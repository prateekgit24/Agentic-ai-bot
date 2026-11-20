const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// One timer per session: timers[sessionId] = { duration, remaining, startedAt, running, paused, finished }
let timers = {};

// ================= START TIMER =================
app.post("/timer/start", (req, res) => {
    const { duration, sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({ error: "sessionId required" });
    }

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
app.post("/timer/pause", (req, res) => {
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
app.post("/timer/resume", (req, res) => {
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
app.post("/timer/reset", (req, res) => {
    const { sessionId } = req.body;

    if (timers[sessionId]) {
        delete timers[sessionId];
    }

    res.json({ success: true });
});

// ================= STATUS =================
app.get("/timer/status/:sessionId", (req, res) => {
    const { sessionId } = req.params;
    const timer = timers[sessionId];

    if (!timer) {
        return res.json({ running: false, paused: false, remaining: 0, duration: 0, finished: false });
    }

    let remaining = timer.remaining;

    if (timer.running) {
        // Compute remaining fresh from startedAt each time — never mutate timer.remaining here
        const elapsed = Math.floor((Date.now() - timer.startedAt) / 1000);
        remaining = Math.max(timer.remaining - elapsed, 0);

        if (remaining === 0) {
            // Timer done — now it's safe to persist the final state
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

const PORT = 6500;
app.listen(PORT, () => {
    console.log(`Clock API running on http://localhost:${PORT}`);
});
