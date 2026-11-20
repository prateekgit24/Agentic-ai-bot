// node-server/services/tools/toolRegistry.js
const { getWeather } = require("./weatherTool");
const { startTimer } = require("./timerTool");
const { fileTool } = require("./fileTool");
const { playMusic } = require("./playMusicTool");
const { setAlarm } = require("./alarmTool");
const { showClock } = require("./clockTool");
const { openStopwatch } = require("./stopwatchTool");
const { addNote } = require("./notesTool");
const { openNetSpeed } = require("./netSpeedTool");
const { webSearch } = require("./webSearchTool");
const { runCode } = require("./codeRunnerTool");
const { convertUnits } = require("./unitConverterTool");
const { getNewsFeed } = require("./newsFeedTool");
const { fileManager } = require("./fileManagerTool");

const registry = {
    get_weather: getWeather,
    start_timer: startTimer,
    file_tool: fileTool,
    play_music: playMusic,
    set_alarm: setAlarm,
    show_clock: showClock,
    open_stopwatch: openStopwatch,
    add_note: addNote,
    open_netspeed: openNetSpeed,
    web_search: webSearch,
    run_code: runCode,
    convert_units: convertUnits,
    get_news: getNewsFeed,
    file_manager: fileManager
};


function getTool(toolName) {
    console.log("toolRegistry checking for:", toolName);
    return registry.hasOwnProperty(toolName)
        ? registry[toolName]
        : null;
}

module.exports = { getTool };
