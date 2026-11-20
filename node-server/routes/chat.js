// node-server/routes/chat.js
const router  = require("express").Router();
const axios   = require("axios");
const rateLimit = require("express-rate-limit");
const {
    User, Session, Message,
    optionalAuth,
    buildSystemPrompt, buildConversationHistory, getModePrompt
} = require("../shared");
const { classifyQuery, EXTRACTOR_MODEL } = require("../services/modelRouter");

// ---- Rate limiter: 20 requests per minute per IP ----
const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: "Too many requests. Please slow down (max 20/min)." },
    standardHeaders: true,
    legacyHeaders: false
});

// ============================================================
//  POST /chat  (non-streaming)
// ============================================================
router.post("/chat", chatLimiter, optionalAuth, async (req, res) => {
    try {
        const { message, sessionId, model_id, images, fileContext } = req.body;
        const targetModel = model_id || "llama3.1:8b";

        if (!sessionId)
            return res.status(400).json({ error: "sessionId required" });
        if (!message || typeof message !== "string")
            return res.status(400).json({ error: "Invalid message" });

        // Usage limit check
        let userMode = "default";
        let userPerms = null;
        if (req.user) {
            const usr = await User.findById(req.user.userId).select("tokensUsed tokenLimit mode permissions");
            if (usr && usr.tokensUsed >= usr.tokenLimit)
                return res.status(429).json({ error: "Token limit reached. Upgrade your plan or wait for a reset." });
            if (usr && usr.mode) userMode = usr.mode;
            if (usr && usr.permissions) userPerms = usr.permissions;
        }

        // Build augmented message for AI (file context prepended, not stored in history)
        let aiInput = message;
        if (fileContext && fileContext.text) {
            const fileText = String(fileContext.text).slice(0, 8000);
            aiInput = `[Attached file: ${fileContext.filename}]\n${fileText}\n\n---\n${message}`;
        }

        // Save user message
        await Message.create({
            userId: req.user ? req.user.userId : null,
            sessionId, role: "user", content: message
        });

        const historyText = await buildConversationHistory(sessionId);

        // Auto title
        const session = await Session.findById(sessionId);
        if (session && session.title === "New Chat") {
            session.title = message.split(" ").slice(0, 5).join(" ");
            await session.save();
        }

        let systemPrompt = await buildSystemPrompt();
        const modePromptText = getModePrompt(userMode);
        if (modePromptText) systemPrompt = modePromptText;

        // RAG memory
        try {
            const ragRes = await axios.post(
                "http://localhost:8000/memory/query",
                { query: message, top_k: 4 },
                { timeout: 5000 }
            );
            const relevantNotes = ragRes.data?.results || [];
            if (relevantNotes.length > 0) {
                const notesText = relevantNotes.map(n => `[${n.type.toUpperCase()}] ${n.text}`).join("\n");
                systemPrompt += `\n\nRelevant saved notes (recall only — do NOT re-save these):\n${notesText}\n`;
            }
        } catch (_) { }

        let aiResponse;
        try {
            aiResponse = await axios.post(
                "http://localhost:8000/ask",
                {
                    message: aiInput,
                    system_prompt: systemPrompt,
                    history: historyText,
                    model_id: targetModel,
                    ...(images && images.length > 0 ? { images } : {})
                },
                { timeout: 120000 }
            );
        } catch (aiErr) {
            if (aiErr.code === "ECONNREFUSED") {
                console.error("FastAPI service is not running on port 8000");
                return res.status(503).json({
                    error: "AI service is offline. Please ensure the FastAPI server is running (uvicorn main:app --port 8000)."
                });
            }
            if (aiErr.code === "ETIMEDOUT" || (aiErr.response && aiErr.response.status >= 500)) {
                console.error("FastAPI timeout or server error:", aiErr.message);
                return res.status(502).json({
                    error: "AI service timed out or returned an error. Try again or use a smaller model."
                });
            }
            throw aiErr;
        }

        const fullResponse = aiResponse.data?.response || aiResponse.data || "";
        const aiStats = aiResponse.data?.stats || null;

        // Try to parse tool call
        let parsed = null;
        try {
            let cleanJson = fullResponse.trim();
            if (cleanJson.startsWith("```json")) cleanJson = cleanJson.replace(/^```json\s*/, "");
            else if (cleanJson.startsWith("```"))   cleanJson = cleanJson.replace(/^```\s*/, "");
            if (cleanJson.endsWith("```"))           cleanJson = cleanJson.replace(/\s*```$/, "");
            cleanJson = cleanJson.replace(/\\'/g, "'");
            parsed = JSON.parse(cleanJson);
        } catch (err) {
            parsed = null;
            const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    parsed = JSON.parse(jsonMatch[0].replace(/\\'/g, "'"));
                } catch (e) { }
            }
        }

        if (req.body._directTool) parsed = req.body._directTool;

        // ---- Tool execution ----
        if (parsed && parsed.type === "tool") {
            if (!parsed.tool) {
                return res.json({ type: "tool_result", message: "Invalid tool format." });
            }

            const { getTool } = require("../services/tools/toolRegistry");
            const toolFunction = getTool(parsed.tool);

            if (!toolFunction) {
                return res.json({
                    type: "tool_result", tool: parsed.tool, ui: "error-card",
                    data: { message: `Unknown tool: ${parsed.tool}` }
                });
            }

            // ---- Permission check ----
            const permMap = {
                web_search: "canWebSearch", run_code: "canRunCode",
                file_tool: "canCreateFiles", file_manager: "canCreateFiles",
                set_alarm: "canSetAlarms", play_music: "canPlayMusic",
                get_news: "canGetNews"
            };
            const requiredPerm = permMap[parsed.tool];
            if (requiredPerm && userPerms && userPerms[requiredPerm] === false) {
                return res.json({
                    type: "tool_result", tool: parsed.tool, ui: null,
                    error: "Tool disabled by your permissions."
                });
            }

            try {
                const toolResult = await toolFunction(parsed.parameters || {}, { sessionId, userMessage: message });
                if (parsed.message) toolResult.tool_message = parsed.message;

                await Message.create({
                    userId: req.user ? req.user.userId : null,
                    sessionId, role: "assistant", content: `[Tool Executed: ${parsed.tool}]`
                });
                return res.json(toolResult);
            } catch (toolError) {
                console.error("Tool error:", toolError);
                return res.json({
                    type: "tool_result", tool: parsed.tool, ui: "error-card",
                    data: { message: "Tool execution failed." }
                });
            }
        }

        // ---- Normal chat ----
        await Message.create({
            userId: req.user ? req.user.userId : null,
            sessionId, role: "assistant", content: fullResponse
        });

        let usageInfo = null;
        if (req.user && aiStats) {
            const totalTokens = aiStats.total_tokens || 0;
            const usr = await User.findByIdAndUpdate(
                req.user.userId,
                { $inc: { tokensUsed: totalTokens, messagesCount: 1 } },
                { new: true, select: "tokensUsed tokenLimit messagesCount" }
            );
            if (usr) {
                usageInfo = {
                    tokensUsed: usr.tokensUsed,
                    tokensLeft: Math.max(0, usr.tokenLimit - usr.tokensUsed),
                    messagesCount: usr.messagesCount
                };
            }
        }

        return res.json({ type: "chat", message: fullResponse, stats: aiStats, usage: usageInfo });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "AI error" });
    }
});

// ============================================================
//  POST /chat/stream  (SSE streaming)
// ============================================================
router.post("/chat/stream", chatLimiter, optionalAuth, async (req, res) => {
    try {
        const { message, sessionId, model_id, images, fileContext, autoRouting, lastManualSelect } = req.body;
        const targetModel = model_id || "llama3.1:8b";

        if (!sessionId) return res.status(400).json({ error: "sessionId required" });
        if (!message || typeof message !== "string") return res.status(400).json({ error: "Invalid message" });

        // Usage limit check
        let userMode = "default";
        let userPerms = null;
        let userRole  = "user";
        if (req.user) {
            const usr = await User.findById(req.user.userId).select(
                "tokensUsed tokenLimit mode permissions role lastDailyReset"
            );
            if (usr) {
                userMode  = usr.mode || "default";
                userPerms = usr.permissions;
                userRole  = usr.role || "user";

                if (userRole !== "admin") {
                    // Daily reset: if calendar day changed, reset tokensUsed to 0
                    const today = new Date().toDateString();
                    if (!usr.lastDailyReset || new Date(usr.lastDailyReset).toDateString() !== today) {
                        await User.findByIdAndUpdate(req.user.userId, {
                            tokensUsed: 0,
                            lastDailyReset: new Date()
                        });
                        usr.tokensUsed = 0;
                    }
                    // Daily token limit check (weighted usage vs tokenLimit)
                    if (usr.tokensUsed >= usr.tokenLimit) {
                        return res.status(429).json({
                            error: "Daily token limit reached. Spend points to add more tokens, or wait until tomorrow."
                        });
                    }
                }
            }
        }

        // Build augmented message for AI (file context prepended, not stored in history)
        let aiInput = message;
        if (fileContext && fileContext.text) {
            const fileText = String(fileContext.text).slice(0, 8000);
            aiInput = `[Attached file: ${fileContext.filename}]\n${fileText}\n\n---\n${message}`;
        }

        await Message.create({
            userId: req.user ? req.user.userId : null,
            sessionId, role: "user", content: message
        });

        const historyText = await buildConversationHistory(sessionId);

        const session = await Session.findById(sessionId);
        if (session && session.title === "New Chat") {
            session.title = message.split(" ").slice(0, 5).join(" ");
            await session.save();
        }

        let systemPrompt = await buildSystemPrompt();
        const modePromptText = getModePrompt(userMode);
        if (modePromptText) systemPrompt = modePromptText;

        try {
            const ragRes = await axios.post("http://localhost:8000/memory/query", { query: message, top_k: 4 }, { timeout: 5000 });
            const relevantNotes = ragRes.data?.results || [];
            if (relevantNotes.length > 0) {
                const notesText = relevantNotes.map(n => `[${n.type.toUpperCase()}] ${n.text}`).join("\n");
                systemPrompt += `\n\nRelevant saved notes (recall only — do NOT re-save these):\n${notesText}\n`;
            }
        } catch { }

        // SSE headers
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        // ── Smart model routing ──
        const hasAttachment = (images && images.length > 0) || (fileContext && !!fileContext.text);
        const routing = classifyQuery(
            message,
            hasAttachment,
            targetModel,
            autoRouting !== false,          // default ON if not explicitly false
            lastManualSelect ? Number(lastManualSelect) : null
        );

        let effectiveModel   = routing.model_id;
        let effectiveImages  = images;    // images to pass to FastAPI (cleared for step 2)

        // Emit routing info to frontend (skip for default/trivial routes)
        if (routing.reason !== "default" && routing.reason !== "auto_routing_off") {
            res.write(`data: ${JSON.stringify({ routing_status: { reason: routing.reason, reasonLabel: routing.reasonLabel, model: routing.model_id, pipeline: routing.pipeline ? routing.pipeline.map(s => s.model_id) : null } })}\n\n`);
        }

        // ── Vision pipeline: extract from image/file using Gemini, then reason ──
        if (routing.pipeline && routing.pipeline.length === 2) {
            const extractStep  = routing.pipeline[0];
            const reasonStep   = routing.pipeline[1];

            res.write(`data: ${JSON.stringify({ routing_step: { n: 1, label: `Extracting content via ${extractStep.model_id}…` } })}\n\n`);

            try {
                const extractRes = await axios.post(
                    "http://localhost:8000/ask",
                    {
                        message: extractStep.extractPrompt,
                        system_prompt: "You are a document/image content extractor. Be thorough and accurate.",
                        history: "",
                        model_id: extractStep.model_id,
                        ...(effectiveImages && effectiveImages.length > 0 ? { images: effectiveImages } : {})
                    },
                    { timeout: 60000 }
                );
                const extracted = ((extractRes.data?.response || "") + "").slice(0, 5000);
                // Inject extracted content into aiInput for step 2
                aiInput = `[Extracted content from attachment]\n${extracted}\n\n---\n[User question]\n${message}`;
                effectiveImages = null;   // step 2 (reasoning) does NOT receive raw images
                effectiveModel  = reasonStep.model_id;
                res.write(`data: ${JSON.stringify({ routing_step: { n: 2, label: `Reasoning with ${effectiveModel}…` } })}\n\n`);
            } catch (extractErr) {
                console.warn("Vision extraction failed, falling back to direct:", extractErr.message);
                // Fall back to calling original model with original input
                effectiveModel  = targetModel;
                effectiveImages = images;
            }
        }

        let aiResponse;
        try {
            aiResponse = await axios.post(
                "http://localhost:8000/ask/stream",
                {
                    message: aiInput,
                    system_prompt: systemPrompt,
                    history: historyText,
                    model_id: effectiveModel,
                    ...(effectiveImages && effectiveImages.length > 0 ? { images: effectiveImages } : {})
                },
                { timeout: 120000, responseType: "stream" }
            );
        } catch (aiErr) {
            if (aiErr.code === "ECONNREFUSED") {
                res.write(`data: ${JSON.stringify({ error: "AI service is offline." })}\n\n`);
                res.write("data: [DONE]\n\n");
                return res.end();
            }
            throw aiErr;
        }

        let fullResponse = "";
        let aiStats = null;

        aiResponse.data.on("data", (chunk) => {
            const lines = chunk.toString().split("\n").filter(l => l.trim());
            for (const line of lines) {
                try {
                    const parsed = JSON.parse(line);
                    if (parsed.done) {
                        fullResponse = parsed.full_response || fullResponse;
                        aiStats = parsed.stats || null;
                        res.write(`data: ${JSON.stringify({ done: true, stats: aiStats })}\n\n`);
                    } else if (parsed.token) {
                        fullResponse += parsed.token;
                        res.write(`data: ${JSON.stringify({ token: parsed.token })}\n\n`);
                    }
                } catch { }
            }
        });

        aiResponse.data.on("end", async () => {
            const trimmed = fullResponse.trim();
            if (trimmed.startsWith("{") && trimmed.includes('"type"') && trimmed.includes('"tool"')) {
                try {
                    let cleanJson = trimmed;
                    if (cleanJson.startsWith("```")) cleanJson = cleanJson.replace(/^```\w*\n?/, "");
                    if (cleanJson.endsWith("```"))   cleanJson = cleanJson.replace(/\s*```$/, "");
                    cleanJson = cleanJson.replace(/\\'/g, "'");

                    const toolParsed = JSON.parse(cleanJson);
                    if (toolParsed && toolParsed.type === "tool" && toolParsed.tool) {
                        const { getTool } = require("../services/tools/toolRegistry");
                        const toolFunction = getTool(toolParsed.tool);
                        if (toolFunction) {
                            const streamPermMap = {
                                web_search: "canWebSearch", run_code: "canRunCode",
                                file_tool: "canCreateFiles", file_manager: "canCreateFiles",
                                set_alarm: "canSetAlarms", play_music: "canPlayMusic",
                                get_news: "canGetNews"
                            };
                            const streamReqPerm = streamPermMap[toolParsed.tool];
                            if (streamReqPerm && userPerms && userPerms[streamReqPerm] === false) {
                                res.write(`data: ${JSON.stringify({ tool_result: { type: "tool_result", tool: toolParsed.tool, ui: null, error: "Tool disabled by your permissions." } })}\n\n`);
                            } else {
                                const toolResult = await toolFunction(toolParsed.parameters || {}, { sessionId, userMessage: message });
                                if (toolParsed.message) toolResult.tool_message = toolParsed.message;
                                await Message.create({
                                    userId: req.user ? req.user.userId : null,
                                    sessionId, role: "assistant", content: `[Tool Executed: ${toolParsed.tool}]`
                                });
                                res.write(`data: ${JSON.stringify({ tool_result: toolResult })}\n\n`);
                            }
                        }
                    }
                } catch { }
            }

            await Message.create({
                userId: req.user ? req.user.userId : null,
                sessionId, role: "assistant", content: fullResponse
            });

            if (req.user && aiStats) {
                const { MODEL_WEIGHTS } = require("../services/modelConfig");
                const rawTokens  = aiStats.total_tokens || 0;
                const weight     = MODEL_WEIGHTS[effectiveModel] || 1.0;
                const weighted   = Math.ceil(rawTokens * weight);
                if (userRole !== "admin") {
                    // Weighted consumption drains daily token allowance faster for expensive models
                    await User.findByIdAndUpdate(req.user.userId, {
                        $inc: {
                            tokensUsed:         weighted,
                            messagesCount:      1,
                            weightedTokensUsed: weighted
                        }
                    });
                } else {
                    await User.findByIdAndUpdate(req.user.userId, {
                        $inc: { tokensUsed: rawTokens, messagesCount: 1 }
                    });
                }
            }

            res.write("data: [DONE]\n\n");
            res.end();
        });

        aiResponse.data.on("error", () => {
            res.write(`data: ${JSON.stringify({ error: "Stream interrupted." })}\n\n`);
            res.write("data: [DONE]\n\n");
            res.end();
        });

    } catch (error) {
        console.error("Stream error:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: "Streaming failed." });
        } else {
            res.write(`data: ${JSON.stringify({ error: "Server error." })}\n\n`);
            res.write("data: [DONE]\n\n");
            res.end();
        }
    }
});

// ============================================================
//  POST /extract-text  — proxy to FastAPI text extraction
// ============================================================
router.post("/extract-text", async (req, res) => {
    try {
        const { filename, data } = req.body;
        if (!filename || !data) return res.status(400).json({ error: "filename and data required" });
        const response = await axios.post(
            "http://localhost:8000/extract-text",
            { filename, data },
            { timeout: 30000 }
        );
        res.json(response.data);
    } catch (err) {
        if (err.code === "ECONNREFUSED") return res.status(503).json({ error: "AI service offline." });
        res.status(500).json({ error: "Text extraction failed." });
    }
});

module.exports = router;
