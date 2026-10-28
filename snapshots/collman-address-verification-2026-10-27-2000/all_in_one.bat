@echo off
setlocal
title Collman Services Address Verification - All-In-One Control Center

REM Ensure we are in project root
cd /d "%~dp0"

REM -------------------------------------------------------------
REM Node.js Detection: Check custom directory, then system PATH
REM -------------------------------------------------------------
if exist "D:\ANTIGRAVITY\node-bin\node-v20.18.0-win-x64\node.exe" (
    set "PATH=D:\ANTIGRAVITY\node-bin\node-v20.18.0-win-x64;%PATH%"
)

where node.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found in your system PATH or D:\ANTIGRAVITY\node-bin.
    echo Please install Node.js 20 LTS from https://nodejs.org/
    pause
    exit /b 1
)

REM -------------------------------------------------------------
REM Main Interactive Menu
REM -------------------------------------------------------------
:MENU
cls
echo ==============================================================================
echo    COLLMAN SERVICES ADDRESS VERIFICATION ^& BGV - ALL-IN-ONE CONTROLLER
echo ==============================================================================
echo.
echo   [1]  ONE-CLICK START (Dev Mode: Backend + Frontend + Auto Browser)
echo   [2]  PRODUCTION START (Single Server: Port 5000 serving Built App)
echo   [3]  INSTALL / REPAIR DEPENDENCIES (Root + Client npm install)
echo   [4]  BUILD CLIENT BUNDLE (npm run build:client)
echo   [5]  INITIALIZE / RESET DATABASE (npm run seed)
echo   [6]  STOP ALL RUNNING SERVERS (Kill Port 5000 ^& Port 3000 processes)
echo   [7]  BACKUP DATABASE ^& UPLOADS (Export to ZIP)
echo   [8]  DEPLOY TO REMOTE UBUNTU SERVER (Automated SCP ^& Remote Deploy)
echo   [9]  OPEN PORTALS IN BROWSER
echo   [0]  EXIT
echo.
echo ==============================================================================
set "CHOICE="
set /p "CHOICE=Enter your choice [1-9, 0]: "

if "%CHOICE%"=="1" goto QUICK_START
if "%CHOICE%"=="2" goto PROD_START
if "%CHOICE%"=="3" goto INSTALL_DEPS
if "%CHOICE%"=="4" goto BUILD_CLIENT
if "%CHOICE%"=="5" goto SEED_DB
if "%CHOICE%"=="6" goto STOP_SERVERS
if "%CHOICE%"=="7" goto BACKUP_DATA
if "%CHOICE%"=="8" goto DEPLOY_UBUNTU
if "%CHOICE%"=="9" goto OPEN_BROWSER
if "%CHOICE%"=="0" exit /b 0

echo Invalid choice. Please try again.
timeout /t 2 >nul 2>&1
goto MENU

REM -------------------------------------------------------------
REM [1] Quick Start (Dev Mode)
REM -------------------------------------------------------------
:QUICK_START
cls
echo ==============================================================================
echo  Starting Collman Services BGV (Development Mode)
echo ==============================================================================
echo.

REM 1. Check root dependencies
if not exist "node_modules\" (
    echo [INFO] Installing root dependencies...
    call npm install
)

REM 2. Check client dependencies
if not exist "client\node_modules\" (
    echo [INFO] Installing client dependencies...
    call npm install --prefix client
)

REM 3. Check SQLite database
if not exist "server\db\collman_bgv.db" (
    echo [INFO] Database not found. Seeding initial admin and test data...
    call npm run seed
)

REM 4. Launch Backend
echo [INFO] Launching Backend Server on http://localhost:5000 ...
start "Collman Backend (Port 5000)" cmd /k "title Collman Backend && cd /d ""%~dp0"" && node server/index.js"

REM 5. Short delay
timeout /t 2 >nul 2>&1

REM 6. Launch Frontend
echo [INFO] Launching Frontend Vite Dev Server on http://localhost:3000 ...
start "Collman Frontend (Port 3000)" cmd /k "title Collman Frontend && cd /d ""%~dp0"" && npm run dev:client"

REM 7. Wait and Open Browser
timeout /t 3 >nul 2>&1
echo [INFO] Opening HR / Admin Portal in default browser...
start http://localhost:3000/admin/login

echo.
echo ==============================================================================
echo  Both servers started successfully!
echo.
echo  - HR / Admin Login:  http://localhost:3000/admin/login
echo  - Candidate Link:    http://localhost:3000/verify
echo  - Backend API:       http://localhost:5000/api/health
echo.
echo  Default Login:
echo    Username: admin@collman.com  ^|  Password: admin123
echo ==============================================================================
echo.
pause
goto MENU

REM -------------------------------------------------------------
REM [2] Production Start (Port 5000)
REM -------------------------------------------------------------
:PROD_START
cls
echo ==============================================================================
echo  Starting Collman Services BGV (Production Mode)
echo ==============================================================================
echo.

if not exist "client\dist\" (
    echo [INFO] Production bundle not found in client\dist. Building now...
    call npm run build:client
)

