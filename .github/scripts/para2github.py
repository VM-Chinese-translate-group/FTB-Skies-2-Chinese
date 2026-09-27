import json
import os
import re
import shutil
import sys
from collections import OrderedDict
from pathlib import Path, PurePosixPath

from LangSpliter import merge_all_to_snbt
from paratranz_api import ParaTranzClient
from paratranz_json_split import (
    is_legacy_split_source,
    load_paratranz_config,
    merge_split_translations,
    redirect_path,
    split_for_remote_path,
)


def translate(
    client: ParaTranzClient, project_id: int, file_id: int
) -> tuple[list[str], list[str]]:
    """
    获取指定文件的翻译内容并返回键值对列表

    :param file_id: 文件ID
    :return: 包含键和值的元组列表
    """
    translations = client.get_file_translation(project_id, file_id)

    keys, values = [], []

    for item in translations:
        keys.append(item["key"])
        translation = item.get("translation", "")
        original = item.get("original", "")
        # 如果阶段是未翻译(0)、已隐藏(-1)，则使用原文
        # 否则（如已翻译、已检查等），即使译文为空也使用译文内容，以保持空翻译
        if item["stage"] in [0, -1]:
            values.append(original)
        else:
            values.append(translation)

    return keys, values


def safe_relative_path(path_str: str) -> Path:
    normalized = PurePosixPath(path_str.replace("\\", "/"))
    if (
        normalized.is_absolute()
        or not normalized.parts
        or ".." in normalized.parts
        or ":" in normalized.parts[0]
    ):
        raise ValueError(f"ParaTranz 返回了不安全的文件路径：{path_str}")
    return Path(*normalized.parts)


def save_translation(
    zh_cn_dict: dict[str, str], path: Path, path_redirects=None
) -> None:
    """
    保存翻译内容到指定的 JSON 文件，并保持与源文件完全相同的格式。
    （已修复 \n 等转义字符被错误解析的问题）

    :param zh_cn_dict: 翻译内容的字典
    :param path: 原始文件路径
    """
    source_relative_path = PurePosixPath(path.as_posix())
    output_relative_path = redirect_path(
        source_relative_path, path_redirects or []
    )
    dir_path = Path("CNPack") / Path(*output_relative_path.parent.parts)
    dir_path.mkdir(parents=True, exist_ok=True)
    zh_cn_filename = output_relative_path.name.replace("en_us", "zh_cn")
    file_path = dir_path / zh_cn_filename
    source_path = Path("Source") / path

    try:
        with open(source_path, "r", encoding="UTF-8") as f1:
            source_content = f1.read()
            source_json = json.loads(source_content, object_pairs_hook=OrderedDict)

        for key, original_value in source_json.items():
            if key in zh_cn_dict:
                translated_value = zh_cn_dict[key]

                original_value_str = json.dumps(original_value, ensure_ascii=False)
                translated_value_str = json.dumps(translated_value, ensure_ascii=False)

                key_pattern = re.escape(json.dumps(key, ensure_ascii=False))
                value_pattern = re.escape(original_value_str)

                pattern = re.compile(f"({key_pattern}\\s*:\\s*){value_pattern}")

                # BUGFIX: 对替换字符串中的反斜杠进行转义。
                # re.sub 会处理替换字符串中的反斜杠，因此我们需要将单个 '\' 变成 '\\'
                # 以确保像 "\\n" 这样的字符串被当作字面量插入，而不是被解析成换行符。
                safe_replacement_value = translated_value_str.replace("\\", "\\\\")

                replacement = f"\\1{safe_replacement_value}"

                source_content, num_replacements = pattern.subn(
                    replacement, source_content, count=1
                )

        with open(file_path, "w", encoding="UTF-8") as f:
            f.write(source_content)

    except (IOError, FileNotFoundError):
        print(f"{source_path} 路径不存在，文件按首字母排序！")
        with open(file_path, "w", encoding="UTF-8") as f:
            json.dump(
                zh_cn_dict,
                f,
                ensure_ascii=False,
                indent=4,
                separators=(",", ":"),
                sort_keys=True,
            )


