@echo off
:: ============================================================
:: AJUQNET - Launch Script (Atlas Edition)
:: No MongoDB service needed
:: ============================================================

set INSTALL_DIR=C:\Program Files\AJUQNET

:: ── Start AJUQNET service if not running ─────────────────────
sc query AJUQNET | find "RUNNING" >nul 2>&1
if %errorlevel% neq 0 (
    net start AJUQNET >nul 2>&1
    timeout /t 4 /nobreak >nul
)

:: ── Open browser ─────────────────────────────────────────────
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"

exit /b 0