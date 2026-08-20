@echo off
title Attendance Pro
chcp 65001 >nul
echo   Starting Attendance Pro...
cd /d "%~dp0"
if not exist "node_modules" (
  echo.
  echo   [X] Dependencies not found. Please run Install.bat first.
  echo.
  pause
  exit /b 1
)
if not exist ".env" (
  echo   [X] Missing .env. Please run Install.bat first.
  pause
  exit /b 1
)
rem Start the server minimized, then open the app in the browser.
start "Attendance Pro Server" /min cmd /c "node server.js"
timeout /t 4 /nobreak >nul
start "" "http://localhost:3000/login"
exit