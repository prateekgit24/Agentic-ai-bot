// const fs = require("fs");
// const path = require("path");
// const File = require("../models/File");

// const baseDir = path.join(__dirname, "..", "generated-files");

// if (!fs.existsSync(baseDir)) {
//     fs.mkdirSync(baseDir);
// }

// function detectFileExtension(message) {
//     if (message.includes("python")) return ".py";
//     if (message.includes("javascript")) return ".js";
//     if (message.includes("html")) return ".html";
//     if (message.includes("css")) return ".css";
//     if (message.includes("json")) return ".json";
//     if (message.includes("java")) return ".java";
//     return ".txt";
// }

// async function createFile(sessionId, message, content) {
//     const ext = detectFileExtension(message);
//     const fileName = `file_${Date.now()}${ext}`;
//     const filePath = path.join(baseDir, fileName);

//     fs.writeFileSync(filePath, content);

//     const fileDoc = await File.create({
//         sessionId,
//         fileName,
//         fileType: ext,
//         filePath,
//         content
//     });

//     return fileDoc;
// }

// async function deleteFile(fileId) {
//     const file = await File.findById(fileId);
//     if (!file) return null;

//     if (fs.existsSync(file.filePath)) {
//         fs.unlinkSync(file.filePath);
//     }

//     await File.findByIdAndDelete(fileId);
//     return true;
// }

// module.exports = {
//     createFile,
//     deleteFile
// };
//above was old unused


// const fs = require("fs");
// const path = require("path");

// const BASE_DIR = path.join(__dirname, "../../../workspace");

// if (!fs.existsSync(BASE_DIR)) {
//     fs.mkdirSync(BASE_DIR);
// }

// async function fileTool(parameters = {}, context = {}) {

//     try {
//         const { action, fileName, content } = parameters;

//         if (!fileName) {
//             throw new Error("fileName required");
//         }

//         const filePath = path.join(BASE_DIR, fileName);

//         // ================= CREATE =================
//         if (action === "create") {

//             fs.writeFileSync(filePath, content || "");

//             return {
//                 type: "tool_result",
//                 tool: "file_tool",
//                 ui: "file-card",
//                 data: {
//                     action: "created",
//                     fileName,
//                     filePath
//                 }
//             };
//         }

//         // ================= EDIT =================
//         if (action === "edit") {

//             if (!fs.existsSync(filePath)) {
//                 throw new Error("File does not exist");
//             }

//             fs.writeFileSync(filePath, content);

//             return {
//                 type: "tool_result",
//                 tool: "file_tool",
//                 ui: "file-card",
//                 data: {
//                     action: "edited",
//                     fileName
//                 }
//             };
//         }

//         // ================= DELETE =================
//         if (action === "delete") {

//             if (fs.existsSync(filePath)) {
//                 fs.unlinkSync(filePath);
//             }

//             return {
//                 type: "tool_result",
//                 tool: "file_tool",
//                 ui: "file-card",
//                 data: {
//                     action: "deleted",
//                     fileName
//                 }
//             };
//         }

//         // ================= READ =================
//         if (action === "read") {

//             if (!fs.existsSync(filePath)) {
//                 throw new Error("File does not exist");
//             }

//             const fileContent = fs.readFileSync(filePath, "utf-8");

//             return {
//                 type: "tool_result",
//                 tool: "file_tool",
//                 ui: "file-card",
//                 data: {
//                     action: "read",
//                     fileName,
//                     content: fileContent
//                 }
//             };
//         }

//         throw new Error("Unknown action");

//     } catch (err) {

//         return {
//             type: "tool_result",
//             tool: "file_tool",
//             ui: "error-card",
//             data: {
//                 message: err.message
//             }
//         };
//     }
// }

// module.exports = { fileTool };
// // above is version 1
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const diff = require("diff");

const BASE_DIR = path.join(__dirname, "../../../workspace");

if (!fs.existsSync(BASE_DIR)) {
    fs.mkdirSync(BASE_DIR);
}

function safePath(fileName) {
    const filePath = path.join(BASE_DIR, fileName);
    if (!filePath.startsWith(BASE_DIR)) {
        throw new Error("Invalid file path");
    }
    return filePath;
}

async function fileTool(parameters = {}) {

    try {
        const { action, fileName, content, newName } = parameters;

        if (!fileName) throw new Error("fileName required");

        const filePath = safePath(fileName);

        // ================= CREATE =================
        if (action === "create") {

            fs.writeFileSync(filePath, content || "");

            return {
                type: "tool_result",
                tool: "file_tool",
                ui: "file-card",
                data: {
                    action: "created",
                    fileName,
                    content: content || ""
                }
            };
        }

        // ================= EDIT =================
        if (action === "edit") {

            if (!fs.existsSync(filePath)) throw new Error("File not found");

            const oldContent = fs.readFileSync(filePath, "utf-8");

            const changes = diff.createPatch(
                fileName,
                oldContent,
                content
            );

            fs.writeFileSync(filePath, content);

            return {
                type: "tool_result",
                tool: "file_tool",
                ui: "file-card",
                data: {
                    action: "edited",
                    fileName,
                    diff: changes
                }
            };
        }

        // ================= DELETE =================
        if (action === "delete") {

            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

            return success("deleted", fileName);
        }

        // ================= READ =================
        if (action === "read") {

            const fileContent = fs.readFileSync(filePath, "utf-8");

            return {
                type: "tool_result",
                tool: "file_tool",
                ui: "file-card",
                data: {
                    action: "read",
                    fileName,
                    content: fileContent
                }
            };
        }

        // ================= RENAME =================
        if (action === "rename") {

            const newPath = safePath(newName);

            fs.renameSync(filePath, newPath);

            return success("renamed", newName);
        }

        // ================= LIST FILES =================
        if (action === "list") {

            const files = fs.readdirSync(BASE_DIR);

            return {
                type: "tool_result",
                tool: "file_tool",
                ui: "file-tree",
                data: { files }
            };
        }

        // ================= FORMAT =================
        if (action === "format") {

            execSync(`npx prettier --write ${filePath}`);

            const formatted = fs.readFileSync(filePath, "utf-8");

            return {
                type: "tool_result",
                tool: "file_tool",
                ui: "file-card",
                data: {
                    action: "formatted",
                    fileName,
                    content: formatted
                }
            };
        }

        throw new Error("Unknown action");

    } catch (err) {
        return error(err.message);
    }
}

function success(action, fileName) {
    return {
        type: "tool_result",
        tool: "file_tool",
        ui: "file-card",
        data: { action, fileName }
    };
}

function error(msg) {
    return {
        type: "tool_result",
        tool: "file_tool",
        ui: "error-card",
        data: { message: msg }
    };
}

module.exports = { fileTool };