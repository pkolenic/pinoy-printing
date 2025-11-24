import mongoose from "mongoose";

const OrderItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order'},
    quantity: {type: Number, required: true},
    customization: {type: Object, required: false},
});

export default mongoose.model('OrderItem', OrderItemSchema);
