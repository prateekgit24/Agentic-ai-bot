// node-server/services/tools/notesTool.js
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

async function addNote(parameters = {}) {
    const { text, type = "note" } = parameters;

    if (!text) {
        return {
            type: "tool_result",
            tool: "add_note",
            ui: "notes-card",
            data: { error: "No text provided." }
        };
    }

    const validTypes = ["note", "todo", "reminder", "phone"];
    const noteType = validTypes.includes(type) ? type : "note";
    const noteId = uuidv4();

    // Embed into RAG memory (non-blocking)
    axios.post(`${FASTAPI_URL}/memory/embed`, {
        id: noteId,
        text: text.trim(),
        type: noteType
    }, { timeout: 8000 }).catch(() => { }); // fire-and-forget, never block

    return {
        type: "tool_result",
        tool: "add_note",
        ui: "notes-card",
        data: {
            id: noteId,
            text: text.trim(),
            type: noteType,
            timestamp: new Date().toISOString()
        }
    };
}

module.exports = { addNote };
