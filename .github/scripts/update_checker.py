import os
import sys
import json
import subprocess
import zipfile
import shutil
import filecmp
from pathlib import Path


def run_command(command):
    """Executes a command and raises an exception on failure."""
    print(f"Executing: {' '.join(command)}")
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        print(f"Error executing command: {result.stderr}", file=sys.stderr)
        raise RuntimeError(f"Command failed with stderr: {result.stderr}")
    return result.stdout.strip()


def set_github_output(name, value):
    """Sets an output variable for GitHub Actions."""
    if 'GITHUB_OUTPUT' in os.environ:
        with open(os.environ['GITHUB_OUTPUT'], 'a') as f:
            f.write(f'{name}={value}\n')
    else:
        print(f"::set-output name={name}::{value}")


def get_file_hash(filepath):
    """Computes SHA256 hash of a file."""
    import hashlib
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(4096), b""): h.update(chunk)
    return h.hexdigest()


def compare_folders(dcmp, added_files, deleted_files, changed_files):
    for name in dcmp.right_only: added_files.add(Path(dcmp.right) / name)
    for name in dcmp.left_only: deleted_files.add(Path(dcmp.left) / name)
    for name in dcmp.diff_files: changed_files.add(Path(dcmp.right) / name)
    for sub_dcmp in dcmp.subdirs.values(): compare_folders(sub_dcmp, added_files, deleted_files, changed_files)


def generate_pr_body(pack_name, new_version, updated, added, deleted, source_root, new_root):
    def simplify_paths(path_set, root_to_strip):
        if not path_set: return set()
        sorted_paths = sorted([Path(p) for p in path_set])
        simplified = set()
        if not sorted_paths: return set()

        last_added = Path('.')
        for current_path in sorted_paths:
            try:
                if last_added == Path('.'):
                    simplified.add(current_path)
                    last_added = current_path
                    continue
                current_path.relative_to(last_added)
            except ValueError:
                simplified.add(current_path)
                last_added = current_path
        return {str(p.relative_to(root_to_strip)) for p in simplified}

    body = f"## 自动更新：{pack_name} v{new_version}\n\n此 PR 由机器人自动创建，检测到整合包源文件发生以下变更：\n\n"
    if updated: body += "### 📝 内容更新的文件\n" + "".join(
        f"- `{f}`\n" for f in sorted([str(p) for p in updated])) + "\n"
    if added: body += "### ✨ 新增的文件/文件夹\n" + "".join(
        f"- `{f}`\n" for f in sorted(list(simplify_paths(added, new_root)))) + "\n"
    if deleted: body += "### 🗑️ 被删除的文件/文件夹\n" + "".join(
        f"- `{f}`\n" for f in sorted(list(simplify_paths(deleted, source_root)))) + "\n"
    body += "\n---\n*详细的版本间差异报告将在稍后以评论形式发布。*"
    return body

def apply_exclusion_rules(file_set, exclusion_patterns, root_path):
    """
    Filters a set of file paths based on an ordered list of exclusion patterns.
    The last matching pattern in the list wins.
    """
    if not exclusion_patterns:
        return file_set

    kept_files = set()
    for file_path in file_set:
        relative_path = file_path.relative_to(root_path)
        is_excluded = False  # Default to include

        # Iterate through patterns in the specified order
        for pattern in exclusion_patterns:
            is_negation = pattern.startswith('!')
            match_pattern = pattern[1:] if is_negation else pattern
            
            if relative_path.match(match_pattern):
                # If it's a negation, it should be included (not excluded)
                # If it's a regular pattern, it should be excluded
                is_excluded = not is_negation
        
        if not is_excluded:
            kept_files.add(file_path)
            
    return kept_files


# --- Main Logic ---

