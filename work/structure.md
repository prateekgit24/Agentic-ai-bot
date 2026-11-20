# Project Architecture & Structural File Tree

```
my-ai-app/
├── start.bat                                 # Windows one-click startup script (launches all 3 services)
│
├── frontend/                                 # User Interface (HTML5, Vanilla JS, CSS3, Web APIs)
│   ├── index.html                            # Main SPA layout, chat viewport, sidebars & modal containers
│   ├── admin.html                            # Admin dashboard for user metrics & point requests
│   │
│   ├── script.js                             # Primary controller: sessions, chat dispatch, NDJSON streaming
│   ├── auth.js                               # Auth manager: JWT, Google OAuth GSI, OTP verification
│   ├── admin.js                              # Admin logic: fetch stats, user controls, point approvals
│   │
│   ├── tools-widgets.js                      # Tool result card renderers (weather, code output, search, canvas)
│   ├── tools-clock.js                        # Clock suite: countdown timer, alarms, world clocks, stopwatch
│   ├── tools-notes.js                        # Local & vector-synced note, todo, and reminder store
│   │
│   ├── voice.js                              # Speech pipeline: STT, TTS, Porcupine wake word & custom trainer
│   ├── avatar.js                             # SVG avatar state machine & animation controller
│   ├── avatar-live2d.js                      # Live2D Cubism 4 avatar renderer with speech lip-sync
│   ├── themes.js                             # Theme palette and brightness manager
│   ├── ui-extras.js                          # UI utilities: Prism.js syntax highlighting, copy buttons
│   ├── modern-effects.js                     # Glow, cursor trail, particle and ripple effects
│   │
│   ├── style.css                             # Master stylesheet combining all base & theme styles
│   ├── style-base.css                        # CSS reset, variables, design tokens & typography
│   ├── style-layout.css                      # Layout grid: left sidebar, chat area, right widget dock
│   ├── style-widgets.css                     # Tool cards, timers, clocks, weather widgets styling
│   ├── style-modals.css                      # Settings modal, auth overlays & popups styling
│   ├── modern-effects.css                    # Glassmorphism, neon glows & modern animations styling
│   │
│   ├── hiyori_free_en/                       # Live2D Cubism 4 model runtime assets & textures
│   ├── live2dcubismcore.min.js               # Live2D Core runtime engine
│   ├── live2d-stub.min.js                    # Compatibility stub for Cubism 2/4 checks
│   ├── pixi.min.js                           # PixiJS 2D rendering engine
│   ├── pixi-live2d-display.min.js            # PixiJS integration plugin for Live2D models
│   ├── pixi-live2d-display.cubism4.js        # Cubism 4 model display adapter
│   ├── porcupine.min.js                      # Picovoice Porcupine wake-word WASM engine
│   ├── porcupine_params.pv                   # Porcupine acoustic model parameters
│   ├── web-voice-processor.min.js            # Audio worklet/processor for real-time mic streaming
│   ├── hey-Anya_en_wasm_v4_0_0.ppn           # Trained wake-word model binary for "Hey Anya"
│   └── node_modules/                         # Frontend dependencies (serve, etc.)
│
├── node-server/                              # Orchestration Backend (Node.js, Express, MongoDB)
│   ├── server.js                             # Express entry point, CORS, JSON parsers, MongoDB connect
│   ├── shared.js                             # Mongoose schemas, JWT middlewares, Nodemailer transporter
│   ├── prompts.js                            # Master system prompt, tool schemas & mode definitions
│   ├── package.json                          # Backend dependencies and startup scripts
│   ├── .env                                  # Environment variables (Mongo URI, JWT secret, API keys)
│   │
│   ├── models/                               # Additional Mongoose schemas
│   │   └── File.js                           # Workspace file metadata schema
│   │
│   ├── routes/                               # Express REST API endpoints
│   │   ├── auth.js                           # Signup, login, Google OAuth verification, email OTP
│   │   ├── chat.js                           # POST /chat: rate limits, token quotas, RAG enrichment, tool runner
│   │   ├── profile.js                        # User profile data, tool permissions, daily reset, point redemptions
│   │   ├── sessions.js                       # Session CRUD and message history retrieval
│   │   ├── timer.js                          # In-process session countdown timer state machine
│   │   ├── workspace.js                      # Local workspace file listing, downloading & deletion
│   │   ├── admin.js                          # Admin platform telemetry, user token overrides, point requests
│   │   └── config.js                         # Public configuration endpoint (Picovoice key, OAuth client ID)
│   │
│   ├── services/                             # Core business logic & AI orchestration
│   │   ├── modelRouter.js                    # Smart classifier routing to fast, reasoning, or vision models
│   │   ├── modelConfig.js                    # Model weight multipliers, point costs & token exchange rates
│   │   │
│   │   └── tools/                            # Tool registry and individual tool handlers
│   │       ├── toolRegistry.js               # Tool dispatcher mapping LLM tool names to functions
│   │       ├── weatherTool.js                # OpenWeatherMap / wttr.in weather fetcher
│   │       ├── timerTool.js                  # Interacts with session timer engine
│   │       ├── alarmTool.js                  # Time-based alarm scheduler
│   │       ├── clockTool.js                  # Timezone and current time resolver
│   │       ├── stopwatchTool.js              # Stopwatch trigger
│   │       ├── fileTool.js                   # Create, edit, read, and delete single workspace files
│   │       ├── fileManagerTool.js            # Workspace explorer tool (list, read, delete, rename)
│   │       ├── notesTool.js                  # Saves notes/todos to local store & FastAPI RAG
│   │       ├── playMusicTool.js              # YouTube search & embed music player handler
│   │       ├── webSearchTool.js              # DuckDuckGo API search with Yahoo HTML scraper fallback
│   │       ├── codeRunnerTool.js             # Proxies Python code execution to FastAPI sandbox
│   │       ├── unitConverterTool.js          # Unit conversion engine (length, weight, temp, data, etc.)
│   │       ├── newsFeedTool.js               # News aggregator across categories
│   │       └── netSpeedTool.js               # Triggers network speed test widget
│   │
│   └── node_modules/                         # Node backend npm packages
│
├── fastapi-ai/                               # AI Engine & Python Microservice (FastAPI on Port 8000)
│   ├── main.py                               # FastAPI app: /ask, /ask/stream, ChromaDB RAG, /run-code, /extract-text
│   ├── requirements.txt                      # Python dependencies (FastAPI, PyTorch, ChromaDB, SentenceTransformers)
│   ├── chroma_db/                            # Persistent vector database store (ChromaDB embeddings)
│   ├── generated_files/                      # Directory for server-generated documents or outputs
│   └── __pycache__/                          # Compiled Python bytecode cache
│
├── workspace/                                # Disk storage directory for user files created by Anya
│
└── work/                                     # Project planning, tracking & architectural records
    ├── structure.md                          # This detailed architectural tree and file index
    ├── plan.md                               # Roadmap, upcoming features & implementation plans
    ├── task.md                               # Active task checklist and progress tracker
    └── recommendations.md                    # Deep codebase audit, bug fixes & architectural enhancements
```

