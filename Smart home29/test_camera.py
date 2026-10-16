import subprocess
import shutil
import sys
import os

print("=" * 60)
print("  Smart Home 29 - เครื่องมือตรวจสอบระบบกล้องบน Windows")
print("=" * 60)

# 1. ตรวจสอบ Python
print(f"[1] Python Version: {sys.version.split()[0]}")

# 2. ตรวจสอบ FFmpeg
ffmpeg_path = shutil.which("ffmpeg") or (os.path.exists("ffmpeg.exe") and "ffmpeg.exe")
if ffmpeg_path:
    print(f"[2] FFmpeg Engine: ✅ พบโปรแกรม ({ffmpeg_path})")
else:
    print(f"[2] FFmpeg Engine: ❌ ไม่พบในระบบ")

# 3. ตรวจสอบ OpenCV
try:
    import cv2
    print(f"[3] OpenCV (cv2): ✅ ติดตั้งแล้ว (v{cv2.__version__})")
except ImportError:
    print(f"[3] OpenCV (cv2): ❌ ยังไม่ได้ติดตั้ง (แนะนำ: ดับเบิ้ลคลิก install_requirements.bat)")

# 4. ตรวจสอบการเชื่อมต่อไปยังกล้องนอกบ้าน 10.82.1.22
print("\nกำลังทดสอบเชื่อมต่อกล้องนอกบ้าน (10.82.1.22)...")
try:
    ping_cmd = ["ping", "-n", "2", "-w", "1500", "10.82.1.22"]
    res = subprocess.run(ping_cmd, capture_output=True, text=True)
    if "TTL=" in res.stdout or "Reply from" in res.stdout or "bytes=" in res.stdout:
        print("[4] สัญญาณเครือข่ายไปยังกล้อง 10.82.1.22: ✅ เชื่อมต่อได้ปกติ!")
    else:
        print("[4] สัญญาณเครือข่ายไปยังกล้อง 10.82.1.22: ❌ ไม่พบสัญญาณ (Request timed out)")
        print("    -> เครื่อง Windows และกล้องอาจจะอยู่คนละวงเน็ตเวิร์กกัน")
except Exception as e:
    print(f"[4] เกิดข้อผิดพลาดในการ Ping: {e}")

print("=" * 60)
input("\nกด Enter เพื่อปิดหน้าต่างนี้...")
