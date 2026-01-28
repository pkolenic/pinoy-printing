import { RequestHandler } from "express";
import { FilterQuery, SortOrder } from 'mongoose';
import { StatusCodes } from "http-status-codes";
import { matchedData } from 'express-validator';

import { AppError } from '../utils/errors/index.js';

import {
  Product,
  IProduct,
  getRelatedCategoryIds,
} from '../models/index.js'
import { paginateResponse } from "../utils/paginationHelper.js";

/**
 * Sanitizes product data based on user permissions
 */
const sanitizeProduct = (product: IProduct, permissions: string[]): IProduct => {
  if (!permissions.includes('read:inventory')) {
    const { quantity, ...rest } = product;
    return rest as IProduct;
  }
  return product;
};

/**
 * Creates a new product
 * @route POST /api/products
 * @permission create:products
 */
export const createProduct: RequestHandler = async (req, res, next) => {
  try {
    const { image, category, ...data } = matchedData(req);

    // TODO -- Upload image to Store
    // Placeholder for future S3 logic:
    // const imagePath = req.file ? await uploadToS3(req.file) : image?.trim();
    const imagePath = image?.trim() || "";

    // TODO -- Trigger image processing service

    // Create Image
    const newProduct = new Product({
      ...data,
      details: data.details || data.description,
      categories: [category],
      image: imagePath,
      quantity: data.quantity || 0,
    });

    // Save Product to DB
    await newProduct.save();
    await newProduct.populate('categories', 'name slug id')

    res.status(StatusCodes.CREATED).json(newProduct);
  } catch (error) {
    next(error);
  }
}

/**
 * Gets a list of products
 * @route GET /api/products
 * @permission read:products / update:products
 * @filter {string} [search] - Search term to filter products by name
 * @filter {string} [category] - Parent Category to filter products by
 * @filter {number} [minPrice] - Minimum price to filter products by
 * @filter {number} [maxPrice] - Maximum price to filter products by
 * @filter {number} [maxInventory] - Maximum inventory level to filter products by
 * @filter {string} [sortBy=name] - Sort products by a specific field (e.g., name, price)
 * @filter {number} [page=1] - Page number
 * @filter {number} [limit=10] - Number of products per page
 */
export const getProducts: RequestHandler = async (req, res, next) => {
  try {
    // 1. Parameter Parsing with Explicate Casting
    // req.query values are strings or arrays; we cast to string or parsing
    const limit = parseInt(req.query.perPage as string, 10) || 10;
    const page = parseInt(req.query.page as string, 10) || 1;
    const sortBy = (req.query.sortBy as string)?.toLowerCase() || 'name';
    const search = (req.query.search as string)?.toLowerCase();
    const categorySlug = (req.query.category as string)?.toLowerCase();
    const minPrice = parseInt(req.query.minPrice as string, 10);
    const maxPrice = parseInt(req.query.maxPrice as string, 10);
    const maxInventory = parseInt(req.query.maxInventory as string, 10);
    const userPermissions = req.auth?.payload.permissions || [];
    const isStaff = userPermissions.includes('read:inventory')

    // 2. Build the Query Object
    // Use FilterQuery<IProduct> to allow Mongoose-specific keys ($or, $text, etc.)
    const query: FilterQuery<IProduct> = {};

    // Look up Category Ids (to include all children categories)
    if (categorySlug) {
      const categoryIds = await getRelatedCategoryIds(categorySlug);
      if (categoryIds.length > 0) {
        // Add to the query using $in operator
        query.categories = { $in: categoryIds };
      } else {
        // If slug provided but category doesn't exist, return empty early
        return res.status(200).json(paginateResponse(req, [], 0, page, limit));
      }
    }

    // If a search query is present
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
      ];
    }
    if (minPrice) {
      query.price = { $gte: minPrice };
    }
    if (maxPrice) {
      query.price = { $lte: maxPrice };
    }
    if (maxInventory) {
      query.quantity = { $lte: maxInventory };
    }

    // 3. Build the Sort Object
    // Define allowed sortable fields explicitly for security/clarity
    const publicAllowedSortableFields = ['name', 'price', 'category', 'subCategory'];
    const privateAllowedSortableFields = [...publicAllowedSortableFields, 'quantity'];
    const allowedSortableFields = isStaff ? privateAllowedSortableFields : publicAllowedSortableFields;

    // Default soft field and order
    let sortField = 'name';
    let sortOrder: SortOrder = 'asc';

    if (sortBy) {
      const fieldFromQuery = sortBy.replace(/^-/, ''); // Remove leading '-' if present
      if (allowedSortableFields.includes(fieldFromQuery)) {
        sortField = fieldFromQuery;
        // Check for the descending indicator at the start
        if (sortBy.startsWith('-')) {
          sortOrder = 'desc';
        }
      }
    }

    // Construct sort object with bracket notation
    const sort: { [key: string]: SortOrder } = { [sortField]: sortOrder };

    // 4. Database Operations (Concurrent Execution)
    // Run count and find operations concurrently for better performance
    const [productCount, products] = await Promise.all([
      Product.countDocuments(query),
      Product.find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('categories', 'name slug id')
        .lean<IProduct[]>(), // lean() returns plain JS objects (IUser[])
    ]);
    const sanitizeProducts = products.map(p => sanitizeProduct(p, userPermissions));

    // 5. Response Formatting
    const formattedResponse = paginateResponse<IProduct>(req, sanitizeProducts, productCount, page, limit);

    res.status(200).json(formattedResponse);
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single product by ID
 * @route GET /api/products/:productId
 * @permission read:products
 */
export const getProduct: RequestHandler = async (req, res, next) => {
  try {
    const { product } = req;

    if (!product) {
      return next(new AppError('Product not found', 404));
    }
    await product.populate('categories', 'name slug id')

    const userPermissions = req.auth?.payload.permissions || [];
    const productResponse = sanitizeProduct(product.toObject(), userPermissions);

    res.status(StatusCodes.OK).json(productResponse);
  } catch (error) {
    next(error);
  }
}

/**
 * Updates a product by ID
 * @route PUT /api/products/:productId
 * @permission update:products
 */
export const updateProduct: RequestHandler = async (req, res, next) => {
  try {
    const { product, body: updates } = req;

    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    // Manually handle the category -> categories mapping
    if (updates.category) {
      updates.categories = [updates.category];
      delete updates.category;
    }

    product.set(updates);
    await product.save();
    await product.populate('categories', 'name slug id')

    res.status(StatusCodes.OK).json(product);
  } catch (error) {
    next(error);
  }
}

/**
 * Deletes a product by ID
 * @route DELETE /api/products/:productId
 * @permission delete:products
 */
export const deleteProduct: RequestHandler = async (req, res, next) => {
  try {
    const { product } = req;
    if (!product) {
      return next(new AppError('Product not found', 404));
    }
    await product.deleteOne();
    res.status(StatusCodes.NO_CONTENT).json(product);
  } catch (error) {
    next(error);
  }
}
