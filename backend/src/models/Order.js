import mongoose from "mongoose";
import { AddressSchema } from "./Address.js";
import { OrderItemSchema } from "./OrderItem.js";

const OrderSchema = new mongoose.Schema({
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    items: [OrderItemSchema],
    address: {
        type: AddressSchema,
        required: [true, 'Shipping address is required']
    },
    paid: {type: Date, required: false},
    shipped: {type: Date, required: false},
});

export default mongoose.models.Order || mongoose.model('Order', OrderSchema);
