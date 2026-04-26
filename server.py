from __future__ import annotations

import base64
import json
import mimetypes
import os
import sys
import traceback
import uuid
import warnings
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

warnings.filterwarnings(
    "ignore",
    category=DeprecationWarning,
    message="'.*cgi.*' is deprecated.*",
)
import cgi  # noqa: E402

APP_DIR = Path(__file__).resolve().parent


def _default_project_root() -> Path:
    board_root = APP_DIR.parent
    candidates = [
        board_root / "LabGuardian-Server-main",
        board_root / "LabGuardian-Server-main" / "LabGuardian-Server-main",
        board_root,
    ]
    for candidate in candidates:
        if (candidate / "app").is_dir():
            return candidate
    return candidates[0]


DEFAULT_ROOT_DIR = _default_project_root()
ROOT_DIR = Path(os.environ.get("LABGUARDIAN_PROJECT_ROOT", DEFAULT_ROOT_DIR)).expanduser().resolve()
STATIC_DIR = APP_DIR / "static"
RUNS_DIR = Path(os.environ.get("LABGUARDIAN_RUNS_DIR", APP_DIR / "runs")).expanduser().resolve()
UPLOADS_DIR = Path(os.environ.get("LABGUARDIAN_UPLOADS_DIR", APP_DIR / "uploads")).expanduser().resolve()
VENDOR_DIR = APP_DIR / "vendor"
ULTRALYTICS_CONFIG_DIR = APP_DIR / "ultralytics_config"

ULTRALYTICS_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("YOLO_CONFIG_DIR", str(ULTRALYTICS_CONFIG_DIR))
if VENDOR_DIR.exists() and str(VENDOR_DIR) not in sys.path:
    sys.path.insert(0, str(VENDOR_DIR))
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


def _json_safe(value: Any) -> Any:
    try:
        json.dumps(value)
        return value
    except TypeError:
        if isinstance(value, dict):
            return {str(key): _json_safe(item) for key, item in value.items()}
        if isinstance(value, (list, tuple)):
            return [_json_safe(item) for item in value]
        return str(value)


def _safe_child(base: Path, *parts: str) -> Path:
    target = (base.joinpath(*parts)).resolve()
    resolved_base = base.resolve()
    if target != resolved_base and resolved_base not in target.parents:
        raise FileNotFoundError
    return target


def _image_to_b64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def _load_component_pipeline():
    try:
        import cv2

        from app.core.config import settings
        from app.pipeline.stages.s1_detect import run_detect
        from app.pipeline.stages.s1b_pin_detect import run_pin_detect
        from app.pipeline.vision.detector import ComponentDetector
        from app.pipeline.vision.pin_model import PinRoiDetector
    except ModuleNotFoundError as exc:
        missing = exc.name or "required package"
        raise RuntimeError(
            f"Missing dependency or project module: {missing}. "
            f"Project root is configured as {ROOT_DIR}. On the board, put this folder next to "
            f"LabGuardian-Server-main or set LABGUARDIAN_PROJECT_ROOT=/path/to/LabGuardian-Server-main. "
            f"Install the vision dependencies first, for example: "
            f"python3 -m pip install opencv-python numpy ultralytics torch"
        ) from exc

    return {
        "cv2": cv2,
        "settings": settings,
        "run_detect": run_detect,
        "run_pin_detect": run_pin_detect,
        "ComponentDetector": ComponentDetector,
        "PinRoiDetector": PinRoiDetector,
    }


def _run_component_pin_pipeline(
    *,
    image_path: Path,
    out_dir: Path,
    conf: float,
    iou: float,
    imgsz: int,
) -> dict[str, Any]:
    modules = _load_component_pipeline()
    cv2 = modules["cv2"]
    settings = modules["settings"]
    run_detect = modules["run_detect"]
    run_pin_detect = modules["run_pin_detect"]
    ComponentDetector = modules["ComponentDetector"]
    PinRoiDetector = modules["PinRoiDetector"]

    image = cv2.imread(str(image_path))
    if image is None:
        raise ValueError("Could not read the uploaded image.")

    detector = ComponentDetector(
        model_path=settings.YOLO_MODEL_PATH,
        obb_model_path=settings.YOLO_OBB_MODEL_PATH,
        device=settings.YOLO_DEVICE,
    )
    if detector.model is None:
        _force_load_component_detector(detector, settings.YOLO_MODEL_PATH)

    pin_detector = PinRoiDetector(
        model_path=settings.PIN_MODEL_PATH,
        device=settings.PIN_MODEL_DEVICE,
    )

    images_b64 = [_image_to_b64(image_path)]
    detect_result = run_detect(
        images_b64,
        detector=detector,
        conf=conf,
        iou=iou,
        imgsz=imgsz,
    )
    pin_result = run_pin_detect(
        detections=detect_result.get("detections", []),
        images_b64=images_b64,
        pin_detector=pin_detector,
        supplemental_detections=detect_result.get("supplemental_detections"),
    )

    components = pin_result.get("components", [])
    component_only = _draw_components(cv2, image, components, draw_pins=False)
    component_pins = _draw_components(cv2, image, components, draw_pins=True)

    out_dir.mkdir(parents=True, exist_ok=True)
    component_only_path = out_dir / "components_only.png"
    component_pins_path = out_dir / "components_and_pins.png"
    json_path = out_dir / "component_pin_result.json"
    cv2.imwrite(str(component_only_path), component_only)
    cv2.imwrite(str(component_pins_path), component_pins)

    result = {
        "component_count": len(components),
        "pin_count": sum(len(component.get("pins", [])) for component in components),
        "image_size": {"width": int(image.shape[1]), "height": int(image.shape[0])},
        "detector": {
            "component_backend": detect_result.get("detector_backend"),
            "component_model_path": settings.YOLO_MODEL_PATH,
            "pin_backend": pin_result.get("pin_detector_backend"),
            "pin_mode": pin_result.get("pin_detector_mode"),
            "pin_model_path": settings.PIN_MODEL_PATH,
        },
        "components": _compact_components(components),
        "raw": {
            "detect": detect_result,
            "pin_detect": pin_result,
        },
        "paths": {
            "components_only": str(component_only_path),
            "components_and_pins": str(component_pins_path),
            "json": str(json_path),
        },
    }
    json_path.write_text(json.dumps(_json_safe(result), ensure_ascii=False, indent=2), encoding="utf-8")
    return result


