@echo off
:: ============================================================
:: AJUQNET - Uninstall Script
:: Runs during uninstallation to clean up services
:: ============================================================

set INSTALL_DIR=C:\Program Files\AJUQNET

echo Stopping AJUQNET service...
net stop AJUQNET >nul 2>&1
"%INSTALL_DIR%\redist\nssm.exe" stop AJUQNET >nul 2>&1
"%INSTALL_DIR%\redist\nssm.exe" remove AJUQNET confirm >nul 2>&1

echo AJUQNET has been removed.
echo Note: MongoDB service has been kept installed.
echo Note: Your database data has been kept intact.
echo If you want to remove MongoDB, use Windows Add/Remove Programs.

exit /b 0
