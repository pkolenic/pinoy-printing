import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    name: {type: String, required: true},
    sub: {type: String, required: true},
    email: {type: String, required: true},
    phone: {type: String, required: false},
});
UserSchema.virtual('orders', {
    ref: 'Order',
    localField: '_id',
    foreignField: 'customer',
    justOne: false,
});

export default mongoose.model('User', UserSchema);
