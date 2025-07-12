import json
import os
import re
import shutil
from pathlib import Path
from typing import Tuple
from collections import OrderedDict
import requests
from LangSpliter import merge_all_to_snbt

TOKEN: str = os.getenv("API_TOKEN", "")
GH_TOKEN: str = os.getenv("GH_TOKEN", "")
PROJECT_ID: str = os.getenv("PROJECT_ID", "")
FILE_URL: str = f"https://paratranz.cn/api/projects/{PROJECT_ID}/files/"

if not TOKEN or not PROJECT_ID:
    raise EnvironmentError("环境变量 API_TOKEN 或 PROJECT_ID 未设置。")

# 初始化列表
file_id_list: list[int] = []
file_path_list: list[str] = []


def fetch_json(url: str, headers: dict[str, str]) -> list[dict[str, str]]:
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    return response.json()


def translate(file_id: int) -> Tuple[list[str], list[str]]:
    """
    获取指定文件的翻译内容并返回键值对列表

    :param file_id: 文件ID
    :return: 包含键和值的元组列表
    """
    url = f"https://paratranz.cn/api/projects/{PROJECT_ID}/files/{file_id}/translation"
    headers = {"Authorization": TOKEN, "accept": "*/*"}
    translations = fetch_json(url, headers)

    keys, values = [], []

    for item in translations:
        keys.append(item["key"])
        translation = item.get("translation", "")
        original = item.get("original", "")
        # 优先使用翻译内容，缺失时根据 stage 使用原文
        values.append(
            original if item["stage"] in [0, -1, 2] or not translation else translation
        )

    return keys, values


def get_files() -> None:
    """
    获取项目中的文件列表并提取文件ID和路径
    """
    headers = {"Authorization": TOKEN, "accept": "*/*"}
    files = fetch_json(FILE_URL, headers)

    for file in files:
        file_id_list.append(file["id"])
        file_path_list.append(file["name"])


def save_translation(zh_cn_dict: dict[str, str], path: Path) -> None:
    """
    保存翻译内容到指定的 JSON 文件，并保持与源文件完全相同的格式。

    :param zh_cn_dict: 翻译内容的字典
    :param path: 原始文件路径
    """
    dir_path = Path("CNPack") / path.parent
    dir_path.mkdir(parents=True, exist_ok=True)
    zh_cn_filename = path.name.replace("en_us", "zh_cn")
    file_path = dir_path / zh_cn_filename
    source_path = Path("Source") / path

    try:
        # 1. 将源文件完整读入，以保留所有格式（空行、缩进等）
        with open(source_path, "r", encoding="UTF-8") as f1:
            source_content = f1.read()
            # 2. 使用 OrderedDict 解析，以获取正确的键顺序和原始值
            # object_pairs_hook 会在读取时保留原始的键值对顺序
            source_json = json.loads(source_content, object_pairs_hook=OrderedDict)

        # 3. 遍历源文件的键，以确保替换顺序与源文件一致
        for key, original_value in source_json.items():
            # 仅当该键存在于翻译字典中时才进行替换
            if key in zh_cn_dict:
                translated_value = zh_cn_dict[key]

                # 4. 为防止意外替换，我们构建精确的查找和替换模式
                # 使用 json.dumps 可以确保值被正确地转义为JSON字符串格式
                original_value_str = json.dumps(original_value, ensure_ascii=False)
                translated_value_str = json.dumps(translated_value, ensure_ascii=False)

                # 5. 使用正则表达式查找 "key": "value" 结构
                # re.escape 用于转义key和value中的特殊字符，以防它们被当作正则表达式元字符
                # \s* 用于匹配冒号两边可能存在的任意数量的空格或换行
                key_pattern = re.escape(json.dumps(key, ensure_ascii=False))
                value_pattern = re.escape(original_value_str)
                
                # 创建一个正则表达式，捕获键和冒号部分，以便在替换时保留它
                # 这使得替换操作更安全，只替换与键精确关联的值
                pattern = re.compile(f"({key_pattern}\\s*:\\s*){value_pattern}")
                
                # 替换时，\1 代表第一个捕获组（即 "key": ），后面跟上新的值
                replacement = f"\\1{translated_value_str}"
                
                # 执行替换，只替换第一个匹配项，以提高效率和安全性
                source_content, num_replacements = pattern.subn(replacement, source_content, count=1)

        # 6. 将修改后的完整内容写入新文件
        with open(file_path, "w", encoding="UTF-8") as f:
            f.write(source_content)

    except (IOError, FileNotFoundError):
        print(f"{source_path} 路径不存在，文件按首字母排序！")
        # Fallback: 如果源文件不存在，则按原有的方式生成一个新文件
        with open(file_path, "w", encoding="UTF-8") as f:
            json.dump(zh_cn_dict, f, ensure_ascii=False, indent=4, separators=(",", ":"), sort_keys=True)


