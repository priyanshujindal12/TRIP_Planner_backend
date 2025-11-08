const { Router } = require('express');
const adminRouter = Router();
const adminMiddleware = require('../middleware/adminMiddleware');
const usermiddleware = require('../middleware/usermiddleware');
const { userModel, tripModel } = require('../db');
adminRouter.use(usermiddleware, adminMiddleware);
adminRouter.get("/users", async (req, res) => {
    try {
        const users = await userModel.find({}, "email isAdmin createdAt");
        res.status(200).json({ success: true, users });

    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
adminRouter.get("/trips", async (req, res) => {
    try {
        const trips = await tripModel.find({}, "title from to startDate endDate seats image pricePerPerson phoneNo modeOfTransport createdBy createdAt status").populate("createdBy", "email");
        res.status(200).json({ success: true, trips });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
adminRouter.get("/bookings", async (req, res) => {
    try {
        const { status } = req.query;
        const matchCondition = status ? { "bookings.status": status } : { "bookings.0": { $exists: true } };
        const trips = await tripModel.find(matchCondition)
            .populate("createdBy", "email")      // trip creator
            .populate("bookings.user", "email")  // booking user
            .select("title from to startDate endDate pricePerPerson bookings status");
        const allBookings = [];
        trips.forEach(trip => {
            trip.bookings.forEach(booking => {
                if (!status || booking.status === status) {
                    allBookings.push({
                        tripTitle: trip.title,
                        from: trip.from,
                        to: trip.to,
                        startDate: trip.startDate,
                        endDate: trip.endDate,
                        tripStatus: trip.status,
                        bookedBy: booking.user?.email,
                        seatsBooked: booking.seatsBooked,
                        bookingStatus: booking.status,
                        tripCreator: trip.createdBy?.email,
                        pricePerPerson: trip.pricePerPerson
                    })
                }
            })
        });
        if (allBookings.length === 0) {
            return res.status(200).json({ success: true, message: "No bookings found", bookings: [] });
        }
        else {
            return res.status(200).json({
                success: true,
                count: allBookings.length,
                bookings: allBookings
            });

        }


    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
module.exports = {
    adminRouter: adminRouter
}