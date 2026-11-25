@echo off
title POS System Server
echo Starting Modern POS System...

:: Start the Node.js server in the same window, but allow the batch script to continue
start /b node server.js

:: Wait for 3 seconds to ensure the server is fully up and running
timeout /t 3 /nobreak >nul

:: Open browser in normal window mode (default browser)
echo Opening Browser in normal window...
start "" http://localhost:3000

echo.
echo ==================================================
echo POS System is running! 
echo Browser opened in normal window. Press F11 if you want full screen.
echo To stop the server, press Ctrl+C in this window.
echo ==================================================