---

## Detailed Component Breakdown

### 1. Frontend Architecture (`frontend/`)

| File / Folder | Primary Responsibility |
|---|---|
| **`index.html`** | Structure of the single-page application: chat view, left/right collapsible drawers, 11-panel settings modal, profile and auth modals. |
| **`script.js`** | Manages conversation state, session switching, streaming token rendering, health checks, auto-titling, and general settings synchronization. |
| **`auth.js`** | Coordinates client-side authentication, JWT session persistence, Google OAuth token exchange, 6-digit OTP verification, and point requests. |
| **`admin.html` / `admin.js`** | Admin panel interface to inspect system stats, adjust user token limits, and approve or reject point purchase requests. |
| **`tools-widgets.js`** | Dispatches LLM tool outputs to UI widgets: renders weather, search results, terminal outputs, news feeds, unit conversions, and HTML previews. |
| **`tools-clock.js`** | Controls real-time clock tools: session countdown timer (synced with Node), alarm sound notifications, world clock conversions, and stopwatch. |
| **`tools-notes.js`** | Local and vector-synced note/todo/reminder manager (`notesStore`). |
| **`voice.js`** | Full voice suite: SpeechRecognition (STT), SpeechSynthesis (TTS) with rate/voice pickers, Picovoice Porcupine wake-word engine, and in-browser trainer. |
| **`avatar.js` & `avatar-live2d.js`** | Interactive avatars: lightweight SVG expression animator and Live2D Cubism 4 Hiyori model with mouth-flap lip syncing. |
| **`style*.css`** | 6 modular stylesheets implementing tokens, layout grids, widget styling, modal overlays, dark/light modes, and modern glassmorphism effects. |
| **Model & WASM Assets** | Binaries and vendor libraries for local speech processing (`.ppn`, `.pv`, `porcupine.min.js`, PixiJS, Live2D Core). |

