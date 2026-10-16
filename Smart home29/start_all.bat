@echo off
chcp 65001 >nul
title Smart Home 29 - Start All Services
cd /d "C:\Users\IOT WIN10\Smart Home29"
echo ========================================================
echo   เริ่มระบบสตรีมมิ่ง Smart Home 29 ทั้งหมด...
echo ========================================================

start "Tapo Camera Stream Server" cmd /c "run_stream.bat"
timeout /t 3 /nobreak >nul
start "Cloudflare Tunnel" cmd /c "run_tunnel.bat"

echo.
echo ✅ เริ่มต้นระบบทั้งสองตัวเรียบร้อยแล้ว
