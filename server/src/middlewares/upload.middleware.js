import multer from "multer";
import path from "path";
import fs from "fs";

const UPLOAD_DIR = "public/uploads";
const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
    ".json",
    ".csv",
    ".xlsx",
    ".txt",
    ".docx",
    ".log"         
];

const ALLOWED_MIMETYPES = [
    "application/json",
    "text/csv",
    "application/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/octet-stream",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/x-log",               // for .log files (common)
    "application/x-log",        // alternative
    "text/x-server-log",        // server logs
    // catch‑all for logs that browsers might send as text/plain
    "text/plain"                // already there, covers many logs
];

// Ensure upload dir exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const uniqueName = `${Date.now()}-${safeName}`;
        cb(null, uniqueName);
    },
});

const fileFilter = (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeOk = ALLOWED_MIMETYPES.includes(file.mimetype);
    const extOk  = ALLOWED_EXTENSIONS.includes(ext);

    if (extOk || mimeOk) {
        cb(null, true);
    } else {
        cb(
            new Error(
                `File type not supported: "${ext}". Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`
            ),
            false
        );
    }
};

export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE_BYTES,
        files: 1,
    },
});