---

### 2. Node.js Orchestration Backend (`node-server/`)

| File / Folder | Primary Responsibility |
|---|---|
| **`server.js`** | Server entry point on port 5000: sets up CORS, JSON parsers (5MB limit), connects to MongoDB, mounts routes, and serves `/health`. |
| **`shared.js`** | Core schemas (`User`, `Session`, `Message`, `Assistant`, `PointsRequest`, `OTP`), JWT middlewares (`authMiddleware`, `adminMiddleware`), Nodemailer setup. |
| **`prompts.js`** | Master system prompt defining strict JSON tool contracts and personality modes (Default, Coding, Study, Professional, Casual, Emotional, Funny). |
| **`routes/auth.js`** | Handles user registration, password login, Google OAuth validation, and 6-digit email OTP login. |
| **`routes/chat.js`** | Primary conversational endpoint: enforces rate limits, tracks token quotas, enriches prompts with RAG context, and runs tool handlers. |
| **`routes/profile.js`** | Profile management, tool permission toggles, daily token limit reset checks, and points exchange for tokens. |
| **`routes/sessions.js`** | Manages conversation threads (create, list, fetch message history, delete session). |
| **`routes/timer.js`** | In-process state machine for countdown timers (start, pause, resume, reset, status). |
| **`routes/workspace.js`** | Local disk file manager (list files, download/serve, and delete workspace files). |
| **`routes/admin.js`** | Telemetry metrics (`/api/admin/stats`), user token/points overrides, and approval of point top-up requests. |
| **`services/modelRouter.js`** | Query classifier that automatically routes complex code queries to reasoning models, short chats to fast models, and files to vision extractors. |
| **`services/modelConfig.js`** | Configures token multipliers per model and the point exchange rate (1 pt = 1,000 tokens). |
| **`services/tools/`** | 14 dedicated tool handlers (Weather, Web Search, Code Runner, File Tools, Timer, Alarm, Clock, Stopwatch, Notes, Music, Units, News, Net Speed). |

---

### 3. FastAPI Python Microservice (`fastapi-ai/`)

| File / Folder | Primary Responsibility |
|---|---|
| **`main.py`** | Central Python microservice running on port 8000: |
| *— Inference Gateway* | Routes `/ask` and `/ask/stream` to Ollama (`llama3:8b`, `llama3.1:8b`, `llama3.2:3b`), LM Studio (`deepseek-r1`, `phi-4`), or Google Gemini. |
| *— ChromaDB RAG Memory* | Endpoints `/memory/embed`, `/memory/query`, `/memory/item` embedding texts with `SentenceTransformer("all-MiniLM-L6-v2")`. |
| *— Python Sandbox* | `/run-code` endpoint validating code against blocked imports/builtins and executing in a sandboxed subprocess with a 5s timeout. |
| *— Text Extractor* | `/extract-text` endpoint extracting plain text from base64 `.pdf` (via `pdfplumber`), `.docx` (via `python-docx`), and `.txt`. |
| **`chroma_db/`** | Persistent vector storage directory for user notes, reminders, and semantic memory. |

---

### 4. Storage & Workspace

| Folder | Primary Responsibility |
|---|---|
| **`workspace/`** | Root storage folder for files generated, edited, or inspected by Anya's file management tools. |
| **`work/`** | Internal tracking and documentation repository containing architecture trees, roadmaps, task checklists, and analysis. |
