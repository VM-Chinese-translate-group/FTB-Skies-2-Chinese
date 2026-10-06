"""Synchronize patch metadata with the adjacent modpackinfo.json."""

import argparse
import json
from pathlib import Path


def write_if_changed(path, data):
    content = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    if not path.exists() or path.read_text(encoding="utf-8") != content:
        path.write_text(content, encoding="utf-8", newline="\n")


def sync_pack_info(info_file_path, version=None):
    """Keep patch-only fields; derive shared metadata from modpack info."""
    info_file_path = Path(info_file_path)
    patch_file_path = info_file_path.with_name("patchpackinfo.json")
    data = json.loads(info_file_path.read_text(encoding="utf-8"))
    modpack = data["modpack"]
    version = modpack["version"] if version is None else version
    for field, value in (("name", modpack.get("name")), ("version", version)):
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"modpack.{field} must be a non-empty string")

    patch = (
        json.loads(patch_file_path.read_text(encoding="utf-8"))
        if patch_file_path.exists()
        else {}
    )
    if not isinstance(patch, dict):
        raise ValueError("patchpackinfo.json must contain a JSON object")
    modpack["version"] = version
    translation = modpack.setdefault("translation", {})
    translation["version"] = version

    patch["formatVersion"] = 1
    if not patch.get("name"):
        patch["name"] = f'{modpack["name"]}简中汉化'
    patch["modpack"] = {
        "name": modpack["name"],
        "versionRange": f"[{version},)",
    }
    # The translation URL points to the patch release page.
    if "url" in translation:
        patch["url"] = translation["url"]
    else:
        patch.pop("url", None)
    for field in ("description", "authors"):
        if field in modpack:
            patch[field] = modpack[field]
    patch.setdefault("authors", ["VM汉化组"])

    write_if_changed(info_file_path, data)
    write_if_changed(patch_file_path, patch)
    return patch_file_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("info_file_path", nargs="?", default="CNPack/modpackinfo.json")
    args = parser.parse_args()
    sync_pack_info(args.info_file_path)
