@echo off
setlocal
cd /d "%~dp0"
title Collman Services - Local IP Launcher

if exist "D:\ANTIGRAVITY\node-bin\node-v20.18.0-win-x64\node.exe" (
    set "PATH=D:\ANTIGRAVITY\node-bin\node-v20.18.0-win-x64;%PATH%"
)

for /f "tokens=*" %%i in ('node -e "const os=require('os');const ifs=os.networkInterfaces();let ip='127.0.0.1';for(const[n,list] of Object.entries(ifs)){for(const f of list){if(f.family==='IPv4'&&!f.internal&&!f.address.startsWith('169.254.')&&!/vEthernet|Virtual|WSL|VMware/i.test(n)){ip=f.address;break;}}}console.log(ip);"') do set "LOCAL_IP=%%i"

if "%LOCAL_IP%"=="" set "LOCAL_IP=192.168.1.70"

echo ================================================================
echo  COLLMAN SERVICES ADDRESS VERIFICATION - LOCAL IP MODE
echo ================================================================
echo  Detected Local IP Address: %LOCAL_IP%
echo ================================================================
echo.

REM 1. Start Backend on 0.0.0.0:5000
echo [1/3] Starting Backend Server (0.0.0.0:5000)...
start "Collman Backend (Port 5000)" cmd /k "title Collman Backend (Port 5000) && cd /d ""%~dp0"" && node backend/index.js"

timeout /t 2 >nul 2>&1

REM 2. Start Frontend on 0.0.0.0:3000
echo [2/3] Starting Frontend Dev Server (0.0.0.0:3000)...
start "Collman Frontend (Port 3000)" cmd /k "title Collman Frontend (Port 3000) && cd /d ""%~dp0"" && npm run dev:frontend"

timeout /t 3 >nul 2>&1

REM 3. Open browser directly with the Local IP URL
echo [3/3] Opening Application on Local IP in default browser...
start http://%LOCAL_IP%:3000/admin/login

echo.
echo ================================================================
echo   APPLICATION RUNNING ON LOCAL IP:
echo ================================================================
echo   * HR / Admin Login:  http://%LOCAL_IP%:3000/admin/login
echo   * Employee Link:     http://%LOCAL_IP%:3000/verify
echo   * Backend API:       http://%LOCAL_IP%:5000/api/health
echo ================================================================
echo   Default Credentials:
echo     Username: admin@collman.com
echo     Password: admin123
echo ================================================================
echo.
