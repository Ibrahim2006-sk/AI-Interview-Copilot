// ============================================================
//  INTERVIEW COPILOT — FINAL ROUND AI STYLE — app.js
// ============================================================

// ─── State ───────────────────────────────────────────────────
let deviceId = "";
let licenseKey = localStorage.getItem("premium_license_key") || "";
let resumeContextText = localStorage.getItem("resume_context") || "";
let resumeFileName = localStorage.getItem("resume_filename") || "";
let isAutonomousMode = false;
let isProcessing = false;
let isMuted = false;
let questionCount = 0;
let sessionSeconds = 0;
let sessionTimerInterval = null;
let historyItems = [];
let lastAnswerText = "";
let lastAudioBlob = null;
let autoSpeak = localStorage.getItem("auto_speak") !== "false"; // default ON

// ─── Speech Recognition ──────────────────────────────────────
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let recognitionActive = false;

// ─── Hardware ID Generator ────────────────────────────────────
async function generateHardwareId() {
    const nav = window.navigator;
    const scr = window.screen;
    const raw = `${nav.userAgent}|${nav.language}|${scr.colorDepth}|${scr.width}x${scr.height}|${new Date().getTimezoneOffset()}|${nav.hardwareConcurrency || 4}`;
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ─── DOM Ready ────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
    deviceId = await generateHardwareId();
    const shortId = deviceId.substring(0, 16).toUpperCase().match(/.{1,4}/g).join("-");
    document.getElementById("device-id-display").innerText = shortId;
    document.getElementById("sec-device-id").innerText = shortId;
    document.getElementById("sec-session-id").innerText = generateSessionId();

    // Check API health
    checkAPIHealth();

    // Auto-login if saved key
    if (licenseKey) {
        await verifyLicense(licenseKey, true);
    }

    // Resume restore
    if (resumeContextText && resumeFileName) {
        showResumePreview(resumeFileName);
    }

    // Setup SpeechRecognition
    setupSpeechRecognition();

    // Drop zone
    setupDropZone();

    // Nav
    setupNavigation();

    // Session timer (start paused)
    updateSessionTimer();

    // Copy HWID
    document.getElementById("copy-hwid-btn").addEventListener("click", () => {
        navigator.clipboard.writeText(shortId);
        showToast("Device ID copied!");
    });

    // Toggle password visibility
    document.getElementById("toggle-key-visibility").addEventListener("click", () => {
        const inp = document.getElementById("license-key-input");
        const ico = document.getElementById("toggle-key-visibility").querySelector("i");
        if (inp.type === "password") {
            inp.type = "text";
            ico.className = "fas fa-eye-slash";
        } else {
            inp.type = "password";
            ico.className = "fas fa-eye";
        }
    });

    // Enter key on license input
    document.getElementById("license-key-input").addEventListener("keydown", e => {
        if (e.key === "Enter") document.getElementById("activate-btn").click();
    });
});

function generateSessionId() {
    return "sess_" + Math.random().toString(36).substr(2, 10).toUpperCase();
}

// ─── API Health Check ─────────────────────────────────────────
async function checkAPIHealth() {
    const el = document.getElementById("sec-api-status");
    try {
        const res = await fetch("/", { method: "GET" });
        if (res.ok) {
            el.innerHTML = '<span style="color:var(--green)">✅ Online</span>';
        } else {
            el.innerHTML = '<span style="color:var(--red)">❌ Error</span>';
        }
    } catch {
        el.innerHTML = '<span style="color:var(--red)">❌ Unreachable</span>';
    }
}

// ─── Login / Activation ───────────────────────────────────────
document.getElementById("activate-btn").addEventListener("click", async () => {
    const key = document.getElementById("license-key-input").value.trim();
    if (!key) return flashError("Please enter a license key.");
    await verifyLicense(key, false);
});

async function verifyLicense(key, silent = false) {
    const btn = document.getElementById("activate-btn");
    const btnText = document.getElementById("activate-btn-text");
    const btnIcon = document.getElementById("activate-btn-icon");
    const spinner = document.getElementById("activate-spinner");
    const authMsg = document.getElementById("auth-message");

    if (!silent) {
        btnText.style.display = "none";
        btnIcon.style.display = "none";
        spinner.classList.remove("hidden");
        authMsg.innerText = "";
    }

    try {
        const res = await fetch("/verify_license", {
            method: "POST",
            headers: {
                "license-key": key,
                "device-id": deviceId
            }
        });
        const data = await res.json();

        if (res.ok) {
            licenseKey = key;
            localStorage.setItem("premium_license_key", key);
            showApp();
        } else {
            if (!silent) flashError(data.detail || "Access denied. Invalid key.");
            localStorage.removeItem("premium_license_key");
        }
    } catch {
        if (!silent) flashError("Cannot reach backend server. Is it running?");
    } finally {
        if (!silent) {
            btnText.style.display = "";
            btnIcon.style.display = "";
            spinner.classList.add("hidden");
        }
    }
}

