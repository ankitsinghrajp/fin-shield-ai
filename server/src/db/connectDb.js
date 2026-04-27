import mongoose from "mongoose";

const connectDb = async ()=>{
    try {

        const connectionInstance = await mongoose.connect(`${process.env.DATABASE_URL}/${process.env.DB_NAME}`);
        console.log("Database connection successsfull!");
        console.log("DB Host: ",connectionInstance.connection.host);
        
    } catch (error) {
        console.log(error);
        console.log("Database connection failed!");
        process.exit(1);
    }
}

export {connectDb};