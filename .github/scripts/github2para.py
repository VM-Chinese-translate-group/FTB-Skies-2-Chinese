import os
from pathlib import Path, PurePosixPath
from tempfile import TemporaryDirectory

import requests
from LangSpliter import split_and_process_all
from paratranz_api import RETRYABLE_STATUS_CODES, ParaTranzClient
from paratranz_json_split import (
    UploadFile,
    create_split_uploads,
    is_legacy_split_source,
    load_paratranz_config,
    split_for_remote_path,
)

SOURCE_DIR = Path("Source")


def index_remote_files(files):
    indexed = {}
    for remote_file in files:
        if not isinstance(remote_file, dict):
            raise RuntimeError("ParaTranz file list contains a non-object item.")
        name = remote_file.get("name")
        file_id = remote_file.get("id")
        if not isinstance(name, str) or not isinstance(file_id, int):
            raise RuntimeError("ParaTranz file list contains an invalid file entry.")
        indexed[name] = remote_file
    return indexed


def is_retryable(error):
    response = getattr(error, "response", None)
    return response is None or response.status_code in RETRYABLE_STATUS_CODES


def upload_file(client, project_id, remote_path, local_file, existing_files):
    file_name = local_file.name
    full_path = f"{remote_path}{file_name}"
    existing_file = existing_files.get(full_path)

    if existing_file:
        client.update_file(project_id, existing_file["id"], local_file)
        print(f"文件已更新：{full_path}")
        return

    for attempt in range(client.max_attempts):
        try:
            client.create_file(project_id, local_file, remote_path)
            print(f"文件已创建：{full_path}")
            return
        except requests.RequestException as error:
            # 创建请求可能已被服务端处理，但响应在网络中丢失。重新获取列表，
            # 避免下一次重试制造同名文件冲突。
            refreshed_files = index_remote_files(client.get_files(project_id))
            recovered_file = refreshed_files.get(full_path)
            if recovered_file:
                existing_files[full_path] = recovered_file
                print(f"文件已创建（通过文件列表确认）：{full_path}")
                return
            if attempt + 1 == client.max_attempts or not is_retryable(error):
                raise
            client.sleep(2**attempt)

    raise RuntimeError(f"上传文件失败：{full_path}")


def get_filelist(directory):
    return sorted(
        path
        for path in Path(directory).rglob("*.json")
        if "en_us" in path.name
    )


def handle_ftb_quests_snbt():
    """Splits an FTB Quests source language file into uploadable JSON files."""
    snbt_file = SOURCE_DIR / "config/ftbquests/quests/lang/en_us.snbt"
    chapters_dir = SOURCE_DIR / "config/ftbquests/quests/chapters"
    chapter_groups_file = SOURCE_DIR / "config/ftbquests/quests/chapter_groups.snbt"
    output_json_dir = SOURCE_DIR / "kubejs/assets/quests/lang"

    if not snbt_file.exists():
        print("未检测到 FTB Quests 的 en_us.snbt 文件，跳过拆分步骤。")
        return

    print(f"检测到 SNBT 文件: {snbt_file}，将进行自动拆分...")
    output_json_dir.mkdir(parents=True, exist_ok=True)
    split_and_process_all(
        source_lang_file=str(snbt_file),
        chapters_dir=str(chapters_dir),
        chapter_groups_file=str(chapter_groups_file),
        output_dir=str(output_json_dir),
        flatten_single_lines=False,
    )
    print("SNBT 文件已成功拆分为 JSON，准备上传。")


def main():
    token = os.getenv("API_TOKEN", "")
    project_id_value = os.getenv("PROJECT_ID", "")
    if not token or not project_id_value:
        raise EnvironmentError("环境变量 API_TOKEN 或 PROJECT_ID 未设置。")
    try:
        project_id = int(project_id_value)
    except ValueError as error:
        raise ValueError("环境变量 PROJECT_ID 必须是整数。") from error

    handle_ftb_quests_snbt()
    split_configs, _ = load_paratranz_config()
    split_sources = {
        SOURCE_DIR / Path(*config.path.parts) for config in split_configs
    }
    files = [path for path in get_filelist(SOURCE_DIR) if path not in split_sources]

    client = ParaTranzClient(token)
    existing_files = index_remote_files(client.get_files(project_id))
    with TemporaryDirectory(prefix="paratranz-json-split-") as temporary_dir:
        uploads = [
            UploadFile(
                local_file,
                PurePosixPath(local_file.relative_to(SOURCE_DIR).as_posix()),
            )
            for local_file in files
        ]
        for config in split_configs:
            uploads.extend(
                create_split_uploads(SOURCE_DIR, config, Path(temporary_dir))
            )
        if not uploads:
            raise FileNotFoundError(
                "在 Source 目录中未找到可上传的英文 JSON 文件，请检查源文件与配置。"
            )

        for upload in uploads:
            remote_parent = upload.remote_path.parent
            remote_directory = (
                ""
                if remote_parent == PurePosixPath(".")
                else f"{remote_parent.as_posix()}/"
            )
            print(
                f"准备上传 {upload.local_path} 到 ParaTranz 路径：'{remote_directory}'"
            )
            upload_file(
                client,
                project_id,
                remote_directory,
                upload.local_path,
                existing_files,
            )

        desired_paths = {upload.remote_path.as_posix() for upload in uploads}
        for remote_name, remote_file in list(existing_files.items()):
            remote_path = PurePosixPath(remote_name.replace("\\", "/"))
            managed = split_for_remote_path(remote_path, split_configs) is not None
            legacy = is_legacy_split_source(remote_path, split_configs)
            if (managed or legacy) and remote_path.as_posix() not in desired_paths:
                client.delete_file(project_id, remote_file["id"])
                print(f"已清理 ParaTranz 旧分片：{remote_name}")


if __name__ == "__main__":
    main()
