#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
又拍云立绘图片批量上传脚本

功能：
1. 扫描本地文件夹中的图片
2. 自动按 角色名_n.jpg 格式重命名
3. 生成/更新 config.json 配置文件
4. 批量上传到又拍云

目录结构示例:
上传目录/
├── 角色A/
│   ├── 任意名称1.jpg  -> 角色A_1.jpg
│   ├── 任意名称2.png  -> 角色A_2.jpg
│   └── 角色A_3.jpg    -> 保持不变
├── 角色B/
│   └── image.jpg      -> 角色B_1.jpg
└── config.json        -> 自动生成

使用方法:
python upyun_upload.py --source /path/to/images --bucket your-bucket --operator your-operator --password your-password
"""

import os
import re
import json
import hashlib
import hmac
import base64
import argparse
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from urllib.parse import quote
import http.client
from PIL import Image  # pip install Pillow


# ============ 配置 ============

DEFAULT_CONFIG = {
    "bucket": "image-15775",
    "api_host": "v0.api.upyun.com",
    "remote_base_path": "/fragment/img",
    "supported_formats": [".jpg", ".jpeg", ".png", ".webp", ".gif"],
    "convert_to_jpg": True,  # 是否统一转换为 jpg
    "jpg_quality": 90,
}


# ============ 又拍云 API ============

def md5(content: str) -> str:
    """计算 MD5"""
    return hashlib.md5(content.encode('utf-8')).hexdigest()


def generate_signature(method: str, uri: str, date: str, password: str, content_length: int = 0) -> str:
    """生成又拍云签名"""
    password_md5 = md5(password)
    sign_str = f"{method}&{uri}&{date}&{content_length}&{password_md5}"
    return md5(sign_str)


class UpyunClient:
    """又拍云客户端"""
    
    def __init__(self, bucket: str, operator: str, password: str, api_host: str = "v0.api.upyun.com"):
        self.bucket = bucket
        self.operator = operator
        self.password = password
        self.api_host = api_host
    
    def _get_headers(self, method: str, uri: str, content_length: int = 0) -> Dict[str, str]:
        """生成请求头"""
        date = datetime.now(timezone.utc).strftime('%a, %d %b %Y %H:%M:%S GMT')
        signature = generate_signature(method, uri, date, self.password, content_length)
        
        return {
            "Authorization": f"UpYun {self.operator}:{signature}",
            "Date": date,
            "Content-Length": str(content_length),
        }
    
    def upload_file(self, local_path: str, remote_path: str) -> bool:
        """上传文件"""
        uri = f"/{self.bucket}{remote_path}"
        
        with open(local_path, 'rb') as f:
            content = f.read()
        
        content_length = len(content)
        headers = self._get_headers("PUT", uri, content_length)
        
        try:
            conn = http.client.HTTPSConnection(self.api_host)
            conn.request("PUT", uri, content, headers)
            response = conn.getresponse()
            
            if response.status in [200, 201]:
                print(f"  ✓ 上传成功: {remote_path}")
                return True
            else:
                print(f"  ✗ 上传失败: {remote_path} - {response.status} {response.reason}")
                return False
        except Exception as e:
            print(f"  ✗ 上传错误: {remote_path} - {e}")
            return False
        finally:
            conn.close()
    
    def file_exists(self, remote_path: str) -> bool:
        """检查文件是否存在"""
        uri = f"/{self.bucket}{remote_path}"
        headers = self._get_headers("HEAD", uri)
        
        try:
            conn = http.client.HTTPSConnection(self.api_host)
            conn.request("HEAD", uri, headers=headers)
            response = conn.getresponse()
            return response.status == 200
        except:
            return False
        finally:
            conn.close()
    
    def create_directory(self, remote_path: str) -> bool:
        """创建目录"""
        uri = f"/{self.bucket}{remote_path}"
        headers = self._get_headers("POST", uri)
        headers["folder"] = "true"
        headers["Content-Length"] = "0"
        
        try:
            conn = http.client.HTTPSConnection(self.api_host)
            conn.request("POST", uri, headers=headers)
            response = conn.getresponse()
            return response.status in [200, 201]
        except:
            return False
        finally:
            conn.close()


# ============ 图片处理 ============

def convert_to_jpg(input_path: str, output_path: str, quality: int = 90) -> bool:
    """将图片转换为 JPG 格式"""
    try:
        with Image.open(input_path) as img:
            # 转换为 RGB（处理 PNG 的 RGBA）
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')
            img.save(output_path, 'JPEG', quality=quality)
        return True
    except Exception as e:
        print(f"  ✗ 转换失败: {input_path} - {e}")
        return False


def is_valid_naming(filename: str, character_name: str) -> bool:
    """检查文件名是否符合 角色名_n.jpg 格式"""
    pattern = rf"^{re.escape(character_name)}_\d+\.(jpg|jpeg|png|webp|gif)$"
    return bool(re.match(pattern, filename, re.IGNORECASE))


def get_next_index(character_name: str, existing_files: List[str]) -> int:
    """获取下一个可用的索引号"""
    pattern = rf"^{re.escape(character_name)}_(\d+)\."
    indices = []
    
    for f in existing_files:
        match = re.match(pattern, f, re.IGNORECASE)
        if match:
            indices.append(int(match.group(1)))
    
    return max(indices, default=0) + 1


# ============ 扫描和处理 ============

def scan_source_directory(source_dir: str) -> Dict[str, List[str]]:
    """
    扫描源目录，返回角色名到图片文件列表的映射
    
    目录结构:
    source_dir/
    ├── 角色A/
    │   ├── image1.jpg
    │   └── image2.png
    └── 角色B/
        └── photo.jpg
    """
    characters = {}
    source_path = Path(source_dir)
    
    if not source_path.exists():
        raise ValueError(f"源目录不存在: {source_dir}")
    
    for char_dir in source_path.iterdir():
        if not char_dir.is_dir():
            continue
        
        # 跳过隐藏目录和特殊目录
        if char_dir.name.startswith('.') or char_dir.name == '__pycache__':
            continue
        
        character_name = char_dir.name
        image_files = []
        
        for file in char_dir.iterdir():
            if file.is_file() and file.suffix.lower() in DEFAULT_CONFIG["supported_formats"]:
                image_files.append(str(file))
        
        if image_files:
            # 按文件名排序
            image_files.sort(key=lambda x: Path(x).name.lower())
            characters[character_name] = image_files
    
    return characters


def prepare_upload_files(
    characters: Dict[str, List[str]],
    temp_dir: str,
    convert_jpg: bool = True,
    jpg_quality: int = 90
) -> Dict[str, List[Tuple[str, str]]]:
    """
    准备上传文件：重命名并可选转换格式
    
    返回: {角色名: [(本地路径, 目标文件名), ...]}
    """
    temp_path = Path(temp_dir)
    temp_path.mkdir(parents=True, exist_ok=True)
    
    result = {}
    
    for character_name, files in characters.items():
        char_temp_dir = temp_path / character_name
        char_temp_dir.mkdir(exist_ok=True)
        
        prepared_files = []
        
        for idx, file_path in enumerate(files, start=1):
            src_path = Path(file_path)
            src_name = src_path.name
            
            # 检查是否已经符合命名规范
            if is_valid_naming(src_name, character_name):
                # 提取现有索引
                match = re.match(rf"{re.escape(character_name)}_(\d+)\.", src_name)
                if match:
                    idx = int(match.group(1))
            
            # 目标文件名
            ext = ".jpg" if convert_jpg else src_path.suffix.lower()
            target_name = f"{character_name}_{idx}{ext}"
            target_path = char_temp_dir / target_name
            
            # 复制或转换文件
            if convert_jpg and src_path.suffix.lower() != '.jpg':
                print(f"  转换: {src_name} -> {target_name}")
                if not convert_to_jpg(str(src_path), str(target_path), jpg_quality):
                    continue
            else:
                shutil.copy2(str(src_path), str(target_path))
            
            prepared_files.append((str(target_path), target_name))
        
        if prepared_files:
            # 按索引排序
            prepared_files.sort(key=lambda x: int(re.search(r'_(\d+)\.', x[1]).group(1)))
            result[character_name] = prepared_files
    
    return result


def generate_config(prepared_files: Dict[str, List[Tuple[str, str]]]) -> dict:
    """生成配置文件内容"""
    characters = {}
    
    for character_name, files in prepared_files.items():
        file_names = [f[1] for f in files]
        characters[character_name] = {
            "count": len(file_names),
            "images": file_names
        }
    
    return {
        "characters": characters,
        "updatedAt": datetime.now(timezone.utc).isoformat()
    }


def merge_config(existing_config: Optional[dict], new_config: dict) -> dict:
    """合并配置（新数据覆盖旧数据）"""
    if not existing_config:
        return new_config
    
    merged = existing_config.copy()
    merged["characters"] = merged.get("characters", {})
    
    for char_name, char_data in new_config["characters"].items():
        merged["characters"][char_name] = char_data
    
    merged["updatedAt"] = new_config["updatedAt"]
    
    return merged


# ============ 主流程 ============

def main():
    parser = argparse.ArgumentParser(description="又拍云立绘图片批量上传工具")
    parser.add_argument("--source", "-s", required=True, help="源图片目录路径")
    parser.add_argument("--bucket", "-b", default=DEFAULT_CONFIG["bucket"], help="又拍云服务名称")
    parser.add_argument("--operator", "-o", required=True, help="操作员名称")
    parser.add_argument("--password", "-p", required=True, help="操作员密码")
    parser.add_argument("--remote-path", "-r", default=DEFAULT_CONFIG["remote_base_path"], help="远程基础路径")
    parser.add_argument("--no-convert", action="store_true", help="不转换图片格式")
    parser.add_argument("--quality", "-q", type=int, default=DEFAULT_CONFIG["jpg_quality"], help="JPG 质量 (1-100)")
    parser.add_argument("--dry-run", action="store_true", help="仅预览，不实际上传")
    parser.add_argument("--skip-existing", action="store_true", help="跳过云端已存在的文件")
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("又拍云立绘图片批量上传工具")
    print("=" * 60)
    
    # 1. 扫描源目录
    print(f"\n[1/5] 扫描源目录: {args.source}")
    try:
        characters = scan_source_directory(args.source)
    except ValueError as e:
        print(f"错误: {e}")
        return 1
    
    if not characters:
        print("未找到任何图片文件")
        return 0
    
    print(f"  找到 {len(characters)} 个角色:")
    for name, files in characters.items():
        print(f"    - {name}: {len(files)} 张图片")
    
    # 2. 准备上传文件
    print(f"\n[2/5] 准备上传文件...")
    temp_dir = os.path.join(args.source, ".upload_temp")
    
    try:
        prepared_files = prepare_upload_files(
            characters,
            temp_dir,
            convert_jpg=not args.no_convert,
            jpg_quality=args.quality
        )
    except Exception as e:
        print(f"错误: {e}")
        return 1
    
    total_files = sum(len(f) for f in prepared_files.values())
    print(f"  准备完成: {total_files} 个文件")
    
    # 3. 生成配置文件
    print(f"\n[3/5] 生成配置文件...")
    new_config = generate_config(prepared_files)
    
    # 尝试加载现有配置
    config_local_path = os.path.join(temp_dir, "config.json")
    final_config = new_config  # 默认使用新配置
    
    print(f"  配置文件将包含 {len(new_config['characters'])} 个角色")
    
    # 保存配置文件
    with open(config_local_path, 'w', encoding='utf-8') as f:
        json.dump(final_config, f, ensure_ascii=False, indent=2)
    print(f"  配置文件已保存到: {config_local_path}")
    
    if args.dry_run:
        print("\n[预览模式] 以下文件将被上传:")
        print(f"  配置文件: {args.remote_path}/config.json")
        for char_name, files in prepared_files.items():
            print(f"  {char_name}/")
            for local_path, target_name in files:
                print(f"    - {target_name}")
        print("\n使用 --dry-run=false 或移除该参数以实际上传")
        return 0
    
    # 4. 上传文件
    print(f"\n[4/5] 开始上传到又拍云...")
    client = UpyunClient(args.bucket, args.operator, args.password)
    
    success_count = 0
    fail_count = 0
    skip_count = 0
    
    for char_name, files in prepared_files.items():
        print(f"\n  上传 {char_name}/")
        
        # 创建角色目录
        char_remote_dir = f"{args.remote_path}/{char_name}"
        client.create_directory(char_remote_dir)
        
        for local_path, target_name in files:
            remote_path = f"{char_remote_dir}/{target_name}"
            
            # 检查是否跳过已存在
            if args.skip_existing and client.file_exists(remote_path):
                print(f"    ⊘ 跳过已存在: {target_name}")
                skip_count += 1
                continue
            
            if client.upload_file(local_path, remote_path):
                success_count += 1
            else:
                fail_count += 1
    
    # 5. 上传配置文件
    print(f"\n[5/5] 上传配置文件...")
    config_remote_path = f"{args.remote_path}/config.json"
    if client.upload_file(config_local_path, config_remote_path):
        print("  ✓ 配置文件上传成功")
    else:
        print("  ✗ 配置文件上传失败")
        fail_count += 1
    
    # 清理临时目录
    print(f"\n清理临时文件...")
    shutil.rmtree(temp_dir, ignore_errors=True)
    
    # 总结
    print("\n" + "=" * 60)
    print("上传完成!")
    print(f"  成功: {success_count}")
    print(f"  失败: {fail_count}")
    print(f"  跳过: {skip_count}")
    print("=" * 60)
    
    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    exit(main())
