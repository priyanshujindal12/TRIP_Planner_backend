const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const userSchema = new Schema({
    email: { type: String, unique: true },
    password: {type: String},
});
const userModel = mongoose.model("user", userSchema);

const tripSchema = new Schema({
    title: { type: String, required: true },       
    from: { type: String, required: true },        
    to: { type: String, required: true },          
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    seats: { type: Number, required: true },
    image: { type: String },
    pricePerPerson: { type: Number, required: true }, 
    phoneNo: { type: String, required: true },
    modeOfTransport: { 
        type: String, 
        enum: ["bus", "railway", "airplane", ""],  
        required: false  
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
    
    // Create date objects for comparison (only date, no time)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startDate = new Date(this.startDate.getFullYear(), this.startDate.getMonth(), this.startDate.getDate());
    const endDate = new Date(this.endDate.getFullYear(), this.endDate.getMonth(), this.endDate.getDate());

    // Only update status if it's not already cancelled
    if (this.status !== "cancelled") {
        if (endDate < today) {
            this.status = "completed";
        } else if (startDate <= today && endDate >= today) {
            this.status = "ongoing";
        } else {
            this.status = "upcoming";
        }
    }
    next();
});

const tripModel = mongoose.model("Trip", tripSchema);

module.exports = {
    userModel,
    tripModel
};
