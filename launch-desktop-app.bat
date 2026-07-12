@echo off
title Daily Relational Todo & Security Center Launcher
echo ====================================================================
echo  Daily Relational Todo - Desktop Launcher (Offline Secure Storage)
echo ====================================================================
echo.
echo [1/3] Ensuring local dependencies are installed...
call npm install
echo.
echo [2/3] Spinning up local Express and Vite servers...
start "" /b npm run dev
echo.
echo [3/3] Waiting for server initialization...
timeout /t 3 >nul
echo.
echo Launching standalone view...
:: Try to open in Chrome App Mode if chrome.exe is available, otherwise open default URL
where chrome >nul 2>nul
if %ERRORLEVEL% equ 0 (
    start chrome --app=http://localhost:3000
) else (
    start http://localhost:3000
)
echo.
echo --------------------------------------------------------------------
echo [SUCCESS] Daily Relational Todo is active at http://localhost:3000
echo.
echo NOTE: Please keep this command prompt window open while using the app.
echo To shut down the app, you can close this window.
echo --------------------------------------------------------------------
pause
