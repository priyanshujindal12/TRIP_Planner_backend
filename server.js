require('dotenv').config();
const express=require('express');
const app=express();
const { z }=require('zod');
const mongoose=require('mongoose');
const {tripModel}=require("./db");
const { userRouter }=require("./routes/user");
const {triprouter}=require("./routes/triprouter")
const {adminRouter}=require("./routes/admin");
const paymentRouter = require("./routes/paymentRouter");
const cors=require('cors');
const cron = require("node-cron");
app.use(cors());
app.use(express.json());
app.use("/user", userRouter);
app.use("/trips", triprouter);
app.use("/admin", adminRouter);

app.use("/payment", paymentRouter);

cron.schedule("0 0 * * *", async () => {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
      const trips = await tripModel.find();
      for (const trip of trips) {
        if (trip.status === "cancelled") continue; // skip cancelled ones
  
        const startDate = new Date(trip.startDate.getFullYear(), trip.startDate.getMonth(), trip.startDate.getDate());
        const endDate = new Date(trip.endDate.getFullYear(), trip.endDate.getMonth(), trip.endDate.getDate());
  
        let newStatus = "upcoming";
        if (endDate < today) newStatus = "completed";
        else if (startDate <= today && endDate >= today) newStatus = "ongoing";
  
        // Only update if status changed
        if (trip.status !== newStatus) {
          trip.status = newStatus;
          await trip.save();
        }
      }
  
      console.log("✅ Trip statuses updated at midnight");
    } catch (error) {
      console.error("❌ Error updating trip statuses:", error);
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