@echo off
chcp 65001 >nul
title InfoLake — применение обновления
cd /d "%~dp0"
echo.
echo ========================================
echo   InfoLake — применение обновления
echo ========================================
echo.
echo Не закрывайте это окно до завершения.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply-update.ps1" -PackageDir "%~dp0"
echo.
echo ----------------------------------------
pause
