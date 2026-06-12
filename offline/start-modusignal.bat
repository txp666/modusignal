@echo off
chcp 65001 >nul
cd /d "%~dp0"

set PORT=4173
set URL=http://localhost:%PORT%

set PY=
where python >nul 2>&1 && set PY=python
if not defined PY where py >nul 2>&1 && set PY=py -3

if not defined PY (
  echo.
  echo Python 3 not found. Install from https://www.python.org/downloads/
  echo 未找到 Python 3，请先安装：https://www.python.org/downloads/
  echo.
  pause
  exit /b 1
)

echo.
echo modusignal -> %URL%
echo 正在启动 modusignal -> %URL%
echo.

start "modusignal-server" cmd /k "%PY% -m http.server %PORT%"

timeout /t 2 /nobreak >nul
start "" %URL%

echo Browser opened. Close the modusignal-server window to stop.
echo 浏览器已打开。关闭 modusignal-server 窗口即可停止服务。
echo.
pause
