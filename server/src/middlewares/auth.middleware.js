import {asyncHandler} from "../utils/asyncHandler.js";
import {APIError} from "../utils/APIError.js";
import jwt from "jsonwebtoken";
import {User} from "../models/user.model.js";

const verifyJWT = asyncHandler(async (req, res, next)=>{
   const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ","");
   
   if(!token) throw new APIError(401,"Unauthorized Request!");

   const decodedToken = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET);

   const user = await User.findById(decodedToken?._id).select(
    "-password -refreshToken"
   );

   if(!user) throw new APIError(401,"Unauthorized Request!");
   
   req.user = user;
   next();

});

export {verifyJWT};