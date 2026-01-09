import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema({
    sku: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        index: true,
    },
    description: {type: String, required: false},
    price: {type: Number, required: true},
    image: {type: String, required: false},
    customizationSchema: {type: Object, required: false},
});

export default mongoose.models.Product || mongoose.model('Product', ProductSchema);
