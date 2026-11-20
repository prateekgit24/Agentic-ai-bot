// node-server/services/tools/stopwatchTool.js
// A lightweight tool that signals the frontend to open the stopwatch widget.

async function openStopwatch(parameters = {}) {
    return {
        type: "tool_result",
        tool: "open_stopwatch",
        ui: "stopwatch-card",
        data: {}
    };
}

module.exports = { openStopwatch };