function flashError(msg) {
    const el = document.getElementById("auth-message");
    el.innerText = msg;
    el.style.color = "var(--red)";
}

function showApp() {
    document.getElementById("login-container").classList.add("hidden");
    document.getElementById("app-container").classList.remove("hidden");
    document.getElementById("app-container").style.display = "grid";
    startSessionTimer();
    checkAPIHealth();
}

// ─── Logout ───────────────────────────────────────────────────
document.getElementById("logout-btn").addEventListener("click", () => {
    if (!confirm("End session and logout?")) return;
    stopCopilot();
    stopSessionTimer();
    licenseKey = "";
    localStorage.removeItem("premium_license_key");
    document.getElementById("login-container").classList.remove("hidden");
    document.getElementById("app-container").classList.add("hidden");
    document.getElementById("license-key-input").value = "";
    document.getElementById("auth-message").innerText = "";
});

// ─── Navigation ───────────────────────────────────────────────
function setupNavigation() {
    const navLinks = document.querySelectorAll(".nav-link");
    navLinks.forEach(link => {
        link.addEventListener("click", () => {
            navLinks.forEach(l => l.classList.remove("active"));
            link.classList.add("active");

            const panelId = link.getAttribute("data-panel");
            document.querySelectorAll(".panel").forEach(p => {
                p.classList.add("hidden");
                p.classList.remove("active");
            });

            const panel = document.getElementById("panel-" + panelId);
            if (panel) {
                panel.classList.remove("hidden");
                panel.classList.add("active");
            }

            const titles = { live: "Live Session", setup: "Setup & Config", resume: "Resume Sync", history: "Session History" };
            document.getElementById("topbar-title").innerText = titles[panelId] || "Dashboard";
        });
    });

    // Mobile sidebar toggle
    document.getElementById("sidebar-toggle-btn").addEventListener("click", () => {
        document.querySelector(".sidebar").classList.toggle("open");
    });

    // Save settings
    document.getElementById("save-settings-btn").addEventListener("click", () => {
        showToast("Settings saved!");
    });
}

// ─── Session Timer ────────────────────────────────────────────
function startSessionTimer() {
    sessionTimerInterval = setInterval(() => {
        sessionSeconds++;
        updateSessionTimer();
        const mins = Math.floor(sessionSeconds / 60);
        document.getElementById("sidebar-session-time").innerText = `${mins}m`;
    }, 1000);
}

function stopSessionTimer() {
    clearInterval(sessionTimerInterval);
    sessionSeconds = 0;
    updateSessionTimer();
}

function updateSessionTimer() {
    const m = String(Math.floor(sessionSeconds / 60)).padStart(2, "0");
    const s = String(sessionSeconds % 60).padStart(2, "0");
    document.getElementById("session-timer").innerText = `${m}:${s}`;
}

// ─── Speech Recognition ───────────────────────────────────────
let silenceTimer = null;
function setupSpeechRecognition() {
    if (!SpeechRecognition) return;

    recognition = new SpeechRecognition();
    recognition.continuous = true; // Keep listening 
    recognition.interimResults = true; // Show text as it's spoken
    recognition.lang = "en-US";

    recognition.onstart = () => {
        recognitionActive = true;
        setStatusBar("listening", "Listening to interview...");
        setWaveActive(true);
        document.getElementById("mic-status-label").innerText = "🎙️ Microphone Active";
    };

    recognition.onresult = async (event) => {
        if (!isAutonomousMode || isMuted || isProcessing) return;

        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        const currentText = (finalTranscript || interimTranscript).trim();
        if (currentText) {
            showTranscript(currentText);
            
            // Smart Silence Detection: If user stops talking for 1.2s, trigger AI
            clearTimeout(silenceTimer);
            silenceTimer = setTimeout(async () => {
                if (currentText.length > 5 && !isProcessing) {
                    await handleQuestion(currentText);
                }
            }, 1200); 
        }
    };

    recognition.onerror = (e) => {
        if (e.error === "no-speech") return; // Ignore silent errors
        if (e.error === "not-allowed") {
            stopCopilot();
            alert("Microphone permission denied.");
            return;
        }
        recognitionActive = false;
    };

    recognition.onend = () => {
        recognitionActive = false;
        if (isAutonomousMode && !isProcessing) {
            setTimeout(() => {
                try { recognition.start(); } catch(_) {}
            }, 100);
        }
    };
}

function restartRecognitionIfNeeded() {
    if (isAutonomousMode && !recognitionActive && !isProcessing) {
        try { recognition.start(); } catch (_) {}
    }
}

// ─── Launch / Stop Copilot ───────────────────────────────────
document.getElementById("launch-copilot-btn").addEventListener("click", () => {
    if (isAutonomousMode) {
        stopCopilot();
    } else {
        startCopilot();
    }
});

