import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema({
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    paid: {type: Date, required: false},
    shipped: {type: Date, required: false},
});
OrderSchema.virtual('items', {
    ref: 'OrderItem',
    localField: '_id',
    foreignField: 'order',
    justOne: false,
});

export default mongoose.model('Order', OrderSchema);
