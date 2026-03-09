import uuid
import hashlib
import json
import os
import platform

# Mock database file for our licensing
DB_FILE = "license_db.json"

def init_db():
    if not os.path.exists(DB_FILE):
        with open(DB_FILE, "w") as f:
            # mock database structure
            json.dump({
                "licenses": {
                    "STARTUP-PREMIUM-1234": {"device_id": None, "is_active": True},
                    "TEST-LICENSE-0000": {"device_id": None, "is_active": True}
                }
            }, f)

def get_db():
    init_db()
    with open(DB_FILE, "r") as f:
        return json.load(f)

def save_db(data):
    with open(DB_FILE, "w") as f:
        json.dump(data, f, indent=4)

def generate_hardware_id() -> str:
    """Generates a hardware ID for device binding. Useful if deployed as a desktop app."""
    system = platform.node() + platform.system() + platform.machine()
    return hashlib.sha256(system.encode()).hexdigest()

def validate_and_bind_license(license_key: str, device_id: str) -> dict:
    """Validates the license and binds it to exactly ONE device securely."""
    db = get_db()
    
    if license_key not in db["licenses"]:
        return {"valid": False, "message": "❌ Invalid License Key. Subscription not found."}
    
    license_data = db["licenses"][license_key]
    
    if not license_data["is_active"]:
        return {"valid": False, "message": "❌ License is inactive or expired."}
        
    # Device Binding Logic (1 Subscription = 1 Device)
    if license_data["device_id"] is None:
        # First time activation - Bind the device
        license_data["device_id"] = device_id
        db["licenses"][license_key] = license_data
        save_db(db)
        return {"valid": True, "message": "✅ Subscription Activated & Bound to this Device!"}
    elif license_data["device_id"] != device_id:
        # Anti-theft / License sharing detection!
        return {"valid": False, "message": "🚨 ANTI-THEFT: This license is already used on another device."}
    
    return {"valid": True, "message": "✅ License Validated."}

def ai_threat_monitor(request_ip: str, user_agent: str):
    """
    Simulated AI Threat Monitoring & Auto-Fix System.
    In production, this could use an ML model to detect anomalous request patterns
    and automatically ban IPs or adjust firewall rules (cloudflare/WAF).
    """
    # Simple heuristic
    suspicious_agents = ["curl", "postman", "sqlmap", "nmap"]
    if any(agent in str(user_agent).lower() for agent in suspicious_agents):
        return True # Threat detected
    return False

init_db()
