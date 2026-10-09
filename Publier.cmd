@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publier.ps1" %*
echo.
pause
