import mongoose from "mongoose";
import { AddressSchema } from "./Address.js";
import { OrderItemSchema } from "./OrderItem.js";

const OrderSchema = new mongoose.Schema({
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    items: [OrderItemSchema],
    address: {
        type: AddressSchema,
        required: [true, 'Shipping address is required']
    },
    paid: { type: Date, required: false },
    shipped: { type: Date, required: false },
}, {
    // 1. Enable virtuals so that OTHER Order virtuals still show
    toJSON: {
        virtuals: true,
        // 2. Add a transform to remove the isPrimary flag from the nested address
        transform: function (doc, ret) {
            if (ret.address) {
                delete ret.address.isPrimary;
            }
            return ret;
        }
    },
    toObject: { virtuals: true }
});

export default mongoose.models.Order || mongoose.model('Order', OrderSchema);
