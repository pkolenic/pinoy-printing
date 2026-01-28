import { RequestHandler } from "express";
import { FilterQuery } from 'mongoose';
import { StatusCodes } from "http-status-codes";
import { matchedData } from 'express-validator';

import { AppError } from '../utils/errors/index.js';

import {
  Product,
  IProduct,
  getRelatedCategoryIds,
} from '../models/index.js'
import { paginateResponse } from "../utils/paginationHelper.js";
import { buildSort, parsePagination } from "../utils/controllers/queryHelper.js";

/**
 * Sanitizes product data based on user permissions
 */
const sanitizeProduct = (product: IProduct, isStaff: boolean): IProduct => {
  if (isStaff) {
    return product;
  }
  const { quantity, ...rest } = product;
  return rest as IProduct;
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
    const { limit, page, skip } = parsePagination(req);
    const userPermissions = req.auth?.payload.permissions || [];
    const isStaff = userPermissions.includes('read:inventory')

    // Build Query
    type queryType = { search?: string, category?: string, minPrice?: number, maxPrice?: number, maxInventory?: number, sortBy?: string};
    const query: FilterQuery<IProduct> = {};
    const { search, category, minPrice, maxPrice, maxInventory, sortBy } = req.query as queryType

    if (category) {
      const categoryIds = await getRelatedCategoryIds(category.toLowerCase());
      if (categoryIds.length === 0) {
        // If slug provided but category doesn't exist, return empty early'
        return res.status(200).json(paginateResponse(req, [], 0, page, limit));
      }
      query.categories = { $in: categoryIds };
    }

    if (search) {
      query.$or = [{ name: { $regex: search, $options: 'i' } }, { sku: { $regex: search, $options: 'i' } }];
    }
    if (minPrice || maxPrice) {
      query.price = { ...(minPrice && { $gte: minPrice }), ...(maxPrice && { $lte: maxPrice }) };
    }
    if (maxInventory) {
      query.quantity = { $lte: maxInventory };
    }

    // Sort & Execute
    const allowedSort = isStaff ? ['name', 'price', 'quantity'] : ['name', 'price'];
    const sort = buildSort(sortBy, allowedSort);

    const [count, products] = await Promise.all([
      Product.countDocuments(query),
      Product.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('categories', 'name slug id')
        .lean<IProduct[]>(),
    ]);

    const securedData = products.map(p => sanitizeProduct(p, isStaff)) as IProduct[];
    res.status(200).json(paginateResponse(req, securedData, count, page, limit));
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
    const isStaff = userPermissions.includes('read:inventory')
    const productResponse = sanitizeProduct(product.toObject(), isStaff);

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
