@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publier-launcher.ps1" %*
echo.
pause
