from fastapi import FastAPI
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import requests
import json
import os
import uuid
import time
import subprocess
import tempfile
import re
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

# Load environment variables from the existing node-server .env file
env_path = os.path.join(os.path.dirname(__file__), '..', 'node-server', '.env')
load_dotenv(dotenv_path=env_path)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===================== RAG MEMORY (ChromaDB) =====================
# Persist to a folder next to main.py
CHROMA_PATH = os.path.join(os.path.dirname(__file__), "chroma_db")
_chroma_client = None
_chroma_col = None
_embed_model = None

def get_chroma():
    global _chroma_client, _chroma_col
    if _chroma_col is None:
        _chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
        _chroma_col = _chroma_client.get_or_create_collection("anya_memory")
    return _chroma_col

def get_embed():
    global _embed_model
    if _embed_model is None:
        print("Loading sentence-transformers model (first-time download)...")
        _embed_model = SentenceTransformer("all-MiniLM-L6-v2")
        print("Model loaded.")
    return _embed_model


# ===================== MODELS =====================
class Prompt(BaseModel):
    message: str
    system_prompt: str = ""
    history: str = ""
    model_id: str = "llama3.1:8b"
    images: Optional[List[str]] = None  # list of base64 data URIs for vision input

class MemoryItem(BaseModel):
    id: str
    text: str
    type: str = "note"

class MemoryQuery(BaseModel):
    query: str
    top_k: int = 4

class MemoryDelete(BaseModel):
    id: str

class CodeRequest(BaseModel):
    code: str
    language: str = "python"

class ExtractRequest(BaseModel):
    filename: str
    data: str  # base64-encoded file content


# ===================== /ask =====================
@app.post("/ask")
def ask_ai(prompt: Prompt):
    full_prompt = f"""{prompt.system_prompt}

Conversation History:
{prompt.history}

User: {prompt.message}
Assistant:
"""
    t_start = time.time()
    try:
        # --- ROUTING LOGIC ---
        if prompt.model_id in ("llama3:8b", "llama3.1:8b", "llama3.2:3b", "llama3.2", "llama3") or (not prompt.model_id.startswith("gemini") and not prompt.model_id.startswith("deepseek") and prompt.model_id != "phi-4"):
            # --- OLLAMA (Local) ---
            target_model = prompt.model_id
            ollama_payload = {"model": target_model, "prompt": full_prompt, "stream": False}
            if prompt.images:
                ollama_payload["images"] = [img.split(",", 1)[1] if "," in img else img for img in prompt.images]
            response = requests.post(
                "http://localhost:11434/api/generate",
                json=ollama_payload,
                timeout=120
            )
            t_end = time.time()
            data = response.json()
            content = data.get("response", "").strip()
            
            eval_count        = data.get("eval_count", 0)
            prompt_tokens     = data.get("prompt_eval_count", 0)
            eval_duration_s   = data.get("eval_duration", 1) / 1e9
            toks_per_sec      = round(eval_count / eval_duration_s, 1) if eval_duration_s > 0 else 0
            wall_time_s       = round(t_end - t_start, 2)

        elif prompt.model_id == "gemini-2.5-flash":
            # --- GOOGLE: Gemini 2.5 Flash ---
            GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
            if not GEMINI_API_KEY:
                return {"response": "Please add GEMINI_API_KEY to your `node-server/.env` file.", "stats": {"verdict": "done"}}

            user_parts = [{"text": full_prompt}]
            if prompt.images:
                for img in prompt.images:
                    if "," in img:
                        mime = img.split(";")[0].split(":")[1] if img.startswith("data:") else "image/jpeg"
                        b64 = img.split(",", 1)[1]
                    else:
                        mime, b64 = "image/jpeg", img
                    user_parts.append({"inline_data": {"mime_type": mime, "data": b64}})

            gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
            response = requests.post(
                gemini_url,
                json={
                    "contents": [{"role": "user", "parts": user_parts}],
                    "systemInstruction": {"parts": [{"text": prompt.system_prompt}]},
                    "generationConfig": {"temperature": 0.5}
                },
                timeout=120
            )
            t_end = time.time()
            data = response.json()
            
            try:
                content = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            except KeyError:
                content = "Error parsing Gemini response: " + str(data)
                
            usage = data.get("usageMetadata", {})
            eval_count = usage.get("candidatesTokenCount", 0)
            prompt_tokens = usage.get("promptTokenCount", 0)
            
            wall_time_s = round(t_end - t_start, 2)
            toks_per_sec = round(eval_count / wall_time_s, 1) if wall_time_s > 0 else 0

        elif prompt.model_id == "deepseek/deepseek-r1-0528-qwen3-8b":
            # --- LM STUDIO: DeepSeek R1 ---
            response = requests.post(
                "http://localhost:1234/v1/chat/completions",
                json={
                    "model": "deepseek/deepseek-r1-0528-qwen3-8b",
                    "messages": [
                        {"role": "system", "content": prompt.system_prompt + "\n\nConversation History:\n" + prompt.history},
                        {"role": "user", "content": prompt.message}
                    ],
                    "stream": False
                },
                timeout=120
            )
            t_end = time.time()
            data = response.json()
            
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            usage = data.get("usage", {})
            eval_count = usage.get("completion_tokens", 0)
            prompt_tokens = usage.get("prompt_tokens", 0)
            
            wall_time_s = round(t_end - t_start, 2)
            toks_per_sec = round(eval_count / wall_time_s, 1) if wall_time_s > 0 else 0

        elif prompt.model_id == "phi-4":
            # --- LM STUDIO: Phi-4 ---
            response = requests.post(
                "http://localhost:1234/v1/chat/completions",
                json={
                    "model": "phi-4",
                    "messages": [
                        {"role": "system", "content": prompt.system_prompt + "\n\nConversation History:\n" + prompt.history},
                        {"role": "user", "content": prompt.message}
                    ],
                    "stream": False
                },
                timeout=120
            )
            t_end = time.time()
            data = response.json()
            
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            usage = data.get("usage", {})
            eval_count = usage.get("completion_tokens", 0)
            prompt_tokens = usage.get("prompt_tokens", 0)
            
            wall_time_s = round(t_end - t_start, 2)
            toks_per_sec = round(eval_count / wall_time_s, 1) if wall_time_s > 0 else 0

        else:
            return {
                "response": f"Error: Model '{prompt.model_id}' is not explicitly configured in main.py.",
                "stats": {"verdict": "error"}
            }

        return {
            "response": content,
            "stats": {
                "output_tokens": eval_count,
                "input_tokens":  prompt_tokens,
                "total_tokens":  eval_count + prompt_tokens,
                "tok_per_sec":   toks_per_sec,
                "gen_time_s":    wall_time_s,
                "total_time_s":  wall_time_s,
                "wall_time_s":   wall_time_s,
                "verdict":       "done"
            }
        }
    except Exception as e:
        return {"response": "Error: AI service unavailable.", "stats": {"verdict": "error"}}


