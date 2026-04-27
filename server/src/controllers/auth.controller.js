import { OAuth2Client } from "google-auth-library";
import { User } from "../models/user.model.js";
import { generateAccessAndRefreshTokens } from "../utils/generateAccessAndRefreshTokens.js";
import { cookieOptions } from "../constants.js";
import { APIError } from "../utils/APIError.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleLogin = async (req,res)=>{
   try {

    const {token} = req.body;

    if (!token) throw new APIError(400, "Google token missing");

    const ticket = await client.verifyIdToken({
        idToken:token,
        audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    if (!payload.email_verified) {
    throw new APIError(400, "Google email not verified");
}

    const {name, email} = payload;

    let user = await User.findOne({email});

    if(!user) {
        user = await User.create({
            fullname:name,
            email,
            password: null,
        });
    }
   
    if(!user?._id) throw new APIError(400, "Google login failed!");

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id);

    return res
         .status(200)
         .cookie("accessToken", accessToken, cookieOptions)
         .cookie("refreshToken", refreshToken, cookieOptions)
         .json({
            success:true,
            message: "Google Login Successfull!",
            user:{
                _id:user._id,
                fullname: user.fullname,
                email: user.email,
                accessToken,
                refreshToken
            }
         });

    
   } catch (error) {
    console.log(error);
         throw new APIError(500, error.message || "Google login failed");
   }
}