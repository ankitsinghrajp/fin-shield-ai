import { User } from "../models/user.model.js"
import { APIError } from "./APIError.js";

const generateAccessAndRefreshTokens = async (userId)=>{
   const user = await User.findById(userId);

   if(!user) throw new APIError(404,"Unauthorized User!");

   const accessToken = await user.generateAccessToken();
   const refreshToken = await user.generateRefreshToken();

   user.refreshToken = refreshToken;
   await user.save({validateBeforeSave: false});

   return {accessToken, refreshToken};
}

export {generateAccessAndRefreshTokens}