const { Router } = require('express');
const Razorpay = require("razorpay");
const usermiddleware = require("../middleware/usermiddleware");
const { tripModel } = require("../db");
const router=Router();
require("dotenv").config();
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
router.post("/create-order/:tripId", usermiddleware, async (req, res) => {
  try {
    const { seatsBooked } = req.body;
    const trip = await tripModel.findById(req.params.tripId);
    if (!trip) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }

    // 🧠 Check if trip is open for booking
    if (trip.status === "completed" || trip.status === "cancelled" || trip.status === "ongoing") {
      return res.status(400).json({ success: false, message: "This trip is not available for booking" });
    }

    // 🧠 Check available seats
    const alreadyBooked = trip.bookings.reduce((sum, b) => sum + b.seatsBooked, 0);
    const availableSeats = trip.seats - alreadyBooked;

    if (seatsBooked > availableSeats) {
      return res.status(400).json({
        success: false,
        message: `Only ${availableSeats} seats are available.`,
      });
    }

    // 🧠 Prevent trip creator from joining own trip
    if (trip.createdBy.toString() === req.user.id) {
      return res.status(400).json({ success: false, message: "You cannot join your own trip" });
    }

    const amount = trip.pricePerPerson * seatsBooked * 100; // paise
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `trip_${Date.now()}`, // keep short
    });

    res.json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount,
      tripTitle: trip.title,
    });
  } catch (error) {
    console.error("❌ Error creating Razorpay order:", error);
    res.status(500).json({ success: false, message: "Failed to create order" });
  }
});

module.exports =router