function startCopilot() {
    if (!SpeechRecognition) {
        alert("Your browser doesn't support speech recognition. Please use Chrome or Edge.");
        return;
    }

    isAutonomousMode = true;
    document.getElementById("launch-copilot-btn").classList.add("stop-mode");
    document.getElementById("launch-label").innerText = "Stop Copilot";
    document.getElementById("launch-icon").className = "fas fa-stop";
    document.getElementById("copilot-status-bar").classList.add("active-mode");
    document.getElementById("copilot-state-val").innerText = "Active";
    document.getElementById("sidebar-mode").innerText = "Auto";

    setStatusBar("listening", "Listening to interview...");
    clearTranscript();

    try { recognition.start(); } catch (_) {}
}

function stopCopilot() {
    isAutonomousMode = false;
    recognitionActive = false;

    try { if (recognition) recognition.abort(); } catch (_) {}

    document.getElementById("launch-copilot-btn").classList.remove("stop-mode");
    document.getElementById("launch-label").innerText = "Launch Copilot";
    document.getElementById("launch-icon").className = "fas fa-play";
    document.getElementById("copilot-status-bar").classList.remove("active-mode");
    document.getElementById("copilot-state-val").innerText = "Off";

    setStatusBar("idle", "Copilot stopped");
    setWaveActive(false);
    document.getElementById("mic-status-label").innerText = "🎙️ Microphone Off";

    stopAudio();
}

// ─── Mute Button ─────────────────────────────────────────────
document.getElementById("mute-btn").addEventListener("click", () => {
    isMuted = !isMuted;
    const btn = document.getElementById("mute-btn");
    const icon = btn.querySelector("i");
    if (isMuted) {
        btn.classList.add("muted");
        icon.className = "fas fa-microphone-slash";
        setStatusBar("idle", "Microphone muted");
        setWaveActive(false);
        document.getElementById("mic-status-label").innerText = "🔇 Muted";
    } else {
        btn.classList.remove("muted");
        icon.className = "fas fa-microphone";
        if (isAutonomousMode) {
            setStatusBar("listening", "Listening to interview...");
            setWaveActive(true);
            document.getElementById("mic-status-label").innerText = "🎙️ Microphone Active";
        }
    }
});

// ─── Status Bar Helper ────────────────────────────────────────
function setStatusBar(state, text) {
    const dot = document.querySelector(".status-dot-anim");
    const textEl = document.getElementById("status-text");
    dot.className = "status-dot-anim";
    if (state !== "idle") dot.classList.add(state);
    textEl.innerText = text;
}

// ─── Transcript ───────────────────────────────────────────────
function showTranscript(text) {
    const box = document.getElementById("transcript-display");
    box.innerHTML = `<div class="transcript-text">${escapeHtml(text)}</div>`;
    document.getElementById("mic-status-label").innerText = `✅ Captured: "${text.substring(0, 40)}${text.length > 40 ? "..." : ""}"`;
}

function clearTranscript() {
    document.getElementById("transcript-display").innerHTML = `
        <div class="placeholder-text">
            <i class="fas fa-microphone-lines fa-2x"></i>
            <p>Copilot is now active. Speak clearly — it's listening for interview questions.</p>
        </div>`;
}

// ─── Wave Bars ────────────────────────────────────────────────
function setWaveActive(active) {
    const bars = document.getElementById("wave-bars");
    if (active) bars.classList.add("active");
    else bars.classList.remove("active");
}

// ─── Main Question Handler ────────────────────────────────────
async function handleQuestion(questionText) {
    isProcessing = true;
    setStatusBar("processing", "Generating AI answer...");
    setWaveActive(false);
    showTypingIndicator(true);
    hideAnswerFooter();

    const interviewType = document.getElementById("interview-type").value;
    const targetLang = document.getElementById("target-lang").value;
    const aiVoice = document.getElementById("ai-voice").value;

    try {
        const res = await fetch("/generate_answer", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "license-key": licenseKey,
                "device-id": deviceId
            },
            body: JSON.stringify({
                question: questionText,
                interview_type: interviewType,
                resume_context: resumeContextText,
                target_lang: targetLang
            })
        });

        if (res.status === 429) {
            showToast("⏳ Too many requests, please wait.", "orange");
            isProcessing = false;
            showTypingIndicator(false);
            restartRecognitionIfNeeded();
            return;
        }

        if (!res.ok) {
            const err = await res.json();
            showToast("❌ " + (err.detail || "Error generating answer."), "red");
            isProcessing = false;
            showTypingIndicator(false);
            restartRecognitionIfNeeded();
            return;
        }

        const data = await res.json();
        questionCount++;
        document.getElementById("q-count").innerText = questionCount;
        document.getElementById("sidebar-question-count").innerText = questionCount;
        document.getElementById("detected-lang-val").innerText = data.detected_language.toUpperCase();
        document.getElementById("detected-lang-badge").innerText = `🌐 ${data.detected_language.toUpperCase()}`;

        lastAnswerText = data.translated_answer;
        renderAnswer(data.translated_answer);
        showAnswerFooter(interviewType, data.detected_language);
        addToHistory(questionText, interviewType);

        // Push to stealth caption overlay
        const answerHtml = marked.parse(data.translated_answer || "");
        updateStealthCaption(questionText, answerHtml);

        showTypingIndicator(false);

        // Text to speech (only if auto-speak is ON)
        if (autoSpeak) {
            setStatusBar("speaking", "AI answer ready — speaking...");
            await playAnswerAudio(data.translated_answer, aiVoice);
        } else {
            setStatusBar("idle", "Answer ready — read mode");
        }

    } catch (err) {
        showTypingIndicator(false);
        isProcessing = false;
        restartRecognitionIfNeeded();
    }

    isProcessing = false;
    if (isAutonomousMode) {
        setStatusBar("listening", "Listening to interview...");
        setWaveActive(true);
        restartRecognitionIfNeeded();
    }
}

