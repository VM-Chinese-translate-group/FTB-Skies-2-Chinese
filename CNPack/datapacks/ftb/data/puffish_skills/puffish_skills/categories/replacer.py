import json
import os
import shutil
from collections import defaultdict

# Unicode字符映射
UNICODE_MAPPING = {
    '\uF933': '\\uE001', '\uF934': '\\uE002', '\uF935': '\\uE003',
    '\uF936': '\\uE004', '\uF937': '\\uE005', '\uF938': '\\uE006',
    '\uF940': '\\uE007', '\uF941': '\\uE008', '\uF942': '\\uE009',
    '\uF943': '\\uE010', '\uF944': '\\uE011', '\uF945': '\\uE012',
    '\uF946': '\\uE013', '\uF947': '\\uE014', '\uF948': '\\uE015',
    '\uF949': '\\uE016', '\uF950': '\\uE017', '\uF951': '\\uE018',
    '\uF952': '\\uE019', '\uF953': '\\uE020', '\uF954': '\\uE021',
    '\uF955': '\\uE022', '\uF956': '\\uE023', '\uF957': '\\uE024',
    '\uF958': '\\uE025', '\uF959': '\\uE026'
}

def replace_unicode(text):
    if not isinstance(text, str):
        return text
    for old, new in UNICODE_MAPPING.items():
        text = text.replace(old, new)
    return text

def write_lang_file(file_path, translations):
    with open(file_path, 'wb') as f:
        # 手动构建JSON字符串,使用bytes写入以保持原始格式
        f.write(b'{\n')
        entries = []
        items = list(translations.items())
        for i, (key, value) in enumerate(items):
            value = value.replace('"', '\\"').replace('\n', '\\n')
            entry = f'    "{key}": "{value}"'
            if i < len(items) - 1:
                entry += ','
            entries.append(entry.encode('utf-8'))
        f.write(b'\n'.join(entries))
        f.write(b'\n}\n')

def restore_backups(base_dir):
    """恢复备份文件"""
    for root, dirs, files in os.walk(base_dir):
        for file in files:
            if file.endswith('.bak'):
                bak_path = os.path.join(root, file)
                orig_path = os.path.join(root, file[:-4])
                if os.path.exists(bak_path):
                    shutil.copy2(bak_path, orig_path)
                    print(f"已恢复备份: {bak_path}")

def get_content_hash(text):
    """生成内容的唯一标识，用于区分同一技能中不同文本"""
    return hash(text) % 100000

# …前面的代码保持不变…

def process_json_files(base_dir):
    """处理JSON文件"""
    # 先恢复备份
    restore_backups(base_dir)

    # 用于保存所有翻译文本
    all_translations = {}
    # 用于追踪同一技能中同一字段内不同文本（hash值）的变体
    content_variants = defaultdict(lambda: dict())
    
    # 处理 category.json（按原逻辑处理，不从bak读取）
    for root, dirs, files in os.walk(base_dir):
        category_file = os.path.join(root, "category.json")
        if os.path.exists(category_file):
            category_name = os.path.basename(root)
            with open(category_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if "title" in data and isinstance(data["title"], str):
                title_text = data["title"]
                processed_text = replace_unicode(title_text)
                trans_key = f"puffish_skills.category.{category_name}.title"
                all_translations[trans_key] = processed_text
                data["title"] = {"translate": trans_key}
            with open(category_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=4, ensure_ascii=False)
            print(f"已处理 category.json: {category_file}")
    
    # 处理技能文件 definitions.json
    for root, dirs, files in os.walk(base_dir):
        for file in files:
            if file == "definitions.json":
                file_path = os.path.join(root, file)
                # 读取bak备份文件中的原始数据（忽略已有文本）
                backup_file = file_path
                
                with open(backup_file, 'r', encoding='utf-8') as f:
                    try:
                            backup_data = json.load(f)
                    except Exception as e:
                            print(f"备份文件读取失败: {backup_file}, {e}")
                            backup_data = {}

                new_data = {}
                modified = False
                for skill_name, orig_skill_data in backup_data.items():
                    new_skill_data = orig_skill_data.copy()
                    # 处理 title 字段（直接按原文本提取，不再判断空值）
                    if "title" in orig_skill_data and isinstance(orig_skill_data["title"], str):
                        original_text = orig_skill_data["title"]
                        base_key = f"puffish_skills.categories.{skill_name}.title"
                        content_hash = get_content_hash(original_text)
                        variant_dict = content_variants[base_key]
                        if content_hash in variant_dict:
                            trans_key = variant_dict[content_hash]
                        else:
                            variant_num = len(variant_dict)
                            trans_key = base_key if variant_num == 0 else f"{base_key}.{variant_num}"
                            variant_dict[content_hash] = trans_key
                        processed_text = replace_unicode(original_text)
                        all_translations[trans_key] = processed_text
                        new_skill_data["title"] = {"translate": trans_key}
                        modified = True
                    # 处理 description 字段（直接提取原文本）
                    if "description" in orig_skill_data and isinstance(orig_skill_data["description"], str):
                        original_text = orig_skill_data["description"]
                        base_key = f"puffish_skills.categories.{skill_name}.description"
                        content_hash = get_content_hash(original_text)
                        variant_dict = content_variants[base_key]
                        if content_hash in variant_dict:
                            trans_key = variant_dict[content_hash]
                        else:
                            variant_num = len(variant_dict)
                            trans_key = base_key if variant_num == 0 else f"{base_key}.{variant_num}"
                            variant_dict[content_hash] = trans_key
                        processed_text = replace_unicode(original_text)
                        all_translations[trans_key] = processed_text
                        new_skill_data["description"] = {"translate": trans_key}
                        modified = True
                    new_data[skill_name] = new_skill_data
                if modified:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        json.dump(new_data, f, indent=4, ensure_ascii=False)
                    print(f"已处理 definitions.json: {file_path}")
    
    # 生成语言文件（放在 base_dir 下）
    lang_path = os.path.join(base_dir, "en_us.json")
    write_lang_file(lang_path, all_translations)
    print(f"已生成语言文件: {lang_path}")

# …后面的 main 函数保持不变…

def main():
    base_dir = r"D:\mc\mod\FTB-Skies-2-Chinese\CNPack\datapacks\ftb\data\puffish_skills\puffish_skills\categories"
    process_json_files(base_dir)

if __name__ == "__main__":
    main()