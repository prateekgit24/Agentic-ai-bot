// netSpeedTool.js — purely a frontend signal; no server logic needed
async function openNetSpeed() {
    return {
        type: "tool_result",
        tool: "open_netspeed",
        ui: "netspeed-card",
        data: {}
    };
}

module.exports = { openNetSpeed };
