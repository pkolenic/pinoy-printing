import mongoose, {
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
  categories: (Types.ObjectId | ICategory)[];
  quantity?: number;
  showIfOutOfStock?: boolean;
}

/**
 * Hydrated type for Mongoose Documents
 * Use this for "this" in Schema methods/hooks and Model definitions.
 */
export type IProductDocument = HydratedDocument<IProduct>;

// Define the Model type for use in static contexts
type ProductModel = Model<IProduct>;

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
    unique: true,
    trim: true,
    lowercase: true,
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
  categories: [{
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'At least one category is required.'],
    index: true,
  }],
  quantity: { type: Number, required: true, min: [0, 'Quantity cannot be less than 0.'] },
  showIfOutOfStock: { type: Boolean, required: false, default: false },
});

/**
 * PRE-SAVE: Ensure the full category hierarchy is stored
 */
ProductSchema.pre<IProductDocument>('save', async function (next) {
  // Only run this logic if categories were modified, or it's a new product
  if (this.isModified('categories') && this.categories?.length > 0) {
    try {
      // Get the Model reference safely via Mongoose internal registry
      const CategoryModel = mongoose.model<ICategory>('Category');

      // Grab the last ID in the array (the "leaf" provided by the client)
      const leafCategoryId = this.categories[this.categories.length - 1];

      // Use the typed model to look up the leaf category by ID
      const leafCategory = await CategoryModel.findById(leafCategoryId).lean();

      if (leafCategory?.path) {
        // Split path (e.g., "electronics/computers/laptops") into slugs
        const slugs = leafCategory.path.split('/');

        // Find all categories matching these slugs to get their ObjectIds
        const ancestorDocs = await CategoryModel.find({
          slug: { $in: slugs }
        }).select('_id').lean();

        // Map them to ObjectIds and re-assign
        this.categories = ancestorDocs.map(doc => doc._id as Types.ObjectId);
      }
    } catch (error) {
      return next(error as mongoose.CallbackError);
    }
  }
  next();
});

export const Product = mongoose.models.Product || mongoose.model<IProduct, ProductModel>('Product', ProductSchema);
