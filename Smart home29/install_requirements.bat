@echo off
chcp 65001 >nul
title Install Smart Home 29 Dependencies
cd /d "C:\Users\IOT WIN10\Smart Home29"
echo ========================================================
echo   ติดตั้งไลบรารี Python สำหรับ Windows...
echo ========================================================
pip install opencv-python requests
echo.
echo ✅ ติดตั้งเสร็จสมบูรณ์
pause
