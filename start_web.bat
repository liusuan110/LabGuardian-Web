@echo off
setlocal
cd /d "%~dp0.."
start "" "http://127.0.0.1:8088"
python "breadboard_web_demo\server.py"
if errorlevel 1 (
  echo.
  echo Failed to start. If Python cannot find cv2, run:
  echo python -m pip install opencv-python numpy --target breadboard_web_demo\vendor
  echo.
  pause
)
