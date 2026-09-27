import os
import sys
import json
import zipfile
import shutil
import requests
import re
import subprocess
import uuid
from pathlib import Path, PurePosixPath

from sync_pack_info import sync_pack_info


REQUEST_TIMEOUT = (10, 120)


def set_github_output(name, value):
    """Sets an output variable for GitHub Actions."""
    if "GITHUB_OUTPUT" in os.environ:
        delimiter = f"ghadelimiter_{uuid.uuid4().hex}"
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            f.write(f"{name}<<{delimiter}\n{value}\n{delimiter}\n")
    else:
        # Fallback for local testing
        print(f"{name}={value}")


def run_command(command):
    """Runs a shell command and returns its stdout, raising an error on failure."""
    print(f"Running command: {' '.join(command)}")
    try:
        result = subprocess.run(
            command, capture_output=True, text=True, check=True, encoding="utf-8"
        )
        print(result.stdout)
        if result.stderr:
            print(f"Stderr: {result.stderr}", file=sys.stderr)
        return result.stdout
    except FileNotFoundError:
        raise RuntimeError(
            f"Command not found: {command[0]}. Is CurseTheBeast installed and in the PATH?"
        )
    except subprocess.CalledProcessError as e:
        raise RuntimeError(
            f"Command failed with exit code {e.returncode}:\nStdout: {e.stdout}\nStderr: {e.stderr}"
        )


def get_file_hash(filepath):
    """Computes SHA256 hash of a file."""
    import hashlib

    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            h.update(chunk)
    return h.hexdigest()


def resolve_repo_path(repo_root, configured_path, field_name):
    """Resolves a configured relative path while keeping it inside the repo."""
    if not isinstance(configured_path, str) or not configured_path.strip():
        raise ValueError(f"Config field '{field_name}' must be a non-empty path.")
    raw_path = Path(configured_path)
    if raw_path.is_absolute() or ".." in raw_path.parts:
        raise ValueError(f"Config field '{field_name}' must stay inside the repository.")
    resolved = (Path(repo_root).resolve() / raw_path).resolve()
    if not resolved.is_relative_to(Path(repo_root).resolve()):
        raise ValueError(f"Config field '{field_name}' must stay inside the repository.")
    return resolved


def validate_scoped_path(configured_path, field_name):
    """Validates a relative folder path or glob that must stay below its root."""
    if not isinstance(configured_path, str) or not configured_path.strip():
        raise ValueError(f"Config field '{field_name}' must be a non-empty path.")
    normalized = PurePosixPath(configured_path.replace("\\", "/"))
    if (
        normalized.is_absolute()
        or not normalized.parts
        or ".." in normalized.parts
        or ":" in normalized.parts[0]
    ):
        raise ValueError(f"Config field '{field_name}' must stay inside its root.")
    return normalized.as_posix()


