Anya AI — Full Roadmap & Architecture Plan
Current State
Layer	Tech	Role
Frontend	HTML + Vanilla JS + CSS	Chat UI, tool windows, right sidebar
Node.js Server	Express + MongoDB	Session management, tool routing, AI proxy
FastAPI	Python	Hosts local LLM (Ollama/llama), inference
Clock Service	Express	Timer state management (port 6500)
Working tools today: Weather, Timer (pause/resume/reset), Music (YouTube), File Tool (create/edit/read/delete/rename)

Phase 1 — Complete the Clock Suite
Prerequisite for everything else. Get all time-based tools solid.

1.1 Stopwatch
New route in 
clock-service/server.js
: POST /stopwatch/start, /stop, /reset, GET /status
Frontend: Stopwatch tool window (counting up, not down)
No AI needed — direct button calls like the timer fix
1.2 Alarm
POST /alarm/set with { time: "HH:MM", label, sessionId }
Background interval in clock-service checks current time every second
When triggered: emit via WebSocket or polling → frontend shows popup + plays beep
AI maps: "Wake me at 7am" → set_alarm tool
1.3 To-Do List
New MongoDB collection: todos { sessionId, text, done, createdAt }
Routes in Node server: POST /todo, PATCH /todo/:id, DELETE /todo/:id, GET /todos/:sessionId
Frontend: To-Do tool window with checkboxes, add/delete
AI maps: "Remind me to call mum" → add_todo tool
1.4 World Clock / Timezone Display
Frontend-only widget showing multiple timezones
User can pin cities via settings
Phase 2 — Web Search & RAG
This is a big one — gives Anya real-world knowledge.

2.1 Web Search Tool
Add web_search to tool registry
Use SerpAPI or DuckDuckGo API (free) or Brave Search API
Returns: top 3-5 result snippets shown in a search results tool window
AI maps: "Search for..." or "What is..." when it doesn't know → web_search
2.2 RAG (Retrieval-Augmented Generation)
This is a multi-part upgrade to FastAPI:

User uploads document / pastes text
        ↓
FastAPI chunks + embeds (e.g. nomic-embed via Ollama)
        ↓
Stored in a vector DB (ChromaDB — local, zero setup)
        ↓
On each message: semantic search for relevant chunks
        ↓
Top chunks injected into system prompt context
        ↓
LLM answers with actual document knowledge
ChromaDB is the recommended vector store (runs locally, Python-native)
New FastAPI routes: POST /embed, POST /search-context
New Node route: POST /upload-knowledge (PDF/txt/md support via PyMuPDF)
Frontend: Upload button in right sidebar
2.3 Learning / Memory
Short-term: Already done (message history, MEMORY_LIMIT)
Long-term user memory: Store key facts about user in MongoDB
memories { userId, fact, source, timestamp }
e.g. "User's name is abc", "User is a developer"
Extract memories from conversation using a lightweight summarizer prompt
Inject top memories into system prompt on each request
Phase 3 — Voice: Input & Output ✅ DONE (base implementation)
Makes Anya feel alive.

3.1 Voice Input (STT) ✅
Done: Web Speech API mic button with pulse animation, auto-sends on speech end
Mic button left of Send button, turns red + pulsing ring while recording
Stops TTS automatically when mic opens (prevents feedback loop)
Chrome/Edge only (Web Speech API limitation)
3.2 Voice Response (TTS) ✅
Done: Anya auto-speaks her replies using Web Speech Synthesis API
Right sidebar voice settings panel: On/Off toggle, voice picker, speed slider (0.5×–2×)
Settings persist in localStorage
Strips code blocks and markdown before speaking
Speaking AI bubble gets a subtle blue glow
3.3 Wake Word ✅
Done: Picovoice Porcupine v4, custom "Hey Anya" 
.ppn
 model trained on Picovoice Console
Model files: 
hey-Anya_en_wasm_v4_0_0.ppn
 + porcupine_params.pv served from frontend
