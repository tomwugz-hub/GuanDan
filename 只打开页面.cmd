@echo off
setlocal EnableExtensions
pushd "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: need Node.js. Use main launcher cmd.
  pause
  exit /b 1
)

node "%CD%\tools\open-coach.mjs"
if errorlevel 1 (
  echo Failed. Try: npm run dev
  pause
  exit /b 1
)
pause
