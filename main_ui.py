"""
TOOFAN Shield & GPay Simulator — Unified One-Click Launcher
Usage:
    python main_ui.py
"""

import os
import sys
import time
import socket
import signal
import shutil
import webbrowser
import subprocess
from pathlib import Path

# Ensure UTF-8 output encoding on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"

# Ensure local portable node is discovered if present on system
NODE_PORTABLE_DIR = Path(r"D:\tools\node")
if NODE_PORTABLE_DIR.exists() and str(NODE_PORTABLE_DIR) not in os.environ.get("PATH", ""):
    os.environ["PATH"] = f"{NODE_PORTABLE_DIR};" + os.environ.get("PATH", "")

BACKEND_HOST = "127.0.0.1"
BACKEND_PORT = 8000
FRONTEND_HOST = "localhost"
FRONTEND_PORT = 5173

processes = []

def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    for family, addr in [(socket.AF_INET, "127.0.0.1"), (socket.AF_INET6, "::1")]:
        try:
            with socket.socket(family, socket.SOCK_STREAM) as s:
                s.settimeout(0.5)
                if s.connect_ex((addr, port)) == 0:
                    return True
        except Exception:
            pass
    return False

def wait_for_port(port: int, timeout: float = 15.0, host: str = "127.0.0.1") -> bool:
    start = time.time()
    while time.time() - start < timeout:
        if is_port_in_use(port, host):
            return True
        time.sleep(0.3)
    return False

def cleanup(sig=None, frame=None):
    print("\n[TOOFAN] Shutting down background services...")
    for p in processes:
        try:
            if sys.platform == "win32":
                subprocess.call(
                    ["taskkill", "/F", "/T", "/PID", str(p.pid)],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            else:
                p.terminate()
        except Exception:
            pass
    print("[TOOFAN] All services stopped. Goodbye!")
    sys.exit(0)

signal.signal(signal.SIGINT, cleanup)
signal.signal(signal.SIGTERM, cleanup)

def main():
    if sys.platform == "win32":
        os.system("color")

    print("""
========================================================================
             TOOFAN SHIELD & GPAY CASH SIMULATOR
                 All-in-One Local Runner v0.2.0
========================================================================
""")

    # 1. Start Backend (FastAPI via Uvicorn)
    if is_port_in_use(BACKEND_PORT):
        is_toofan = False
        try:
            import urllib.request
            with urllib.request.urlopen(f"http://127.0.0.1:{BACKEND_PORT}/docs", timeout=1.0) as resp:
                is_toofan = "TOOFAN" in resp.read().decode("utf-8", errors="ignore")
        except Exception:
            pass

        if is_toofan:
            print(f"[OK] TOOFAN Backend already listening on port {BACKEND_PORT}")
        else:
            print(f"[!] Warning: Port {BACKEND_PORT} is currently in use by another application.")
            print(f"    (If another project like MindBridge is running, stop it to use TOOFAN backend).")
    else:
        print(f"[*] Starting FastAPI backend on http://{BACKEND_HOST}:{BACKEND_PORT}...")
        backend_cmd = [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            BACKEND_HOST,
            "--port",
            str(BACKEND_PORT),
        ]
        backend_proc = subprocess.Popen(
            backend_cmd,
            cwd=str(BACKEND_DIR),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        processes.append(backend_proc)

        if wait_for_port(BACKEND_PORT, timeout=12.0):
            print(f"[OK] Backend online at http://{BACKEND_HOST}:{BACKEND_PORT} (Docs: /docs)")
        else:
            print(f"[!] Warning: Backend port {BACKEND_PORT} did not respond in time.")

    # 2. Start Frontend (Vite Dev Server or fallback http.server for dist)
    if is_port_in_use(FRONTEND_PORT, FRONTEND_HOST):
        print(f"[OK] Frontend already listening on port {FRONTEND_PORT}")
    else:
        npm_path = shutil.which("npm.cmd") or shutil.which("npm")
        if npm_path and (FRONTEND_DIR / "node_modules").exists():
            print(f"[*] Starting Vite dev server on http://{FRONTEND_HOST}:{FRONTEND_PORT}...")
            frontend_cmd = [npm_path, "run", "dev"]
            frontend_proc = subprocess.Popen(
                frontend_cmd,
                cwd=str(FRONTEND_DIR),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                shell=(sys.platform == "win32"),
            )
            processes.append(frontend_proc)
        else:
            dist_dir = FRONTEND_DIR / "dist"
            print(f"[*] Serving pre-built frontend from {dist_dir} on port {FRONTEND_PORT}...")
            fallback_cmd = [
                sys.executable,
                "-m",
                "http.server",
                str(FRONTEND_PORT),
                "--directory",
                str(dist_dir),
            ]
            frontend_proc = subprocess.Popen(fallback_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            processes.append(frontend_proc)

        if wait_for_port(FRONTEND_PORT, timeout=15.0):
            print(f"[OK] Frontend online at http://{FRONTEND_HOST}:{FRONTEND_PORT}")
        else:
            print(f"[*] Waiting for frontend on port {FRONTEND_PORT}...")

    dashboard_url = f"http://{FRONTEND_HOST}:{FRONTEND_PORT}/"
    gpay_url = f"http://{FRONTEND_HOST}:{FRONTEND_PORT}/pay"

    print(f"""
========================================================================
                          SERVICES READY!
------------------------------------------------------------------------
  * Shield Command Center:  {dashboard_url}
  * GPay Cash Simulator:    {gpay_url}
  * FastAPI Backend:        http://{BACKEND_HOST}:{BACKEND_PORT}/docs
========================================================================

Opening browser in 2 seconds...
(Press Ctrl+C anytime to stop all servers)
""")

    time.sleep(1.5)
    try:
        webbrowser.open(dashboard_url)
    except Exception:
        pass

    try:
        while True:
            time.sleep(1)
            for p in processes:
                if p.poll() is not None:
                    err = p.stderr.read().decode(errors="ignore") if p.stderr else ""
                    if err:
                        print(f"[Error in child process {p.pid}]: {err}")
    except KeyboardInterrupt:
        cleanup()

if __name__ == "__main__":
    main()
