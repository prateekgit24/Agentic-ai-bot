// node-server/services/tools/alarmTool.js
// Returns a tool_result so the frontend alarm widget picks it up and pre-fills.

async function setAlarm(parameters = {}, context = {}) {
    try {
        const { time, label } = parameters;

        if (!time) {
            throw new Error("No time specified for alarm.");
        }

        // Validate HH:MM format
        const valid = /^\d{1,2}:\d{2}(:\d{2})?( ?[AaPp][Mm])?$/.test(time.trim());
        if (!valid) {
            throw new Error(`Invalid time format: "${time}". Use HH:MM or H:MM AM/PM.`);
        }

        // Convert 12-hour to 24-hour if needed
        let time24 = time.trim();
        const ampmMatch = time24.match(/^(\d{1,2}):(\d{2})(?::\d{2})? ?([AaPp][Mm])$/);
        if (ampmMatch) {
            let h = parseInt(ampmMatch[1]);
            const m = ampmMatch[2];
            const ampm = ampmMatch[3].toUpperCase();
            if (ampm === "PM" && h !== 12) h += 12;
            if (ampm === "AM" && h === 12) h = 0;
            time24 = `${String(h).padStart(2, "0")}:${m}`;
        } else {
            // Ensure HH:MM format (strip seconds)
            const parts = time24.split(":");
            time24 = `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
        }

        return {
            type: "tool_result",
            tool: "set_alarm",
            ui: "alarm-card",
            data: {
                time: time24,
                label: label || "Alarm"
            }
        };

    } catch (err) {
        return {
            type: "tool_result",
            tool: "set_alarm",
            ui: "error-card",
            data: { message: err.message }
        };
    }
}

module.exports = { setAlarm };
