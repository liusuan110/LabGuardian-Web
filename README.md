# LabGuardian 元件与引脚识别网页

这个文件夹是独立的网页演示入口。它复用项目主视觉链路：

1. `S1 ComponentDetector` 识别面包板上插入的元件
2. `S1.5 PinRoiDetector` 在每个元件 ROI 内识别引脚
3. 前端展示元件框、元件类别、置信度、引脚点和引脚名

## 启动

Windows 下可以直接双击：

```text
breadboard_web_demo/start_web.bat
```

也可以在项目根目录执行：

```bash
python breadboard_web_demo/server.py
```

然后打开：

```text
http://127.0.0.1:8088
```

## 依赖

网页会优先从 `breadboard_web_demo/vendor` 加载依赖。若缺少依赖，可执行：

```bash
python -m pip install opencv-python numpy ultralytics torch torchvision --target breadboard_web_demo/vendor
```

## 输出

每次识别会在 `breadboard_web_demo/runs/` 中生成：

- `components_and_pins.png`
- `components_only.png`
- `component_pin_result.json`