# ===================== /ask/stream =====================
from fastapi.responses import StreamingResponse

@app.post("/ask/stream")
def ask_ai_stream(prompt: Prompt):
    """Stream tokens as newline-delimited JSON (NDJSON).
    Each line: {"token": "word"} or final {"done": true, "stats": {...}}
    """
    full_prompt = f"""{prompt.system_prompt}

Conversation History:
{prompt.history}

User: {prompt.message}
Assistant:
"""
    t_start = time.time()

    def stream_ollama(model_name):
        """Stream from Ollama /api/generate with stream=True."""
        ollama_payload = {"model": model_name, "prompt": full_prompt, "stream": True}
        if prompt.images:
            ollama_payload["images"] = [img.split(",", 1)[1] if "," in img else img for img in prompt.images]
        resp = requests.post(
            "http://localhost:11434/api/generate",
            json=ollama_payload,
            stream=True, timeout=120
        )
        full_text = ""
        eval_count = 0
        prompt_tokens = 0
        eval_duration = 1

        for line in resp.iter_lines():
            if not line:
                continue
            chunk = json.loads(line)
            token = chunk.get("response", "")
            if token:
                full_text += token
                yield json.dumps({"token": token}) + "\n"
            if chunk.get("done"):
                eval_count = chunk.get("eval_count", len(full_text.split()))
                prompt_tokens = chunk.get("prompt_eval_count", 0)
                eval_duration = chunk.get("eval_duration", 1) / 1e9

        wall_time = round(time.time() - t_start, 2)
        tps = round(eval_count / eval_duration, 1) if eval_duration > 0 else 0
        yield json.dumps({
            "done": True,
            "full_response": full_text.strip(),
            "stats": {
                "output_tokens": eval_count,
                "input_tokens": prompt_tokens,
                "total_tokens": eval_count + prompt_tokens,
                "tok_per_sec": tps,
                "gen_time_s": wall_time,
                "total_time_s": wall_time,
                "wall_time_s": wall_time,
                "verdict": "done"
            }
        }) + "\n"

    def stream_lmstudio(model_name):
        """Stream from LM Studio OpenAI-compatible /v1/chat/completions."""
        resp = requests.post(
            "http://localhost:1234/v1/chat/completions",
            json={
                "model": model_name,
                "messages": [
                    {"role": "system", "content": prompt.system_prompt + "\n\nConversation History:\n" + prompt.history},
                    {"role": "user", "content": prompt.message}
                ],
                "stream": True
            },
            stream=True, timeout=120
        )
        full_text = ""
        for line in resp.iter_lines():
            if not line:
                continue
            text = line.decode("utf-8")
            if text.startswith("data: "):
                text = text[6:]
            if text.strip() == "[DONE]":
                break
            try:
                chunk = json.loads(text)
                token = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                if token:
                    full_text += token
                    yield json.dumps({"token": token}) + "\n"
            except json.JSONDecodeError:
                continue

        wall_time = round(time.time() - t_start, 2)
        word_count = len(full_text.split())
        tps = round(word_count / wall_time, 1) if wall_time > 0 else 0
        yield json.dumps({
            "done": True,
            "full_response": full_text.strip(),
            "stats": {
                "output_tokens": word_count,
                "input_tokens": 0,
                "total_tokens": word_count,
                "tok_per_sec": tps,
                "gen_time_s": wall_time,
                "total_time_s": wall_time,
                "wall_time_s": wall_time,
                "verdict": "done"
            }
        }) + "\n"

    try:
        # Ollama models
        if prompt.model_id in ("llama3:8b", "llama3.1:8b", "llama3.2:3b", "llama3.2", "llama3") or (not prompt.model_id.startswith("gemini") and not prompt.model_id.startswith("deepseek") and prompt.model_id != "phi-4"):
            return StreamingResponse(stream_ollama(prompt.model_id), media_type="application/x-ndjson")

        # LM Studio models
        elif prompt.model_id in ("deepseek/deepseek-r1-0528-qwen3-8b", "phi-4"):
            return StreamingResponse(stream_lmstudio(prompt.model_id), media_type="application/x-ndjson")

        # Gemini — no streaming, fall back to regular /ask
        elif prompt.model_id == "gemini-2.5-flash":
            result = ask_ai(prompt)
            def gemini_fallback():
                yield json.dumps({"token": result["response"]}) + "\n"
                yield json.dumps({"done": True, "full_response": result["response"], "stats": result["stats"]}) + "\n"
            return StreamingResponse(gemini_fallback(), media_type="application/x-ndjson")

        else:
            def error_stream():
                yield json.dumps({"token": f"Error: Model '{prompt.model_id}' is not configured.", "done": True, "stats": {"verdict": "error"}}) + "\n"
            return StreamingResponse(error_stream(), media_type="application/x-ndjson")

    except Exception as e:
        def err():
            yield json.dumps({"token": "Error: AI service unavailable.", "done": True, "stats": {"verdict": "error"}}) + "\n"
        return StreamingResponse(err(), media_type="application/x-ndjson")


