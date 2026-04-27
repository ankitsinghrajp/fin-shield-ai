import mongoose from "mongoose";

const pipelineRunSchema = new mongoose.Schema({
     user:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false,
     },

     fileName: String,
     filetype: String,
     fileSize: Number,

     recordsProcessed:Number,
     piiDetectedPercentage: Number,
     fieldsMasked: Number,
     dataUtilityScore: Number,

     maskingLevel: {
        type:String,
        enum: ["low", "medium", "high"],
        default:"medium"
     },

     maskedData:{
        Object,
     },
     
     report:{
        Object,
     }
},{
    timestamps:true
})


const PipelineRun = mongoose.models.PipelineRun || mongoose.model("PipelineRun",pipelineRunSchema);

export {PipelineRun}