// node-server/services/modelRouter.js
// Pure, stateless model routing logic — no DB or network calls.
// Returns a routing decision for each incoming chat request.

const VISION_MODELS    = new Set(["llama3:8b", "llama3.2:3b", "gemini-2.5-flash"]);
const FAST_MODEL       = "llama3.2:3b";
const REASONING_MODEL  = "deepseek/deepseek-r1-0528-qwen3-8b";
const EXTRACTOR_MODEL  = "gemini-2.5-flash";
const MANUAL_TTL_MS    = 5 * 60 * 1000; // 5 minutes

// Keywords that suggest code / complex reasoning
const CODE_REGEX = /(function|def |algorithm|implement|debug|refactor|sql\s+query|codebase|compile|runtime|api\s+endpoint|derivative|integral|proof|theorem|∫|Σ|∂|LaTeX|regex|recursion|complexity|big\s*o)/i;

// Friendly reason labels shown in the UI routing bar
const REASON_LABELS = {
    auto_routing_off:     "routing off",
    user_override:        "manual selection",
    vision_pipeline:      "file/image extraction",
    code_or_complexity:   "code / complex query",
    short_conversational: "quick response",
    default:              "default model"
};

/**
 * Classify a query and decide which model(s) to use.
 *
 * @param {string}  message            - The user's message text
 * @param {boolean} hasAttachment      - True if images or fileContext are present
 * @param {string}  requestedModel     - The model_id the user currently has selected
 * @param {boolean} autoRouting        - Whether smart routing is enabled (from req.body)
 * @param {number|null} lastManualSelect - Timestamp of last manual model switch (from req.body)
 * @returns {{ model_id: string, pipeline: Array|null, reason: string, reasonLabel: string }}
 */
function classifyQuery(message, hasAttachment, requestedModel, autoRouting, lastManualSelect) {
    // Helper: return single-model result
    function direct(modelId, reason) {
        return { model_id: modelId, pipeline: null, reason, reasonLabel: REASON_LABELS[reason] || reason };
    }

    // 1. Auto-routing explicitly disabled
    if (!autoRouting) return direct(requestedModel, "auto_routing_off");

    // 2. User manually picked a model recently — respect their choice
    if (lastManualSelect && (Date.now() - lastManualSelect) < MANUAL_TTL_MS) {
        return direct(requestedModel, "user_override");
    }

    // 3. Attachment present but selected model has no vision → vision pipeline
    if (hasAttachment && !VISION_MODELS.has(requestedModel)) {
        return {
            model_id: requestedModel,   // final reasoning model
            pipeline: [
                {
                    model_id: EXTRACTOR_MODEL,
                    role: "extract",
                    extractPrompt: "Describe this image or document thoroughly. Extract all visible text, data, tables, and key details. Be comprehensive."
                },
                {
                    model_id: requestedModel,
                    role: "reason"
                }
            ],
            reason: "vision_pipeline",
            reasonLabel: REASON_LABELS["vision_pipeline"]
        };
    }

    // 4. Code / complex reasoning detected
    const wordCount = message.trim().split(/\s+/).length;
    const sentenceCount = message.split(/[.!?]+/).filter(s => s.trim()).length;
    if (CODE_REGEX.test(message) || sentenceCount > 4 || wordCount > 80) {
        return direct(REASONING_MODEL, "code_or_complexity");
    }

    // 5. Short conversational query — use the fastest model
    if (wordCount < 15 && !hasAttachment) {
        return direct(FAST_MODEL, "short_conversational");
    }

    // 6. Default — use what the user selected
    return direct(requestedModel, "default");
}

module.exports = { classifyQuery, EXTRACTOR_MODEL, VISION_MODELS };