# ===================== /memory/embed =====================
@app.post("/memory/embed")
def embed_memory(item: MemoryItem):
    try:
        col = get_chroma()
        model = get_embed()
        embedding = model.encode(item.text).tolist()
        col.upsert(
            ids=[item.id],
            documents=[item.text],
            embeddings=[embedding],
            metadatas=[{"type": item.type}]
        )
        return {"success": True}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# ===================== /memory/query =====================
@app.post("/memory/query")
def query_memory(body: MemoryQuery):
    try:
        col = get_chroma()
        model = get_embed()
        # Return empty if collection is empty
        if col.count() == 0:
            return {"results": []}
        embedding = model.encode(body.query).tolist()
        k = min(body.top_k, col.count())
        res = col.query(query_embeddings=[embedding], n_results=k, include=["documents", "metadatas", "distances"])
        results = []
        for doc, meta, dist in zip(res["documents"][0], res["metadatas"][0], res["distances"][0]):
            # Only include if similarity is decent (distance < 1.5 in cosine space)
            if dist < 1.5:
                results.append({"text": doc, "type": meta.get("type", "note"), "distance": round(dist, 3)})
        return {"results": results}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# ===================== /memory/delete =====================
@app.delete("/memory/item")
def delete_memory(body: MemoryDelete):
    try:
        col = get_chroma()
        col.delete(ids=[body.id])
        return {"success": True}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# ===================== /run-code =====================
