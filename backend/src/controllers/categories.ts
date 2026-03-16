import { RequestHandler } from 'express';
import {
  FilterQuery,
  SortOrder,
  Types,
} from "mongoose";
import { StatusCodes } from "http-status-codes";
import { AppError } from '../utils/errors/index.js';

import {
  ICategory,
  ICategoryTree,
  ICategoryDocument,
} from '#/models/index.js';
import {
  IUpdateCategoryRequest
} from "#/types/requests/index.js";

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
    const { Category } = req.tenantModels;

    const newCategory = new Category({ name, parent }) as ICategoryDocument;
    await newCategory.save();

    // Invalidate the category tree cache
    await req.tenantRedis.del(CATEGORY_TREE_CACHE_KEY);

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
    const { Category } = req.tenantModels;
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
export const getCategoryTree: RequestHandler = async (req, res, next) => {
  try {
    const { Category } = req.tenantModels;
    // 1. Check Redis Cache
    const cachedTree = await req.tenantRedis.getJSON<ICategoryTree[]>(CATEGORY_TREE_CACHE_KEY);
    if (cachedTree) {
      return res.status(StatusCodes.OK).json(cachedTree);
    }

    // 2. Fetch Flat list from DB
    // Use .lean() to get plain JS objects (ICategory[])
    type LeanCategory = ICategory & { _id: Types.ObjectId };
    const categories = await Category.find()
      .select("-createdAt -updatedAt -__v")
      .lean<LeanCategory[]>();

    // 3. Transform flat list to tree
    // Use a record to store the nodes by ID for O(1) lookup
    const categoryMap: Record<string, ICategoryTree> = {};
    const tree: ICategoryTree[] = []

    // First pass: Map _id to id and initialize the map and structure the objects
    categories.forEach((cat) => {
      const idStr = cat._id.toString();
      const { _id, ...rest } = cat; // Destructure to remove _id
      categoryMap[idStr] = {
        ...rest,
        id: idStr,
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
    await req.tenantRedis.setJSON(CATEGORY_TREE_CACHE_KEY, tree, CATEGORY_CACHE_TTL);

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
    res.status(StatusCodes.OK).json(category);
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
    const { Product } = req.tenantModels;
    const { category: categoryToDelete } = req;

    if (!categoryToDelete) {
      return next(new AppError('Category not found', StatusCodes.NOT_FOUND));
    }

    // 1. PRODUCT CLEANUP
    // We find all products pointing to this category and set them to its parent (or null)
    const newParentId = categoryToDelete.get('parent') as Types.ObjectId | null;

    await Product.updateMany(
      { category: categoryToDelete._id },
      { $set: { category: newParentId } }
    );

    // 2. DELETE the category
    await categoryToDelete.deleteOne();

    // 3. CACHE PURGE
    await req.tenantRedis.del(CATEGORY_TREE_CACHE_KEY);

    // Send 204 No Content Response
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
    const { Category } = req.tenantModels;
    const { name, parent } = req.body as IUpdateCategoryRequest;
    const { category } = req;

    if (!category) {
      return next(new AppError('Category not found', StatusCodes.NOT_FOUND));
    }

    // 1. Handle Parent Changes
    if (parent !== undefined) {
      // Prevent self-parenting
      if (parent === category._id.toString()) {
        return next(new AppError('A category cannot be its own parent', StatusCodes.BAD_REQUEST));
      }

      if (parent !== null) {
        if (!Types.ObjectId.isValid(parent)) {
          return next(new AppError('Invalid parent ID format', StatusCodes.BAD_REQUEST));
        }

        // Prevent moving under a descendant (would break the tree)
        const potentialParent = await Category.findById(parent).lean();
        if (potentialParent?.path.startsWith(`${category.path}/`)) {
          return next(new AppError('A category cannot have its own descendant as a parent', StatusCodes.BAD_REQUEST));
        }
        category.set('parent', parent ? new Types.ObjectId(parent) : null);
      } else {
        category.parent = null; // Move to root
      }
    }

    // 2. Handle Name Changes
    if (name) {
      category.name = name;
    }

    // 3. Save triggers the Materialized Path hooks (Pre & Post)
    await category.save();

    // 4. Invalidate Cache
    await req.tenantRedis.del(CATEGORY_TREE_CACHE_KEY);

    res.status(StatusCodes.OK).json(category);
  } catch (error) {
    next(error);
  }
};
