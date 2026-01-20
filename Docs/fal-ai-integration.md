# Fal.ai 图像生成接入指南

> 官方文档：[https://fal.ai/models/fal-ai/nano-banana-pro/api](https://fal.ai/models/fal-ai/nano-banana-pro/api)

## 目录

1. [概述](#1-概述)
2. [快速开始](#2-快速开始)
3. [认证方式](#3-认证方式)
4. [API 调用方式](#4-api-调用方式)
5. [请求参数 Schema](#5-请求参数-schema)
6. [响应格式](#6-响应格式)
7. [常见错误与排查](#7-常见错误与排查)
8. [安全注意事项](#8-安全注意事项)
9. [项目实际用法](#9-项目实际用法)

---

## 1. 概述

**Fal.ai** 是一个高性能的 AI 推理平台，提供多种图像生成模型。本项目使用 **Nano Banana Pro**（又名 Nano Banana 2），这是基于 Google 技术的最新图像生成与编辑模型。

### 主要特点

- 🚀 高质量文本到图像生成
- 🎨 支持多种宽高比（21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16）
- 📐 支持多种分辨率（1K, 2K, 4K）
- 🖼️ 支持多种输出格式（png, jpeg, webp）
- 🔍 可选启用 Web 搜索增强生成

---

## 2. 快速开始

### 2.1 获取 API Key

1. 访问 [fal.ai](https://fal.ai) 并注册账号
2. 进入 Dashboard，创建 API Key
3. 妥善保存 Key，**不要泄露到前端代码或公开仓库**

### 2.2 配置环境变量

在项目根目录的 `.env.local` 文件中添加：

```bash
FAL_KEY=your_fal_api_key_here
```

### 2.3 安装依赖（可选）

如果使用官方 SDK：

```bash
npm install @fal-ai/client
```

> **注意**：旧包名 `@fal-ai/serverless-client` 已废弃，请使用 `@fal-ai/client`。

---

## 3. 认证方式

### ⚠️ 关键点：使用 `Key` 而非 `Bearer`

Fal.ai 的认证头格式与 OpenAI 等平台**不同**：

| 平台 | Authorization 格式 |
|------|-------------------|
| OpenAI / Qiniu | `Bearer <API_KEY>` |
| **Fal.ai** | `Key <FAL_KEY>` |

#### 正确示例

```javascript
headers: {
  "Content-Type": "application/json",
  "Authorization": `Key ${FAL_KEY}`  // ✅ 正确
}
```

#### 错误示例

```javascript
headers: {
  "Authorization": `Bearer ${FAL_KEY}`  // ❌ 错误，会返回 401
}
```

### SDK 配置方式

```javascript
import { fal } from "@fal-ai/client";

fal.config({
  credentials: "YOUR_FAL_KEY"  // SDK 内部自动处理认证头
});
```

---

## 4. API 调用方式

### 4.1 使用官方 SDK（推荐用于 Node.js）

```javascript
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("fal-ai/nano-banana-pro", {
  input: {
    prompt: "A futuristic city skyline at sunset, cyberpunk style",
    num_images: 1,
    aspect_ratio: "16:9",
    output_format: "png",
    resolution: "1K"
  },
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === "IN_PROGRESS") {
      update.logs.map((log) => log.message).forEach(console.log);
    }
  }
});

console.log(result.data.images[0].url);
```

### 4.2 使用 REST API（适用于浏览器/前端）

```javascript
const FAL_KEY = "your_fal_key";
const modelId = "fal-ai/nano-banana-pro";
const url = `https://fal.run/${modelId}`;

const response = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Key ${FAL_KEY}`
  },
  body: JSON.stringify({
    prompt: "A futuristic city skyline at sunset",
    num_images: 1,
    aspect_ratio: "16:9"
  })
});

const data = await response.json();
console.log(data.images[0].url);
```

### ⚠️ REST API 请求体结构

**关键点**：参数直接放在顶层，**不要**用 `input` 包裹！

#### ✅ 正确

```json
{
  "prompt": "A beautiful landscape",
  "num_images": 1,
  "aspect_ratio": "16:9"
}
```

#### ❌ 错误（会返回 422）

```json
{
  "input": {
    "prompt": "A beautiful landscape",
    "num_images": 1
  }
}
```

> **注意**：SDK 方式需要 `input` 包裹，REST API 直接调用则不需要。这是常见的混淆点！

---

## 5. 请求参数 Schema

### 输入参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `prompt` | string | ✅ 是 | - | 图像描述文本 |
| `num_images` | integer | 否 | 1 | 生成图片数量 |
| `aspect_ratio` | enum | 否 | "1:1" | 宽高比，可选值见下表 |
| `output_format` | enum | 否 | "png" | 输出格式：jpeg / png / webp |
| `resolution` | enum | 否 | "1K" | 分辨率：1K / 2K / 4K |
| `sync_mode` | boolean | 否 | false | 同步模式，返回 Data URI |
| `enable_web_search` | boolean | 否 | false | 启用 Web 搜索增强 |
| `limit_generations` | boolean | 否 | false | 限制每轮只生成1张 |

### 支持的宽高比

| 横向 | 方形 | 竖向 |
|------|------|------|
| 21:9 | 1:1 | 4:5 |
| 16:9 | | 3:4 |
| 3:2 | | 2:3 |
| 4:3 | | 9:16 |
| 5:4 | | |

### 请求示例

```json
{
  "prompt": "An action shot of a black lab swimming in a pool, camera on water line",
  "num_images": 1,
  "aspect_ratio": "16:9",
  "output_format": "png",
  "resolution": "1K"
}
```

---

## 6. 响应格式

### 成功响应

```json
{
  "images": [
    {
      "url": "https://storage.googleapis.com/falserverless/...",
      "content_type": "image/png",
      "file_name": "nano-banana-t2i-output.png",
      "width": 1920,
      "height": 1080,
      "file_size": 1234567
    }
  ],
  "description": ""
}
```

### ImageFile 对象字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `url` | string | 图片下载地址（必有） |
| `content_type` | string | MIME 类型 |
| `file_name` | string | 文件名 |
| `file_size` | integer | 文件大小（字节） |
| `width` | integer | 图片宽度 |
| `height` | integer | 图片高度 |
| `file_data` | string | Base64 数据（sync_mode=true 时） |

---

## 7. 常见错误与排查

### 7.1 错误 401 - Invalid token

**错误信息**：
```json
{"detail": "Invalid token"}
```

**原因**：认证头格式错误

**解决方案**：
- ✅ 使用 `Authorization: Key <FAL_KEY>`
- ❌ 不要使用 `Authorization: Bearer <FAL_KEY>`

### 7.2 错误 422 - field required / prompt missing

**错误信息**：
```json
{"detail":[{"loc":["body","prompt"],"msg":"field required","type":"value_error.missing"}]}
```

**原因**：请求体结构错误，参数被错误地包裹在 `input` 中

**解决方案**：
```javascript
// ❌ 错误
body: JSON.stringify({ input: { prompt: "..." } })

// ✅ 正确
body: JSON.stringify({ prompt: "..." })
```

### 7.3 错误 400 - Invalid aspect_ratio

**原因**：使用了不支持的宽高比

**解决方案**：只使用官方支持的值：
`21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16`

### 7.4 环境变量未加载

**现象**：`FAL_KEY is missing from environment variables`

**排查步骤**：

1. 确认 `.env.local` 文件存在且包含 `FAL_KEY=...`
2. 检查 `vite.config.ts` 是否正确注入：
   ```typescript
   define: {
     'process.env.FAL_KEY': JSON.stringify(env.FAL_KEY || env.FAL_API_KEY)
   }
   ```
3. **重启开发服务器**（环境变量修改后必须重启）

---

## 8. 安全注意事项

### 🔒 永远不要在前端暴露 API Key

> ⚠️ **官方警告**：When running code on the client-side (e.g. in a browser, mobile app or GUI applications), make sure to not expose your `FAL_KEY`. Instead, **use a server-side proxy** to make requests to the API.

### 推荐架构

```
[浏览器] → [你的后端服务器] → [Fal.ai API]
              ↑
         API Key 存放于此
```

### 本地开发临时方案

本项目为了开发便利，在前端直接调用 Fal.ai API，但这**仅适用于**：
- 本地开发环境
- API Key 不暴露在公开代码库
- 不部署到公网

### 生产环境建议

1. 创建后端代理端点（如 `/api/generate-image`）
2. 后端从环境变量读取 `FAL_KEY`
3. 前端调用你的后端，后端转发请求到 Fal.ai

---

## 9. 项目实际用法

本项目在 `services/geminiService.ts` 中封装了 Fal.ai 调用：

```typescript
const generateFalImage = async (prompt: string): Promise<string> => {
  if (!FAL_API_KEY) {
    throw new Error("FAL_KEY is missing from environment variables");
  }
  
  const modelId = IMAGE_MODEL || "fal-ai/nano-banana-pro";
  const url = `https://fal.run/${modelId}`;
  
  const body = {
    prompt,
    num_images: 1,
    aspect_ratio: "16:9"  // 固定宽屏输出
  };
  
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${FAL_API_KEY}`  // 注意是 Key 不是 Bearer
    },
    body: JSON.stringify(body)
  });
  
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`FAL image request failed: ${res.status} ${errText}`);
  }
  
  const data = await res.json();
  const imageUrl = data?.images?.[0]?.url;
  
  if (!imageUrl) {
    throw new Error("No image returned from FAL");
  }
  
  return imageUrl;
};
```

### 模型切换

在 `App.tsx` 的图片模型选择器中添加 Fal.ai 模型：

```typescript
const IMAGE_MODEL_OPTIONS = [
  'gemini-2.5-flash-image',
  // ... 其他模型
  'fal-ai/nano-banana-pro'  // Fal.ai 模型
];
```

当选择以 `fal-ai/` 开头的模型时，系统自动使用 `generateFalImage` 函数。

---

## 参考链接

- [Fal.ai 官方文档](https://fal.ai/docs)
- [Nano Banana Pro API](https://fal.ai/models/fal-ai/nano-banana-pro/api)
- [Fal.ai 定价](https://fal.ai/pricing)
- [SDK 迁移指南](https://fal.ai/docs/migration)

---

*文档最后更新：2025-12-07*

