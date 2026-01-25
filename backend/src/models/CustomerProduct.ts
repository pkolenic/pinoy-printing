import mongoose, { Schema, Document, Model, Types } from "mongoose";

/**
 * Define the Interface for the CustomerProduct.
 * This includes database fields and virtuals
 */
export interface ICustomerProduct {
    _id: Types.ObjectId;
    product: Types.ObjectId;
    customer: Types.ObjectId;
    price: number;
}

/**
 * Hydrated Interface (Mongoose Document)
 * Used for active document instances and model methods.
 */
export interface ICustomerProductDocument extends ICustomerProduct, Document {
    // If you add instance methods or virtuals later, define them here
}


/**
 * Define the Mongoose Schema for the CustomerProduct Model.
 */
export const CustomerProductSchema = new Schema<ICustomerProductDocument>({
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true},
    price: {type: Number, required: true},
});

export const CustomerProduct: Model<ICustomerProductDocument> = mongoose.models.CustomerProduct || mongoose.model<ICustomerProductDocument>('CustomerProduct', CustomerProductSchema);
