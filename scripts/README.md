# 又拍云立绘图片上传工具

## 安装依赖

```bash
pip install -r requirements.txt
```

## 准备图片目录

按以下结构组织图片：

```
上传目录/
├── 角色A/
│   ├── 任意名称1.jpg
│   ├── 任意名称2.png
│   └── ...
├── 角色B/
│   ├── photo1.jpg
│   └── photo2.webp
└── 角色C/
    └── image.gif
```

**说明：**
- 每个子文件夹名即为角色名
- 图片文件名可以是任意名称，脚本会自动重命名为 `角色名_n.jpg`
- 支持的格式：`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`
- 默认会将所有图片转换为 JPG 格式

## 使用方法

### 基本用法

```bash
python upyun_upload.py \
  --source /path/to/images \
  --operator your-operator \
  --password your-password
```

### 完整参数

```bash
python upyun_upload.py \
  --source /path/to/images \     # 图片目录路径（必填）
  --bucket image-15775 \          # 又拍云服务名称（默认 image-15775）
  --operator your-operator \      # 操作员名称（必填）
  --password your-password \      # 操作员密码（必填）
  --remote-path /fragment/img \   # 远程目录（默认 /fragment/img）
  --quality 90 \                  # JPG 质量 1-100（默认 90）
  --no-convert \                  # 不转换格式，保持原格式
  --skip-existing \               # 跳过云端已存在的文件
  --dry-run                       # 仅预览，不实际上传
```

### 示例

1. **预览上传（不实际执行）**
   ```bash
   python upyun_upload.py -s ./portraits -o myoperator -p mypassword --dry-run
   ```

2. **正式上传**
   ```bash
   python upyun_upload.py -s ./portraits -o myoperator -p mypassword
   ```

3. **增量上传（跳过已存在）**
   ```bash
   python upyun_upload.py -s ./portraits -o myoperator -p mypassword --skip-existing
   ```

4. **保持原格式不转换**
   ```bash
   python upyun_upload.py -s ./portraits -o myoperator -p mypassword --no-convert
   ```

## 上传后的目录结构

```
/fragment/img/
├── config.json           # 配置文件（自动生成）
├── 角色A/
│   ├── 角色A_1.jpg
│   ├── 角色A_2.jpg
│   └── 角色A_3.jpg
├── 角色B/
│   ├── 角色B_1.jpg
│   └── 角色B_2.jpg
└── 角色C/
    └── 角色C_1.jpg
```

## config.json 格式

```json
{
  "characters": {
    "角色A": {
      "count": 3,
      "images": ["角色A_1.jpg", "角色A_2.jpg", "角色A_3.jpg"]
    },
    "角色B": {
      "count": 2,
      "images": ["角色B_1.jpg", "角色B_2.jpg"]
    }
  },
  "updatedAt": "2024-01-21T12:00:00+00:00"
}
```

## 前端访问地址

- 配置文件: `http://image-15775.test.upcdn.net/fragment/img/config.json`
- 图片文件: `http://image-15775.test.upcdn.net/fragment/img/角色名/角色名_n.jpg`
