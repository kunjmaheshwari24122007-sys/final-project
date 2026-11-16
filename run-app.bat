@echo off
title InterviewAce Launcher
echo ===================================================
echo   InterviewAce AI - Production Launcher
echo ===================================================
echo.
echo 1. Starting InterviewAce Full-Stack Server (Port 5000)...
start "InterviewAce Server" cmd /k "cd /d %~dp0backend && node server.js"

timeout /t 2 >nul
echo.
echo 2. Opening InterviewAce in your default browser...
start http://localhost:5000

echo.
echo Server is running! Press any key or close window to exit launcher.
echo.