BLOCKED_IMPORTS = {
    "os", "sys", "subprocess", "socket", "shutil",
    "importlib", "ctypes", "multiprocessing",
    "signal", "pathlib", "glob", "io",
    "http", "urllib", "requests", "ftplib", "smtplib",
    "pickle", "shelve", "marshal",
    "threading", "asyncio", "concurrent"
}

# Dangerous builtins that bypass import checks
BLOCKED_BUILTINS = [
    r"__import__\s*\(",
    r"\beval\s*\(",
    r"\bexec\s*\(",
    r"\bcompile\s*\(",
    r"\bglobals\s*\(",
    r"\blocals\s*\(",
    r"\bgetattr\s*\(",
    r"\bdelattr\s*\(",
    r"\bsetattr\s*\(",
    r"\bopen\s*\(",
]

@app.post("/run-code")
def run_code(body: CodeRequest):
    if body.language != "python":
        return JSONResponse(status_code=400, content={"error": "Only Python is supported."})

    code = body.code

    # Check for blocked imports
    import_pattern = re.findall(r"^\s*(?:import|from)\s+(\w+)", code, re.MULTILINE)
    for mod in import_pattern:
        if mod in BLOCKED_IMPORTS:
            return {
                "stdout": "",
                "stderr": f"❌ Blocked: import '{mod}' is not allowed for security reasons.",
                "exit_code": 1,
                "duration_ms": 0,
                "blocked": True
            }

    # Check for dangerous builtins
    for pattern in BLOCKED_BUILTINS:
        if re.search(pattern, code):
            builtin_name = pattern.split(r"\b")[-1].split(r"\s")[0] if r"\b" in pattern else pattern.split("_")[2].split(r"\s")[0]
            return {
                "stdout": "",
                "stderr": f"❌ Blocked: '{builtin_name}' is not allowed for security reasons.",
                "exit_code": 1,
                "duration_ms": 0,
                "blocked": True
            }

    # Mock input to prevent EOFError in non-interactive background execution
    mock_input = (
        "import builtins\n"
        "def _mock_input(prompt=''):\n"
        "    print(prompt + '42')\n"
        "    return '42'\n"
        "builtins.input = _mock_input\n\n"
    )
    code = mock_input + code

    # Write to temp file and execute
    tmp = tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False, encoding="utf-8")
    try:
        tmp.write(code)
        tmp.close()

        t0 = time.time()
        result = subprocess.run(
            ["python", tmp.name],
            capture_output=True,
            text=True,
            input="",
            timeout=5
        )
        duration_ms = round((time.time() - t0) * 1000)

        return {
            "stdout": result.stdout[:4000],   # cap output
            "stderr": result.stderr[:2000],
            "exit_code": result.returncode,
            "duration_ms": duration_ms,
            "blocked": False
        }
    except subprocess.TimeoutExpired:
        return {"stdout": "", "stderr": "⏱ Execution timed out (5s limit).", "exit_code": 1, "duration_ms": 5000, "blocked": False}
    except Exception as e:
        return {"stdout": "", "stderr": str(e), "exit_code": 1, "duration_ms": 0, "blocked": False}
    finally:
        os.unlink(tmp.name)

# ===================== /health =====================
@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "fastapi-ai",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S")
    }


# ===================== /extract-text =====================
@app.post("/extract-text")
def extract_text(req: ExtractRequest):
    """Extract plain text from TXT, PDF, or DOCX files (base64-encoded input)."""
    import base64
    try:
        raw = base64.b64decode(req.data)
        ext = req.filename.rsplit(".", 1)[-1].lower() if "." in req.filename else ""

        if ext == "txt":
            return {"text": raw.decode("utf-8", errors="replace")}

        elif ext == "pdf":
            import pdfplumber
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                f.write(raw)
                tmp_path = f.name
            try:
                with pdfplumber.open(tmp_path) as pdf:
                    pages_text = [page.extract_text() or "" for page in pdf.pages]
                text = "\n\n".join(t for t in pages_text if t.strip())
            finally:
                os.unlink(tmp_path)
            return {"text": text.strip()}

        elif ext in ("docx", "doc"):
            from docx import Document
            with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as f:
                f.write(raw)
                tmp_path = f.name
            try:
                doc = Document(tmp_path)
                text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
            finally:
                os.unlink(tmp_path)
            return {"text": text.strip()}

        else:
            return JSONResponse(status_code=400, content={"error": f"Unsupported file type: .{ext}"})

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
