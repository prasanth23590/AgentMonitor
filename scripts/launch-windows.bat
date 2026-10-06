@echo off
REM Agent Monitor launcher for Windows
REM Double-click this file, or pin it to taskbar / Start menu

set PORT=3001
set VITE_PORT=5173
set PROJECT=%~dp0

REM Kill any existing processes on those ports
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%PORT% "') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%VITE_PORT% "') do taskkill /F /PID %%a 2>nul

REM Start dev server in a minimised window
cd /d "%PROJECT%"
start /min "Agent Monitor" cmd /c "npm run dev > %TEMP%\agent-monitor.log 2>&1"

REM Wait for Vite to be ready (poll up to 10s)
set /a tries=0
:wait
timeout /t 1 /nobreak >nul
curl -s -o nul http://localhost:%VITE_PORT%
if %errorlevel%==0 goto launch
set /a tries=%tries%+1
if %tries% lss 10 goto wait

:launch
start "" "http://localhost:%VITE_PORT%"
