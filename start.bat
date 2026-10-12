@echo off
REM UniAssist - START. Double-click to run the app. Place this file in the "uniassist" folder.
cd /d "%~dp0"
if not exist "server\node_modules" (echo Run setup.bat first. & pause & exit /b 1)
if not exist "client\node_modules" (echo Run setup.bat first. & pause & exit /b 1)

start "UniAssist SERVER - keep open" cmd /k "cd /d "%~dp0server" && npm run dev"
start "UniAssist WEBSITE - keep open" cmd /k "cd /d "%~dp0client" && npm run dev"

echo Starting... the browser will open in a few seconds.
timeout /t 8 /nobreak >nul
start "" http://localhost:5173
echo To stop the app, close the two windows named "UniAssist".
timeout /t 5 >nul
