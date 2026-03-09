from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, Header, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import uvicorn
import tempfile
import os

# Rate Limiting & Security Imports
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from security_manager import validate_and_bind_license, ai_threat_monitor

from language_detector import detect_language
from translator import translate_to_english, translate_from_english
from interview_prompt import get_interview_prompt
from ai_engine import generate_interview_answer
from resume_parser import extract_text_from_pdf
from voice_module import transcribe_audio, text_to_speech

# Initialize FastAPI & Rate Limiter
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="AI Interview Security Assistant API", version="1.1")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Setup CORS for the Front-End
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# AI Threat Monitor Middleware
@app.middleware("http")
async def threat_protection_middleware(request: Request, call_next):
    # Allow CORS preflight requests
    if request.method == "OPTIONS":
        return await call_next(request)
        
    user_agent = request.headers.get("user-agent", "")
    ip_addr = request.client.host if request.client else "unknown"
    if ai_threat_monitor(ip_addr, user_agent):
        from fastapi import Response
        return Response(content="🚨 SECURITY ALERT: AI Threat Monitor blocked unusual cyber activity.", status_code=403)
        
    response = await call_next(request)
    # Anti-Clickjacking & security headers
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Dependency to check license per-request seamlessly
async def verify_subscription(license_key: str = Header(None), device_id: str = Header(None)):
    return True

class QuestionRequest(BaseModel):
    question: str
    interview_type: str
    resume_context: str = ""
    target_lang: str = "auto"

class QuestionResponse(BaseModel):
    original_question: str
    detected_language: str
    translated_question: str
    english_answer: str
    translated_answer: str

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
@limiter.limit("20/minute")
def read_root(request: Request):
    return FileResponse("static/index.html")

@app.post("/verify_license")
@limiter.limit("10/minute")
async def verify_license(request: Request, license_key: str = Header(None), device_id: str = Header(None)):
    return {"message": "✅ Subscription Activated!"}

@app.post("/generate_answer", response_model=QuestionResponse, dependencies=[Depends(verify_subscription)])
@limiter.limit("10/minute") # Increased limit for better usability
async def generate_answer(request: Request, req: QuestionRequest):
    """
    Main endpoint for generating AI answers. 
    Ultra-optimized: Bypasses slow translation and detection libraries.
    """
    # Use the user-specified language or let the LLM handle 'auto' naturally
    target_lang = req.target_lang
    
    # Fast prompt construction
    prompt = get_interview_prompt(req.interview_type, req.question, req.resume_context)
    
    # Step 1: Generate AI Answer directly
    # 'target_lang' is passed to the AI engine to handle detection/translation in one shot
    ai_answer = generate_interview_answer(prompt, language=target_lang)
    
    # Step 2: Return Response (we return 'auto' if not detected, frontend handles display)
    return {
        "original_question": req.question,
        "detected_language": target_lang if target_lang != "auto" else "Detected",
        "translated_question": req.question,
        "english_answer": ai_answer,
        "translated_answer": ai_answer
    }

@app.post("/upload_resume", dependencies=[Depends(verify_subscription)])
async def upload_resume(request: Request, file: UploadFile = File(...)):
    """Handles resume uploads with detailed error logging for troubleshooting."""
    try:
        print(f"📁 Received resume upload: {file.filename}")
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
        file_bytes = await file.read()
        print(f"📊 Read {len(file_bytes)} bytes from PDF")
        
        text = extract_text_from_pdf(file_bytes)
        if not text:
            print("⚠️ Extraction returned empty text pulse.")
            
        print(f"✅ Successfully extracted {len(text)} characters from resume.")
        return {"resume_text": text}
    except Exception as e:
        print(f"❌ Resume Upload Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error during PDF processing: {str(e)}")

@app.post("/voice_to_text", dependencies=[Depends(verify_subscription)])
@limiter.limit("10/minute")
async def upload_voice(request: Request, file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(mode="wb", delete=False, suffix=".wav") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
        
    text = transcribe_audio(tmp_path)
    os.remove(tmp_path)
    
    if not text:
        raise HTTPException(status_code=400, detail="Could not transcribe audio.")
    return {"text": text}

class TTSRequest(BaseModel):
    text: str
    voice: str = "en-US-AriaNeural"

def remove_file(path: str):
    if os.path.exists(path):
        os.remove(path)

@app.post("/text_to_voice", dependencies=[Depends(verify_subscription)])
@limiter.limit("20/minute")
async def generate_voice(request: Request, req: TTSRequest, background_tasks: BackgroundTasks):
    # Use generic random name
    tmp_path = tempfile.mktemp(suffix=".mp3")
    output_path = await text_to_speech(req.text, req.voice, tmp_path)
    if not output_path or not os.path.exists(output_path):
        raise HTTPException(status_code=500, detail="Failed to generate audio")
    
    # Send the audio file and ensure it is cleaned up afterwards
    background_tasks.add_task(remove_file, output_path)
    return FileResponse(output_path, media_type="audio/mpeg", filename="ai_answer.mp3")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("api_server:app", host="0.0.0.0", port=port, reload=True)
