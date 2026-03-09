import subprocess
import sys
import os

def main():
    print("====================================")
    print("🚀 Starting Premium AI Interviewer ...")
    print("====================================")
    
    # Check if static files exist
    if not os.path.exists("static/index.html"):
        print("[!] ERROR: static/index.html not found! Ensure you are running from the correct directory.")
        sys.exit(1)
        
    print("[1] Starting Unified FastAPI server...")
    print("    -> Serving Frontend at http://127.0.0.1:8000")
    print("    -> Anti-Theft Security Binding is Active")
    
    fastapi_process = subprocess.Popen([sys.executable, "-m", "uvicorn", "api_server:app", "--host", "127.0.0.1", "--port", "8000"])
    
    try:
        fastapi_process.wait()
    except KeyboardInterrupt:
        print("\n[!] Shutting down natively...")
        fastapi_process.terminate()

if __name__ == "__main__":
    main()
