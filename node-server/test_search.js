const { webSearch } = require('./services/tools/webSearchTool');

(async () => {
    console.log("Testing search: 'gold price today'...");
    const res = await webSearch({ query: "gold price today" });
    console.log(JSON.stringify(res, null, 2));
})();
