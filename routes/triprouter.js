const axios = require('axios');
const { Router } = require('express');
const triprouter = Router();
const { tripModel } = require('../db');
const usermiddleware = require("../middleware/usermiddleware");
const { z } = require("zod");
const { WEATHER_API_KEY } = require('../config')
const tripSchema = z.object({
    title: z.string().min(3).max(100),
    from: z.string().min(3).max(100),
    to: z.string().min(3).max(100),
    startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid start date format"
    }),
    endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid end date format"
    }),
    seats: z.coerce.number().int().positive(),
    image: z.string().optional().or(z.literal("")),
    pricePerPerson: z.coerce.number().positive(),
    phoneNo: z.string().min(1, "Phone number is required"),
    modeOfTransport: z.enum(["bus", "railway", "airplane"]).optional().or(z.literal(""))
});
const joinTripSchema = z.object({
    seatsBooked: z.number().int().positive()
});
const cache = {};
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY
triprouter.get("/search-places", async (req, res) => {
    try {
        const city = req.query.city;
        if (!city) return res.status(400).json({ success: false, message: "City is required" });

        // Check cache first
        if (cache[city]) {
            return res.json({ success: true, places: cache[city] });
        }

        // Call Google Places Text Search API
        const response = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=popular+places+in+${encodeURIComponent(city)}&key=${GOOGLE_API_KEY}`);
        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            return res.status(404).json({ success: false, message: "No places found" });
        }


        const places = data.results.slice(0, 10).map(place => ({
            name: place.name,
            address: place.formatted_address,
            rating: place.rating,
            image: place.photos ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${GOOGLE_API_KEY}` : null
        }));


        cache[city] = places;

        res.json({ success: true, places });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

