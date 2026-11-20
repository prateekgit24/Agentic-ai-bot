// node-server/routes/timer.js
// In-process timer state — replaces the separate clock-service on port 6500.
// Each session gets one timer stored in a plain object (memory only; resets on restart).

const router = require("express").Router();

// timers[sessionId] = { duration, remaining, startedAt, running, paused, finished }
const timers = {};

// ================= START =================
router.post("/timer/start", (req, res) => {
    const { duration, sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: "sessionId required" });

    const dur = Math.max(1, parseInt(duration) || 60);

    timers[sessionId] = {
        duration: dur,
        remaining: dur,
        startedAt: Date.now(),
        running: true,
        paused: false,
        finished: false
    };

    res.json({ success: true, duration: dur });
});

// ================= PAUSE =================
router.post("/timer/pause", (req, res) => {
    const { sessionId } = req.body;
    const timer = timers[sessionId];

    if (!timer || !timer.running) {
        return res.json({ success: false, reason: "No running timer" });
    }

    const elapsed = Math.floor((Date.now() - timer.startedAt) / 1000);
    timer.remaining = Math.max(timer.remaining - elapsed, 0);
    timer.running = false;
    timer.paused = true;

    res.json({ success: true, remaining: timer.remaining });
});

// ================= RESUME =================
router.post("/timer/resume", (req, res) => {
    const { sessionId } = req.body;
    const timer = timers[sessionId];

    if (!timer || !timer.paused) {
        return res.json({ success: false, reason: "Timer not paused" });
    }

    timer.startedAt = Date.now();
    timer.running = true;
    timer.paused = false;

    res.json({ success: true });
});

// ================= RESET =================
router.post("/timer/reset", (req, res) => {
    const { sessionId } = req.body;
    if (timers[sessionId]) delete timers[sessionId];
    res.json({ success: true });
});

// ================= STATUS =================
router.get("/timer/status/:sessionId", (req, res) => {
    const { sessionId } = req.params;
    const timer = timers[sessionId];

    if (!timer) {
        return res.json({ running: false, paused: false, remaining: 0, duration: 0, finished: false });
    }

    let remaining = timer.remaining;

    if (timer.running) {
        const elapsed = Math.floor((Date.now() - timer.startedAt) / 1000);
        remaining = Math.max(timer.remaining - elapsed, 0);

        if (remaining === 0) {
            timer.running = false;
            timer.finished = true;
            timer.remaining = 0;
        }
    }

    res.json({
        running: timer.running,
        paused: timer.paused,
        remaining,
        duration: timer.duration,
        finished: timer.finished
    });
});

module.exports = router;