def is_json_or_serialized_json(value: str) -> bool:
    """
    检测一个字符串是否包含JSON格式的内容。
    
    :param value: 要检测的字符串值（已进行转义符转换）
    :return: 如果是有效的JSON格式则返回True，否则返回False
    """
    value = value.strip()
    if not value:
        return False

    if (value.startswith("{") and value.endswith("}")) or \
       (value.startswith("[") and value.endswith("]")):
        try:
            json.loads(value)
            return True
        except (json.JSONDecodeError, ValueError):
            pass
    
    return False


def process_translation(
    client: ParaTranzClient,
    project_id: int,
    file_id: int,
    path: Path,
    translated_only: bool = False,
) -> dict[str, str]:
    """
    处理单个文件的翻译，返回翻译字典

    :param file_id: 文件ID
    :param path: 文件路径
    :return: 翻译内容字典
    """
    keys, values = translate(client, project_id, file_id)

    source_file_path = Path("Source") / path
    try:
        # 先读取文件内容到字符串，这样即使解析失败，我们也能访问它
        with open(source_file_path, "r", encoding="UTF-8") as f:
            content = f.read()
        zh_cn_dict = json.loads(content)
    except json.JSONDecodeError as e:
        print("---" * 20)
        print(">>> FATAL: JSON 解析失败！")
        print(f">>> 文件: {source_file_path}")
        print(f">>> 错误: {e.msg}")
        print(f">>> 位置: 第 {e.lineno} 行, 第 {e.colno} 列")
        print("---" * 20)
        print("错误发生位置上下文：\n")

        lines = content.splitlines()
        # 计算要显示的行范围（错误行的前后各两行）
        start = max(0, e.lineno - 3)
        end = min(len(lines), e.lineno + 2)

        for i in range(start, end):
            line_num = i + 1
            line_content = lines[i]
            # 在错误行前面加上 '>' 标记
            prefix = f"{line_num:4d}> " if line_num == e.lineno else f"{line_num:4d}| "
            print(f"{prefix}{line_content}")

            # 为错误行添加一个指向错误列的指针 '^'
            if line_num == e.lineno:
                pointer_space = " " * (len(prefix) + e.colno - 1)
                print(f"{pointer_space}^")

        print("\n---" * 20)
        if e.lineno > 1:
            print(
                f"提示: 这个问题通常是由于上一行 (第 {e.lineno - 1} 行) 的末尾缺少了逗号 ',' 导致的。请仔细检查。"
            )
        print("脚本已终止。")
        sys.exit(1)  # 遇到解析错误，直接退出脚本

    except FileNotFoundError:
        print(f"警告: 源文件 {source_file_path} 未找到，将创建一个空的翻译字典。")
        zh_cn_dict = {}
    except IOError as e:
        print(f"错误: 无法读取文件 {source_file_path}: {e}")
        sys.exit(1)

    # 检查路径是否包含quests
    is_quest_file = "quests" in str(path)

    for key, value in zip(keys, values):
        value = re.sub(r'\\"', '"', value)

        contains_json = is_json_or_serialized_json(value)

        if is_quest_file and not contains_json and "image" not in value:
            value = value.replace(" ", "\u00a0")

        zh_cn_dict[key] = value

    if translated_only:
        return {key: zh_cn_dict[key] for key in keys}
    return zh_cn_dict


