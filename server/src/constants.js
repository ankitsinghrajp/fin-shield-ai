import { configDotenv } from "dotenv";
configDotenv();

export const corsOptions = {
    origin: process.env.FRONTEND_URL,
    credentials: true
};

export const cookieOptions = {
    httpOnly: false,
    secure: false,
    sameSite: "lax",
    maxAge: 7*24*60*60*1000,
}
