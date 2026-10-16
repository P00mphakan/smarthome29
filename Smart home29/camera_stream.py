#!/usr/bin/env python3
"""
Tapo C200 Local Streaming Server (Snapshot ทุก 1 นาที & 1080p On-Demand Video)
=============================================================================
รองรับทั้ง Windows (C:\\Users\\IOT WIN10\\Smart Home29) และ macOS
รองรับทั้ง ffmpeg และ OpenCV (cv2) อัตโนมัติ
"""

import http.server
import socketserver
import subprocess
import threading
import time
import os
import sys
import urllib.parse
import shutil

PORT = 8088
DIR = os.path.dirname(os.path.abspath(__file__))

# ตรวจสอบตัวแปลงสัญญาณ ffmpeg (PATH หรือ ffmpeg.exe ในโฟลเดอร์)
FFMPEG_CMD = shutil.which("ffmpeg")
if not FFMPEG_CMD:
    local_ffmpeg = os.path.join(DIR, "ffmpeg.exe")
    if os.path.exists(local_ffmpeg):
        FFMPEG_CMD = local_ffmpeg

# ตรวจสอบ OpenCV สำรอง
HAVE_CV2 = False
try:
    import cv2
    HAVE_CV2 = True
except ImportError:
    pass

CAMERAS = {
    "outdoor": {
        "name": "กล้องนอกบ้าน Tapo C200",
        "ip": "10.82.1.22",
        "user": "poomphakan@gmail.com",
        "pass": "#Boonpim00",
        "rtsp": "rtsp://poomphakan%40gmail.com:%23Boonpim00@10.82.1.22:554/stream1"
    }
}

# เก็บแคชภาพ Snapshot ล่าสุดในหน่วยความจำ (In-Memory Buffer)
latest_snapshots = {
    "outdoor": None
}
snapshot_timestamps = {
    "outdoor": 0
}

def capture_single_snapshot(cam_id):
    """บันทึกภาพ 1 เฟรมจาก RTSP โดยใช้ ffmpeg หรือ cv2 สำรอง"""
    cam = CAMERAS.get(cam_id)
    if not cam:
        return None

    temp_file = os.path.join(DIR, f"{cam_id}_tmp.jpg")
    target_file = os.path.join(DIR, f"{cam_id}_snapshot.jpg")

    # วิธีที่ 1: ใช้ FFmpeg (แนะนำ เร็วและเสถียร)
    if FFMPEG_CMD:
        cmd = [
            FFMPEG_CMD,
            "-rtsp_transport", "tcp",
            "-i", cam["rtsp"],
            "-frames:v", "1",
            "-q:v", "2",
            temp_file,
            "-y"
        ]
        try:
            res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5)
            if res.returncode == 0 and os.path.exists(temp_file):
                with open(temp_file, "rb") as f:
                    data = f.read()
                latest_snapshots[cam_id] = data
                snapshot_timestamps[cam_id] = int(time.time() * 1000)
                os.replace(temp_file, target_file)
                return data
        except Exception:
            pass
        finally:
            if os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except Exception:
                    pass

    # วิธีที่ 2: ใช้ OpenCV สำรอง (ถ้าไม่มี FFmpeg)
    if HAVE_CV2:
        try:
            cap = cv2.VideoCapture(cam["rtsp"])
            if cap.isOpened():
                ret, frame = cap.read()
                cap.release()
                if ret:
                    _, buf = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
                    data = buf.tobytes()
                    latest_snapshots[cam_id] = data
                    snapshot_timestamps[cam_id] = int(time.time() * 1000)
                    with open(target_file, "wb") as f:
                        f.write(data)
                    return data
        except Exception:
            pass

    return None

class TapoStreamHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith("/snapshot/"):
            cam_id = path.split("/")[2]
            self.serve_snapshot(cam_id)
        elif path.startswith("/video/"):
            cam_id = path.split("/")[2]
            self.serve_video_1080p(cam_id)
        elif path == "/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            status_data = f'{{"status":"ok","outdoor_ts":{snapshot_timestamps["outdoor"]}}}'
            self.wfile.write(status_data.encode('utf-8'))
        else:
            # เสิร์ฟไฟล์ static
            super().do_GET()

    def serve_snapshot(self, cam_id):
        """ส่งภาพ Snapshot ล่าสุดไปยังเบราว์เซอร์ พร้อมคำสั่งห้ามแคช"""
        data = latest_snapshots.get(cam_id)
        
        # ถ้ายังไม่มีในแรม ให้ลองอ่านจากไฟล์
        if not data:
            fpath = os.path.join(DIR, f"{cam_id}_snapshot.jpg")
            if os.path.exists(fpath):
                try:
                    with open(fpath, "rb") as f:
                        data = f.read()
                except Exception:
                    pass

        # ถ้ายังไม่มีอีก ให้สั่งจับภาพสดทันที
        if not data:
            data = capture_single_snapshot(cam_id)

        if data:
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(data)
        else:
            self.send_error(404, f"Snapshot for {cam_id} not available")

    def serve_video_1080p(self, cam_id):
        """สตรีมวิดีโอสดขนาด 1080p On-Demand เมื่อกดปุ่ม Play"""
        cam = CAMERAS.get(cam_id)
        if not cam:
            self.send_error(404, "Camera not found")
            return

        print(f"🎬 [1080P VIDEO] เริ่มสตรีมวิดีโอสดกล้อง: {cam['name']}")
        
        if FFMPEG_CMD:
            cmd = [
                FFMPEG_CMD,
                "-rtsp_transport", "tcp",
                "-i", cam["rtsp"],
                "-s", "1920x1080",
                "-f", "mpjpeg",
                "-q:v", "4",
                "-r", "20",
                "-"
            ]
            try:
                process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
                self.send_response(200)
                self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=ffmpeg")
                self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()

                while True:
                    chunk = process.stdout.read(8192)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
            except Exception:
                pass
            finally:
                if 'process' in locals():
                    process.terminate()
                    print(f"⏹ [1080P VIDEO] หยุดสตรีมสดกล้อง: {cam['name']}")
        elif HAVE_CV2:
            try:
                cap = cv2.VideoCapture(cam["rtsp"])
                self.send_response(200)
                self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=cv2frame")
                self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()

                while cap.isOpened():
                    ret, frame = cap.read()
                    if not ret:
                        break
                    _, buf = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
                    chunk = buf.tobytes()
                    self.wfile.write(b"--cv2frame\r\nContent-Type: image/jpeg\r\nContent-Length: " + str(len(chunk)).encode() + b"\r\n\r\n" + chunk + b"\r\n")
                    time.sleep(0.04) # ~25fps
                cap.release()
            except Exception:
                pass
            finally:
                print(f"⏹ [1080P VIDEO] หยุดสตรีมสดกล้อง: {cam['name']}")
        else:
            self.send_error(500, "Neither ffmpeg nor opencv-python is installed")

def periodic_snapshot_worker():
    """
    วนลูปถ่าย Snapshot ทุก 1 นาที (60 วินาที)
    ลบและสลับไฟล์เป้าหมายแบบ atomic replace (ไม่สะสมไฟล์ขยะ)
    """
    while True:
        for cam_id in CAMERAS.keys():
            try:
                capture_single_snapshot(cam_id)
            except Exception:
                pass
        time.sleep(60) # Snap ทุก 1 นาที

if __name__ == "__main__":
    t = threading.Thread(target=periodic_snapshot_worker, daemon=True)
    t.start()

    engine = "FFmpeg" if FFMPEG_CMD else ("OpenCV (cv2)" if HAVE_CV2 else "None (ติดตั้ง ffmpeg หรือ pip install opencv-python)")

    print("=" * 66)
    print(f" 🚀 Tapo C200 Hub (Snap ทุก 1 นาที + On-Demand 1080p Video)")
    print(f" ⚙️  Engine: {engine}")
    print(f" 🌐 เซิร์ฟเวอร์พร้อมทำงานที่พอร์ต {PORT}")
    print(f" 📸 ดูสแนปช็อต: http://localhost:{PORT}/snapshot/outdoor")
    print(f" 🎬 ดูวิดีโอ 1080p สด: http://localhost:{PORT}/video/outdoor")
    print("=" * 66)

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), TapoStreamHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")
            httpd.server_close()
