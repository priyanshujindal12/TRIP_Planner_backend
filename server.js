require('dotenv').config();
const express=require('express');
const app=express();
const { z }=require('zod');
const mongoose=require('mongoose');
const {tripModel}=require("./db");
const { userRouter }=require("./routes/user");
const {triprouter}=require("./routes/triprouter")
const cors=require('cors');
const cron = require("node-cron");
app.use(cors());
app.use(express.json());
app.use("/user", userRouter);
app.use("/trips", triprouter);
cron.schedule("0 0 * * *", async () => {
    const trips = await tripModel.find();
    for (let trip of trips) {
        await trip.save(); 
    console.log("Trip statuses updated at midnight");
    }
});

async function main() {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("mongo is connected");
    app.listen(3000, ()=>{
         console.log("Server running on http://localhost:3000");
    });
    
}
main();