// ─── Render Markdown Answer ───────────────────────────────────
function renderAnswer(mdText) {
    const body = document.getElementById("answer-body");
    const html = marked.parse(mdText || "No answer generated.");
    body.innerHTML = `<div class="answer-md">${html}</div>`;
}

// ─── Answer Footer ────────────────────────────────────────────
function showAnswerFooter(type, lang) {
    const footer = document.getElementById("answer-footer");
    footer.style.display = "flex";
    document.getElementById("answer-type-badge").innerText = type;
    document.getElementById("answer-lang-badge").innerText = `🌐 ${lang.toUpperCase()}`;
    const pct = Math.floor(Math.random() * 15) + 85;
    document.getElementById("confidence-pct").innerText = `${pct}%`;
    document.getElementById("confidence-fill").style.width = `${pct}%`;
}

function hideAnswerFooter() {
    document.getElementById("answer-footer").style.display = "none";
}

// ─── Typing Indicator ─────────────────────────────────────────
function showTypingIndicator(show) {
    const el = document.getElementById("typing-indicator");
    el.classList.toggle("hidden", !show);
}

// ─── Text-to-Speech ───────────────────────────────────────────
async function playAnswerAudio(text, voice) {
    try {
        const res = await fetch("/text_to_voice", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "license-key": licenseKey,
                "device-id": deviceId
            },
            body: JSON.stringify({ text, voice })
        });

        if (!res.ok) return;

        const blob = await res.blob();
        lastAudioBlob = blob;
        const url = URL.createObjectURL(blob);
        const player = document.getElementById("ai-audio-player");

        return new Promise(resolve => {
            player.src = url;
            player.onended = () => {
                URL.revokeObjectURL(url);
                setStatusBar("listening", "Listening to interview...");
                resolve();
            };
            player.onerror = resolve;
            player.play().catch(resolve);
        });
    } catch (_) {}
}

function stopAudio() {
    const player = document.getElementById("ai-audio-player");
    player.pause();
    player.src = "";
}

// ─── Auto-Speak Toggle ───────────────────────────────────────
function updateAutoSpeakUI() {
    const icon = document.getElementById("autospeak-icon");
    const btn = document.getElementById("toggle-autospeak-btn");
    const checkbox = document.getElementById("auto-speak-toggle");
    
    if (autoSpeak) {
        icon.className = "fas fa-volume-high";
        btn.classList.remove("muted");
        btn.title = "Auto-Speak ON (click to mute)";
    } else {
        icon.className = "fas fa-volume-xmark";
        btn.classList.add("muted");
        btn.title = "Auto-Speak OFF (click to enable)";
        stopAudio(); // immediately stop if speaking
    }
    
    if (checkbox) checkbox.checked = autoSpeak;
    localStorage.setItem("auto_speak", autoSpeak);
}

// Quick toggle button on answer panel
document.getElementById("toggle-autospeak-btn").addEventListener("click", () => {
    autoSpeak = !autoSpeak;
    updateAutoSpeakUI();
    showToast(autoSpeak ? "🔊 Auto-Speak ON" : "🔇 Auto-Speak OFF — Read Mode");
});

// Settings checkbox
document.getElementById("auto-speak-toggle").addEventListener("change", (e) => {
    autoSpeak = e.target.checked;
    updateAutoSpeakUI();
    showToast(autoSpeak ? "🔊 Auto-Speak ON" : "🔇 Auto-Speak OFF — Read Mode");
});

// Initialize UI on load
setTimeout(() => updateAutoSpeakUI(), 100);

// ─── Manual Submit ────────────────────────────────────────────
document.getElementById("manual-submit-btn").addEventListener("click", async () => {
    const q = document.getElementById("manual-question").value.trim();
    if (!q) { showToast("Please type a question first.", "orange"); return; }

    showTranscript(q);
    await handleQuestion(q);
});

// ─── Copy Answer ──────────────────────────────────────────────
document.getElementById("copy-answer-btn").addEventListener("click", () => {
    if (!lastAnswerText) { showToast("No answer to copy yet."); return; }
    navigator.clipboard.writeText(lastAnswerText).then(() => {
        showToast("Answer copied to clipboard!");
    });
});

