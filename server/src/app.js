import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { corsOptions } from "./constants.js";

const app = express();

app.use(cors(corsOptions));

app.use(express.json({"limit":"16kb"}));
app.use(express.urlencoded({extended:true, limit: "16kb"}));
app.use(express.static("public"));
app.use(cookieParser());

// import Routes
import UserRoutes from "../src/routes/user.routes.js";
import googleRoutes from "./routes/auth.routes.js";
import pipelineRoutes from "./routes/pipeline.routes.js";

// Routes declaration
app.get("/",(req,res)=>{
    res.send("The Server is running...")
})

//imported routes
app.use("/api/v1/user",googleRoutes);
app.use("/api/v1/user",UserRoutes);
app.use("/api/v1/pipeline",pipelineRoutes);


export {app};