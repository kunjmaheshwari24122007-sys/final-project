@echo off
title InterviewAce Launcher
echo ===================================================
echo   InterviewAce AI - Production Launcher
echo ===================================================
echo.

:: Ensure node is found in PATH
where node >nul 2>nul
if %errorlevel% neq 0 (
    if exist "%USERPROFILE%\nodejs\node.exe" (
        set "PATH=%USERPROFILE%\nodejs;%PATH%"
    ) else if exist "C:\Program Files\nodejs\node.exe" (
        set "PATH=C:\Program Files\nodejs;%PATH%"
    )
)

echo 1. Starting InterviewAce Full-Stack Server (Port 5000)...
start "InterviewAce Server" cmd /k "cd /d ""%~dp0backend"" && (where node >nul 2>nul || set ""PATH=%USERPROFILE%\nodejs;C:\Program Files\nodejs;%%PATH%%"") && node server.js"

timeout /t 2 >nul
echo.
echo 2. Opening InterviewAce in your default browser...
start http://localhost:5000

echo.
echo Server is running at http://localhost:5000!
echo Keep the server console window open while practicing.
echo.
