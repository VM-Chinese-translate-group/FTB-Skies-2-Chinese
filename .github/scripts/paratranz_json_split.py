import json
import re
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

CONFIG_PATH = Path(".github/configs/modpack.json")


@dataclass(frozen=True)
class JsonSplitConfig:
    path: PurePosixPath
    group_patterns: tuple[str, ...]
    fallback_group: str

    @property
    def remote_dir(self) -> PurePosixPath:
        return self.path.with_suffix("")


@dataclass(frozen=True)
class PathRedirect:
    source: PurePosixPath
    target: PurePosixPath


@dataclass(frozen=True)
class UploadFile:
    local_path: Path
    remote_path: PurePosixPath


def _relative_path(value: object, field: str) -> PurePosixPath:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} must be a non-empty relative path.")
    path = PurePosixPath(value.replace("\\", "/"))
    if (
        path.is_absolute()
        or not path.parts
        or ".." in path.parts
        or ":" in path.parts[0]
    ):
        raise ValueError(f"{field} must stay inside its configured root.")
    return path


def _group_name(value: object, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} must be a non-empty file stem.")
    value = value.strip()
    reserved_names = {"CON", "PRN", "AUX", "NUL"} | {
        f"{prefix}{number}" for prefix in ("COM", "LPT") for number in range(1, 10)
    }
    if (
        value in {".", ".."}
        or value[-1] in ". "
        or re.search(r'[<>:"/\\|?*\x00-\x1f]', value)
        or value.split(".", 1)[0].upper() in reserved_names
    ):
        raise ValueError(f"{field} must be a single portable file stem.")
    return value


def load_paratranz_config(
    config_path: Path = CONFIG_PATH,
) -> tuple[list[JsonSplitConfig], list[PathRedirect]]:
    if not config_path.exists():
        return [], []

    with config_path.open("r", encoding="utf-8") as file:
        root = json.load(file)
    if not isinstance(root, dict):
        raise ValueError("modpack configuration must be a JSON object.")
    paratranz = root.get("paratranz", {})
    if not isinstance(paratranz, dict):
        raise ValueError("paratranz must be a JSON object.")

    split_entries = paratranz.get("jsonSplits", [])
    redirect_entries = paratranz.get("pathRedirects", [])
    if not isinstance(split_entries, list) or not isinstance(redirect_entries, list):
        raise ValueError("paratranz jsonSplits and pathRedirects must be arrays.")

    splits = []
    seen_paths = set()
    for index, entry in enumerate(split_entries):
        field = f"paratranz.jsonSplits[{index}]"
        if not isinstance(entry, dict):
            raise ValueError(f"{field} must be a JSON object.")
        path = _relative_path(entry.get("path"), f"{field}.path")
        if path.suffix.lower() != ".json":
            raise ValueError(f"{field}.path must point to a JSON file.")
        if path in seen_paths:
            raise ValueError(f"Duplicate JSON split path: {path.as_posix()}")
        seen_paths.add(path)

        patterns = entry.get("groupPatterns")
        if not isinstance(patterns, list) or not patterns:
            raise ValueError(f"{field}.groupPatterns must be a non-empty array.")
        checked_patterns = []
        for pattern_index, pattern in enumerate(patterns):
            pattern_field = f"{field}.groupPatterns[{pattern_index}]"
            if not isinstance(pattern, str) or not pattern:
                raise ValueError(f"{pattern_field} must be a non-empty regex.")
            try:
                compiled = re.compile(pattern)
            except re.error as error:
                raise ValueError(
                    f"Invalid regex in {pattern_field}: {error}"
                ) from error
            if compiled.groups < 1:
                raise ValueError(f"{pattern_field} must contain a capture group.")
            checked_patterns.append(pattern)

        fallback = _group_name(
            entry.get("fallbackGroup", "general"), f"{field}.fallbackGroup"
        )
        splits.append(JsonSplitConfig(path, tuple(checked_patterns), fallback))

    redirects = []
    for index, entry in enumerate(redirect_entries):
        field = f"paratranz.pathRedirects[{index}]"
        if not isinstance(entry, dict):
            raise ValueError(f"{field} must be a JSON object.")
        redirects.append(
            PathRedirect(
                _relative_path(entry.get("from"), f"{field}.from"),
                _relative_path(entry.get("to"), f"{field}.to"),
            )
        )
    return splits, redirects


