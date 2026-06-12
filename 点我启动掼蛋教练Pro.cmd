@echo off
setlocal EnableExtensions
pushd "%~dp0"
title Guandan Coach Pro

echo.
echo [Guandan Coach Pro 2.0]
echo Starting local server and opening browser...
echo Folder: %CD%
echo.

where node >nul 2>&1
if errorlevel 1 goto no_node

if exist "tools\ai-coach-server.mjs" (
  echo Starting training collector on port 8787...
  start "guandan-training-collector" /min node "%CD%\tools\ai-coach-server.mjs"
)

node "%CD%\tools\open-coach.mjs"
if errorlevel 1 goto failed

echo.
echo URL: http://127.0.0.1:8010/app/
echo After code changes: close old tabs and run this script again.
echo If Edge fails, run: set GUANDAN_BROWSER=chrome
echo Do NOT double-click html files.
echo Keep this window open while playing.
echo Press any key to close this window.
pause >nul
exit /b 0

:no_node
echo ERROR: Node.js not found. Install Node.js LTS first.
echo Download: https://nodejs.org/
pause
exit /b 1

:failed
echo.
echo Failed. Try: npm run dev
echo Then open: http://127.0.0.1:8010/app/
pause
exit /b 1
