# LabGuardian 元件与引脚识别网页

这个文件夹是独立的网页演示入口。前端使用无构建依赖的 ES Module 架构，
适合 Ubuntu 演示环境直接运行；后端复用项目主视觉链路：

1. `S1 ComponentDetector` 识别面包板上插入的元件
2. `S1.5 PinRoiDetector` 在每个元件 ROI 内识别引脚
3. 前端展示元件框、元件类别、置信度、引脚点和引脚名

## Ubuntu 启动

Ubuntu 演示推荐：

```bash
chmod +x start_web.sh
./start_web.sh
```

脚本会自动查找同级目录里的 `LabGuardian-Server`，并优先使用
`LabGuardian-Server/.venv/bin/python`。然后打开：

```text
http://127.0.0.1:8088
```

也可以手动启动。网页端会自动查找同级目录里的 `LabGuardian-Server` 或
`LabGuardian-Server-main`，如果后端目录不在默认位置，请先设置
`LABGUARDIAN_PROJECT_ROOT`：

```bash
LABGUARDIAN_PROJECT_ROOT=/path/to/LabGuardian-Server \
  /path/to/LabGuardian-Server/.venv/bin/python server.py
```

## 前端结构

- `static/index.html`：页面骨架
- `static/styles.css`：页面样式
- `static/js/api.js`：识别接口请求和超时处理
- `static/js/state.js`：页面状态
- `static/js/render.js`：DOM 渲染
- `static/js/main.js`：事件绑定和交互流程

## 依赖

推荐直接使用后端项目自带的虚拟环境启动，例如：

```bash
LABGUARDIAN_PROJECT_ROOT=/path/to/LabGuardian-Server \
  /path/to/LabGuardian-Server/.venv/bin/python server.py
```

Ubuntu 演示不要携带 `vendor/`、历史 `runs/`、`uploads/` 或
`ultralytics_config/`。这些目录要么是平台相关依赖，要么是运行时生成物。

## 输出

每次识别会在 `runs/` 中生成：

- `components_and_pins.png`
- `components_only.png`
- `component_pin_result.json`
