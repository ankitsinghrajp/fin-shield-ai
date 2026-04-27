import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema({
    fullname:{
        type:String, 
        required:true,
    },
    email:{
        type:String,
        required:true
    },
    password:{
        type:String,
        required:false
    },
    refreshToken:{
        type:String,
    }
}, 
{timestamps:true});


userSchema.pre("save", async function (){
    if(!this.isModified("password") || !this.password) return;
    
    this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.isPasswordCorrect = async function(password){
    return bcrypt.compare(password,this.password);
}

userSchema.methods.generateAccessToken = function(){
    return jwt.sign({
        _id: this._id,
        email: this.email,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY
    });
}

userSchema.methods.generateRefreshToken = function(){
    return jwt.sign({
        _id: this._id,
        email: this.email
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRY
    });
}

const User = mongoose.models.User || mongoose.model("User",userSchema);

export {User};