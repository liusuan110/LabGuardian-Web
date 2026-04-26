# LabGuardian Ubuntu 演示前端

React + Vite + TypeScript 单工位完整诊断演示界面。

演示主线：

```text
上传面包板图片
-> POST /api/v1/pipeline/run
-> 展示 S1-S4 事实链、元件/引脚/孔位/网表
-> POST /api/v1/angnt/ask
-> 展示 Agent 诊断解释和建议
```

## Ubuntu 启动

先启动后端：

```bash
cd /Users/liusuan/Desktop/LabGuardian-Server
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

再启动前端：

```bash
cd /Users/liusuan/Desktop/LabGuardian-web
npm install
./start_web.sh
```

打开：

```text
http://127.0.0.1:5173
```

如后端不在 `127.0.0.1:8000`：

```bash
VITE_API_BASE_URL=http://<backend-host>:8000 npm run dev -- --host 0.0.0.0
```

## 前端结构

- `src/api/`：后端 API 封装
- `src/types/`：pipeline / agent / UI 类型
- `src/components/`：上传、Canvas 标注、阶段耗时、诊断、网表、原始 JSON
- `src/features/demo/`：演示页 reducer、hooks 和主流程
- `src/styles/`：全局布局和视觉样式

## 可用命令

```bash
npm run dev
npm run typecheck
npm run build
npm run preview
```

## 后端契约

当前前端使用：

- `GET /health`
- `GET /version`
- `POST /api/v1/pipeline/run`
- `POST /api/v1/angnt/ask`
- `GET /api/v1/angnt/status/{job_id}`

上传图片会在浏览器端转换为纯 base64 字符串，提交到
`PipelineRequest.images_b64`，不包含 `data:image/...` 前缀。
