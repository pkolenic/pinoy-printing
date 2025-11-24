import mongoose from "mongoose";

const CustomerProductSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    price: {type: Number, required: true},
});

export default mongoose.model('CustomerProduct', CustomerProductSchema);
