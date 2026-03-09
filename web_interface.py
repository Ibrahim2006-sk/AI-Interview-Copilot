import streamlit as st
import requests
import json
import os
import platform
import hashlib

API_BASE_URL = "http://127.0.0.1:8000"

st.set_page_config(page_title="AI Interview Coach", page_icon="👔", layout="centered")

# Generates a pseudo-hardware ID for the device running the Streamlit app
def get_device_id():
    system_info = platform.node() + platform.system() + platform.machine()
    return hashlib.sha256(system_info.encode()).hexdigest()

app_device_id = get_device_id()

# --- CUSTOM CSS FOR MODERN AESTHETICS ---
st.markdown("""
<style>
    /* Google Fonts */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    html, body, [class*="css"] {
        font-family: 'Inter', sans-serif;
    }

    .main-title {
        background: -webkit-linear-gradient(45deg, #FF6B6B, #4ECDC4);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-weight: 700;
        font-size: 3rem;
        margin-bottom: 0px;
    }
    
    .stButton>button {
        background: linear-gradient(90deg, #4b6cb7 0%, #182848 100%);
        color: white;
        border-radius: 8px;
        padding: 0.6rem 1.2rem;
        border: none;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .stButton>button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        color: white;
    }
</style>
""", unsafe_allow_html=True)

# -----------------------------------------
# SUBSCRIPTION & ACTIVATION LOGIC 
# -----------------------------------------
if 'license_key' not in st.session_state:
    st.session_state['license_key'] = "bypassed"
    st.session_state['is_authenticated'] = True

if not st.session_state['is_authenticated']:
    st.markdown('<h1 class="main-title">🔒 Premium AI Interviewer</h1>', unsafe_allow_html=True)
    st.markdown("### Subscription Activation")
    st.info(f"**Device ID:** `{app_device_id[:12]}`\n\nThis application is strictly bound to 1 Device per Subscription to prevent theft. If you deploy this via PyInstaller offline, this ID becomes your offline permanent HWID.")
    
    auth_key = st.text_input("Enter your License Key", type="password", help="e.g. STARTUP-PREMIUM-1234")
    
    if st.button("Activate Application"):
        with st.spinner("Validating subscription securely on the backend..."):
            headers = {
                "license-key": auth_key,
                "device-id": app_device_id
            }
            try:
                res = requests.post(f"{API_BASE_URL}/verify_license", headers=headers)
                if res.status_code == 200:
                    st.success(res.json().get("message", "Activated successfully!"))
                    st.session_state['license_key'] = auth_key
                    st.session_state['is_authenticated'] = True
                    st.rerun()
                else:
                    st.error(f"Activation Failed: {res.json().get('detail', 'Invalid key.')}")
            except requests.exceptions.ConnectionError:
                st.error("❌ Cannot reach backend licensing server.")
                
    st.stop() # Stop rendering the rest of the application


# -----------------------------------------
# MAIN APPLICATION LOGIC 
# -----------------------------------------
headers = {
    "license-key": st.session_state['license_key'],
    "device-id": app_device_id
}

st.markdown('<h1 class="main-title">👔 Multi-Language AI Interview Coach</h1>', unsafe_allow_html=True)
st.markdown("Prepare for your next job interview with professional AI-generated answers in any language. 🌍")

# Sidebar for Setup & Resume Upload
st.sidebar.header("⚙️ Configuration")
st.sidebar.success(f"License Active (Device bound).")
interview_type = st.sidebar.selectbox(
    "Select Interview Type", 
    ["HR Interview", "Technical Interview", "Behavioral Interview", "Managerial Interview"]
)

st.sidebar.subheader("📄 Upload Resume (Optional)")
st.sidebar.markdown("Upload your resume to let the AI personalize its response around your background.")
uploaded_resume = st.sidebar.file_uploader("Upload resume (PDF)", type=["pdf"])

resume_context = ""
if uploaded_resume:
    with st.spinner("Extracting resume..."):
        # Send to API backend
        files = {"file": (uploaded_resume.name, uploaded_resume.getvalue(), "application/pdf")}
        try:
            res = requests.post(f"{API_BASE_URL}/upload_resume", files=files, headers=headers)
            if res.status_code == 200:
                resume_context = res.json().get("resume_text", "")
                st.sidebar.success("✅ Resume processed successfully!")
            else:
                st.sidebar.error("❌ Failed to process resume or unauthenticated.")
        except requests.exceptions.ConnectionError:
            st.sidebar.error("❌ Error connecting to backend API. Please run the FastAPI app.")


st.divider()

st.header("💬 Ask a Question")
st.markdown("Type your interview question below in **any language** (English, Hindi, Spanish, Arabic, etc.).")

question = st.text_area("Interview Question", placeholder="e.g., Tell me about yourself. \nOr: Hablame de ti.\nOr: अपने बारे में कुछ बताइए।", height=120)

# Optional Voice Input feature
with st.expander("🎤 Use Voice Input instead (Optional)"):
    st.markdown("Record your question directly. Note: The environment must support audio recording.")
    audio_val = st.audio_input("Record your question")
    if audio_val:
        with st.spinner("Transcribing..."):
            files = {"file": ("audio.wav", audio_val.getvalue(), "audio/wav")}
            try:
                res = requests.post(f"{API_BASE_URL}/voice_to_text", files=files, headers=headers)
                if res.status_code == 200:
                    transcription = res.json().get("text", "")
                    st.success(f"**Transcribed Text:** {transcription}")
                    st.info("💡 You can copy the transcribed text and paste it into the Interview Question input above.")
            except Exception as e:
                st.error("Error transcribing audio. Make sure the backend is running.")

col1, col2 = st.columns([1, 1])
if st.button("Generate Professional Answer", type="primary", use_container_width=True):
    if not question.strip():
        st.warning("Please enter a question or transcribe one using voice input.")
    else:
        with st.spinner("🧠 Analyzing and Generating Answer... (Anti-Threat enabled)"):
            payload = {
                "question": question,
                "interview_type": interview_type,
                "resume_context": resume_context
            }
            try:
                res = requests.post(f"{API_BASE_URL}/generate_answer", json=payload, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    st.session_state['last_response'] = data
                else:
                    if res.status_code == 429:
                        st.error("Too many requests! Wait a moment to mitigate bot activity.")
                    else:
                        st.error(f"Error: {res.json().get('detail', 'Failed')}")
            except requests.exceptions.ConnectionError:
                st.error("❌ Cannot reach the backend API.")

# Display Results
if 'last_response' in st.session_state:
    data = st.session_state['last_response']
    st.divider()
    
    lang_display = data['detected_language'].upper()
    if lang_display == 'EN':
        st.subheader(f"🗣️ Language Detected: English")
    else:
        st.subheader(f"🗣️ Language Detected: `{lang_display}`")
    
    st.markdown(f"### 📝 Professional Response ({interview_type})")
    st.info(data['translated_answer'])
    
    if data['detected_language'] != 'en':
        with st.expander("🔍 Show Original English Translation"):
            st.write(f"**Translated English Question:**\n\n{data['translated_question']}")
            st.divider()
            st.write(f"**English AI Answer:**")
            st.write(data['english_answer'])
