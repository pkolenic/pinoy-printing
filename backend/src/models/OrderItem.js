import mongoose from "mongoose";

export const OrderItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: {type: Number, required: true},
    customization: {type: Object, required: false},
});
