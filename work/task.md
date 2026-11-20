# Task Tracker — Anya AI

## Core Infrastructure
- `[ ]` Proper streaming implementation — wire FastAPI `/ask/stream` NDJSON through Node SSE to frontend word-by-word render
- `[ ]` History and context management — sliding window, summarization, per-session persistent context
- `[ ]` Token management — accurate counting, daily reset on chat route, per-model cost tracking, live usage indicator

## AI & Models
- `[ ]` Proper AI personality and AI prompts — refine system prompts per mode, tune tone/memory/tool awareness
- `[ ]` Multi AI system — concurrent model orchestration, fallback chains, A/B routing
- `[ ]` Adding more LLMs — integrate Mistral, Qwen, Command-R, Claude (API), GPT-4o-mini as selectable backends
- `[ ]` RAG vector embedding improvements — better chunking, hybrid BM25 + vector search, document-level memory

## UI & Frontend
- `[ ]` Updating UI — redesign chat bubbles, input bar, responsive layout polish, micro-animations
- `[ ]` Website preview — live in-panel HTML/CSS/JS canvas renderer with refresh and device frame toggle
- `[ ]` Thinking view — expandable reasoning trace panel for models with chain-of-thought (DeepSeek, R1)
- `[ ]` Mermaid tree view — auto-detect and render Mermaid diagrams inline in chat responses
- `[ ]` Proper avatar — improve Live2D expressions, add emotion states, blink/idle animations, SVG fallback refinement

## Voice & Interaction
- `[ ]` Wake word proper solution — replace Porcupine WASM with a more reliable always-on solution or fix key loading

## Search & Web
- `[ ]` Better web search — replace DuckDuckGo/Yahoo scraper with Brave Search API, Tavily, or self-hosted SearXNG
- `[ ]` Integrating to foreign tools — connect to Notion, Google Calendar, GitHub, Spotify APIs

## Tools & Capabilities
- `[ ]` Adding more tools (self) — calculator widget, currency converter, dictionary/thesaurus, QR code gen
- `[ ]` Add tools for non-AI tasks — standalone utilities that run without calling an LLM (unit converter UI, color picker, regex tester)
- `[ ]` Image gen capacity — add `/imagine` command with Pollinations, Stable Diffusion API, or FLUX backend
- `[ ]` Camera capability and camera ML tools — webcam feed, real-time object detection (YOLO), face recognition, emotion detection via MediaPipe/deepface

## Security
- `[ ]` Updating security — workspace per-user isolation, HTTPS enforcement, CSRF tokens, rate limit tuning, input sanitization audit


proper avatar 
multi ai system
adding more llms
adding more tools self
integrating to foreign tools
website preview
thinking view
mermaid tree view
better websearch
history and context management
token management 
add tools for non ai task rag vector embedding and any improvement possible
image gen capacity
camera capability and camera ml tools and ai tools
just add them