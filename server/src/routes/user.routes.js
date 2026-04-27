import express from "express";
import { loginUser, logoutUser, refreshAccessToken, registerUser } from "../controllers/user.controller.js";
import {verifyJWT} from "../middlewares/auth.middleware.js";
const router = express.Router();

router.post("/register",registerUser);
router.post("/login",loginUser);
router.post("/refresh-token",refreshAccessToken);

router.use(verifyJWT);
router.post("/logout",logoutUser);


export default router;