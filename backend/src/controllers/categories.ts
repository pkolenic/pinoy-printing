import { RequestHandler } from 'express';
import {
  FilterQuery,
  SortOrder,
  Types,
} from "mongoose";
import { StatusCodes } from "http-status-codes";

import redis from '../services/redis.js';
import { AppError } from '../utils/errors/index.js';

import {
  Category,
  Product,
  ICategory,
  ICategoryTree,
  ICategoryDocument,
  getRelatedCategoryIds,
} from '../models/index.js';

import { paginateResponse } from "../utils/paginationHelper.js";

const CATEGORY_TREE_CACHE_KEY = 'category_tree';
const CATEGORY_CACHE_TTL = 3600;

/**
 * Create a new category
 * @route POST /api/categories
 * @permission create:categories
 */
export const createCategory: RequestHandler = async (req, res, next) => {
  try {
    const { name, parent } = req.body;

    const newCategory = new Category({ name, parent }) as ICategoryDocument;
    await newCategory.save();

    // Invalidate the cache after a database change
    await redis.del(CATEGORY_TREE_CACHE_KEY);

    res.status(StatusCodes.CREATED).json(newCategory);
  } catch (error) {
    next(error);
  }
}

/**
 * Get all categories
 * @route GET /api/categories
 * @permission read:categories
 * @filter {Number} [limit=100] Maximum number of users returned (100 is the maximum)
 * @filter {Number} [page=1] Page number (1 is the first page)
 */
export const getCategories: RequestHandler = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 100;
    const page = parseInt(req.query.page as string, 10) || 1;

    // Use FilterQuery<ICategory> to allow Mongoose-specific keys ($or, $text, etc.)
    const query: FilterQuery<ICategory> = {};

    // Default sort field and order
    let sortField = 'path';
    let sortOrder: SortOrder = 'asc';

    // Construct sort object with bracket notation
    const sort: { [key: string]: SortOrder } = { [sortField]: sortOrder };

    const [categoryCount, categories] = await Promise.all([
      Category.countDocuments(query),
      Category.find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<ICategory[]>(),
    ]);

    const formattedResponse = paginateResponse<ICategory>(req, categories, categoryCount, page, limit);
    res.status(StatusCodes.OK).json(formattedResponse);
  } catch (error) {
    next(error);
  }
}

/**
 * Get all categories in a tree structure for use in FrontEnd UI
 * @route GET /api/categories/tree
 * @permission read:categories
 */