def main():
    repo_root = Path('.')
    config_path = repo_root / '.github' / 'configs' / 'modpack.json'
    with open(config_path, 'r', encoding='utf-8') as f:
        config = json.load(f)

    pack_id, pack_name = config['packId'], config['packName']
    info_file_path = repo_root / config['infoFilePath']
    source_dir = repo_root / config['sourceDir']
    attention_list = config.get('attentionList', {})
    exclusion_patterns = config.get('exclusionPatterns', [])

    with open(info_file_path, 'r', encoding='utf-8') as f:
        local_version_name = json.load(f)['modpack']['version']

    print(f"Checking updates for: {pack_name} (ID: {pack_id})\nLocal version: {local_version_name}")

    inspect_output = run_command(['./CurseTheBeast', 'inspect', str(pack_id)])

    versions_map = {}
    for line in inspect_output.splitlines():
        if 'release' in line and line.count('│') > 2:
            parts = [p.strip() for p in line.split('│')]
            version_id, version_name = parts[1], parts[2]
            versions_map[version_name] = version_id

    if not versions_map:
        sys.exit("Error: Could not parse any release versions from inspect output.")

    latest_version_name = next(iter(versions_map))  # First entry is the latest
    latest_version_id = versions_map[latest_version_name]

    if local_version_name == latest_version_name:
        print("Already up to date. Exiting.")
        return

    local_version_id = versions_map.get(local_version_name)
    if not local_version_id:
        print(
            f"Warning: Could not find version ID for local version '{local_version_name}'. Diff report will not be generated.")
        # We can still proceed with the update, just can't generate a diff.

    print(f"New version found: {latest_version_name} (ID: {latest_version_id})")
    print(f"Old version: {local_version_name} (ID: {local_version_id})")

    print(f"Downloading LATEST version ({latest_version_name}) for file update...")
    temp_root = repo_root / 'temp_update'
    shutil.rmtree(temp_root, ignore_errors=True)
    extract_dir = temp_root / 'extracted'
    os.makedirs(extract_dir, exist_ok=True)
    run_command(
        ['./CurseTheBeast', 'download', str(pack_id), latest_version_id, '--output', str(temp_root / f"{pack_id}.zip")])
    with zipfile.ZipFile(temp_root / f"{pack_id}.zip", 'r') as z:
        z.extractall(extract_dir)
    new_source_root = extract_dir / 'overrides'
    if not new_source_root.exists(): sys.exit("Error: 'overrides' directory not found.")

    updated_files, added_files, deleted_files = set(), set(), set()
    # (The comparison loops for filePatterns and folders are unchanged)
    for item in attention_list.get('filePatterns', []):
        pattern = item['pattern'];
        ignore_deletions = item.get('ignoreDeletions', False)
        old_matches = set(source_dir.glob(pattern));
        new_matches = set(new_source_root.glob(pattern))
        relative_paths_from_old = {p.relative_to(source_dir) for p in old_matches}
        relative_paths_from_new = {p.relative_to(new_source_root) for p in new_matches}
        for rel_path in relative_paths_from_old.union(relative_paths_from_new):
            old_f, new_f = source_dir / rel_path, new_source_root / rel_path
            if not new_f.exists():
                if not ignore_deletions: deleted_files.add(old_f)
            elif not old_f.exists():
                added_files.add(new_f)
            elif get_file_hash(old_f) != get_file_hash(new_f):
                updated_files.add(new_f)
    for item in attention_list.get('folders', []):
        folder_rel_str = item['path'];
        ignore_deletions = item.get('ignoreDeletions', False)
        old_d, new_d = source_dir / folder_rel_str, new_source_root / folder_rel_str
        if not new_d.exists():
            if old_d.exists() and not ignore_deletions: deleted_files.add(old_d)
            continue
        if not old_d.exists(): added_files.add(new_d); continue
        dcmp = filecmp.dircmp(str(old_d), str(new_d), ignore=['.DS_Store'])
        f_add, f_del, f_change = set(), set(), set()
        compare_folders(dcmp, f_add, f_del, f_change)
        added_files.update(f_add);
        updated_files.update(f_change)
        if not ignore_deletions: deleted_files.update(f_del)

    added_files = apply_exclusion_rules(added_files, exclusion_patterns, new_source_root)
    updated_files = apply_exclusion_rules(updated_files, exclusion_patterns, new_source_root)

    if not any([updated_files, added_files, deleted_files]):
        print("Version updated, but no effective changes detected. Exiting.")
        return

    # (File application logic is unchanged)
    for item in sorted(list(deleted_files), key=lambda p: len(p.parts), reverse=True): shutil.rmtree(
        item) if item.is_dir() else item.unlink()
    all_to_copy = sorted(list(updated_files.union(added_files)))
    for item in all_to_copy:
        dest = source_dir / item.relative_to(new_source_root)
        dest.parent.mkdir(parents=True, exist_ok=True)
        if item.is_dir():
            shutil.copytree(item, dest, dirs_exist_ok=True)
        else:
            shutil.copy2(item, dest)

    with open(info_file_path, "r+", encoding="utf-8") as f:
        data = json.load(f)
        data['modpack']['version'] = latest_version_name
        f.seek(0);
        json.dump(data, f, indent=2, ensure_ascii=False);
        f.truncate()

    pr_body = generate_pr_body(pack_name, latest_version_name, {f.relative_to(new_source_root) for f in updated_files},
                               added_files, deleted_files, source_dir, new_source_root)
    (repo_root / "pr_body.md").write_text(pr_body, encoding='utf-8')

    set_github_output("changes_detected", "true")
    set_github_output("pack_name", pack_name)
    set_github_output("new_version", latest_version_name)
    set_github_output("local_version_id", local_version_id or "")  # Pass empty string if not found
    set_github_output("new_version_id", latest_version_id or "")
    set_github_output("info_file_path", str(info_file_path.relative_to(repo_root)))
    set_github_output("source_dir", str(config['sourceDir']))

    shutil.rmtree(temp_root, ignore_errors=True)
    print("Script finished successfully.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        sys.exit(f"An unexpected error occurred: {e}")