triprouter.post("/create", usermiddleware, async (req, res) => {
    console.log("request came");
    try {
        const parsedData = tripSchema.safeParse(req.body);
        if (!parsedData.success) {
            console.log('Validation errors:', parsedData.error.errors);
            return res.status(400).json({
                success: false,
                message: "Validation failed",
            });
        }

        const { title, from, to, startDate, endDate, seats, image, pricePerPerson, phoneNo, modeOfTransport } = parsedData.data;
        const cleanPhoneNo = phoneNo.replace(/[^\d+]/g, '');
        if (cleanPhoneNo.length < 10) {
            return res.status(400).json({
                success: false,
                message: "Phone number must be at least 10 digits long"
            });
        }

        const existingTrip = await tripModel.findOne({
            from,
            to,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            createdBy: req.user.id
        });

        if (existingTrip) {
            return res.status(400).json({ success: false, message: "A trip with these exact details already exists" });
        }
        const start = new Date(startDate);
        const end = new Date(endDate);
        let filteredForecast = [];
        try {
            const weatherRes = await axios.get(
                `https://api.openweathermap.org/data/2.5/forecast?q=${to}&appid=${WEATHER_API_KEY}&units=metric`
            );

            filteredForecast = weatherRes.data.list
                .filter(item => {
                    const itemDate = new Date(item.dt_txt);
                    return itemDate >= start && itemDate <= end;
                })
                .map(item => ({
                    date: item.dt_txt,
                    temp: item.main.temp,
                    description: item.weather[0].description,
                    icon: item.weather[0].icon
                }));

        } catch (e) {
            console.log("Weather API failed:", e.response?.data || e.message);
            // Continue without weather instead of crashing
            filteredForecast = [];
        }

        const newTrip = await tripModel.create({
            title,
            from,
            to,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            seats,
            image: image || '',
            pricePerPerson,
            phoneNo: cleanPhoneNo,
            modeOfTransport: modeOfTransport || undefined,
            createdBy: req.user.id,
            weather: filteredForecast
        });

        console.log('Trip created successfully:', newTrip);
        res.json({ success: true, trip: newTrip });

    }
    catch (err) {
        console.error('Error creating trip:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});


triprouter.get("/all", usermiddleware, async (req, res) => {
    try {
        const trips = await tripModel.find({ createdBy: { $ne: req.user.id }, status: { $in: ["upcoming", "ongoing"] } }).populate("createdBy", "username email");
        const formatted = trips.map(trip => {
            const bookedSeats = trip.bookings.reduce((sum, b) => sum + b.seatsBooked, 0);
            return {
                ...trip.toObject(),
                availableSeats: trip.seats - bookedSeats
            }
        });

        res.json({ success: true, trips: formatted });

    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }

});
triprouter.post("/:id/join", usermiddleware, async (req, res) => {
    try {
        const parsedData = joinTripSchema.safeParse(req.body);
        if (!parsedData.success) {
            return res.status(400).json({ success: false, message: "Invalid input", errors: parsedData.error });
        }

        const { seatsBooked } = parsedData.data;
        const tripId = req.params.id;
        const userId = req.user.id;

        const trip = await tripModel.findById(tripId);
        if (!trip) {
            return res.status(404).json({ success: false, message: "Trip not found" });
        }

        if (trip.status === "completed" || trip.status === "cancelled" || trip.status === "ongoing") {
            return res.status(400).json({ success: false, message: "This trip is no longer available to join" });
        }

        if (trip.createdBy.toString() === userId) {
            return res.status(400).json({ success: false, message: "You cannot join your own trip" });
        }

        const alreadyJoined = trip.bookings.some(booking => booking.user.toString() === userId);
        if (alreadyJoined) {
            return res.status(400).json({ success: false, message: "You have already joined this trip" });
        }

        const alreadybooked = trip.bookings.reduce((sum, b) => sum + b.seatsBooked, 0);
        if (alreadybooked + seatsBooked > trip.seats) {
            return res.status(400).json({ success: false, message: "Not enough seats available" });
        }

        trip.bookings.push({ user: userId, seatsBooked, status: "pending" });
        await trip.save();

        res.json({ success: true, message: "Joined trip successfully", trip });
    }
    catch (e) {
        console.error('Error joining trip:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

triprouter.get("/my-trips", usermiddleware, async (req, res) => {
    try {
        const trips = await tripModel.find({ createdBy: req.user.id })
            .populate("bookings.user", "email")
            .populate("createdBy", "email");
        const formatted = trips.map(trip => {
            const bookedSeats = trip.bookings.reduce((sum, b) => sum + b.seatsBooked, 0);
            return {
                ...trip.toObject(),
                availableSeats: trip.seats - bookedSeats
            };
        });

        res.json({ success: true, trips: formatted });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
triprouter.get("/my-booking", usermiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const trips = await tripModel
            .find({ "bookings.user": userId })
            .populate("createdBy", "email")
            .populate("bookings.user", "email");

        const now = new Date();

        // Flatten the user's bookings
        const formatted = trips.flatMap((trip) => {
            return trip.bookings
                .filter((b) => b.user._id.toString() === userId)
                .map((userBooking) => {
                    const bookedSeats = trip.bookings.reduce((sum, b) => sum + b.seatsBooked, 0);
                    const availableSeats = trip.seats - bookedSeats;
                    const daysLeft = Math.ceil(
                        (new Date(trip.startDate) - now) / (1000 * 60 * 60 * 24)
                    );

                    return {
                        _id: userBooking._id, // booking ID
                        tripId: trip._id,
                        title: trip.title,
                        from: trip.from,
                        to: trip.to,
                        startDate: trip.startDate,
                        endDate: trip.endDate,
                        image: trip.image,
                        modeOfTransport: trip.modeOfTransport,
                        createdBy: trip.createdBy,
                        pricePerPerson: trip.pricePerPerson,
                        availableSeats,
                        mySeatsBooked: userBooking.seatsBooked,
                        daysLeft: daysLeft > 0 ? daysLeft : 0,
                        status: userBooking.status, // ✅ fix here
                        isUpcoming:
                            daysLeft > 0 &&
                            trip.status === "upcoming",

                        isPast:
                            trip.endDate < now ||
                            trip.status === "completed" ||
                            userBooking.status === "completed",
                        isCancelled:
                            trip.status === "cancelled" ||
                            userBooking.status === "cancelled" ||
                            userBooking.status === "rejected",
                    };
                });
        });

        res.json({ success: true, bookings: formatted });
    } catch (error) {
        console.error("Error in /my-booking:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

triprouter.post("/:id/cancel", usermiddleware, async (req, res) => {
    try {
        const tripId = req.params.id;
        const userId = req.user.id; //comes from middleware
        const trip = await tripModel.findById(tripId);
        if (!trip) {
            return res.status(404).json({ success: false, message: "trip not found" });

        }
        if (trip.createdBy.toString() !== userId) {
            return res.status(403).json({ success: false, message: "not authorized to cancel trips " });

        }
        trip.status = "cancelled";

        await trip.save();

        res.json({ success: true, message: "Trip cancelled successfully" });


    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
})
triprouter.post("/:id/cancel-booking", usermiddleware, async (req, res) => {
    try {
        const tripId = req.params.id;
        const userId = req.user.id;

        const trip = await tripModel.findById(tripId);
        if (!trip) {
            return res.status(404).json({ success: false, message: "Trip not found" });
        }
        const bookingIndex = trip.bookings.findIndex(b => b.user.toString() === userId);
        if (bookingIndex === -1) {
            return res.status(400).json({ success: false, message: "you have not booked this trip" });

        }
        trip.bookings.splice(bookingIndex, 1); // remove booking
        await trip.save();
        res.json({ success: true, message: "Booking cancelled successfully", trip });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });

    }
})
triprouter.post("/:id/booking/:bookingId/accept", usermiddleware, async (req, res) => {
    try {
        const tripId = req.params.id;
        const bookingId = req.params.bookingId;
        const userId = req.user.id;

        // IMPORTANT: populate bookings.user so we get the email
        const trip = await tripModel
            .findById(tripId)
            .populate("bookings.user", "email");

        if (!trip) {
            return res.status(404).json({ success: false, message: "Trip not found" });
        }

        if (trip.createdBy.toString() !== userId) {
            return res.status(403).json({ success: false, message: "Only trip creator can accept booking" });
        }

        const booking = trip.bookings.id(bookingId);
        if (!booking) {
            return res.status(400).json({ success: false, message: "Booking not found" });
        }

        // Update status
        booking.status = "accepted";
        await trip.save();

        // FIXED: correct file path & case
        console.log("REQUEST came");
        const sendMail = require("../utils/sendmail")
        console.log("request came");
        // FIXED: booking.user.email now exists because of populate()
        const userEmail = booking.user.email;

        const subject = "Your Trip Booking Has Been Accepted! 🎉";

        const html = `
            <h2>Great News! 🎉</h2>
            <p>Your booking for the trip <strong>${trip.title}</strong> has been accepted.</p>
            <p><b>Trip Details:</b></p>
            <ul>
                <li>From: ${trip.from}</li>
                <li>To: ${trip.to}</li>
                <li>Start Date: ${new Date(trip.startDate).toDateString()}</li>
                <li>End Date: ${new Date(trip.endDate).toDateString()}</li>
                <li>Seats Booked: ${booking.seatsBooked}</li>
            </ul>
            <p>Have a safe journey! ✈️</p>
        `;

        await sendMail(userEmail, subject, html);
        console.log("📩 Email sent to:", userEmail);

        res.json({ success: true, message: "Booking accepted & Email sent successfully!", trip });

    } catch (error) {
        console.error("❌ Accept booking error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
});
triprouter.post("/:id/bookings/:bookingId/reject", usermiddleware, async (req, res) => {
    try {
        const tripId = req.params.id;
        const bookingId = req.params.bookingId;
        const userId = req.user.id;
        const trip = await tripModel
            .findById(tripId)
            .populate("bookings.user", "email");

        if (!trip) {
            return res.status(404).json({ success: false, message: "Trip not found" });
        }

        if (trip.createdBy.toString() !== userId) {
            return res.status(403).json({ success: false, message: "Only the trip creator can reject bookings" });
        }

        const booking = trip.bookings.id(bookingId);
        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }
        booking.status = "rejected";
        await trip.save();
        const sendMail = require("../utils/sendmail");

        // Email of booking user
        const userEmail = booking.user.email;

        const subject = "Your Trip Booking Has Been Rejected";

        const html = `
            <h2>Sorry, Your Booking Was Rejected 😞</h2>
            <p>Your booking for the trip <strong>${trip.title}</strong> has been rejected by the trip owner.</p>
            
            <p><b>Trip Details:</b></p>
            <ul>
                <li>From: ${trip.from}</li>
                <li>To: ${trip.to}</li>
                <li>Start Date: ${new Date(trip.startDate).toDateString()}</li>
                <li>End Date: ${new Date(trip.endDate).toDateString()}</li>
                <li>Seats Booked: ${booking.seatsBooked}</li>
            </ul>

            <p>We apologize for the inconvenience.</p>
        `;

        await sendMail(userEmail, subject, html);
        console.log("📩 Rejection email sent to:", userEmail);

        res.json({ success: true, message: "Booking rejected & Email sent", trip });

    } catch (e) {
        console.error("Reject booking error:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});

module.exports = {
    triprouter
}