SDK loaded locally (porcupine.min.js, web-voice-processor.min.js) — no CDN
Access key stored in 
node-server/.env
 as PICOVOICE_ACCESS_KEY — served via GET /config/voice
On detection → 
toggleMic()
 activates STT automatically
3.4 Known Issues / Pending Fixes 🔧
Issue	Priority	Fix
Mic/TTS conflict — saying "Hey Anya" while Anya is speaking causes overlap	Medium	Call 
stopSpeaking()
 at start of 
onWakeWord()
 before 
toggleMic()
Debug console.log("Wake word detected! Payload:", detection) still in code	Low	Remove after testing
SpeechRecognition may pause if browser tab loses focus	Medium	Use rec.continuous = true + re-start on 
onend
 when wake word is active
No audio click/beep feedback when wake word is first detected	Low	Play a short beep via Web Audio API on detection
3.5 STT Upgrade Options 🚀
Option	Cost	Accuracy	Works in Firefox	Notes
Web Speech API (current)	Free	Good	❌ Chrome only	Done
OpenAI Whisper (local)	Free	Excellent	✅	Run via FastAPI, record mic → send audio blob → transcript returned
Whisper via OpenAI API	~$0.006/min	Excellent	✅	Easiest Whisper path if you have an OpenAI key
Deepgram	Free tier (12k min/mo)	Excellent	✅	WebSocket-based, real-time streaming
Recommended next STT upgrade: Local Whisper via FastAPI — one new route /transcribe, takes audio blob, returns text. No API key needed.

3.6 TTS Upgrade Options 🚀
Option	Cost	Quality	Notes
Web Speech Synthesis (current)	Free	OK (robotic)	Done
ElevenLabs	~$5/mo personal	Ultra realistic	Custom "Anya voice", streaming supported
Coqui TTS	Free (local)	Very good	Run via FastAPI, GPU optional, many voices
Azure Neural TTS	~$1 per 1M chars free	Excellent	REST API, SSML support
Google Cloud TTS	~1M chars/mo free	Excellent	Natural-sounding, many languages
OpenAI TTS	~$0.015/1K chars	Very good	tts-1 model, 6 voices
Recommended next TTS upgrade: ElevenLabs for the "wow" effect, or Coqui for free local quality.

Implementation pattern for any API TTS:

Frontend sends text → Node server proxies to TTS API → returns audio blob → frontend plays it
Key stored in 
.env
, never exposed to browser.

3.7 Wake Word Upgrade Options 🚀
Upgrade	Effort	Notes
Sensitivity slider	Low	Expose sensitivity: 0.6 as a UI slider in voice settings
Voice commands	Medium	Parse specific phrases: "Hey Anya stop" → cancel TTS, "Hey Anya clear" → clear chat
Second wake word for stop	Medium	Train a second 
.ppn
 for "Anya stop" — multiple keywords in one Porcupine instance
Custom Anya voice model	Low effort	Already done — retrain with more samples on Picovoice Console to improve accuracy
Multiple language models	Medium	Download language-specific .pv files for non-English wake words
3.8 Audio Architecture (Future Refactor)
When multiple upgrades are in place, consolidate into one AudioManager class:

AudioManager
  ├── WakeWordEngine    (Porcupine)
  ├── SpeechInput       (Whisper / Web Speech)
  ├── SpeechOutput      (ElevenLabs / Coqui / Web Synthesis)
  └── State machine     (idle → listening → processing → speaking)
This prevents mic/TTS conflicts and makes the pipeline easier to extend.

Phase 4 — Authentication & Security
Required before any SaaS or shared deployment.

