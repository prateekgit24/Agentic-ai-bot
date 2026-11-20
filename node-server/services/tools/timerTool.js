const axios = require("axios");

const CLOCK_URL = process.env.CLOCK_SERVICE_URL || "http://localhost:5000";

async function startTimer(parameters = {}, context = {}) {

    try {
        const { sessionId } = context;
        if (!sessionId) {
            throw new Error("sessionId missing");
        }

        const action = parameters.action || "start";

        // ================= START =================
        if (action === "start") {

            const duration = Math.max(1, parseInt(parameters.duration) || 60);

            const response = await axios.post(
                `${CLOCK_URL}/timer/start`,
                { duration, sessionId },
                { timeout: 5000 }
            );

            if (response.status !== 200) {
                throw new Error("Clock service error");
            }

            return {
                type: "tool_result",
                tool: "start_timer",
                ui: "timer-card",
                data: {
                    duration,
                    status: "started"
                }
            };
        }

        // ================= PAUSE =================
        if (action === "pause") {
            await axios.post(`${CLOCK_URL}/timer/pause`, { sessionId });

            return {
                type: "tool_result",
                tool: "start_timer",
                data: { status: "paused" }
            };
        }

        // ================= RESUME =================
        if (action === "resume") {
            await axios.post(`${CLOCK_URL}/timer/resume`, { sessionId });

            return {
                type: "tool_result",
                tool: "start_timer",
                data: { status: "resumed" }
            };
        }

        // ================= RESET =================
        if (action === "reset") {
            await axios.post(`${CLOCK_URL}/timer/reset`, { sessionId });

            return {
                type: "tool_result",
                tool: "start_timer",
                data: { status: "reset" }
            };
        }

    } catch (error) {
        console.error("Timer tool error:", error.message);

        return {
            type: "tool_result",
            tool: "start_timer",
            ui: "error-card",
            data: {
                message: "Timer action failed. Clock service unavailable."
            }
        };
    }
}

module.exports = { startTimer };
