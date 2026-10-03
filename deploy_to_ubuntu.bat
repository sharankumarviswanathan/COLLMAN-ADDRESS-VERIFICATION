@echo off
setlocal
title Collman Services - Deploy to Remote Ubuntu Server

cd /d "%~dp0"

echo ==============================================================================
echo    COLLMAN SERVICES BGV - REMOTE UBUNTU DEPLOYMENT FROM WINDOWS
echo ==============================================================================
echo.
echo This tool will package your application, copy it to your remote Ubuntu server
echo via SCP, and trigger the automated Ubuntu setup script.
echo.

REM 1. Check for native Windows ssh and scp
where ssh.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] ssh.exe not found in Windows PATH.
    echo Please enable OpenSSH Client in Windows Settings: Apps - Optional Features.
    pause
    exit /b 1
)

REM 2. Gather Remote Server Details
set "SERVER_IP="
set /p "SERVER_IP=Enter Remote Ubuntu Server IP or Domain: "
if "%SERVER_IP%"=="" (
    echo [ERROR] Server IP / Domain cannot be empty.
    pause
    exit /b 1
)

set "SSH_USER="
set /p "SSH_USER=Enter SSH Username [default: ubuntu]: "
if "%SSH_USER%"=="" set "SSH_USER=ubuntu"

set "SSH_PORT="
set /p "SSH_PORT=Enter SSH Port [default: 22]: "
if "%SSH_PORT%"=="" set "SSH_PORT=22"

set "REMOTE_DIR="
set /p "REMOTE_DIR=Enter Remote Target Directory [default: /var/www/collman-bgv]: "
if "%REMOTE_DIR%"=="" set "REMOTE_DIR=/var/www/collman-bgv"

echo.
echo ------------------------------------------------------------------------------
echo Target Server:    %SSH_USER%@%SERVER_IP%:%SSH_PORT%
echo Target Directory: %REMOTE_DIR%
echo ------------------------------------------------------------------------------
echo.
set "PROCEED="
set /p "PROCEED=Ready to deploy to %SERVER_IP%? [Y/n]: "
if /i not "%PROCEED%"=="Y" if not "%PROCEED%"=="" exit /b 0

REM 3. Package local repository (excluding huge node_modules and builds)
echo.
echo [1/4] Packaging project into collman_deploy.tar.gz (excluding node_modules)...
if exist "collman_deploy.tar.gz" del /f /q "collman_deploy.tar.gz"

tar --exclude="node_modules" --exclude="client/node_modules" --exclude="client/dist" --exclude=".git" --exclude="backups" --exclude="collman_deploy.tar.gz" -czvf collman_deploy.tar.gz *
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to create deployment archive.
    pause
    exit /b 1
)
echo [SUCCESS] Package created successfully.

REM 4. Transfer archive to remote server
echo.
echo [2/4] Uploading archive to %SERVER_IP% via SCP...
scp -P %SSH_PORT% collman_deploy.tar.gz %SSH_USER%@%SERVER_IP%:/tmp/collman_deploy.tar.gz
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] SCP transfer failed. Please check server IP, SSH credentials, and firewall.
    del /f /q "collman_deploy.tar.gz"
    pause
    exit /b 1
)
echo [SUCCESS] Archive uploaded to /tmp/collman_deploy.tar.gz on remote server.

REM 5. Extract and run remote deployment script via SSH
echo.
echo [3/4] Unpacking and executing deploy-ubuntu.sh on remote server...
ssh -p %SSH_PORT% -t %SSH_USER%@%SERVER_IP% "sudo mkdir -p %REMOTE_DIR% && sudo tar -xzvf /tmp/collman_deploy.tar.gz -C %REMOTE_DIR% && cd %REMOTE_DIR% && sudo chmod +x deploy-ubuntu.sh update-ubuntu.sh && sudo bash deploy-ubuntu.sh '%SERVER_IP%' && sudo rm -f /tmp/collman_deploy.tar.gz"

REM 6. Cleanup local archive
echo.
echo [4/4] Cleaning up local temporary archive...
if exist "collman_deploy.tar.gz" del /f /q "collman_deploy.tar.gz"

echo.
echo ==============================================================================
echo  DEPLOYMENT COMPLETED!
echo  Your Collman Services BGV Platform is now running on your Ubuntu server.
echo ==============================================================================
echo.