4.1 User Accounts
Add users { email, passwordHash, role, createdAt } MongoDB collection
bcrypt for password hashing, JWT for sessions
Routes: POST /auth/register, POST /auth/login, GET /auth/me
Middleware: authMiddleware protecting all chat/session routes
4.2 Permissions System
Already have a "Permissions" button in the sidebar — this wires it up
Per-user toggles: { canWebSearch, canCreateFiles, canPlayMusic, canSetAlarms }
Stored in DB, enforced server-side before tool execution
Frontend: Permissions panel modal with toggles
4.3 Security Hardening
Rate limiting: express-rate-limit (prevent abuse)
Input sanitization: already partially done, add DOMPurify on frontend
HTTPS: Caddy reverse proxy when deploying
API key rotation for weather/search services
Phase 5 — SaaS Architecture
Turn Anya from a personal tool into a product people can sign up for.

Architecture Shift
Current:                     SaaS Target:
─────────────────────        ──────────────────────────────
localhost:3000 (frontend)    CDN-hosted frontend (Vercel/CF)
localhost:5000 (node)    →   Node API on VPS / Railway
localhost:8000 (fastapi)     FastAPI on GPU VPS (RunPod/vast.ai)
localhost:6500 (clock)       Clock service merged into Node
MongoDB local                MongoDB Atlas (free tier to start)
Key SaaS Changes
Multi-tenancy: All data scoped to userId (sessions, messages, todos, memories)
LLM Options per user: Local Ollama OR OpenAI/Gemini API key (user brings their own key)
Usage tracking: Token count per user, rate limits per plan
Billing (later): Stripe integration, free/pro tiers
Microservices vs Monolith Decision
For now: keep it as a modular monolith (what you have). Split to true microservices only when traffic demands it. The clock service can be merged back into Node to reduce complexity.

Phase 6 — Streaming & Real-Time
The AI response should feel instant.

6.1 Proper LLM Streaming
FastAPI already has async — add StreamingResponse to /ask endpoint
Node: pipe the stream directly to the browser (already partially built, currently disabled)
Frontend: re-enable the stream reader path in 
sendMessage()
6.2 WebSocket Upgrade (for Alarms + Live Tools)
Replace alarm polling with a persistent WebSocket connection
Node: add ws or socket.io
Frontend: connect on load, receive push events (alarm fired, timer done, etc.)
Phase 7 — More Tools & Integrations
Extensibility is the long game.

Personal Tools
Tool	API / Method	Phase
Calendar	Google Calendar API (OAuth)	7
Email summary	Gmail API (OAuth)	7
Notes	Local Markdown or Notion API	7
Calculator	Frontend-only, no API	1 (Quick Win)
World Clock	Frontend-only timezone widget	1
Unit converter	Frontend-only	7
Currency rates	Free exchangerate.host API	7
Web Tools
Tool	API / Method	Phase
Web search	SerpAPI / Brave Search	2
URL summarize	Fetch page + RAG chunk	2
YouTube summary	yt-dlp + Whisper transcription	7
Wikipedia lookup	Wikipedia REST API (free)	7
Dictionary/thesaurus	Free Dictionary API	7
🔌 Device Connect / IoT Automation
Connect Anya to physical hardware — Arduino, smart bulbs, relays, sensors.

Frontend UI: Device list, connection status, live readings panel
Backend: Node.js serial port bridge (serialport npm) for Arduino; REST/MQTT for smart devices
Home Assistant integration: Control smart lights, scenes, triggers via Home Assistant REST API
AI control: User says "Turn on the lab light" → Anya maps to device_control tool → sends command
Expansion: ESP32 + WebSocket for real-time sensor streaming (temp, humidity, motion)
💬 Chat / Message Integration
Connect Anya's AI brain to your other website's chat system.

Architecture: Your website sends messages to Anya's Node.js /chat endpoint via REST or WebSocket
Response routing: Anya replies stream back to your website's chat widget in real-time
Auth: Per-site API keys for multi-website support
Use case: Same Anya AI powering multiple frontend interfaces (your sites, apps, etc.)
🖼️ Image / File AI Tool
Read, analyze, and generate images using AI. Anya herself does not generate images — she routes to specialist models.