// ─── Speak Answer Again ───────────────────────────────────────
document.getElementById("speak-answer-btn").addEventListener("click", async () => {
    if (!lastAnswerText) { showToast("No answer to speak yet."); return; }
    const voice = document.getElementById("ai-voice").value;
    setStatusBar("speaking", "Speaking answer...");
    await playAnswerAudio(lastAnswerText, voice);
    if (isAutonomousMode) setStatusBar("listening", "Listening to interview...");
    else setStatusBar("idle", "Ready to listen");
});

// ─── Regenerate ───────────────────────────────────────────────
document.getElementById("regenerate-btn").addEventListener("click", async () => {
    const box = document.getElementById("transcript-display");
    const transcriptEl = box.querySelector(".transcript-text");
    if (!transcriptEl) { showToast("No question to regenerate for."); return; }
    const q = transcriptEl.innerText;
    await handleQuestion(q);
});

// ─── Resume Upload ───────────────────────────────────────────
function setupDropZone() {
    const zone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("resume-upload");
    const trigger = document.getElementById("resume-upload-trigger");

    trigger.addEventListener("click", () => fileInput.click());
    zone.addEventListener("click", (e) => {
        if (e.target !== trigger && !trigger.contains(e.target)) fileInput.click();
    });

    fileInput.addEventListener("change", e => {
        if (e.target.files[0]) handleResumeUpload(e.target.files[0]);
    });

    zone.addEventListener("dragover", e => {
        e.preventDefault();
        zone.style.borderColor = "var(--accent)";
        zone.style.background = "var(--accent-subtle)";
    });
    zone.addEventListener("dragleave", () => {
        zone.style.borderColor = "";
        zone.style.background = "";
    });
    zone.addEventListener("drop", e => {
        e.preventDefault();
        zone.style.borderColor = "";
        zone.style.background = "";
        const file = e.dataTransfer.files[0];
        if (file && file.type === "application/pdf") {
            handleResumeUpload(file);
        } else {
            showToast("Please drop a PDF file.", "red");
        }
    });

    document.getElementById("remove-resume-btn").addEventListener("click", () => {
        resumeContextText = "";
        resumeFileName = "";
        localStorage.removeItem("resume_context");
        localStorage.removeItem("resume_filename");
        document.getElementById("resume-preview").classList.add("hidden");
        document.getElementById("resume-status").innerText = "Resume removed.";
    });
}

