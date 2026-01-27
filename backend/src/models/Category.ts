import mongoose, {
  HydratedDocument,
  Model,
  Schema,
  Types,
} from "mongoose";

/**
 * Define the Interface for the Category Document.
 * This includes database fields and virtuals
 */
export interface ICategory {
  name: string;
  slug: string;
  parent: Types.ObjectId | ICategory | null;
  path: string;
}

/**
 * Hydrated type for Mongoose Documents
 * Use this for "this" in Schema methods/hooks and Model definitions.
 */
export type ICategoryDocument = HydratedDocument<ICategory>;

/**
 * Define the Interface for the Category Tree.
 */
export interface ICategoryTree extends ICategory {
  _id: string;
  children: ICategoryTree[];
}

// Define the Model type for use in static contexts
type CategoryModel = Model<ICategory>;

/**
 * Define the Mongoose Schema for the Category Model.
 */
export const CategorySchema = new Schema<ICategory, CategoryModel>({
  name: { type: String, required: true, trim: true },
  slug: { type: String, unique: true, lowercase: true },
  parent: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
  path: { type: String, index: true, default: '' },
}, {
  timestamps: true,
});

/**
 * PRE-SAVE: Set the current document's path and slug
 */
CategorySchema.pre<ICategoryDocument>('save', async function (next) {
  const Model = this.constructor as CategoryModel;

  // 1. Auto-generate slug if it's new or the name changed
  if (this.isModified('name') || !this.slug) {
    this.slug = this.name.toLowerCase().trim().replace(/[^\w ]+/g, '').replace(/ +/g, '-');
  }

  // 2. Auto-generate hierarchy path
  if (this.isModified('parent') || this.isModified('slug') || this.isNew) {
    if (this.parent) {
      const parentDoc = await Model.findById(this.parent);
      this.path = parentDoc ? `${parentDoc.path}/${this.slug}` : this.slug;
    } else {
      this.path = this.slug;
    }
  }
  next();
});

/**
 * POST-SAVE: Recursively update all descendants
 */
CategorySchema.post<ICategoryDocument>('save', async function (doc) {
  const Model = doc.constructor as CategoryModel;

  // Find all children whose path starts with the OLD path (logic: updated path - current slug)
  // To keep it simple and robust, we update any child where the path is no longer accurate
  const descendants = await Model.find({
    path: new RegExp(`^${doc.path}/`)
  });

  // Use Promise.all for parallel updates to improve performance
  await Promise.all(descendants.map(child => child.save()));
});

export const Category = mongoose.models.Category || mongoose.model<ICategory, CategoryModel>('Category', CategorySchema);


export async function getRelatedCategoryIds(categorySlug: string): Promise<string[]> {
  // 1. Find the target parent category (e.g., 'shirts')
  const parentCategory = await Category.findOne({ slug: categorySlug });

  if (!parentCategory) {
    return [];
  }

  // 2. Find all descendant categories (those whose path starts with the parent's path)
  // Example: finding categories with a path starting with "electronics"
  const relatedCategories = await Category.find({
    path: new RegExp(`^${parentCategory.path}(\/|$)`)
  });

  return relatedCategories.map(c => c.id);
}