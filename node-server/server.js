// my-ai-app/node-server/server.js
// Entry point — setup only. All routes live in routes/*.js
require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const mongoose = require("mongoose");

const app = express();

// ---- CORS ----
app.use(cors({
    origin: [
        "http://localhost:3000",
        "http://localhost:5500",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5500",
        "http://localhost:5173"
    ],
    credentials: true
}));
app.use(express.json({ limit: "5mb" }));

// ---- Database ----
mongoose.connect("mongodb://127.0.0.1:27017/llamaAI")
    .then(() => {
        console.log("MongoDB Connected");
        // Ensure default assistant document exists
        require("./shared").ensureAssistantExists();
    })
    .catch(err => console.error("MongoDB Error:", err));

// ---- Routes ----
app.use(require("./routes/auth"));
app.use(require("./routes/profile"));
app.use(require("./routes/sessions"));
app.use(require("./routes/chat"));
app.use(require("./routes/config"));
app.use(require("./routes/workspace"));
app.use(require("./routes/timer"));
app.use(require("./routes/admin"));

// ---- Health check ----
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        service: "node-server",
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

// ---- Start ----
app.listen(5000, () => {
    console.log("Node server running on http://localhost:5000");
});
