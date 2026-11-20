const mongoose = require("mongoose");

const FileSchema = new mongoose.Schema({
    sessionId: String,
    fileName: String,
    fileType: String,
    filePath: String,
    content: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("File", FileSchema);