def process_translation(file_id: int, path: Path) -> dict[str, str]:
    """
    处理单个文件的翻译，返回翻译字典

    :param file_id: 文件ID
    :param path: 文件路径
    :return: 翻译内容字典
    """
    keys, values = translate(file_id)

    # 手动处理文本的替换，避免反斜杠被转义
    try:
        with open("Source/" + str(path), "r", encoding="UTF-8") as f:
            zh_cn_dict = json.load(f)
    except IOError:
        zh_cn_dict = {}

    # 检查路径是否包含quests
    is_quest_file = "quests" in str(path)

    for key, value in zip(keys, values):
        # 确保替换 \\u00A0 和 \\n
        value = re.sub(r'\\"', '\"', value)

        # 对quest文件进行特殊处理
        if is_quest_file and "image" not in value and not value.startswith("[\""):
            value = value.replace(" ", "\u00A0")

        # 保存替换后的值
        zh_cn_dict[key] = value

    return zh_cn_dict



def main() -> None:
    get_files()
    ftb_quests_lang_dir = None # 用于记录FTB Quests语言文件所在的目录

    for file_id, path_str in zip(file_id_list, file_path_list):
        if "TM" in path_str:  # 跳过 TM 文件
            continue

        path = Path(path_str)
        zh_cn_dict = process_translation(file_id, path)

        save_translation(zh_cn_dict, path)

        # 打印日志时，文件名也相应地从 en_us 变为 zh_cn
        log_path = re.sub('en_us', 'zh_cn', path_str)
        print(f"已从Paratranz下载到仓库：{log_path}")

        # 检查是否为 FTB Quests 的语言文件，并记录其输出目录
        if "kubejs/assets/quests/lang/" in path_str and os.path.exists("Source/config/ftbquests/quests/lang/en_us.snbt"):
            ftb_quests_lang_dir = Path("CNPack") / path.parent

    # 在所有文件处理完毕后，如果检测到了 FTB Quests 文件，则执行合并
    if ftb_quests_lang_dir and ftb_quests_lang_dir.exists():
        print(f"\n检测到 FTB Quests 翻译文件，开始调用 LangSpliter 合并 SNBT 文件...")

        # 定义输入和输出路径
        json_dir = str(ftb_quests_lang_dir)
        output_snbt_file = 'CNPack/config/ftbquests/quests/lang/zh_cn.snbt'

        # 新增 chapters 目录的定义
        source_chapters_dir = 'Source/config/ftbquests/quests/chapters'
        output_chapters_dir = 'CNPack/config/ftbquests/quests/chapters'

        # 直接调用从 LangSpliter 导入的函数，并传入所有必需的参数
        if os.path.isdir(source_chapters_dir):
            print(f"检测到章节目录，将启用 custom_name/lore 更新功能...")
            merge_all_to_snbt(json_dir, output_snbt_file, source_chapters_dir, output_chapters_dir)
        else:
            print(f"未检测到章节目录 {source_chapters_dir}，将禁用 custom_name/lore 更新功能...")

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