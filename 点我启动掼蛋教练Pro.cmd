@echo off
chcp 65001 >nul 2>&1
setlocal EnableExtensions
pushd "%~dp0"
title Guandan Coach Pro

echo.
echo [Guandan Coach Pro 2.0]
echo Starting local server...
echo Folder: %CD%
echo.

where node >nul 2>&1
if errorlevel 1 goto no_node

echo [firewall] Allow TCP 8010 on LAN...
powershell -NoProfile -ExecutionPolicy Bypass -File "%CD%\tools\allow-lan-firewall.ps1"
set FIREWALL_ERR=%ERRORLEVEL%

if exist "tools\ai-coach-server.mjs" (
  echo Starting training collector on port 8787...
  start "guandan-training-collector" /min node "%CD%\tools\ai-coach-server.mjs"
)

node "%CD%\tools\open-coach.mjs"
if errorlevel 1 goto failed

echo.
echo Keep this window open while playing.
echo Press any key to exit.
pause >nul
exit /b 0

:no_node
echo ERROR: Node.js not found. Install from https://nodejs.org/
pause
exit /b 1

:failed
echo.
echo Failed. Run: npm run dev
pause
exit /b 1
