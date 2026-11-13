# SC-ROI-Forge

面向 **Star Citizen** 的 ROI（Region of Interest）可视化标定工具。

本项目从 Star Citizen HUD Overlay 的开发实践中获得启发，聚焦**屏幕画面**上关键 HUD / 界面区域的兴趣区标定与可视化，主要为后续 **OCR**、模板匹配、目标检测等**纯视觉方案**提供可复用的标定基础。

## 合规边界（重要）

本项目**仅服务于基于屏幕画面的视觉方案**（截图 / 粘贴 / 等价的屏幕像素捕获上的 OCR、ROI 裁剪、检测与 overlay 标定）。

**允许（in scope）：**

- 用户提供的图像（打开文件、剪贴板粘贴；不含读取游戏进程）
- 在像素上运行的 OCR / 模板匹配 / 检测辅助
- 可选云端视觉 LLM：接收截图并返回**可编辑**的 ROI 草稿
- Konva 画布编辑与 JSON 导入 / 导出

**不涉及、也不支持（out of scope）：**

- 读取游戏进程内存或内部数据结构
- 内存注入、DLL 注入、钩子（hook）或进程篡改
- 逆向工程游戏客户端以获取未公开数据
- 任何绕过官方客户端、修改游戏文件或干扰反作弊机制的做法

所有输入均为**图像 / 视频帧**；所有输出均为标定与可视化产物。导出的标准包中 `compliance` 字段固定为 `"vision_only"`。

## 目标

- 在游戏截图或屏幕画面上标定 ROI 区域（导入 / 粘贴）
- **锁定画幅比例**（16:9 / 16:10 / 21:9 等）：可从截图自动识别，也可手动覆盖；不同比例对应不同 UI 布局，**不可混用**
- 在同一锁定比例下，对 **1K / 2K / 4K** 做**等比例缩放**导出（布局不变，仅分辨率变密）
- Konva 画布手动画框、移动、撤销；可选 LangGraph AI 粗标后再精修
- 为下游 OCR / overlay 管线输出带 `norm` 与分档 `px` 的标准 JSON

**文档：**

- 设计规格：[`docs/superpowers/specs/2026-11-13-sc-roi-forge-design.md`](docs/superpowers/specs/2026-11-13-sc-roi-forge-design.md)
- MVP 实施计划：[`docs/superpowers/plans/2026-11-13-sc-roi-forge-mvp.md`](docs/superpowers/plans/2026-11-13-sc-roi-forge-mvp.md)

## 画幅锁定与 1K / 2K / 4K 比例公式

每个标定工程**固定一个** `aspect_ratio`（如 `16:9`、`21:9`）。`norm`（0..1）是该画幅下的唯一真源；导出时按档位重算像素框。

| 档位 | 高度（px） | 16:9 参考尺寸 |
|------|------------|---------------|
| 1K   | 1080       | 1920×1080     |
| 2K   | 1440       | 2560×1440     |
| 4K   | 2160       | 3840×2160     |

对锁定比例 `A:B`（`r = A/B`）：

```text
height_1k = 1080, height_2k = 1440, height_4k = 2160
width_tier = round(height_tier * r)
px[tier] = round(norm * dimension)  # 导入时亦由 norm 重算，不信赖陈旧 px
```

同画幅下档位之间为均匀缩放（例如 2K/1K = 4/3，4K/1K = 2）。示例：`21:9` → 1K 2520×1080，2K 3360×1440，4K 5040×2160。

共享实现：`packages/schema`（TypeScript）；API 侧镜像：`apps/api/src/sc_roi_api/geometry.py`。

## 可选 AI（LangGraph）

- 后端使用轻量 **LangGraph** `StateGraph`（`reason` ↔ 工具循环），端点 `POST /v1/agent/suggest-rois`。
- 需要用户自备 **OpenAI 兼容** API Key（请求头 `X-API-Key` 或环境变量 `SC_ROI_LLM_API_KEY`）；`SC_ROI_LLM_BASE_URL`、`SC_ROI_LLM_MODEL` 见 [`.env.example`](.env.example)。
- 设置 `SC_ROI_AGENT_ENABLED=0`（或 `false`）可完全关闭 Agent；**无 Key / 关闭开关时仍可手动画框并导出**。

## 快速开始

**前置：** Node.js 20+、Python 3.11+、（可选）Rust + Docker。

### 1. 安装前端工作区依赖

在仓库根目录：

```bash
npm install
```

### 2. Schema 单元测试（画幅 + 导出数学）

```bash
npm test --workspace @sc-roi/schema
```

### 3. API（FastAPI + Uvicorn）

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
# 本地开发可关闭 Agent：export SC_ROI_AGENT_ENABLED=0
uvicorn sc_roi_api.main:app --host 127.0.0.1 --port 8000 --reload
```

API 测试：

```bash
cd apps/api && source .venv/bin/activate && pytest
```

健康检查：`GET http://127.0.0.1:8000/health`

### 4. Web 工作台（Vite + React + Konva）

```bash
cd apps/web
npm install
npm run dev
```

开发服务器将 `/health` 与 `/v1` 代理到 `127.0.0.1:8000`（见 `apps/web/vite.config.ts`）。请先启动 API。

### 5. Docker Compose（浏览器访问）

```bash
docker compose -f deploy/docker/compose.yml up --build
```

- API：`http://localhost:8000`
- 静态 Web：`http://localhost:8080`

Compose 默认 `SC_ROI_AGENT_ENABLED=1`；生产或离线标定可在 `deploy/docker/compose.yml` 中改为 `0`。

### 6. 桌面壳（Tauri 2，Windows 为主）

Tauri 加载与浏览器相同的 SPA；API 默认 `http://127.0.0.1:8000`。侧车脚本、打包与 EXE 说明见 [`apps/desktop/README.md`](apps/desktop/README.md)。

## 仓库结构（摘要）

```text
packages/schema   # 共享画幅 / 导出 JSON 逻辑（TS）
apps/web          # React + Konva 标定 UI
apps/api          # FastAPI、export-preview、可选 Agent
apps/desktop      # Tauri 2 壳 + API sidecar 钩子
deploy/docker     # Compose + Dockerfile
docs/             # 设计规格与 MVP 计划
```

## 背景

Star Citizen 的座舱与 HUD 信息密度高、布局随模式变化。SC-ROI-Forge 将「标定」独立成工具链环节：先把 ROI 画清楚、对得准，再服务上层纯视觉处理，而不触碰游戏内部数据。

## 状态

MVP 骨架已就位：共享 schema、Web 画布、API 导出预览与可选 Agent、Docker 与 Tauri 壳；功能与文档随迭代继续完善。

## License

待定。
