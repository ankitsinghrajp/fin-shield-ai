import { Router } from "express";
import multer from "multer";
import { getDashboardData, getRunById, processPipeline } from "../controllers/pipeline.controller.js";
import { upload }          from "../middlewares/upload.middleware.js";
import {verifyJWT} from "../middlewares/auth.middleware.js";

const router = Router();

/**
 * Multer error handler — catches file-size and file-type rejections
 * from the upload middleware before they reach the generic error handler.
 */
const handleUpload = (req, res, next) => {
    upload.single("file")(req, res, (err) => {
        if (!err) return next();

        if (err instanceof multer.MulterError) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(413).json({
                    success: false,
                    message: "File is too large. Maximum allowed size is 50MB.",
                });
            }
            return res.status(400).json({ success: false, message: err.message });
        }

        // fileFilter rejection or other errors
        return res.status(415).json({ success: false, message: err.message });
    });
};

router.post("/process", handleUpload, processPipeline);
router.get("/dashboard", verifyJWT, getDashboardData);
router.get("/dashboard/:runId", verifyJWT, getRunById);


export default router;