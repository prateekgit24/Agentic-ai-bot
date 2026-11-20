# Anya AI — Comprehensive Architecture Review & Recommendations

## 1. Executive Summary

Anya AI is a multi-tier AI assistant platform comprising:
- **`frontend/`**: Single-Page Application (SPA) with Live2D/SVG avatars, voice STT/TTS, wake-word engine, and interactive widget cards.
- **`node-server/`**: Express.js orchestration backend handling MongoDB data models, JWT & OAuth authentication, token/points billing, and a 14+ tool execution registry.
- **`fastapi-ai/`**: Python microservice running on port 8000 handling multi-provider LLM inference (Ollama, LM Studio, Google Gemini), ChromaDB vector memory (RAG), Python code execution, and document parsing (PDF/DOCX).

---

## 2. Critical Bugs & High-Priority Fixes

### 2.1 Model ID Mismatch Bug (FastAPI & Node)
* **Issue**: `node-server/routes/chat.js` (Line 27) specifies `llama3.1:8b` as the default target model. However, `fastapi-ai/main.py` explicitly handles `llama3:8b` and `llama3.2:3b`. If `llama3.1:8b` is passed, FastAPI returns `Error: Model 'llama3.1:8b' is not explicitly configured in main.py`.
* **Fix**: Normalize model IDs across `main.py`, `modelRouter.js`, and `chat.js` or support dynamic model passing for all installed Ollama tags using a generic fallback handler in `main.py`.

### 2.2 Python Sandbox Security in `/run-code`
* **Issue**: `fastapi-ai/main.py` uses regex pattern matching against `BLOCKED_IMPORTS` and `BLOCKED_BUILTINS`. In Python, static string blocklists can be bypassed using reflection and object inheritance (e.g., `().__class__.__base__.__subclasses__()` to invoke `os.system`).
* **Fix**: For local development, this is acceptable, but for multi-user or public deployment, execute Python scripts inside ephemeral Docker containers, gVisor sandboxes, or a restricted low-privilege OS user with resource limits (`ulimit`).

### 2.3 Daily Token Reset Trigger
* **Issue**: `applyDailyReset()` is invoked only when a user requests their profile (`GET /api/profile`). If a user returns the next day and immediately sends a chat message without loading the profile page, their token usage may not be refreshed.
* **Fix**: Move `applyDailyReset()` into the auth middleware or invoke it inside `POST /chat` before checking `usr.tokensUsed >= usr.tokenLimit`.

### 2.4 Multi-Tenant Workspace File Isolation
* **Issue**: `node-server/routes/workspace.js` serves files directly from a single shared `../../workspace` directory without user ID scoping or mandatory authentication.
* **Fix**: Isolate user files into `workspace/<userId>/` subdirectories and attach `authMiddleware` to all `/workspace/*` routes.

---

## 3. Performance & Architecture Recommendations

### 3.1 End-to-End Response Streaming
* **Current State**: FastAPI supports `/ask/stream` (NDJSON), but `node-server/routes/chat.js` defaults to non-streaming with a 120-second timeout.
* **Recommendation**: Implement Server-Sent Events (SSE) from FastAPI through Node to the frontend. This reduces time-to-first-token (TTFT) from 5–15 seconds down to under 500ms.

### 3.2 FastAPI Startup Model Warmup
* **Current State**: `SentenceTransformer("all-MiniLM-L6-v2")` is lazily initialized on the first RAG query. The first user query experiences an unexpected multi-second lag.
* **Recommendation**: Preload the embedding model and ChromaDB client in FastAPI’s `lifespan` handler or `@app.on_event("startup")`.

### 3.3 Resilient Web Search
* **Current State**: `webSearchTool.js` falls back to regex HTML scraping against Yahoo search results if DuckDuckGo Instant Answers returns no results. Search engine markup changes frequently and can break regex scrapers.
* **Recommendation**: Integrate dedicated search APIs (such as Brave Search API, Tavily, SerpAPI, or a self-hosted SearXNG instance).

### 3.4 In-Memory Timer Cleanup
* **Current State**: `node-server/routes/timer.js` stores timer records indefinitely in a plain JavaScript object (`timers[sessionId]`).
* **Recommendation**: Implement an automatic expiration cleanup interval or store timer states in Redis/MongoDB with TTL indexes.

---

## 4. Frontend & UI/UX Recommendations

### 4.1 Modular State Architecture
* **Current State**: The frontend scripts (`script.js`, `tools-widgets.js`, `voice.js`, `auth.js`) share global window-level variables (`currentSessionId`, `ttsEnabled`, `isRecording`).
* **Recommendation**: Migrate to standard ES Modules (`<script type="module">`) or establish a central event-driven state store (e.g. `AnyaState.on('sessionChange', ...)`).

### 4.2 Voice Audio Pipeline Synchronization
* **Current State**: Saying the wake word while the assistant is speaking can occasionally cause speech synthesis and microphone recognition to clash.
* **Recommendation**: Ensure `stopSpeaking()` immediately terminates all `speechSynthesis` utterances and releases the audio channel before activating the Web Speech recognition instance.

### 4.3 Error Handling & Network Recovery
* **Current State**: Server health polling runs on a fixed 5-second interval.
* **Recommendation**: Implement exponential backoff for reconnection attempts and display subtle non-blocking toast alerts when reconnecting.

---

## 5. Summary Matrix

| Component | Area | Current Status | Recommended Action |
|---|---|---|---|
| **FastAPI** | Model Routing | Hardcoded IDs | Add generic Ollama proxy & match `llama3.1:8b` |
| **FastAPI** | Code Sandbox | Regex Blocklist | Isolate code execution in Docker / subprocess sandbox |
| **FastAPI** | Embeddings | Lazy Load | Preload `SentenceTransformer` during app startup |
| **Node.js** | Chat Delivery | Non-streaming | Wire up SSE / streaming pipeline end-to-end |
| **Node.js** | Workspaces | Shared Directory | Scope workspaces per user ID (`workspace/<userId>`) |
| **Node.js** | Token Reset | In `profile.js` only | Check daily reset in chat route / middleware |
| **Frontend** | Code Organization | Global Variables | Transition to ES modules / structured state manager |
| **Frontend** | Voice Interaction | Discrete Handlers | Centralize in a unified `AudioManager` pipeline |