def _split_group(key: str, config: JsonSplitConfig) -> str:
    for pattern in config.group_patterns:
        match = re.search(pattern, key)
        if match:
            captured = match.group(1)
            if captured is None:
                continue
            return _group_name(captured, f"group captured from key {key!r}")
    return config.fallback_group


def split_json_data(
    source_data: dict[str, object], config: JsonSplitConfig
) -> dict[str, dict[str, object]]:
    groups: dict[str, dict[str, object]] = {}
    portable_names = {}
    for key, value in source_data.items():
        if not isinstance(key, str):
            raise ValueError("JSON language file keys must be strings.")
        group = _split_group(key, config)
        existing_name = portable_names.setdefault(group.casefold(), group)
        if existing_name != group:
            raise ValueError(
                f"Split groups differ only by letter case: {existing_name}, {group}"
            )
        groups.setdefault(group, {})[key] = value
    return groups


def create_split_uploads(
    source_root: Path, config: JsonSplitConfig, temporary_root: Path
) -> list[UploadFile]:
    source_file = source_root / Path(*config.path.parts)
    with source_file.open("r", encoding="utf-8") as file:
        source_data = json.load(file)
    if not isinstance(source_data, dict):
        raise ValueError(f"JSON language file must contain an object: {source_file}")

    groups = split_json_data(source_data, config)
    if not groups:
        groups[config.fallback_group] = {}

    uploads = []
    for group, content in groups.items():
        remote_path = config.remote_dir / f"{group}.json"
        local_path = temporary_root / Path(*remote_path.parts)
        local_path.parent.mkdir(parents=True, exist_ok=True)
        with local_path.open("w", encoding="utf-8") as file:
            json.dump(content, file, ensure_ascii=False, indent=4)
            file.write("\n")
        uploads.append(UploadFile(local_path, remote_path))
    return uploads


def split_for_remote_path(
    path: PurePosixPath, configs: list[JsonSplitConfig]
) -> JsonSplitConfig | None:
    for config in configs:
        if path.parent == config.remote_dir and path.suffix.lower() == ".json":
            return config
    return None


def is_legacy_split_source(path: PurePosixPath, configs: list[JsonSplitConfig]) -> bool:
    return any(path == config.path for config in configs)


def merge_split_translations(
    source_root: Path,
    config: JsonSplitConfig,
    translated_parts: list[dict[str, str]],
) -> dict[str, str]:
    source_file = source_root / Path(*config.path.parts)
    with source_file.open("r", encoding="utf-8") as file:
        source_data = json.load(file)
    if not isinstance(source_data, dict):
        raise ValueError(f"JSON language file must contain an object: {source_file}")

    translations = {}
    for part in translated_parts:
        for key, value in part.items():
            if key not in source_data:
                raise ValueError(f"Split translation contains an unknown key: {key}")
            if key in translations:
                raise ValueError(f"Split translation contains a duplicate key: {key}")
            translations[key] = value

    missing = [key for key in source_data if key not in translations]
    if missing:
        preview = ", ".join(missing[:5])
        raise ValueError(
            f"Split translation is missing {len(missing)} source keys: {preview}"
        )
    return {key: translations[key] for key in source_data}


def redirect_path(path: PurePosixPath, redirects: list[PathRedirect]) -> PurePosixPath:
    for redirect in redirects:
        prefix_length = len(redirect.source.parts)
        if path.parts[:prefix_length] == redirect.source.parts:
            return redirect.target.joinpath(*path.parts[prefix_length:])
    return path
