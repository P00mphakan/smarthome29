@echo off
chcp 65001 >nul
title Tapo C200 Camera Stream Server
cd /d "C:\Users\IOT WIN10\Smart Home29"
echo ========================================================
echo   กำลังเริ่มเซิร์ฟเวอร์สตรีมมิ่ง Tapo C200 (พอร์ต 8088)...
echo ========================================================
python camera_stream.py
pause
