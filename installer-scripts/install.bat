@echo off
:: ============================================================
:: AJUQNET - Installation Script (Atlas Edition)
:: No MongoDB needed — uses MongoDB Atlas cloud
:: ============================================================

setlocal EnableDelayedExpansion

set INSTALL_DIR=%~1
if "%INSTALL_DIR%"=="" set INSTALL_DIR=C:\Program Files\AJUQNET

set LOG_FILE=%TEMP%\ajuqnet_install.log
echo [%date% %time%] AJUQNET v10.0.3 Installation Started > "%LOG_FILE%"
echo Install directory: %INSTALL_DIR% >> "%LOG_FILE%"

:: ── Step 1: Install Node.js if not present ───────────────────
echo [%date% %time%] Checking Node.js... >> "%LOG_FILE%"
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [%date% %time%] Node.js not found. Installing... >> "%LOG_FILE%"
    msiexec /i "%~dp0..\redist\node-v18.20.4-x64.msi" /qn /norestart /log "%TEMP%\nodejs_install.log"
    if !errorlevel! neq 0 (
        echo [%date% %time%] ERROR: Node.js installation failed! >> "%LOG_FILE%"
        exit /b 1
    )
    echo [%date% %time%] Node.js installed. >> "%LOG_FILE%"
    set "PATH=%PATH%;C:\Program Files\nodejs"
) else (
    echo [%date% %time%] Node.js already installed. Skipping. >> "%LOG_FILE%"
)

:: ── Step 2: npm install ───────────────────────────────────────
echo [%date% %time%] Running npm install... >> "%LOG_FILE%"
cd /d "%INSTALL_DIR%"
call npm install --omit=dev >> "%LOG_FILE%" 2>&1
if %errorlevel% neq 0 (
    echo [%date% %time%] ERROR: npm install failed! >> "%LOG_FILE%"
    exit /b 1
)
echo [%date% %time%] npm install done. >> "%LOG_FILE%"

:: ── Step 3: Generate .env file ────────────────────────────────
echo [%date% %time%] Generating .env... >> "%LOG_FILE%"
node "%INSTALL_DIR%\installer-scripts\generate-env.js" "%INSTALL_DIR%" >> "%LOG_FILE%" 2>&1
if %errorlevel% neq 0 (
    echo [%date% %time%] ERROR: .env generation failed! >> "%LOG_FILE%"
    exit /b 1
)
echo [%date% %time%] .env generated. >> "%LOG_FILE%"

:: ── Step 4: Seed the database ─────────────────────────────────
echo [%date% %time%] Seeding the database... >> "%LOG_FILE%"
node seed.js >> "%LOG_FILE%" 2>&1
echo [%date% %time%] Database seeded. >> "%LOG_FILE%"

:: ── Step 5: Register AJUQNET as a Windows Service ────────────
echo [%date% %time%] Registering Windows Service... >> "%LOG_FILE%"

"%INSTALL_DIR%\redist\nssm.exe" stop AJUQNET >nul 2>&1
"%INSTALL_DIR%\redist\nssm.exe" remove AJUQNET confirm >nul 2>&1

for /f "tokens=*" %%i in ('where node') do set NODE_PATH=%%i

"%INSTALL_DIR%\redist\nssm.exe" install AJUQNET "%NODE_PATH%" "server.js"
"%INSTALL_DIR%\redist\nssm.exe" set AJUQNET AppDirectory "%INSTALL_DIR%"
"%INSTALL_DIR%\redist\nssm.exe" set AJUQNET AppEnvironmentExtra "NODE_ENV=production"
"%INSTALL_DIR%\redist\nssm.exe" set AJUQNET DisplayName "AJUQNET Campus System"
"%INSTALL_DIR%\redist\nssm.exe" set AJUQNET Description "Arka Jain University Quick Network System"
"%INSTALL_DIR%\redist\nssm.exe" set AJUQNET Start SERVICE_AUTO_START
"%INSTALL_DIR%\redist\nssm.exe" set AJUQNET AppStdout "%INSTALL_DIR%\logs\output.log"
"%INSTALL_DIR%\redist\nssm.exe" set AJUQNET AppStderr "%INSTALL_DIR%\logs\error.log"
"%INSTALL_DIR%\redist\nssm.exe" set AJUQNET AppRestartDelay 5000

mkdir "%INSTALL_DIR%\logs" >nul 2>&1

"%INSTALL_DIR%\redist\nssm.exe" start AJUQNET >> "%LOG_FILE%" 2>&1
echo [%date% %time%] AJUQNET service started. >> "%LOG_FILE%"

echo [%date% %time%] Installation complete! >> "%LOG_FILE%"
exit /b 0