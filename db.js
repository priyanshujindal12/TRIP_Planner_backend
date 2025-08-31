const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const userSchema = new Schema({
    email: { type: String, unique: true },
    password: String,
});
const userModel = mongoose.model("user", userSchema);

const tripSchema = new Schema({
    title: { type: String, required: true },       // Trip title
    from: { type: String, required: true },        // Starting point
    to: { type: String, required: true },          // Destination
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    seats: { type: Number, required: true },
    image: { type: String },
    pricePerPerson: { type: Number, required: true }, 
    phoneNo: { type: String, required: true },
    modeOfTransport: { 
        type: String, 
        enum: ["bus", "railway", "airplane", ""],  // Added "" to match Zod's allowance for empty string
        required: false  // Changed to false to make optional, matching Zod
    }, 
    createdBy: { type: Schema.Types.ObjectId, ref: "user", required: true },
    bookings: [{
        user: { type: Schema.Types.ObjectId, ref: "user" },
        seatsBooked: { type: Number, required: true },
        status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' }
    }],
    status: {
        type: String,
        enum: ["upcoming", "ongoing", "completed", "cancelled"],
        default: "upcoming"
    }
}, { timestamps: true });

tripSchema.pre("save", function(next) {
    const now = new Date();

    if (this.endDate < now) {
        this.status = "completed";
    } else if (this.startDate <= now && this.endDate >= now) {
        this.status = "ongoing";
    } else if (this.status !== "cancelled") {
        this.status = "upcoming";
    }
    next();
});

const tripModel = mongoose.model("Trip", tripSchema);

module.exports = {
    userModel,
    tripModel
};