if not exist "server\db\collman_bgv.db" (
    echo [INFO] Database not found. Seeding initial data...
    call npm run seed
)

echo [INFO] Starting Production Server on Port 5000 (Serving API + Frontend)...
start "Collman Production Server" cmd /k "title Collman Production Server && cd /d ""%~dp0"" && set NODE_ENV=production && node server/index.js"

timeout /t 3 >nul 2>&1
start http://localhost:5000/admin/login

echo.
echo Production server started at http://localhost:5000
pause
goto MENU

REM -------------------------------------------------------------
REM [3] Install / Repair Dependencies
REM -------------------------------------------------------------
:INSTALL_DEPS
cls
echo ==============================================================================
echo  Installing Dependencies for Root and Client
echo ==============================================================================
echo.
echo [1/2] Installing Root Dependencies...
call npm install
echo.
echo [2/2] Installing Client Dependencies...
call npm install --prefix client
echo.
echo [SUCCESS] All dependencies installed successfully!
pause
goto MENU

REM -------------------------------------------------------------
REM [4] Build Client
REM -------------------------------------------------------------
:BUILD_CLIENT
cls
echo ==============================================================================
echo  Compiling Client Production Assets (Vite)
echo ==============================================================================
echo.
call npm run build:client
echo.
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Client build created in client\dist\
) else (
    echo [ERROR] Build failed. Review errors above.
)
pause
goto MENU

REM -------------------------------------------------------------
REM [5] Seed Database
REM -------------------------------------------------------------
:SEED_DB
cls
echo ==============================================================================
echo  Database Management: Initialize / Seed SQLite Database
echo ==============================================================================
echo.
echo This will ensure all master tables, default users, and sample cases exist.
set /p "CONFIRM=Proceed with seeding? [Y/n]: "
if /i not "%CONFIRM%"=="Y" if not "%CONFIRM%"=="" goto MENU

echo.
call npm run seed
echo.
echo [SUCCESS] Database updated at server\db\collman_bgv.db
pause
goto MENU

REM -------------------------------------------------------------
REM [6] Stop All Running Servers (Kill Ports 5000 & 3000)
REM -------------------------------------------------------------
:STOP_SERVERS
cls
echo ==============================================================================
echo  Stopping Collman Services Servers
echo ==============================================================================
echo.
echo Freeing Port 5000 (Backend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000" ^| findstr "LISTENING"') do (
    echo Killing Process PID %%a on Port 5000...
    taskkill /F /PID %%a >nul 2>&1
)

echo Freeing Port 3000 (Frontend)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Killing Process PID %%a on Port 3000...
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo [SUCCESS] Ports 5000 and 3000 are now clear.
pause
goto MENU

REM -------------------------------------------------------------
REM [7] Backup Database and Uploads
REM -------------------------------------------------------------
:BACKUP_DATA
cls
echo ==============================================================================
echo  Backup Database ^& Uploaded Documents
echo ==============================================================================
echo.

set "BACKUP_DIR=%~dp0backups"
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set "MYDATE=%%c-%%a-%%b")
for /f "tokens=1-2 delims=: " %%a in ('time /t') do (set "MYTIME=%%a%%b")
set "BACKUP_FILE=%BACKUP_DIR%\collman_backup_%MYDATE%_%MYTIME%.zip"

echo Creating backup at: %BACKUP_FILE%
powershell -NoProfile -Command "Compress-Archive -Path 'server\db\collman_bgv.db', 'server\uploads', 'server\downloads' -DestinationPath '%BACKUP_FILE%' -Force"

if exist "%BACKUP_FILE%" (
    echo.
    echo [SUCCESS] Backup created successfully:
    echo %BACKUP_FILE%
) else (
    echo [ERROR] Backup failed.
)
pause
goto MENU

REM -------------------------------------------------------------
REM [8] Deploy to Remote Ubuntu Server
REM -------------------------------------------------------------
:DEPLOY_UBUNTU
cls
echo ==============================================================================
echo  Deploy to Remote Ubuntu Server
echo ==============================================================================
echo.
call "%~dp0deploy_to_ubuntu.bat"
pause
goto MENU

REM -------------------------------------------------------------
REM [9] Open Portals
REM -------------------------------------------------------------
:OPEN_BROWSER
cls
echo ==============================================================================
echo  Opening Collman Portals in Default Browser
echo ==============================================================================
echo.
echo   [1] Open HR / Admin Portal (http://localhost:3000/admin/login)
echo   [2] Open Employee Candidate Link (http://localhost:3000/verify)
echo   [3] Open Backend API Health Check (http://localhost:5000/api/health)
echo   [0] Back to Main Menu
echo.
set /p "PORTAL_CHOICE=Select portal [1-3, 0]: "

if "%PORTAL_CHOICE%"=="1" start http://localhost:3000/admin/login
if "%PORTAL_CHOICE%"=="2" start http://localhost:3000/verify
if "%PORTAL_CHOICE%"=="3" start http://localhost:5000/api/health
if "%PORTAL_CHOICE%"=="0" goto MENU

goto MENU