def main() -> None:
    token = os.getenv("API_TOKEN", "")
    project_id_value = os.getenv("PROJECT_ID", "")
    if not token or not project_id_value:
        raise EnvironmentError("环境变量 API_TOKEN 或 PROJECT_ID 未设置。")
    try:
        project_id = int(project_id_value)
    except ValueError as error:
        raise ValueError("环境变量 PROJECT_ID 必须是整数。") from error

    client = ParaTranzClient(token)
    remote_files = client.get_files(project_id)
    split_configs, path_redirects = load_paratranz_config()
    split_parts = {config: [] for config in split_configs}
    ftb_quests_lang_dir = None  # 用于记录FTB Quests语言文件所在的目录

    for remote_file in remote_files:
        if not isinstance(remote_file, dict):
            raise RuntimeError("ParaTranz 文件列表包含非对象条目。")
        file_id = remote_file.get("id")
        path_str = remote_file.get("name")
        if not isinstance(file_id, int) or not isinstance(path_str, str):
            raise RuntimeError("ParaTranz 文件列表包含无效条目。")
        if "TM" in path_str:  # 跳过 TM 文件
            continue

        remote_path = PurePosixPath(path_str.replace("\\", "/"))
        path = safe_relative_path(path_str)
        split_config = split_for_remote_path(remote_path, split_configs)
        if split_config:
            source_path = Path(*split_config.path.parts)
            split_parts[split_config].append(
                process_translation(
                    client,
                    project_id,
                    file_id,
                    source_path,
                    translated_only=True,
                )
            )
            continue
        if is_legacy_split_source(remote_path, split_configs):
            print(f"忽略已由 JSON 分片配置接管的旧文件：{path_str}")
            continue
        if path.suffix.lower() != ".json" or "en_us" not in path.name:
            print(f"跳过不受支持的 ParaTranz 文件：{path_str}")
            continue
        zh_cn_dict = process_translation(client, project_id, file_id, path)

        save_translation(zh_cn_dict, path, path_redirects)

        # 打印日志时，文件名也相应地从 en_us 变为 zh_cn
        log_path = re.sub("en_us", "zh_cn", path_str)
        print(f"已从Paratranz下载到仓库：{log_path}")

        # 检查是否为 FTB Quests 的语言文件，并记录其输出目录
        if "kubejs/assets/quests/lang/" in path_str and os.path.exists(
            "Source/config/ftbquests/quests/lang/en_us.snbt"
        ):
            ftb_quests_lang_dir = Path("CNPack") / path.parent

    for config, parts in split_parts.items():
        merged = merge_split_translations(Path("Source"), config, parts)
        source_path = Path(*config.path.parts)
        save_translation(merged, source_path, path_redirects)
        print(f"已合并 ParaTranz JSON 分片：{config.path.as_posix()}")

    # 在所有文件处理完毕后，如果检测到了 FTB Quests 文件，则执行合并
    if ftb_quests_lang_dir and ftb_quests_lang_dir.exists():
        print(f"\n检测到 FTB Quests 翻译文件，开始调用 LangSpliter 合并 SNBT 文件...")

        # 定义输入和输出路径
        json_dir = str(ftb_quests_lang_dir)
        output_snbt_file = "CNPack/config/ftbquests/quests/lang/zh_cn.snbt"

        # 新增 chapters 目录的定义
        source_chapters_dir = "Source/config/ftbquests/quests/chapters"
        output_chapters_dir = "CNPack/config/ftbquests/quests/chapters"

        # 直接调用从 LangSpliter 导入的函数，并传入所有必需的参数
        if os.path.isdir(source_chapters_dir):
            print(f"检测到章节目录，将启用 custom_name/lore 更新功能...")
            merge_all_to_snbt(
                json_dir, output_snbt_file, source_chapters_dir, output_chapters_dir
            )
        else:
            print(
                f"未检测到章节目录 {source_chapters_dir}，将禁用 custom_name/lore 更新功能..."
            )

            # 如果源目录不存在，传入空字符串或None来禁用功能
            merge_all_to_snbt(json_dir, output_snbt_file, "", "")

        # 合并完成后，清除已合并的临时JSON文件所在的父目录
        cleanup_dir = ftb_quests_lang_dir.parent

        if cleanup_dir.exists() and cleanup_dir.is_dir():
            try:
                shutil.rmtree(cleanup_dir)
                print(f"已成功清除临时文件夹及其内容：{cleanup_dir}")
            except OSError as e:
                print(f"错误：清除文件夹 {cleanup_dir} 时失败: {e}")
        else:
            print(f"警告：找不到要清理的目录 {cleanup_dir}。")

        print(f"SNBT 合并完成，文件已生成于: {output_snbt_file}")


if __name__ == "__main__":
    main()
