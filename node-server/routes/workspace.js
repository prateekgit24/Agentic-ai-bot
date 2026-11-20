// node-server/routes/workspace.js
const router  = require("express").Router();
const fs      = require("fs");
const path    = require("path");

const WORKSPACE_DIR = path.join(__dirname, "../../workspace");

if (!fs.existsSync(WORKSPACE_DIR)) {
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
}

function safeWorkspacePath(name) {
    const resolved = path.resolve(WORKSPACE_DIR, name);
    if (!resolved.startsWith(WORKSPACE_DIR)) throw new Error("Invalid path");
    return resolved;
}

// ---- List workspace files ----
router.get("/workspace/files", (req, res) => {
    try {
        const files = fs.readdirSync(WORKSPACE_DIR)
            .filter(f => fs.statSync(path.join(WORKSPACE_DIR, f)).isFile())
            .map(f => {
                const fp   = path.join(WORKSPACE_DIR, f);
                const stat = fs.statSync(fp);
                return { name: f, size: stat.size, modified: stat.mtime.toISOString() };
            });
        res.json({ files });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- Download / serve a workspace file ----
router.get("/workspace/file/:name", (req, res) => {
    try {
        const fp = safeWorkspacePath(req.params.name);
        if (!fs.existsSync(fp)) return res.status(404).json({ error: "File not found" });
        res.setHeader("Content-Disposition", `attachment; filename="${req.params.name}"`);
        res.sendFile(fp);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// ---- Delete a workspace file ----
router.delete("/workspace/file/:name", (req, res) => {
    try {
        const fp = safeWorkspacePath(req.params.name);
        if (!fs.existsSync(fp)) return res.status(404).json({ error: "File not found" });
        fs.unlinkSync(fp);
        res.json({ success: true, deleted: req.params.name });
    } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
