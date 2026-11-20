// codeRunnerTool.js — sandboxed Python execution via FastAPI
const axios = require("axios");

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

// Dangerous imports that are blocked on the server side (preview check)
const BLOCKED_PREVIEW = [
    "os", "sys", "subprocess", "socket", "shutil",
    "importlib", "ctypes", "multiprocessing",
    "signal", "pathlib", "glob", "io",
    "http", "urllib", "requests", "ftplib", "smtplib",
    "pickle", "shelve", "marshal",
    "threading", "asyncio", "concurrent"
];

async function runCode(parameters = {}) {
    const code = (parameters.code || "").trim();
    const language = (parameters.language || "python").toLowerCase();

    if (!code) {
        return {
            type: "tool_result",
            tool: "run_code",
            ui: "error-card",
            data: { message: "No code provided to run." }
        };
    }

    if (language !== "python") {
        return {
            type: "tool_result",
            tool: "run_code",
            ui: "error-card",
            data: { message: `Language "${language}" is not supported. Only Python is available.` }
        };
    }

    try {
        const response = await axios.post(
            `${FASTAPI_URL}/run-code`,
            { code, language },
            { timeout: 15000 }
        );

        const result = response.data;

        return {
            type: "tool_result",
            tool: "run_code",
            ui: "code-result-card",
            data: {
                code,
                language,
                stdout: result.stdout || "",
                stderr: result.stderr || "",
                exit_code: result.exit_code ?? 0,
                duration_ms: result.duration_ms ?? 0,
                blocked: result.blocked || false
            }
        };

    } catch (err) {
        console.error("Code runner error:", err.message);
        return {
            type: "tool_result",
            tool: "run_code",
            ui: "error-card",
            data: { message: "Code execution service unavailable." }
        };
    }
}

module.exports = { runCode };