def _force_load_component_detector(detector: Any, model_path: str) -> None:
    """Load YOLO directly when the project wrapper fails silently inside a server request."""
    try:
        from ultralytics import YOLO

        detector.model = YOLO(model_path)
        detector.model_path = model_path
        detector._is_obb = False
        detector.model_contract = {
            "path": model_path,
            "exists": Path(model_path).exists(),
            "task": "detect",
            "model_class": "YOLO",
            "names": [],
            "kpt_shape": None,
            "loaded": True,
        }
    except Exception as exc:
        raise RuntimeError(
            "The component detector was not loaded. Check that ultralytics/torch are installed "
            f"and that the component model exists: {model_path}. Loader error: {exc}"
        ) from exc


def _compact_components(components: list[dict[str, Any]]) -> list[dict[str, Any]]:
    compact = []
    for component in components:
        pins = []
        for pin in component.get("pins", []):
            pins.append(
                {
                    "pin_id": pin.get("pin_id"),
                    "pin_name": pin.get("pin_name"),
                    "top_keypoint": (pin.get("keypoints_by_view") or {}).get("top"),
                    "confidence": pin.get("confidence"),
                    "source": pin.get("source"),
                    "source_by_view": pin.get("source_by_view"),
                }
            )
        compact.append(
            {
                "component_id": component.get("component_id"),
                "component_type": component.get("component_type"),
                "package_type": component.get("package_type"),
                "bbox": component.get("bbox"),
                "confidence": component.get("confidence"),
                "orientation": component.get("orientation"),
                "pin_detector": component.get("pin_detector"),
                "pins": pins,
            }
        )
    return compact


def _draw_components(cv2: Any, image: Any, components: list[dict[str, Any]], *, draw_pins: bool) -> Any:
    annotated = image.copy()
    palette = [
        (20, 126, 108),
        (30, 92, 180),
        (180, 98, 28),
        (130, 72, 170),
        (35, 140, 45),
        (190, 55, 70),
    ]
    for index, component in enumerate(components):
        color = palette[index % len(palette)]
        bbox = component.get("bbox") or [0, 0, 0, 0]
        if len(bbox) != 4:
            continue
        x1, y1, x2, y2 = [int(round(float(v))) for v in bbox]
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 3, cv2.LINE_AA)
        label = (
            f"{component.get('component_id', '')} "
            f"{component.get('component_type', 'UNKNOWN')} "
            f"{float(component.get('confidence') or 0):.2f}"
        ).strip()
        _draw_label(cv2, annotated, label, x1, max(0, y1 - 28), color)

        if not draw_pins:
            continue
        for pin in component.get("pins", []):
            point = (pin.get("keypoints_by_view") or {}).get("top")
            if not point:
                continue
            px, py = [int(round(float(v))) for v in point[:2]]
            cv2.circle(annotated, (px, py), 7, (0, 210, 255), -1, cv2.LINE_AA)
            cv2.circle(annotated, (px, py), 9, (35, 35, 35), 2, cv2.LINE_AA)
            pin_label = str(pin.get("pin_name") or f"pin{pin.get('pin_id', '')}")
            _draw_label(cv2, annotated, pin_label, px + 10, py - 20, (0, 120, 160), scale=0.48)
    if not components:
        _draw_label(cv2, annotated, "No components detected", 24, 28, (40, 90, 160), scale=0.8)
    return annotated


