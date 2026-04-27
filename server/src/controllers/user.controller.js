import {asyncHandler} from "../utils/asyncHandler.js";
import {APIError} from "../utils/APIError.js";
import {APIResponse} from "../utils/APIResponse.js";
import jwt from "jsonwebtoken";
import { cookieOptions } from "../constants.js";
import { User } from "../models/user.model.js";
import {generateAccessAndRefreshTokens} from "../utils/generateAccessAndRefreshTokens.js";


const registerUser = asyncHandler(async (req,res)=>{
    const {fullname, email, password} = req.body;

    if([fullname, email, password].some((field)=>field.trim() === "")){
        throw new APIError(400, "All fields are required!");
    }

    const existingUser = await User.findOne({
        email
    });

    if(existingUser) throw new APIError(400, "User already exists! Try Sign In");

    const user = await User.create({
        fullname,
        email,
        password
    });

    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    if(!createdUser){
        throw new APIError(500, "Server is busy while registering user. Try Again!");
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(createdUser._id);

    return res
    .status(201)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken",refreshToken, cookieOptions)
    .json(
        new APIResponse(200, createdUser,"User registration successfull!")
    )      
});


const loginUser = asyncHandler(async (req,res)=>{
    const {email, password} = req.body;

    if(!email) throw new APIError(400, "Email is required!");
    if(!password) throw new APIError(400, "Password is required!");

    const user = await User.findOne({email});

    if(!user) throw new APIError(400, "User does not exists! Try Sign Up!");

    if(!user.password) throw new APIError(400, "This account is created with google!, Try Continue With Google.");

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid) throw new APIError(401, "Invalid User credentials!");

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    return res
           .status(200)
           .cookie("accessToken",accessToken, cookieOptions)
           .cookie("refreshToken",refreshToken, cookieOptions)
           .json(
            new APIResponse(200, {
                user: loggedInUser, accessToken, refreshToken
            },"User logged in successfull!"))
});

const logoutUser = asyncHandler(async (req,res)=>{
     await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{refreshToken: undefined}
        },
        {
            new:true
        }
     );

     return res
           .status(200)
           .clearCookie("accessToken",cookieOptions)
           .clearCookie("refreshToken", cookieOptions)
           .json(
            new APIResponse(200,{}, "User Logout Successfull!")
           );
});

const refreshAccessToken = asyncHandler(async (req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.header("Authorization")?.replace("Bearer ","");

    if(!incomingRefreshToken) throw new APIError(401,"Unauthorized Request!");

    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

    const user = await User.findById(decodedToken._id);

    if(!user) throw new APIError(401, "Unauthorized Request!");

    if(user?.refreshToken !== incomingRefreshToken){
        throw new APIError(401,"Invalid Refresh Token");
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user?._id);

    return res
         .status(200)
         .cookie("accessToken",accessToken,cookieOptions)
         .cookie("refreshToken",refreshToken,cookieOptions)
         .json(
            new APIResponse(200,{accessToken,refreshToken
            },"Access Token Refreshed!")
         )
})

export {registerUser, loginUser, logoutUser, refreshAccessToken};