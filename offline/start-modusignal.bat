@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "PORT=4173"
set "URL=http://localhost:%PORT%"

set "PY="
set "PYARGS="

where python >nul 2>&1 && set "PY=python"

if not defined PY (
  where py >nul 2>&1 && set "PY=py" && set "PYARGS=-3"
)

if not defined PY (
  echo.
  echo [ERROR] Python 3 not found.
  echo Install Python 3 from python.org/downloads/
  echo.
  pause
  exit /b 1
)

echo.
echo modusignal: %URL%
echo.

if defined PYARGS (
  start "modusignal-server" cmd /k "%PY% %PYARGS% -m http.server %PORT%"
) else (
  start "modusignal-server" cmd /k "%PY% -m http.server %PORT%"
)

timeout /t 2 /nobreak >nul
start "" "%URL%"

echo.
echo Browser opened. Close the modusignal-server window to stop.
echo.
pause
endlocal
