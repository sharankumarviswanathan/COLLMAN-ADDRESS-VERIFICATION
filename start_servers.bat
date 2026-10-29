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
if not exist "frontend\node_modules\" (
    echo [INFO] Installing frontend dependencies...
    call npm install --prefix frontend
)

REM Check SQLite Database
if not exist "backend\db\collman_bgv.db" (
    echo [INFO] Database not found. Seeding initial admin and test data...
    call npm run seed
)

REM Start Backend
echo [INFO] Starting Backend Server (Port 5000)...
start "Collman Backend (Port 5000)" cmd /k "title Collman Backend && cd /d ""%~dp0"" && node backend/index.js"

REM Short delay
timeout /t 2 >nul 2>&1

REM Start Frontend
echo [INFO] Starting Frontend Dev Server (Port 3000)...
start "Collman Frontend (Port 3000)" cmd /k "title Collman Frontend && cd /d ""%~dp0"" && npm run dev:frontend"

REM Resolve Local Network IP Address
set "HOST_IP=localhost"
for /f "tokens=*" %%i in ('node -e "const os=require('os');const ifs=os.networkInterfaces();let ip='localhost';for(const[n,list] of Object.entries(ifs)){for(const f of list){if(f.family==='IPv4'&&!f.internal&&!f.address.startsWith('169.254.')&&!/vEthernet|Virtual|WSL|VMware/i.test(n)){ip=f.address;break;}}}console.log(ip);"') do set "HOST_IP=%%i"

REM Auto-open browser
timeout /t 3 >nul 2>&1
echo [INFO] Opening HR / Admin Portal in default browser...
start http://localhost:3000/admin/login

echo.
echo =======================================================
echo  Servers started successfully in ANY IP / LAN Mode!
echo =======================================================
echo  [LOCAL ACCESS - This Computer]
echo   - HR / Admin:      http://localhost:3000/admin/login
echo   - Employee Link:   http://localhost:3000/verify
echo   - Backend API:     http://localhost:5000/api/health
echo.
echo  [NETWORK ACCESS - Any IP / Phone / Other Computers]
echo   - HR / Admin:      http://%HOST_IP%:3000/admin/login
echo   - Employee Link:   http://%HOST_IP%:3000/verify
echo   - Backend API:     http://%HOST_IP%:5000/api/health
echo =======================================================
echo  Default Login:
echo    Username: admin@collman.com  ^|  Password: admin123
echo =======================================================
echo.
echo Tip: For full management options, run 'all_in_one.bat'
echo.
pause
