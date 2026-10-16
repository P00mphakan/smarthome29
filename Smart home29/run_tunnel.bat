@echo off
chcp 65001 >nul
title Cloudflare Tunnel for Tapo C200
cd /d "C:\Users\IOT WIN10\Smart Home29"
echo ========================================================
echo   กำลังเชื่อมต่อ Cloudflare Tunnel สำหรับ Vercel...
echo ========================================================
if exist cloudflared.exe (
    cloudflared.exe tunnel --url http://localhost:8088
) else (
    echo [คำเตือน] ไม่พบไฟล์ cloudflared.exe ในโฟลเดอร์นี้
    echo กรุณาดาวน์โหลด cloudflared-windows-amd64.exe แล้วเปลี่ยนชื่อเป็น cloudflared.exe มาวางที่นี่
    pause
)
