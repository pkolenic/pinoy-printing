import mongoose, { Schema, Document, Model, Types } from "mongoose";

/**
 * Define the Interface for the Product Document.
 * This includes database fields and virtuals
 */
export interface IProduct {
  _id: Types.ObjectId;
  sku: string;
  name: string;
  description: string;
  details?: string;
  price: number;
  image?: string;
  // This object stores the dynamic configuration for the product's customization options
  customizationSchema?: Record<string, any>;
  category: string;
  subCategory?: string;
}

/**
 * Hydrated interface for Mongoose Documents
 * Use this for "this" in Schema methods/hooks and Model definitions.
 */
export interface IProductDocument extends IProduct, Document {
  // If you add instance methods or virtuals later, define them here
}

/**
 * Define the Mongoose Schema for the Product Model.
 */
export const ProductSchema = new Schema<IProductDocument>({
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
  description: {type: String, required: true},
  details: {type: String, required: false},
  price: {type: Number, required: true},
  image: {type: String, required: false},
  customizationSchema: {type: Schema.Types.Mixed, required: false},
  category: {type: String, required: true},
  subCategory: {type: String, required: false},
});

export const Product: Model<IProductDocument> = mongoose.models.Product || mongoose.model<IProductDocument>('Product', ProductSchema);