Image reading: User uploads image → sent to vision LLM (Gemini Vision, LLaVA local via Ollama) → Anya explains it
Image generation: User asks for image → Anya calls Stable Diffusion (local, automatic1111 API) or Gemini Imagen
File reading: PDF, DOCX parsing → RAG chunk → Anya answers questions about the document
Strategy: Keep Anya as the orchestrator — she decides which specialist tool to call
👁️ Vision / Face Analysis AI
AI-powered analysis of faces and people from webcam or uploaded image. Can be integrated from your other website or built directly.

Age estimation — predict approximate age from face
Gender detection — classified from facial features
Emotion detection — happy, sad, angry, surprised, neutral, fear, disgust
Ethnicity estimation — broad regional inference (with appropriate ethical disclaimers)
Tech: DeepFace (Python library, runs via FastAPI), or integrate your existing website's model
Privacy note: All processing local by default — no data sent to external servers
🤖 Ask Better AI (AI Escalation Tool)
When Anya hits a task too complex for the local LLM, she delegates to a more powerful model.

Trigger: Local model signals low confidence, or user explicitly says "Use your best AI"
Targets: Google Gemini API, OpenAI GPT-4, Claude (user provides API key in settings)
Flow: Anya packages context + task → sends to web LLM → returns answer back as if Anya answered
UI: Badge showing which model answered ("Answered by Gemini Pro")
Security: API keys stored in 
.env
, never in frontend
🔬 OpenCV Computer Vision Tools
Browser-based or FastAPI-based computer vision powered by OpenCV + Python. | Tool | Description | Input | |---|---|---| | Face Detection | Detect & count faces in image/webcam | Webcam / Upload | | Emotion Detection | Read facial expressions in real-time | Webcam | | QR / Barcode Scanner | Scan codes from live webcam feed | Webcam | | Motion Detection | Alert on movement via webcam | Webcam | | OCR (Text from Image) | Extract text via Tesseract+OpenCV | Upload | | Hand Gesture Control | Map hand gestures to UI actions | Webcam | | Object Counter | Detect + count objects in frame | Webcam / Upload | | Background Remover | Remove/swap webcam background | Webcam |

Tech stack: Python FastAPI + cv2 + deepface + MediaPipe (hand detection)
Frontend: Each tool opens a webcam panel or file upload, results streamed back
Home / IoT (Later)
Home Assistant integration via its REST API
Smart light control, scene triggers
Phase 8 — Desktop App
Much later, when the web version is stable.

Recommended: Tauri (not Electron)
Electron	Tauri
Size	~150MB	~5MB
Performance	Slow (Node runtime)	Fast (Rust backend)
Memory	High	Low
Web tech	✅ HTML/JS/CSS	✅ HTML/JS/CSS
What changes
Frontend code stays exactly the same (Tauri renders it in system WebView)
Tauri Rust backend handles: system tray, wake word mic access, file system, notifications
Clock service + Node server can run as embedded background processes
Recommended Build Order
NOW              ──►  Phase 1 (Stopwatch, Alarm, To-Do)
+2 weeks         ──►  Phase 3.1 + 3.2 (Voice in/out — easiest wins)
+1 month         ──►  Phase 2 (Web Search + basic RAG)
+1.5 months      ──►  Phase 4 (Auth + Permissions)
+2 months        ──►  Phase 6 (Streaming + WebSockets)
+3 months        ──►  Phase 5 (SaaS infra, deploy)
+4 months        ──►  Phase 7 (More tools)
+6 months        ──►  Phase 3.3 (Wake word)
+1 year          ──►  Phase 8 (Desktop app)
Quick Wins You Can Do Right Now (< 1 day each)
Web Speech API mic button — 50 lines of JS, zero backend
TTS for Anya responses — 10 lines of JS, zero backend
Stopwatch — reuse timer window, counts up instead of down
Calculator widget — pure frontend, no API
Dark/light theme persistence — already started with localStorage