import dotenv from "dotenv";
dotenv.config();

import { connectDb } from "./db/connectDb.js";
import { app } from "./app.js";

connectDb().then(
    ()=>{
        app.listen(process.env.PORT, ()=>{
            console.log("The app is running on port: ",process.env.PORT);
        })
    }).catch(
        (error)=>{
           console.log("Database connection failed! ",error);
        }
    )