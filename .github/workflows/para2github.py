import json
import os
import re
from pathlib import Path
from typing import Tuple
import snbtlib
from collections import OrderedDict
import requests

TOKEN: str = os.getenv("API_TOKEN", "")
GH_TOKEN: str = os.getenv("GH_TOKEN", "")
PROJECT_ID: str = os.getenv("PROJECT_ID", "")
FILE_URL: str = f"https://paratranz.cn/api/projects/{PROJECT_ID}/files/"

if not TOKEN or not PROJECT_ID:
    raise EnvironmentError("环境变量 API_TOKEN 或 PROJECT_ID 未设置。")

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
    保存翻译内容到指定的 JSON 文件。

    :param zh_cn_dict: 翻译内容的字典
    :param path: 原始文件路径
    """
    dir_path = Path("CNPack") / path.parent
    dir_path.mkdir(parents=True, exist_ok=True)
    zh_cn_filename = path.name.replace("en_us", "zh_cn")
    file_path = dir_path / zh_cn_filename
    source_path = Path("Source") / path

    with open(file_path, "w", encoding="UTF-8") as f:
        try:
            with open(source_path, "r", encoding="UTF-8") as f1:
                # 使用 OrderedDict 保留源文件的键顺序
                source_json: dict = json.load(f1, object_pairs_hook=OrderedDict)
            
            # 按源文件顺序更新值为翻译文本
            for key in source_json.keys():
                if key in zh_cn_dict: # 仅更新存在的键
                    source_json[key] = zh_cn_dict[key]
            
            json.dump(source_json, f, ensure_ascii=False, indent=4, separators=(",", ":"))
        except (IOError, FileNotFoundError):
            print(f"{source_path}路径不存在，文件按首字母排序！")
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
        value = re.sub(r'\\"','\"',value)

        # 对quest文件进行特殊处理
        if is_quest_file and "image" not in value:
            value = value.replace(" ", "\u00A0")
        
        # 保存替换后的值
        zh_cn_dict[key] = value
    
    return zh_cn_dict

def escape_string_for_snbt(s: str) -> str:
    """在将字符串写入 SNBT 文件前，对其进行转义。"""
    s = s.replace('\\', '\\\\')
    s = s.replace('"', '\\"')
    return s


def merge_all_to_snbt(json_dir: str, output_snbt_file: str):
    """
    合并所有JSON文件，将 "key1", "key2" 格式的条目还原为列表，
    进行必要的转义后，输出为单个SNBT文件。
    """
    print(f"--- 2. 开始从 {json_dir} 合并所有 JSON 文件到 SNBT ---")
    if not os.path.isdir(json_dir):
        print(f"错误：JSON目录 '{json_dir}' 不存在。无法合并。")
        return

    combined_data = OrderedDict()
    json_files = sorted([f for f in os.listdir(json_dir) if f.endswith('.json') and f.startswith('zh_cn')])
    for filename in json_files:
        filepath = os.path.join(json_dir, filename)
        try:
            with open(filepath, 'r', encoding='utf-8-sig') as f:
                data = json.load(f, object_pairs_hook=OrderedDict)
                combined_data.update(data)
                print(f"  -> 已加载 {len(data)} 条条目从: {filename}")
        except Exception as e:
            print(f"  -> 警告：读取或解析 {filepath} 失败: {e}")

    if not combined_data:
        print("错误：没有加载到任何数据，无法生成 SNBT 文件。")
        return

    print("\n开始重构多行文本条目...")

    multi_line_pattern = re.compile(r'^(.*?)(\d+)$')

    temp_multiline = OrderedDict()
    reconstructed_data = OrderedDict()

    for key, value in combined_data.items():
        match = multi_line_pattern.match(key)
        if match:
            base_key = match.group(1)
            line_number = int(match.group(2))

            if base_key not in temp_multiline:
                temp_multiline[base_key] = []
            temp_multiline[base_key].append((line_number, value))
        else:
            reconstructed_data[key] = value

    for base_key, lines_with_nums in temp_multiline.items():
        lines_with_nums.sort(key=lambda x: x[0])
        sorted_lines = [line_text for _, line_text in lines_with_nums]
        reconstructed_data[base_key] = sorted_lines

    print(f"重构完成。原始 {len(combined_data)} 条条目被合并为 {len(reconstructed_data)} 条 SNBT 条目。")

    sorted_items = sorted(reconstructed_data.items())
    print(f"\n总共合并了 {len(sorted_items)} 条最终条目，并已按键名排序。")

    snbt_ready_data = {}
    for key, value in sorted_items:
        if isinstance(value, list):
            snbt_ready_data[key] = [escape_string_for_snbt(str(line)) for line in value]
        elif isinstance(value, str):
            snbt_ready_data[key] = escape_string_for_snbt(value)
        else:
            snbt_ready_data[key] = value

    try:
        snbt_output_string = snbtlib.dumps(snbt_ready_data)
        if not snbt_output_string.strip():
            print("错误：snbtlib.dumps 返回了空字符串！")
            return
        
        # 确保输出目录存在
        os.makedirs(os.path.dirname(output_snbt_file), exist_ok=True)
        with open(output_snbt_file, 'w', encoding='utf-8') as f:
            f.write(snbt_output_string)
        print(f"成功将所有条目合并并写入到: {output_snbt_file}")
    except Exception as e:
        print(f"错误：生成或写入 SNBT 文件失败: {e}")

    print("--- 合并完成 ---")


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
        if "kubejs/assets/quests/lang/" in path_str:
            ftb_quests_lang_dir = Path("CNPack") / path.parent

    # 在所有文件处理完毕后，如果检测到了 FTB Quests 文件，则执行合并
    if ftb_quests_lang_dir:
        print(f"\n检测到 FTB Quests 翻译文件，开始合并 SNBT 文件...")
        output_snbt_file = 'CNPack/config/ftbquests/quests/lang/zh_cn.snbt'
        
        # 调用新的合并函数
        merge_all_to_snbt(str(ftb_quests_lang_dir), output_snbt_file)

if __name__ == "__main__":
    main()