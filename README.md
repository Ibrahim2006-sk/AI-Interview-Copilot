# 🔒 STARTUP Premium - AI Interviewer Secure

This repository has been upgraded to a strict **Premium Subscription Startup Model** with intense security measures, hardware binding, and offline capabilities.

## 🚀 Newly Added Security & Startup Features
1. **Device-Binding Module (Anti-Theft)**
   - Every user gets 1 unique `Device ID` automatically calculated via their hardware signature (`security_manager.py`). 
   - A single valid license key (`STARTUP-PREMIUM-1234`) will lock itself forever to the *first physical device* that uses it. If a user tries sharing their license key with a friend, the AI backend blocks it natively.
2. **AI Threat Monitor & Rate Limiter**
   - The backend runs `slowapi` to mitigate DDoS requests or hackers trying to scrape/bot your AI bandwidth.
   - Intelligent middleware specifically bans unapproved User-Agents and typical cyber-attack fingerprints (sqlmap, nmap, excessive curl requests).
3. **Streamlit Premium Gate**
   - No one can access your Interview layout without logging in and verifying their license.

## 📦 Deploying & Securing Offline (PyInstaller + PyArmor)

To make it a true "Directly installable paid app" for offline users, you must bundle the code so users cannot see or steal your python scripts.

1. **Obfuscate your source code so hackers can't modify it:**
   Run the following terminal command (requires you to install `pyarmor >= 8.0`):
   ```bash
   pyarmor gen -O dist/ *.py
   ```
   *This scrambles all Python files to stop debugging and reverse engineering!*

2. **Bundle into a single Windows `.exe` application:**
   You can use `pyinstaller` to convert this into a 1-click startup app for your customers!
   ```bash
   pyinstaller --onefile run_app.py
   ```
   Give the resulting `run_app.exe` to your customers! 

## 🌐 Deploying to your Personal Website (Online)
If you want to host it online instead:
1. Rent a server on **Render.com** or **Railway.app** (they offer free tiers).
2. Host the `api_server.py` and `web_interface.py` safely there.
3. Whenever a real user pays you via Stripe/PayPal on your personal website, manually copy their email and generate a license for them inside your `license_db.json`. Give them the key, and they plug it into the web-app!

## 🧪 Testing Right Now
Run your app locally to test your security systems!
```bash
python run_app.py
```
> **Test Key:** Use `STARTUP-PREMIUM-1234` or `TEST-LICENSE-0000` to magically activate the system offline right now!