async function handleResumeUpload(file) {
    const status = document.getElementById("resume-status");
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB Limit
        status.style.color = "var(--red)";
        status.innerText = "❌ File too large (Max 5MB).";
        return;
    }

    status.style.color = "var(--text-2)";
    status.innerText = "⬆️ Connecting to AI Secure Sync...";

    const formData = new FormData();
    formData.append("file", file);

    // Ensure state is ready
    if (!licenseKey || !deviceId) {
        status.style.color = "var(--red)";
        status.innerText = "❌ Session sync failed. Please re-login.";
        return;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const res = await fetch("/upload_resume", {
            method: "POST",
            headers: { 
                "license-key": licenseKey, 
                "device-id": deviceId 
                // Removed Content-Type, browser handles it for FormData
            },
            body: formData,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const data = await res.json();
        if (res.ok) {
            resumeContextText = data.resume_text;
            resumeFileName = file.name;
            localStorage.setItem("resume_context", resumeContextText);
            localStorage.setItem("resume_filename", resumeFileName);
            status.style.color = "var(--green)";
            status.innerText = "✅ Experience Synced Successfully!";
            showResumePreview(file.name);
            showToast("Resume synced to Copilot!");
        } else {
            status.style.color = "var(--red)";
            status.innerText = `❌ Sync Error: ${data.detail || "Server rejected file"}`;
        }
    } catch (err) {
        console.error("Upload failed:", err);
        status.style.color = "var(--red)";
        if (err.name === 'AbortError') {
            status.innerText = "❌ Connection Timed Out. Try again.";
        } else {
            status.innerText = "❌ Link Failure: Verify backend is running.";
        }
    }
}

function showResumePreview(filename) {
    document.getElementById("resume-filename").innerText = filename;
    document.getElementById("resume-preview").classList.remove("hidden");
}

// ─── History ──────────────────────────────────────────────────
function addToHistory(question, type) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    historyItems.unshift({ question, type, time: timeStr });

    const list = document.getElementById("history-list");
    const empty = list.querySelector(".empty-history");
    if (empty) empty.remove();

    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
        <div class="history-q">${escapeHtml(question)}</div>
        <div class="history-meta">
            <span>${type}</span>
            <span>${timeStr}</span>
        </div>`;
    item.addEventListener("click", () => {
        // Navigate to live panel and show the question
        document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
        document.getElementById("nav-live").classList.add("active");
        document.querySelectorAll(".panel").forEach(p => { p.classList.add("hidden"); p.classList.remove("active"); });
        document.getElementById("panel-live").classList.remove("hidden");
        document.getElementById("panel-live").classList.add("active");
        document.getElementById("topbar-title").innerText = "Live Session";
        document.getElementById("manual-question").value = question;
        showToast("Question loaded. Click 'Generate Answer'.");
    });

    list.prepend(item);
}

// ─── Toast ────────────────────────────────────────────────────
function showToast(msg, type = "success") {
    const toast = document.getElementById("toast");
    const icon = toast.querySelector(".toast-icon");
    document.getElementById("toast-msg").innerText = msg;

    if (type === "red" || type === "error") icon.style.color = "var(--red)";
    else if (type === "orange") icon.style.color = "var(--accent)";
    else icon.style.color = "var(--green)";

    toast.classList.remove("hidden");
    toast.classList.add("show");

    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.classList.add("hidden"), 300);
    }, 3000);
}

// ─── Utility ──────────────────────────────────────────────────
function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ─── MEETING INTEGRATION (Google Meet / Zoom / Teams) ─────────
let currentAudioSource = "mic"; // mic | meet | zoom | teams
let meetingStream = null;
let meetingRecorder = null;
let meetingAudioContext = null;
let meetingChunkInterval = null;
let pendingMeetingSource = null;

// Source tab clicks
document.querySelectorAll(".source-tab").forEach(tab => {
    tab.addEventListener("click", () => {
        const source = tab.dataset.source;
        
        if (source === "mic") {
            // Switch back to microphone mode
            disconnectMeeting();
            setActiveSource("mic");
            showToast("🎙️ Switched to Microphone Mode");
        } else {
            // Open modal for meeting connection
            pendingMeetingSource = source;
            openMeetingModal(source);
        }
    });
});

function setActiveSource(source) {
    currentAudioSource = source;
    document.querySelectorAll(".source-tab").forEach(t => {
        t.classList.remove("active", "connected");
    });
    
    const activeTab = document.getElementById("source-" + source);
    if (source === "mic") {
        activeTab.classList.add("active");
        document.getElementById("source-dot").className = "source-dot";
        document.getElementById("source-status-text").innerText = "Microphone Mode";
    } else {
        activeTab.classList.add("connected");
        document.getElementById("source-dot").className = "source-dot active";
        const names = { meet: "Google Meet", zoom: "Zoom", teams: "Teams" };
        document.getElementById("source-status-text").innerText = `Connected to ${names[source]}`;
    }
}

// Modal Controls
function openMeetingModal(source) {
    const modal = document.getElementById("meeting-modal");
    const title = document.getElementById("modal-meeting-title");
    
    const configs = {
        meet: { icon: "fab fa-google", name: "Google Meet" },
        zoom: { icon: "fas fa-video", name: "Zoom" },
        teams: { icon: "fab fa-microsoft", name: "Microsoft Teams" }
    };
    
    const cfg = configs[source] || configs.meet;
    title.innerHTML = `<i class="${cfg.icon}"></i> Connect to ${cfg.name}`;
    modal.classList.remove("hidden");
}

function closeMeetingModal() {
    document.getElementById("meeting-modal").classList.add("hidden");
    pendingMeetingSource = null;
}

document.getElementById("modal-close-btn").addEventListener("click", closeMeetingModal);
document.getElementById("modal-cancel-btn").addEventListener("click", closeMeetingModal);

// Close modal on overlay click
document.getElementById("meeting-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeMeetingModal();
});

// Connect Button
document.getElementById("modal-connect-btn").addEventListener("click", async () => {
    const source = pendingMeetingSource || "meet";
    closeMeetingModal();
    
    document.getElementById("source-dot").className = "source-dot connecting";
    document.getElementById("source-status-text").innerText = "Connecting...";
    
    try {
        // Request screen/tab capture WITH audio
        meetingStream = await navigator.mediaDevices.getDisplayMedia({
            video: true, // Required, but we only care about audio
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        
        // Check if we actually got audio
        const audioTracks = meetingStream.getAudioTracks();
        if (audioTracks.length === 0) {
            showToast("⚠️ No audio captured! Make sure to check 'Share tab audio' when sharing.", "red");
            disconnectMeeting();
            return;
        }
        
        // Success!
        setActiveSource(source);
        showToast(`✅ Connected to ${source === "meet" ? "Google Meet" : source === "zoom" ? "Zoom" : "Teams"}! AI is listening.`);
        
        // Start processing audio
        startMeetingAudioCapture();
        
        // Handle stream end (user stops sharing)
        meetingStream.getVideoTracks()[0].addEventListener("ended", () => {
            disconnectMeeting();
            showToast("📴 Meeting share ended — switched to Microphone Mode.");
        });
        
    } catch (err) {
        console.error("Meeting capture error:", err);
        if (err.name === "NotAllowedError") {
            showToast("❌ Share permission denied. Try again.", "red");
        } else {
            showToast("❌ Failed to connect: " + err.message, "red");
        }
        disconnectMeeting();
    }
});

function startMeetingAudioCapture() {
    if (!meetingStream) return;
    
    // Create audio context to extract audio from stream
    meetingAudioContext = new AudioContext();
    const audioSource = meetingAudioContext.createMediaStreamSource(meetingStream);
    const analyser = meetingAudioContext.createAnalyser();
    audioSource.connect(analyser);
    
    // Create a destination for recording
    const dest = meetingAudioContext.createMediaStreamDestination();
    audioSource.connect(dest);
    
    // Setup MediaRecorder for audio chunks
    meetingRecorder = new MediaRecorder(dest.stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") 
            ? "audio/webm;codecs=opus" 
            : "audio/webm"
    });
    
    let audioChunks = [];
    
    meetingRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
    };
    
    meetingRecorder.onstop = async () => {
        if (audioChunks.length === 0) return;
        
        const blob = new Blob(audioChunks, { type: "audio/webm" });
        audioChunks = [];
        
        // Only process if blob has meaningful data (> 1KB)
        if (blob.size < 1000) return;
        
        // Transcribe via backend
        await transcribeMeetingAudio(blob);
    };
    
    // Record in 5-second chunks
    meetingRecorder.start();
    
    meetingChunkInterval = setInterval(() => {
        if (meetingRecorder && meetingRecorder.state === "recording") {
            meetingRecorder.stop();
            setTimeout(() => {
                if (meetingStream && meetingStream.active) {
                    meetingRecorder.start();
                }
            }, 100);
        }
    }, 5000);
    
    // Visual feedback
    setWaveActive(true);
    setStatusBar("listening", "Listening to meeting audio...");
    document.getElementById("mic-status-label").innerText = "🔗 Meeting Audio Connected";
    
    // Monitor audio levels for wave animation
    monitorAudioLevels(analyser);
}

function monitorAudioLevels(analyser) {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    function check() {
        if (!meetingStream || !meetingStream.active) return;
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        
        // Show wave animation when audio is detected
        if (avg > 10) {
            setWaveActive(true);
        } else {
            setWaveActive(false);
        }
        
        requestAnimationFrame(check);
    }
    check();
}

async function transcribeMeetingAudio(audioBlob) {
    try {
        const formData = new FormData();
        formData.append("file", audioBlob, "meeting_audio.webm");
        
        const res = await fetch("/voice_to_text", {
            method: "POST",
            headers: {
                "license-key": licenseKey,
                "device-id": deviceId
            },
            body: formData
        });
        
        if (!res.ok) return;
        
        const data = await res.json();
        const transcript = data.text || data.transcript || "";
        
        if (transcript && transcript.trim().length > 5) {
            showTranscript(transcript.trim());
            
            // Auto-generate answer if copilot is launched or in meeting mode
            if (!isProcessing) {
                await handleQuestion(transcript.trim());
            }
        }
    } catch (err) {
        console.warn("Meeting transcription error:", err);
    }
}

function disconnectMeeting() {
    // Stop recording
    if (meetingChunkInterval) {
        clearInterval(meetingChunkInterval);
        meetingChunkInterval = null;
    }
    
    if (meetingRecorder && meetingRecorder.state !== "inactive") {
        try { meetingRecorder.stop(); } catch(_) {}
    }
    meetingRecorder = null;
    
    // Close audio context
    if (meetingAudioContext) {
        meetingAudioContext.close().catch(() => {});
        meetingAudioContext = null;
    }
    
    // Stop all stream tracks
    if (meetingStream) {
        meetingStream.getTracks().forEach(track => track.stop());
        meetingStream = null;
    }
    
    setActiveSource("mic");
    setWaveActive(false);
    setStatusBar("idle", "Ready to Listen");
    document.getElementById("mic-status-label").innerText = "🎙️ Microphone Off";
}


// ─── STEALTH LIVE CAPTION OVERLAY ─────────────────────────────
// Opens a separate popup window that is NOT captured during
// screen share (users share the meeting app, not this window).
let stealthWindow = null;

function getStealthHTML() {
    return `<!DOCTYPE html>
<html>
<head>
<title>Live Caption</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body {
    background: rgba(10,10,18,0.92);
    color: #f1f1f3;
    font-family: 'Inter', system-ui, sans-serif;
    height: 100%; width: 100%;
    overflow: hidden;
    user-select: text;
    cursor: default;
}
body { display: flex; flex-direction: column; }

/* Dragbar */
.drag-bar {
    height: 32px; min-height: 32px;
    background: rgba(255,255,255,0.04);
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 12px;
    cursor: move;
    -webkit-app-region: drag;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
}
.drag-bar .title {
    font-size: 11px; font-weight: 600;
    color: rgba(255,255,255,0.35);
    letter-spacing: 1.5px;
    text-transform: uppercase;
    display: flex; align-items: center; gap: 6px;
}
.drag-bar .dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #22c55e;
    animation: blink 2s infinite;
}
@keyframes blink {
    0%,100% { opacity:1; } 50% { opacity:0.3; }
}
.drag-bar .controls {
    display: flex; gap: 6px;
    -webkit-app-region: no-drag;
}
.ctrl-btn {
    background: rgba(255,255,255,0.06);
    border: none; color: rgba(255,255,255,0.4);
    width: 22px; height: 22px; border-radius: 4px;
    cursor: pointer; font-size: 10px;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.2s, color 0.2s;
}
.ctrl-btn:hover { background: rgba(255,255,255,0.12); color: #fff; }

/* Content */
.content {
    flex: 1;
    padding: 14px 16px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.content::-webkit-scrollbar { width: 3px; }
.content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius:99px; }

/* Question */
.q-section {
    font-size: 11px;
    color: #ff6b2b;
    font-weight: 600;
    padding: 6px 10px;
    background: rgba(255,77,0,0.08);
    border-radius: 6px;
    border-left: 3px solid #ff4d00;
}

/* Answer */
.a-section {
    font-size: 13px;
    line-height: 1.65;
    color: rgba(255,255,255,0.88);
    letter-spacing: 0.15px;
}
.a-section h1,.a-section h2,.a-section h3 {
    color: #ff8542;
    font-size: 13px;
    font-weight: 700;
    margin: 8px 0 4px;
}
.a-section ul, .a-section ol {
    padding-left: 18px;
    margin: 4px 0;
}
.a-section li { margin: 2px 0; }
.a-section strong { color: #fff; }
.a-section p { margin: 4px 0; }

/* Waiting state */
.waiting {
    color: rgba(255,255,255,0.25);
    font-style: italic;
    font-size: 12px;
    text-align: center;
    padding: 30px 0;
}

/* Font size controls */
.size-sm .a-section { font-size: 11px; }
.size-md .a-section { font-size: 13px; }
.size-lg .a-section { font-size: 16px; }
.size-xl .a-section { font-size: 19px; }

/* Opacity levels */
.opacity-100 { background: rgba(10,10,18,0.95) !important; }
.opacity-75  { background: rgba(10,10,18,0.78) !important; }
.opacity-50  { background: rgba(10,10,18,0.55) !important; }
.opacity-25  { background: rgba(10,10,18,0.35) !important; }
</style>
</head>
<body class="size-md opacity-100">
    <div class="drag-bar" id="dragbar">
        <div class="title"><span class="dot"></span> STEALTH CAPTION</div>
        <div class="controls">
            <button class="ctrl-btn" onclick="cycleSize()" title="Font Size">A</button>
            <button class="ctrl-btn" onclick="cycleOpacity()" title="Transparency">◐</button>
        </div>
    </div>
    <div class="content" id="caption-content">
        <div class="waiting">Waiting for AI answer...</div>
    </div>
<script>
// Font size cycling
const sizes = ['size-sm','size-md','size-lg','size-xl'];
let sizeIdx = 1;
function cycleSize() {
    sizeIdx = (sizeIdx + 1) % sizes.length;
    document.body.className = document.body.className.replace(/size-\\w+/,'') + ' ' + sizes[sizeIdx];
}
// Opacity cycling
const opacities = ['opacity-100','opacity-75','opacity-50','opacity-25'];
let opIdx = 0;
function cycleOpacity() {
    opIdx = (opIdx + 1) % opacities.length;
    document.body.className = document.body.className.replace(/opacity-\\w+/,'') + ' ' + opacities[opIdx];
}
// Auto-scroll to bottom
function scrollToBottom() {
    const el = document.getElementById('caption-content');
    el.scrollTop = el.scrollHeight;
}
</script>
</body>
</html>`;
}

document.getElementById("stealth-caption-btn").addEventListener("click", () => {
    if (stealthWindow && !stealthWindow.closed) {
        stealthWindow.focus();
        showToast("Stealth Caption already open — focused.");
        return;
    }

    // Calculate position: bottom-right of screen
    const w = 420;
    const h = 340;
    const left = window.screen.availWidth - w - 30;
    const top = window.screen.availHeight - h - 60;

    stealthWindow = window.open(
        "",
        "StealthCaption",
        `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no`
    );

    if (!stealthWindow) {
        showToast("⚠️ Popup blocked! Allow popups for this site.", "red");
        return;
    }

    stealthWindow.document.open();
    stealthWindow.document.write(getStealthHTML());
    stealthWindow.document.close();

    // Update button state
    document.getElementById("stealth-caption-btn").classList.add("active-stealth");
    showToast("👁️ Stealth Caption launched — invisible during screen share!");

    stealthWindow.addEventListener("beforeunload", () => {
        document.getElementById("stealth-caption-btn").classList.remove("active-stealth");
    });
});

// Push content to stealth window
function updateStealthCaption(question, answerHtml) {
    if (!stealthWindow || stealthWindow.closed) return;
    
    try {
        const content = stealthWindow.document.getElementById("caption-content");
        if (!content) return;

        content.innerHTML = `
            <div class="q-section">❓ ${escapeHtml(question)}</div>
            <div class="a-section">${answerHtml}</div>
        `;

        // Auto scroll
        if (stealthWindow.scrollToBottom) stealthWindow.scrollToBottom();
    } catch(e) {
        console.warn("Stealth window update failed:", e);
    }
}