export const getCategoryTree: RequestHandler = async (_req, res, next) => {
  try {
    // 1. Check Redis Cache
    const cachedTree = await redis.getJSON<ICategoryTree[]>(CATEGORY_TREE_CACHE_KEY);
    if (cachedTree) {
      return res.status(StatusCodes.OK).json(cachedTree);
    }

    // 2. Fetch Flat list from DB
    // Use .lean() to get plain JS objects (ICategory[])
    type LeanCategory = ICategory & { _id: Types.ObjectId };
    const categories = await Category.find().lean<LeanCategory[]>();

    // 3. Transform flat list to tree
    // Use a record to store the nodes by ID for O(1) lookup
    const categoryMap: Record<string, ICategoryTree> = {};
    const tree: ICategoryTree[] = []

    // First pass: Initialize the map and structure the objects
    categories.forEach((cat) => {
      const id = cat._id.toString();
      categoryMap[id] = {
        ...cat,
        _id: id,
        children: []
      } as ICategoryTree;
    });

    // Second pass: Link children to parents
    categories.forEach((cat) => {
      const catId = cat._id.toString();
      const parentId = cat.parent?.toString();

      if (parentId && categoryMap[parentId]) {
        categoryMap[parentId].children.push(categoryMap[catId]);
      } else {
        // No parent means it's a root node
        tree.push(categoryMap[catId]);
      }
    });

    // 4. Save to Redis (Cache for 1 hour or until invalidated)
    await redis.setJSON(CATEGORY_TREE_CACHE_KEY, tree, CATEGORY_CACHE_TTL);

    res.status(StatusCodes.OK).json(tree);
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single category by ID
 * @route GET /api/categories/:categoryId
 * @permission read:categories
 */
export const getCategory: RequestHandler = async (req, res, next) => {
  try {
    const { category } = req;

    if (!category) {
      return next(new AppError('Category not found', StatusCodes.NOT_FOUND));
    }
    res.status(StatusCodes.OK).json(category.toObject());
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a category by ID
 * @route DELETE /api/categories/:categoryId
 * @permission delete:categories
 */
export const deleteCategory: RequestHandler = async (req, res, next) => {
  try {
    // 1. Access the category attached by the createAttachMiddleware
    const { category: categoryToDelete } = req;

    if (!categoryToDelete) {
      return next(new AppError('Category not found', StatusCodes.NOT_FOUND));
    }

    // 2. Handle Orphaned Children: Find all direct children of the category being deleted
    const directChildren = await Category.find({ parent: categoryToDelete._id });

    // Find the parent's ID of the category we're deleting (can be null if it's a root category)
    const newParentId = categoryToDelete.parent;

    // Update the direct children to point to their new parent
    if (directChildren.length > 0) {
      // Map over children, update parent, and save.
      // The PRE-SAVE hook will now see 'parent' is modified and fix the 'path'.
      // The POST-SAVE hook will then see the fixed 'path' and find the grandchildren.
      await Promise.all(
        directChildren.map((child) => {
          child.parent = newParentId;
          return child.save();
        })
      );
    }

    // 3. Handle Related Products: Remove the deleted category from any products' category arrays
    await Product.updateMany(
      { categories: categoryToDelete._id },
      { $pull: { categories: categoryToDelete._id } }
    );

    // The Product pre-save hook handles the hierarchy logic, but we need to ensure the product documents reflect the removal

    // 4. Delete the category itself from Mongo DB
    await categoryToDelete.deleteOne();

    // 5. Invalidate the category tree cache
    await redis.del(CATEGORY_TREE_CACHE_KEY);

    // 6. Send 204 No Content
    res.status(StatusCodes.NO_CONTENT).end();
  } catch (error) {
    next(error);
  }
}

/**
 * Update a category by ID
 * @route PUT /api/categories/:categoryId
 * @permission update:categories
 */
export const updateCategory: RequestHandler = async (req, res, next) => {
  try {
    const { name, parent } = req.body;
    const dbUpdates: Partial<ICategory> = {};

    // Access the category attached by the createAttachMiddleware
    const { category } = req;

    if (!category) {
      return next(new AppError('Category not found', StatusCodes.NOT_FOUND));
    }

    // Ensure a valid parent is being set
    if (parent !== undefined) {
      // Check if trying to set self to parent
      if (parent === category._id.toString()) {
        return next(new AppError('Cannot set a category to be its own parent', StatusCodes.BAD_REQUEST));
      }

      // Check if trying to set a descendant as the parent
      if (parent !== null) {
        // Validate format BEFORE querying the DB
        if (!Types.ObjectId.isValid(parent)) {
          return next(new AppError('Invalid parent ID format', StatusCodes.BAD_REQUEST));
        }

        const potentialParent = await Category.findById(parent);
        if (potentialParent && potentialParent.path.startsWith(`${category.path}/`)) {
          return next(new AppError('A category cannot have its own descendant as a parent', StatusCodes.BAD_REQUEST));
        }
      }

      dbUpdates['parent'] = parent;
    }
    if (name) {
      dbUpdates['name'] = name;
    }
    category.set(dbUpdates);

    const isHierarchyChanging = category.isModified('parent') || category.isModified('name');

    // Save the category
    // This triggers the pre-save (path/slug logic) and post-save (descendant path updates)
    await category.save();

    // If the hierarchy changed, we must update all Products that use this category or its descendants
    if (isHierarchyChanging) {
      // Find all categories affected (the category itself + all descendants)
      const affectedCategoryIds = await getRelatedCategoryIds(category.slug);

      // Find all products that contain any of these categories
      const productsToUpdate = await Product.find({
        categories: { $in: affectedCategoryIds }
      });

      // Trigger the Product pre-save hook for each product to recalculate its category array
      // We use Promise.all for parallel saves
      await Promise.all(productsToUpdate.map(product => {
        // FORCE the hook to run by marking the field as dirty
        product.markModified('categories');
        return product.save();
      }));
    }

    // Invalidate Cache
    await redis.del(CATEGORY_TREE_CACHE_KEY);

    res.status(StatusCodes.OK).json(category);
  } catch (error) {
    next(error);
  }
}