def download_file(url, dest_path):
    """Downloads a file from a URL to a destination path."""
    print(f"Downloading from {url} to {dest_path}...")
    try:
        with requests.get(url, stream=True, timeout=REQUEST_TIMEOUT) as r:
            r.raise_for_status()
            with open(dest_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Failed to download file: {e}")


def extract_clean_version(full_name, pattern):
    """
    Extracts a clean version string from a full name using a pattern.
    Example: "Techopolis 3-7.0" with pattern "Techopolis 3-{version}" -> "7.0"
    """
    if not pattern:
        return full_name
    if pattern.count("{version}") != 1:
        raise ValueError(
            "versionPattern must contain exactly one '{version}' placeholder."
        )

    prefix, suffix = pattern.split("{version}")
    regex_pattern = f"{re.escape(prefix)}(.*){re.escape(suffix)}"
    match = re.fullmatch(regex_pattern, full_name)
    if not match:
        raise ValueError(
            f"CurseForge file name '{full_name}' does not match versionPattern "
            f"'{pattern}'. Update versionPattern to match the file name exactly."
        )

    clean_version = match.group(1).strip()
    if not clean_version:
        raise ValueError(
            f"CurseForge file name '{full_name}' produced an empty version using "
            f"versionPattern '{pattern}'."
        )
    return clean_version


def reconstruct_full_name(clean_version, pattern):
    """
    Reconstructs the full display name from a clean version and a pattern.
    Example: "7.0" with pattern "Techopolis 3-{version}" -> "Techopolis 3-7.0"
    """
    if not pattern or "{version}" not in pattern:
        return clean_version
    return pattern.replace("{version}", clean_version)


def safe_extract_zip(archive_path, destination):
    """Extracts a ZIP archive without allowing members to escape destination."""
    destination = Path(destination).resolve()
    destination.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(archive_path, "r") as archive:
        for member in archive.infolist():
            member_path = PurePosixPath(member.filename.replace("\\", "/"))
            if member_path.is_absolute() or ".." in member_path.parts:
                raise ValueError(f"Unsafe path in ZIP archive: {member.filename}")

            target = (destination / Path(*member_path.parts)).resolve()
            if not target.is_relative_to(destination):
                raise ValueError(f"Unsafe path in ZIP archive: {member.filename}")

        archive.extractall(destination)


def compare_file_trees(old_root, new_root):
    """Returns changed, added, and deleted files below two directory roots."""
    old_root = Path(old_root)
    new_root = Path(new_root)
    old_files = (
        {
            path.relative_to(old_root)
            for path in old_root.rglob("*")
            if path.is_file() and path.name != ".DS_Store"
        }
        if old_root.is_dir()
        else set()
    )
    new_files = (
        {
            path.relative_to(new_root)
            for path in new_root.rglob("*")
            if path.is_file() and path.name != ".DS_Store"
        }
        if new_root.is_dir()
        else set()
    )

    added_files = {new_root / path for path in new_files - old_files}
    deleted_files = {old_root / path for path in old_files - new_files}
    updated_files = {
        new_root / path
        for path in old_files & new_files
        if get_file_hash(old_root / path) != get_file_hash(new_root / path)
    }
    return updated_files, added_files, deleted_files


def generate_pr_body(
    pack_name, new_version, updated, added, deleted, source_root, new_root
):
    def simplify_paths(path_set, root_to_strip):
        if not path_set:
            return set()
        sorted_paths = sorted([Path(p) for p in path_set])
        simplified = set()
        if not sorted_paths:
            return set()
        last_added = Path(".")
        for current_path in sorted_paths:
            try:
                if last_added == Path("."):
                    simplified.add(current_path)
                    last_added = current_path
                    continue
                current_path.relative_to(last_added)
            except ValueError:
                simplified.add(current_path)
                last_added = current_path
        return {str(p.relative_to(root_to_strip)) for p in simplified}

    body = f"## 自动更新：{pack_name} v{new_version}\n\n此 PR 由机器人自动创建，检测到整合包源文件发生以下变更：\n\n"
    if updated:
        body += (
            "### 📝 内容更新的文件\n"
            + "".join(f"- `{f}`\n" for f in sorted([str(p) for p in updated]))
            + "\n"
        )
    if added:
        body += (
            "### ✨ 新增的文件/文件夹\n"
            + "".join(
                f"- `{f}`\n" for f in sorted(list(simplify_paths(added, new_root)))
            )
            + "\n"
        )
    if deleted:
        body += (
            "### 🗑️ 被删除的文件/文件夹\n"
            + "".join(
                f"- `{f}`\n" for f in sorted(list(simplify_paths(deleted, source_root)))
            )
            + "\n"
        )
    body += "\n---\n*详细的版本间差异报告将在稍后以评论形式发布。*"
    return body


def apply_exclusion_rules(file_set, exclusion_patterns, root_path):
    if not exclusion_patterns:
        return file_set
    kept_files = set()
    for file_path in file_set:
        relative_path = file_path.relative_to(root_path)
        is_excluded = False
        for pattern in exclusion_patterns:
            is_negation = pattern.startswith("!")
            match_pattern = pattern[1:] if is_negation else pattern
            if relative_path.match(match_pattern):
                is_excluded = not is_negation
        if not is_excluded:
            kept_files.add(file_path)
    return kept_files


def collect_changes(source_dir, new_source_root, attention_list, exclusion_patterns):
    """Collects effective source changes according to attention and exclusion rules."""
    source_dir = Path(source_dir)
    new_source_root = Path(new_source_root)
    updated_files, added_files, deleted_files = set(), set(), set()
    file_patterns = attention_list.get("filePatterns", [])
    folders = attention_list.get("folders", [])

    if not file_patterns and not folders:
        updated_files, added_files, deleted_files = compare_file_trees(
            source_dir, new_source_root
        )
    else:
        for item in file_patterns:
            pattern = validate_scoped_path(item["pattern"], "attentionList.filePatterns")
            ignore_deletions = item.get("ignoreDeletions", False)
            old_matches = {path for path in source_dir.glob(pattern) if path.is_file()}
            new_matches = {
                path for path in new_source_root.glob(pattern) if path.is_file()
            }
            old_relative = {path.relative_to(source_dir) for path in old_matches}
            new_relative = {
                path.relative_to(new_source_root) for path in new_matches
            }

            for relative_path in old_relative | new_relative:
                old_file = source_dir / relative_path
                new_file = new_source_root / relative_path
                if relative_path not in new_relative:
                    if not ignore_deletions:
                        deleted_files.add(old_file)
                elif relative_path not in old_relative:
                    added_files.add(new_file)
                elif get_file_hash(old_file) != get_file_hash(new_file):
                    updated_files.add(new_file)

        for item in folders:
            folder_path = validate_scoped_path(item["path"], "attentionList.folders")
            ignore_deletions = item.get("ignoreDeletions", False)
            changed, added, deleted = compare_file_trees(
                source_dir / folder_path, new_source_root / folder_path
            )
            updated_files.update(changed)
            added_files.update(added)
            if not ignore_deletions:
                deleted_files.update(deleted)

    updated_files = apply_exclusion_rules(
        updated_files, exclusion_patterns, new_source_root
    )
    added_files = apply_exclusion_rules(
        added_files, exclusion_patterns, new_source_root
    )
    deleted_files = apply_exclusion_rules(
        deleted_files, exclusion_patterns, source_dir
    )
    return updated_files, added_files, deleted_files


def main():
    # --- Configuration and Setup ---
    api_key = (os.getenv("CF_API_KEY") or "").strip()

    repo_root = Path(".").resolve()
    config_path = repo_root / ".github" / "configs" / "modpack.json"
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    if config.get("configured", True) is not True:
        sys.exit(
            "Error: .github/configs/modpack.json is still a template. "
            "Complete the configuration and set 'configured' to true."
        )

    pack_id, pack_name = config["packId"], config["packName"]
    update_method = config.get("updateMethod", "api")
    if not isinstance(pack_id, int) or pack_id < 1:
        sys.exit("Error: config field 'packId' must be a positive integer.")
    if not isinstance(pack_name, str) or not pack_name.strip():
        sys.exit("Error: config field 'packName' must be a non-empty string.")
    if update_method not in {"api", "cursethebeast"}:
        sys.exit("Error: config field 'updateMethod' must be 'api' or 'cursethebeast'.")
    version_pattern = config.get("versionPattern")
    info_file_path = resolve_repo_path(
        repo_root, config["infoFilePath"], "infoFilePath"
    )
    source_dir = resolve_repo_path(repo_root, config["sourceDir"], "sourceDir")
    attention_list = config.get("attentionList", {})
    exclusion_patterns = config.get("exclusionPatterns", [])

    with open(info_file_path, "r", encoding="utf-8") as f:
        local_clean_version = json.load(f)["modpack"]["version"]

    print(
        f"Checking updates for: {pack_name} (ID: {pack_id})\nLocal version: {local_clean_version}"
    )
    print(f"Using update method: {update_method}")

    set_github_output("old_version", local_clean_version)

    latest_clean_version = None
    local_version_id = None
    latest_version_id = None
    latest_download_url = None  # Specific to 'api' method

    if update_method == "cursethebeast":
        inspect_output = run_command(["./CurseTheBeast", "inspect", str(pack_id)])
        versions_map = {}
        for line in inspect_output.splitlines():
            if "release" in line and line.count("│") > 2:
                parts = [p.strip() for p in line.split("│")]
                if len(parts) > 3 and parts[1] != "ID":  # Skip header
                    version_id, version_name = parts[1], parts[2]
                    versions_map[version_name] = version_id

        if not versions_map:
            sys.exit(
                "Error: Could not parse any release versions from CurseTheBeast inspect output."
            )

        latest_clean_version = next(iter(versions_map))
        latest_version_id = versions_map[latest_clean_version]

        if local_clean_version == latest_clean_version:
            print("Already up to date. Exiting.")
            return

        local_version_id = versions_map.get(local_clean_version)
        if not local_version_id:
            print(
                f"Warning: Could not find version ID for local version '{local_clean_version}'. Diff report will not be generated."
            )

        print(f"New version found: {latest_clean_version} (ID: {latest_version_id})")
        print(f"Old version: {local_clean_version} (ID: {local_version_id})")

    else:  # Default to 'api' method
        if not api_key:
            sys.exit(
                "Error: CurseForge API key (CF_API_KEY) not found. Required for 'api' update method."
            )

        headers = {"Accept": "application/json", "x-api-key": api_key}
        api_url = f"https://api.curseforge.com/v1/mods/{pack_id}/files?pageSize=50"
        try:
            response = requests.get(api_url, headers=headers, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            files_data = response.json()["data"]
        except requests.exceptions.HTTPError as e:
            status_code = e.response.status_code if e.response is not None else None
            if status_code in (401, 403):
                sys.exit(
                    f"Error: CurseForge API rejected CF_API_KEY (HTTP {status_code}). "
                    "The current REST API still uses the /v1 endpoint and x-api-key "
                    "header. Generate or verify an authorized key using the official "
                    "instructions at https://docs.curseforge.com/rest-api/ (third-party "
                    "services must apply for API access), then save the raw key (without "
                    "quotes) as the CF_API_KEY secret in the PARATRANZ_ENV environment."
                )
            if status_code == 429:
                sys.exit(
                    "Error: CurseForge API rate limit exceeded (HTTP 429). "
                    "Wait before rerunning the workflow."
                )
            sys.exit(f"Error fetching data from CurseForge API: {e}")
        except requests.exceptions.RequestException as e:
            sys.exit(f"Error fetching data from CurseForge API: {e}")
        except (KeyError, IndexError):
            sys.exit(
                f"Error: Unexpected API response format. Response: {response.text}"
            )

        if not files_data:
            sys.exit("Error: API returned no files for this modpack.")

        local_full_name = reconstruct_full_name(local_clean_version, version_pattern)

        latest_file_info = files_data[0]
        latest_full_name = latest_file_info["displayName"].removesuffix(".zip")
        latest_version_id = latest_file_info["id"]
        latest_download_url = latest_file_info["downloadUrl"]

        try:
            latest_clean_version = extract_clean_version(
                latest_full_name, version_pattern
            )
        except ValueError as e:
            sys.exit(f"Error: {e}")

        if local_clean_version == latest_clean_version:
            print("Already up to date. Exiting.")
            return

        def normalize_name(name):
            return name.lower().replace(" ", "-").removesuffix(".zip")

        versions_map = {normalize_name(f["displayName"]): f["id"] for f in files_data}
        normalized_local_name = normalize_name(local_full_name)
        local_version_id = versions_map.get(normalized_local_name)

        if not local_version_id:
            fileName_map = {normalize_name(f["fileName"]): f["id"] for f in files_data}
            local_version_id = fileName_map.get(normalized_local_name)

        if not local_version_id:
            print(
                f"Warning: Could not find version ID for local version '{local_full_name}'. Diff report will not be generated."
            )

        print(
            f"New version found: {latest_clean_version} (Full name: {latest_full_name}, ID: {latest_version_id})"
        )
        print(
            f"Old version: {local_clean_version} (Full name: {local_full_name}, ID: {local_version_id})"
        )

    # --- Download and Extract New Version ---
    temp_root = repo_root / "temp_update"
    shutil.rmtree(temp_root, ignore_errors=True)
    extract_dir = temp_root / "extracted"
    os.makedirs(extract_dir, exist_ok=True)
    zip_path = temp_root / f"{pack_id}.zip"

    if update_method == "cursethebeast":
        print(
            f"Downloading LATEST version ({latest_clean_version}) using CurseTheBeast..."
        )
        run_command(
            [
                "./CurseTheBeast",
                "download",
                str(pack_id),
                str(latest_version_id),
                "--output",
                str(zip_path),
            ]
        )
    else:  # api
        print(f"Downloading LATEST version ({latest_clean_version})...")
        download_file(latest_download_url, zip_path)

    safe_extract_zip(zip_path, extract_dir)
    new_source_root = extract_dir / "overrides"
    if not new_source_root.exists():
        sys.exit("Error: 'overrides' directory not found in the downloaded archive.")

    # --- Compare files and detect changes---
    updated_files, added_files, deleted_files = collect_changes(
        source_dir, new_source_root, attention_list, exclusion_patterns
    )

    if not any([updated_files, added_files, deleted_files]):
        print(
            "Version updated, but no effective changes detected after applying rules. Exiting."
        )
        return

    # --- Apply changes to the repository ---
    for item in sorted(list(deleted_files), key=lambda p: len(p.parts), reverse=True):
        shutil.rmtree(item) if item.is_dir() else item.unlink()
    all_to_copy = sorted(list(updated_files.union(added_files)))
    for item in all_to_copy:
        dest = source_dir / item.relative_to(new_source_root)
        dest.parent.mkdir(parents=True, exist_ok=True)
        if item.is_dir():
            shutil.copytree(item, dest, dirs_exist_ok=True)
        else:
            shutil.copy2(item, dest)

    patch_file_path = sync_pack_info(info_file_path, latest_clean_version)

    pr_body = generate_pr_body(
        pack_name,
        latest_clean_version,
        {f.relative_to(new_source_root) for f in updated_files},
        added_files,
        deleted_files,
        source_dir,
        new_source_root,
    )
    (repo_root / "pr_body.md").write_text(pr_body, encoding="utf-8")

    # --- Set outputs for GitHub Actions ---
    set_github_output("changes_detected", "true")
    set_github_output("pack_name", pack_name)
    set_github_output("new_version", latest_clean_version)
    set_github_output("local_version_id", local_version_id or "")
    set_github_output("new_version_id", latest_version_id or "")
    set_github_output("info_file_path", str(info_file_path.relative_to(repo_root)))
    set_github_output("patch_file_path", str(patch_file_path.relative_to(repo_root)))
    set_github_output("source_dir", str(config["sourceDir"]))

    shutil.rmtree(temp_root, ignore_errors=True)
    print("Script finished successfully.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        sys.exit(f"An unexpected error occurred: {e}")
