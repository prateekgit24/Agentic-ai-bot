// node-server/routes/sessions.js
const router = require("express").Router();
const { Session, Message, optionalAuth } = require("../shared");

// ---- Create session ----
router.post("/session", optionalAuth, async (req, res) => {
    try {
        const newSession = await Session.create({
            userId: req.user ? req.user.userId : null,
            title: "New Chat"
        });
        res.json(newSession);
    } catch (err) {
        res.status(500).json({ error: "Failed to create session" });
    }
});

// ---- Get all sessions ----
router.get("/sessions", optionalAuth, async (req, res) => {
    const query = req.user ? { userId: req.user.userId } : { userId: null };
    const sessions = await Session.find(query).sort({ createdAt: -1 });
    res.json(sessions);
});

// ---- Get messages for a session ----
router.get("/session/:id/messages", optionalAuth, async (req, res) => {
    const messages = await Message.find({ sessionId: req.params.id }).sort({ timestamp: 1 });
    res.json(messages);
});

// ---- Delete session + its messages ----
router.delete("/session/:id", optionalAuth, async (req, res) => {
    try {
        await Message.deleteMany({ sessionId: req.params.id });
        await Session.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

module.exports = router;
