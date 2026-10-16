@echo off
chcp 65001 >nul
title Smart Home 29 - Camera Diagnostics
cd /d "C:\Users\IOT WIN10\Smart Home29"
python test_camera.py
pause
