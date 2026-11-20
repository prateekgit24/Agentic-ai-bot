// fileManagerTool.js — Enhanced workspace file manager
const fs   = require("fs");
const path = require("path");

const BASE_DIR = path.join(__dirname, "../../../workspace");

if (!fs.existsSync(BASE_DIR)) {
    fs.mkdirSync(BASE_DIR, { recursive: true });
}

function safePath(fileName) {
    if (!fileName) throw new Error("fileName required");
    // Prevent path traversal
    const resolved = path.resolve(BASE_DIR, fileName);
    if (!resolved.startsWith(BASE_DIR)) throw new Error("Invalid path");
    return resolved;
}

// Extension → icon + language label
const EXT_META = {
    py:   { icon: "🐍", lang: "Python",     type: "code" },
    js:   { icon: "🟡", lang: "JavaScript", type: "code" },
    ts:   { icon: "🔷", lang: "TypeScript", type: "code" },
    html: { icon: "🌐", lang: "HTML",       type: "code" },
    css:  { icon: "🎨", lang: "CSS",        type: "code" },
    json: { icon: "📋", lang: "JSON",       type: "data" },
    md:   { icon: "📝", lang: "Markdown",   type: "text" },
    txt:  { icon: "📄", lang: "Text",       type: "text" },
    csv:  { icon: "📊", lang: "CSV",        type: "data" },
    xml:  { icon: "🗂",  lang: "XML",        type: "data" },
    sql:  { icon: "🗄",  lang: "SQL",        type: "code" },
    sh:   { icon: "⚙",  lang: "Shell",      type: "code" },
    bat:  { icon: "⚙",  lang: "Batch",      type: "code" },
    java: { icon: "☕", lang: "Java",       type: "code" },
    c:    { icon: "🔵", lang: "C",          type: "code" },
    cpp:  { icon: "🔵", lang: "C++",        type: "code" },
    rs:   { icon: "🦀", lang: "Rust",       type: "code" },
    go:   { icon: "🐹", lang: "Go",         type: "code" }
};

function getExtMeta(fileName) {
    const ext = path.extname(fileName).slice(1).toLowerCase();
    return EXT_META[ext] || { icon: "📄", lang: ext.toUpperCase() || "File", type: "text" };
}

function humanSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
}

// List all files in workspace with metadata
function listFiles() {
    if (!fs.existsSync(BASE_DIR)) return [];

    return fs.readdirSync(BASE_DIR)
        .filter(f => {
            try {
                return fs.statSync(path.join(BASE_DIR, f)).isFile();
            } catch { return false; }
        })
        .map(f => {
            const fp = path.join(BASE_DIR, f);
            const stat = fs.statSync(fp);
            const meta = getExtMeta(f);
            return {
                name:     f,
                size:     stat.size,
                sizeHuman: humanSize(stat.size),
                modified: stat.mtime.toISOString(),
                created:  stat.birthtime.toISOString(),
                icon:     meta.icon,
                lang:     meta.lang,
                type:     meta.type,
                ext:      path.extname(f).slice(1).toLowerCase()
            };
        })
        .sort((a, b) => new Date(b.modified) - new Date(a.modified));
}

async function fileManager(parameters = {}, context = {}) {
    const { action, fileName, content } = parameters;

    try {
        // ---- LIST ----
        if (!action || action === "list") {
            const files = listFiles();
            return {
                type: "tool_result",
                tool: "file_manager",
                ui: "file-manager-card",
                data: {
                    files,
                    total: files.length,
                    workspacePath: BASE_DIR
                }
            };
        }

        // ---- READ ----
        if (action === "read") {
            const fp = safePath(fileName);
            if (!fs.existsSync(fp)) throw new Error(`File not found: ${fileName}`);
            const raw = fs.readFileSync(fp, "utf-8");
            const meta = getExtMeta(fileName);
            return {
                type: "tool_result",
                tool: "file_manager",
                ui: "file-manager-card",
                data: {
                    action: "view",
                    fileName,
                    content: raw,
                    icon: meta.icon,
                    lang: meta.lang,
                    size: humanSize(fs.statSync(fp).size),
                    files: listFiles()
                }
            };
        }

        // ---- DELETE ----
        if (action === "delete") {
            const fp = safePath(fileName);
            if (!fs.existsSync(fp)) throw new Error(`File not found: ${fileName}`);
            fs.unlinkSync(fp);
            return {
                type: "tool_result",
                tool: "file_manager",
                ui: "file-manager-card",
                data: {
                    action: "deleted",
                    fileName,
                    files: listFiles()
                }
            };
        }

        // ---- CREATE / WRITE ----
        if (action === "create" || action === "write") {
            const fp = safePath(fileName);
            fs.writeFileSync(fp, content || "");
            const meta = getExtMeta(fileName);
            return {
                type: "tool_result",
                tool: "file_manager",
                ui: "file-manager-card",
                data: {
                    action: "created",
                    fileName,
                    icon: meta.icon,
                    lang: meta.lang,
                    files: listFiles()
                }
            };
        }

        // ---- RENAME ----
        if (action === "rename") {
            const { newName } = parameters;
            const oldFp = safePath(fileName);
            const newFp = safePath(newName);
            if (!fs.existsSync(oldFp)) throw new Error(`File not found: ${fileName}`);
            fs.renameSync(oldFp, newFp);
            return {
                type: "tool_result",
                tool: "file_manager",
                ui: "file-manager-card",
                data: {
                    action: "renamed",
                    from: fileName,
                    to: newName,
                    files: listFiles()
                }
            };
        }

        throw new Error(`Unknown action: ${action}`);

    } catch (err) {
        return {
            type: "tool_result",
            tool: "file_manager",
            ui: "error-card",
            data: { message: err.message }
        };
    }
}

module.exports = { fileManager, listFiles };