def _draw_label(
    cv2: Any,
    image: Any,
    text: str,
    x: int,
    y: int,
    color: tuple[int, int, int],
    *,
    scale: float = 0.62,
) -> None:
    thickness = 2
    font = cv2.FONT_HERSHEY_SIMPLEX
    (tw, th), baseline = cv2.getTextSize(text, font, scale, thickness)
    x = max(0, min(int(x), image.shape[1] - max(1, tw) - 8))
    y = max(th + 8, min(int(y), image.shape[0] - baseline - 6))
    cv2.rectangle(image, (x, y - th - 8), (x + tw + 8, y + baseline + 5), color, -1)
    cv2.putText(image, text, (x + 4, y), font, scale, (255, 255, 255), thickness, cv2.LINE_AA)


class BreadboardDemoHandler(SimpleHTTPRequestHandler):
    server_version = "LabGuardianComponentPinDemo/1.0"

    def log_message(self, format: str, *args: object) -> None:
        sys.stdout.write("%s - %s\n" % (self.address_string(), format % args))

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        if path in {"/", "/index.html"}:
            self._send_file(STATIC_DIR / "index.html")
            return
        if path.startswith("/static/"):
            self._send_file(_safe_child(STATIC_DIR, path.removeprefix("/static/")))
            return
        if path.startswith("/api/results/"):
            parts = path.removeprefix("/api/results/").split("/", 1)
            if len(parts) != 2:
                self._send_error(404, "File not found")
                return
            run_id, filename = parts
            try:
                self._send_file(_safe_child(RUNS_DIR, run_id, filename))
            except FileNotFoundError:
                self._send_error(404, "File not found")
            return
        self._send_error(404, "Not found")

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path != "/api/analyze":
            self._send_error(404, "Not found")
            return
        try:
            payload = self._handle_analyze()
        except Exception as exc:
            traceback.print_exc()
            self._send_json({"detail": str(exc)}, status=422)
            return
        self._send_json(payload)

    def _handle_analyze(self) -> dict[str, Any]:
        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": self.headers.get("Content-Type", ""),
                "CONTENT_LENGTH": self.headers.get("Content-Length", "0"),
            },
        )

        file_item = form["image"] if "image" in form else None
        if file_item is None or not getattr(file_item, "filename", ""):
            raise ValueError("Please upload a breadboard image.")

        conf = float(form.getfirst("conf", "0.25"))
        iou = float(form.getfirst("iou", "0.5"))
        imgsz = int(form.getfirst("imgsz", "960"))
        if not (0.01 <= conf <= 0.99):
            raise ValueError("conf must be between 0.01 and 0.99.")
        if not (0.01 <= iou <= 0.99):
            raise ValueError("iou must be between 0.01 and 0.99.")
        if imgsz < 320 or imgsz > 1920:
            raise ValueError("imgsz must be between 320 and 1920.")

        content = file_item.file.read()
        if not content:
            raise ValueError("The uploaded image is empty.")

        RUNS_DIR.mkdir(parents=True, exist_ok=True)
        UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

        run_id = uuid.uuid4().hex[:12]
        suffix = Path(file_item.filename).suffix.lower()
        if suffix not in {".jpg", ".jpeg", ".png", ".bmp", ".webp"}:
            suffix = ".png"
        upload_path = UPLOADS_DIR / f"{run_id}{suffix}"
        upload_path.write_bytes(content)

        result = _run_component_pin_pipeline(
            image_path=upload_path,
            out_dir=RUNS_DIR / run_id,
            conf=conf,
            iou=iou,
            imgsz=imgsz,
        )

        paths = result.get("paths", {})
        image_urls = {
            key: f"/api/results/{run_id}/{Path(path).name}"
            for key, path in paths.items()
            if str(path).lower().endswith((".png", ".jpg", ".jpeg", ".webp"))
        }

        return {
            "run_id": run_id,
            "input_name": file_item.filename,
            "component_count": result.get("component_count"),
            "pin_count": result.get("pin_count"),
            "image_size": result.get("image_size"),
            "detector": result.get("detector"),
            "components": _json_safe(result.get("components", [])),
            "images": image_urls,
            "data": {
                "json": f"/api/results/{run_id}/{Path(paths.get('json', '')).name}",
            },
        }

    def _send_file(self, path: Path) -> None:
        if not path.exists() or not path.is_file():
            self._send_error(404, "File not found")
            return
        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_json(self, payload: dict[str, Any], status: int = 200) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_error(self, status: int, detail: str) -> None:
        self._send_json({"detail": detail}, status=status)


def main() -> None:
    host = os.environ.get("LABGUARDIAN_WEB_HOST", "0.0.0.0")
    port = int(os.environ.get("LABGUARDIAN_WEB_PORT", "8088"))
    server = HTTPServer((host, port), BreadboardDemoHandler)
    print(f"LabGuardian component and pin demo: http://{host}:{port}")
    print(f"Project root: {ROOT_DIR}")
    print(f"Runs dir: {RUNS_DIR}")
    print(f"Uploads dir: {UPLOADS_DIR}")
    print("Press Ctrl+C to stop.")
    server.serve_forever()


if __name__ == "__main__":
    main()
