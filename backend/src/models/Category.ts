import {
  HydratedDocument,
  Model,
  Schema,
  Types,
} from "mongoose";
import slugify from '@sindresorhus/slugify';
import { escapePath } from "../utils/strings.js";

/**
 * Define the Interface for the Category Document.
 * This includes database fields and virtuals
 */
export interface ICategory {
  name: string;
  slug: string;
  parent: Types.ObjectId | null;
  path: string;
  _originalPath?: string; // The transient "memory" field
}

/**
 * Hydrated type for Mongoose Documents
 * Use this for "this" in Schema methods/hooks and Model definitions.
 */
export type ICategoryDocument = HydratedDocument<ICategory, {
  parent: HydratedDocument<ICategory> | null;
}>;

/**
 * Define the Interface for the Category Tree.
 */
export interface ICategoryTree extends ICategory {
  id: string;
  children: ICategoryTree[];
}

// Define the Model type for use in static contexts
type CategoryModel = Model<ICategory>;

/**
 * Define the Mongoose Schema for the Category Model.
 */
export const CategorySchema = new Schema<ICategory, CategoryModel>({
  name: { type: String, required: true, trim: true },
  slug: { type: String, lowercase: true },
  parent: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
  path: {
    type: String,
    index: true,
    unique: true,
    default: '',
  },
}, {
  timestamps: true,
});

/**
 * Index: Unique slug/parent combination
 */
CategorySchema.index({ slug: 1, parent: 1 }, { unique: true });

/**
 * PRE-SAVE: Set the current document's path and slug
 */
CategorySchema.pre<ICategoryDocument>('save', async function (next) {
  const Category = this.model('Category') as CategoryModel;

  // 1. Capture the original path for the post-save rebase logic
  if (!this.isNew && (this.isModified('parent') || this.isModified('slug') || this.isModified('name'))) {
    const oldDoc = await Category.findById(this._id).select('path').lean();
    if (oldDoc) {
      this._originalPath = oldDoc.path;
    }
  }

  // 2. Auto-generate slug if it's new or the name changed
  if (this.isModified('name') || !this.slug) {
    this.slug = slugify(this.name, { decamelize: false });
  }

  // 3. Prevent Circular Dependencies
  if (this.isModified('parent') && this.parent) {
    // Check for Direct Self-Reference
    if (this.parent.toString() === this._id.toString()) {
      return next(new Error('A category cannot be its own parent.'));
    }

    // Descendant-Reference (Circular Loop)
    // We check if the intended parent has a path that STARTS with this category's path
    if (!this.isNew && this.path) {
      const targetParent = await Category.findById(this.parent).select('path').lean();

      // If the target parent's path starts with 'this.path/', it's a descendant
      const descendantRegex = new RegExp(`^${escapePath(this.path)}/`);
      if (targetParent && descendantRegex.test(targetParent.path)) {
        return next(new Error("Circular dependency detected: Cannot move a category under its own descendant."));
      }
    }
  }

  // 4. Auto-generate hierarchy path
  if (this.isModified('parent') || this.isModified('name') || this.isModified('slug') || this.isNew) {
    if (this.parent) {
      // Use .get() to bypass the HydratedDocument type if it was populated
      const parentId = this.get('parent');
      const parentDoc = await Category.findById(parentId).select('path').lean();
      this.path = parentDoc ? `${parentDoc.path}/${this.slug}` : this.slug;
    } else {
      this.path = this.slug;
    }
  }
  next();
});

/**
 * PRE-DELETE: Recursively update all descendants to point to the grandparent
 */
CategorySchema.pre<ICategoryDocument>('deleteOne', { document: true, query: false }, async function (next) {
  const Category = this.model('Category') as CategoryModel;

  // 1. Find all direct children of the category
  const children = await Category.find({ parent: this._id });

  if (children.length > 0) {
    const grandparentId = this.get('parent') as Types.ObjectId | null;
    // 2. Update each child to point to the grandparent
    await Promise.all(
      children.map((child) => {
        child.parent = grandparentId;
        return child.save();
      })
    );
  }
  next();
});

/**
 * POST-SAVE: Recursively update all descendants
 */
CategorySchema.post<ICategoryDocument>('save', async function (doc) {
  const Category = doc.model('Category');

  // REBASE DESCENDANTS: If the path changed, fix all children's paths
  // We check a custom internal flag or compare paths if tracking 'wasModified'
  // Since 'post' save doesn't have isModified, we can check if this save
  // might have changed the path based on the logic in pre-save.

  // To avoid infinite loops, we ONLY run this if there are actually children
  // that currently start with an old/incorrect path structure.
  // This is best handled by passing the "old path" via a virtual or temporary property
  // set in the pre-save hook, but a safer way is a direct update:

  const oldPathPrefix = doc._originalPath;

  if (oldPathPrefix && oldPathPrefix !== doc.path) {
    const escapedPrefix = escapePath(oldPathPrefix);

    await Category.updateMany(
      { path: new RegExp(`^${escapedPrefix}/`) },
      [
        {
          $set: {
            path: {
              $concat: [
                doc.path,
                {
                  $substrCP: [
                    "$path",
                    oldPathPrefix.length,
                    { $subtract: [{ $strLenCP: "$path" }, oldPathPrefix.length] },
                  ]
                }
              ]
            }
          }
        }
      ]
    );
  }
});

/**
 * Utility function to find all related category IDs for a given slug.
 * @param Category
 * @param categoryPath
 */
export async function getRelatedCategoryIds(Category: Model<ICategory>, categoryPath: string): Promise<Types.ObjectId[]> {
  // Find the target parent category (e.g., 'shirts')
  const parentCategory = await Category.findOne({ path: categoryPath }).lean();

  if (!parentCategory) {
    return [];
  }

  // Escape the path for the Regex
  const escapedPath = escapePath(parentCategory.path);

  // Find all descendant categories (those whose path starts with the parent's path)
  // Example: finding categories with a path starting with "electronics"
  const relatedCategories = await Category.find({
    path: new RegExp(`^${escapedPath}(\/|$)`)
  }).select('_id').lean();

  return relatedCategories.map(c => c._id as Types.ObjectId);
}

/**
 * Resolve a category ID from a user-provided input string that can either be a MongoDB ObjectId or a category path.
 * @param Category
 * @param input
 */
export async function resolveCategory(Category: Model<ICategory>, input: string): Promise<Types.ObjectId | null> {
  const value = input.trim();
  if (!value) {
    return null;
  }

  // Normalize the path: lowercase, split by delimiters, filter out empties, join with /
  const path = value.toLowerCase()
    .split(/\s*[>\/+]\s*/)
    .filter(Boolean) // Prevents empty segments from "Parent // Child"
    .join('/');

  // Check if it's a valid MongoDB ObjectId Format
  const isId = Types.ObjectId.isValid(value);

  // If it looks like an ID, check both _id and path. Otherwise, just check the path.
  const query = isId ? { $or: [{ _id: value }, { path }] } : { path };

  const category = await Category.findOne(query).select('_id').lean();
  return category ? category._id : null;
}
