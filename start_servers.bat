@echo off
setlocal
title Collman Address Verification - Quick Launcher
cd /d "%~dp0"

REM -------------------------------------------------------------
REM Node.js Detection: Check custom directory, then system PATH
REM -------------------------------------------------------------
if exist "D:\ANTIGRAVITY\node-bin\node-v20.18.0-win-x64\node.exe" (
    set "PATH=D:\ANTIGRAVITY\node-bin\node-v20.18.0-win-x64;%PATH%"
)

where node.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found in PATH or D:\ANTIGRAVITY\node-bin.
    echo Please install Node.js 20 LTS from https://nodejs.org/
    pause
    exit /b 1
)

echo =======================================================
echo  Starting Collman Services Address Verification System
echo =======================================================
echo.

REM Check dependencies
if not exist "node_modules\" (
    echo [INFO] Installing root dependencies...
    call npm install
)
if not exist "client\node_modules\" (
    echo [INFO] Installing client dependencies...
    call npm install --prefix client
)

REM Check SQLite Database
if not exist "server\db\collman_bgv.db" (
    echo [INFO] Database not found. Seeding initial admin and test data...
    call npm run seed
)

REM Start Backend
echo [INFO] Starting Backend Server (Port 5000)...
start "Collman Backend (Port 5000)" cmd /k "title Collman Backend && cd /d ""%~dp0"" && node server/index.js"

REM Short delay
timeout /t 2 >nul 2>&1

REM Start Frontend
echo [INFO] Starting Frontend Dev Server (Port 3000)...
start "Collman Frontend (Port 3000)" cmd /k "title Collman Frontend && cd /d ""%~dp0"" && npm run dev:client"

REM Auto-open browser
timeout /t 3 >nul 2>&1
echo [INFO] Opening HR / Admin Portal in default browser...
start http://localhost:3000/admin/login

echo.
echo =======================================================
echo  Servers started successfully!
echo  - HR / Admin Portal:   http://localhost:3000/admin/login
echo  - Employee Link:       http://localhost:3000/verify
echo  - Backend API Health:  http://localhost:5000/api/health
echo.
echo  Default Login:
echo    Username: admin@collman.com  ^|  Password: admin123
echo =======================================================
echo.
echo Tip: For full management options, run 'all_in_one.bat'
echo.
pause
