@echo off
REM UniAssist - FIRST-TIME SETUP. Run once. Place this file in the "uniassist" folder.
REM WARNING: this resets the database (deletes all data) and reloads the demo data.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get the LTS version from https://nodejs.org & pause & exit /b 1)
if not exist "server\package.json" (echo Put this file inside the "uniassist" folder ^(next to "server" and "client"^). & pause & exit /b 1)

if not exist "server\.env" (
  copy "server\.env.example" "server\.env" >nul
  echo Fill in DATABASE_URL and JWT_SECRET in Notepad, save, then close it.
  notepad "server\.env"
)

echo.
echo This will DELETE all data in the database and load the demo data.
choice /m "Continue"
if errorlevel 2 exit /b 0

echo [1/4] Installing server packages...
cd /d "%~dp0server"
call npm install || goto :fail
echo [2/4] Creating database tables...
call npm run db:init || goto :fail
echo [3/4] Loading school data...
call npm run seed || goto :fail
echo [4/4] Installing website packages...
cd /d "%~dp0client"
call npm install || goto :fail

echo.
echo Setup complete. From now on, just double-click start.bat
pause
exit /b 0

:fail
echo.
echo Setup stopped because of an error above. Copy the red text and send it for help.
pause
exit /b 1
