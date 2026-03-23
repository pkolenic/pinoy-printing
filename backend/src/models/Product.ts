import {
  Schema,
  HydratedDocument,
  Model,
  Types,
} from "mongoose";
import { ICategory } from "./Category.js";

/**
 * Define the Interface for the Product Document.
 * This includes database fields and virtuals
 */
export interface IProduct {
  sku: string;
  name: string;
  description: string;
  details?: string;
  price: number;
  image?: string;
  customizationSchema?: Record<string, any>; // Stores the dynamic configuration for the product's customization options
  category: Types.ObjectId | ICategory;
  quantityOnHand: number;    // Physical stock
  quantityAvailable: number; // Stock minus "committed" orders
  showIfOutOfStock?: boolean;
}

/**
 * Hydrated type for Mongoose Documents
 * Use this for "this" in Schema methods/hooks and Model definitions.
 */
export type IProductDocument = HydratedDocument<IProduct> & {
  categoryName: string | null;
};

// Define the Model type for use in static contexts
type ProductModel = Model<IProduct>;

export const CSV_PRODUCT_HEADERS = [
  'sku',
  'name',
  'description',
  'details',
  'price',
  'image',
  'category',
  'quantity',
  'showIfOutOfStock',
  'customizationSchema'
];

/**
 * Define the Mongoose Schema for the Product Model.
 */
export const ProductSchema = new Schema<IProduct, ProductModel>({
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
    trim: true,
    index: true,
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters.'],
    required: true,
  },
  details: {
    type: String,
    maxlength: [10000, 'Details cannot exceed 10000 characters.'],
    required: false,
  },
  price: { type: Number, required: true },
  image: { type: String, required: false },
  customizationSchema: { type: Schema.Types.Mixed, required: false },
  category: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'A category is required.'],
    index: true,
  },
  quantityOnHand: { type: Number, required: true, min: [0, 'Quantity cannot be less than 0.'] },
  quantityAvailable: { type: Number, required: true, min: [0, 'Quantity cannot be less than 0.'] },
  showIfOutOfStock: { type: Boolean, required: false, default: false },
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  timestamps: true,
});

/**
 * Virtual: Category Name
 * Simple getter for the category name.
 */
ProductSchema.virtual('categoryName').get(function (this: IProductDocument) {
  return (this.category as any)?.name || null;
});

/**
 * Sanitizes product data based on user permissions
 */
export const sanitizeProduct = (product: IProduct, isStaff: boolean): IProduct => {
  // Create a base object that ensures customizationSchema is at least set null
  const baseProduct = {
    ...product,
    customizationSchema: product.customizationSchema ?? null,
  };

  if (isStaff) {
    return baseProduct as IProduct;
  }

  // For non-staff, exclude sensitive fields
  const { quantityAvailable, quantityOnHand, showIfOutOfStock, ...publicProduct } = baseProduct;

  return publicProduct as IProduct;
};
