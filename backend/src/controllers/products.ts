import { RequestHandler } from "express";
import { FilterQuery } from 'mongoose';
import { StatusCodes } from "http-status-codes";
import { matchedData } from 'express-validator';
import { detailedDiff } from 'deep-object-diff';
import fs from 'fs';
import csv from 'csv-parser';

import { AppError } from '../utils/errors/index.js';
import {
  CSV_PRODUCT_HEADERS,
  getRelatedCategoryIds,
  getCommitedStock,
  IProduct,
  resolveCategory,
} from '../models/index.js'
import { IImportResult, IProductDiff, IProductImportRow, } from "../types/requests/index.js";
import { paginateResponse } from "../utils/paginationHelper.js";
import { buildSort, parsePagination } from "../utils/controllers/queryHelper.js";

/**
 * Sanitizes product data based on user permissions
 */
const sanitizeProduct = (product: IProduct, isStaff: boolean): IProduct => {
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

/**
 * Creates a new product
 * @route POST /api/products
 * @permission create:products
 */
export const createProduct: RequestHandler = async (req, res, next) => {
  try {
    const { Product } = req.tenantModels;
    const { image, quantity = 0, ...data } = matchedData(req);

    // TODO -- Upload image to Store
    // Placeholder for future S3 logic:
    // const imagePath = req.file ? await uploadToS3(req.file) : image?.trim();
    const imagePath = image?.trim() || "";

    // TODO -- Trigger image processing service

    // Create Image
    const newProduct = new Product({
      ...data,
      details: data.details || data.description,
      image: imagePath,
      quantityAvailable: data.quanity || 0,
      quantityOnHand: data.quantity || 0,
    });

    // Save Product to DB
    await newProduct.save();
    await newProduct.populate('category', 'name slug path')

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
    const { Category, Product } = req.tenantModels;
    const { limit, page, skip } = parsePagination(req);
    const userPermissions = req.auth?.payload.permissions || [];
    const isStaff = userPermissions.includes('read:inventory')

    // Build Query
    type queryType = {
      search?: string,
      category?: string,
      minPrice?: number,
      maxPrice?: number,
      maxInventory?: number,
      sortBy?: string
    };
    const query: FilterQuery<IProduct> = {};
    const { search, category, minPrice, maxPrice, maxInventory, sortBy } = req.query as queryType

    if (category) {
      const categoryIds = await getRelatedCategoryIds(Category, category);
      if (categoryIds.length === 0) {
        // If slug provided but category doesn't exist, return empty early'
        return res.status(200).json(paginateResponse(req, [], 0, page, limit));
      }
      query.category = { $in: categoryIds };
    }

    if (search) {
      query.$or = [{ name: { $regex: search, $options: 'i' } }, { sku: { $regex: search, $options: 'i' } }];
    }
    if (minPrice || maxPrice) {
      query.price = { ...(minPrice && { $gte: minPrice }), ...(maxPrice && { $lte: maxPrice }) };
    }
    if (maxInventory) {
      query.quantityAvailable = { $lte: maxInventory };
    }

    // Sort & Execute
    const allowedSort = isStaff ? ['name', 'price', 'quantityAvailable', 'quantityOnHand', 'category'] : ['name', 'price', 'category'];
    const sort = buildSort(sortBy, allowedSort);

    const [count, products] = await Promise.all([
      Product.countDocuments(query),
      Product.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('category', 'name slug path')
        .lean<IProduct[]>(),
    ]);

    const securedData = products.map(p => sanitizeProduct(p, isStaff)) as IProduct[];
    res.status(StatusCodes.OK).json(paginateResponse(req, securedData, count, page, limit));
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
      return next(new AppError('Product not found', StatusCodes.NOT_FOUND));
    }
    await product.populate('category', 'name slug path')

    const userPermissions = req.auth?.payload.permissions || [];
    const isStaff = userPermissions.includes('read:inventory')
    const productResponse = sanitizeProduct(product.toJSON(), isStaff);

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
      return next(new AppError('Product not found', StatusCodes.NOT_FOUND));
    }

    product.set(updates);
    await product.save();
    await product.populate('category', 'name slug path')

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

/**
 * Import products from a CSV file
 * @route POST /api/products/import
 * @permission create:products
 */
export const importProducts: RequestHandler = async (req, res, next) => {
  if (!req.file) {
    return res.status(StatusCodes.BAD_REQUEST).json({ message: "No file uploaded" });
  }

  const filePath = req.file.path;
  const isPreview = req.query.preview === 'true';
  const allowUpdate = req.query.allowUpdate === 'true';
  const results: IProductImportRow[] = [];

  try {
    // 1. Read the entire file into the results array safely
    const parser = fs.createReadStream(filePath).pipe(csv());

    for await (const record of parser) {
      results.push(record);
    }

    const { Category, Product, Order } = req.tenantModels;
    const stats = { created: 0, updated: 0, errors: 0 };
    const importResults: IImportResult[] = [];

    // 2. Process the results
    for (const row of results) {
      let status: 'created' | 'updated' | 'error' = 'error';
      let errorMessage: string | null = null;
      let diff: IProductDiff | null = null;

      // Resolve Category
      const categoryInput = row.category?.trim();
      const resolvedCategoryId = await resolveCategory(Category, categoryInput);

      if (!resolvedCategoryId) {
        status = 'error';
        errorMessage = `Category not found for: "${categoryInput}"`;
      } else {
        try {
          const sku = row.sku?.trim().toLowerCase();
          const existingProduct = await Product.findOne({ sku });

          if (existingProduct && !allowUpdate) {
            status = 'error';
            errorMessage = `SKU ${sku} already exists and updates are disabled.`;
          } else {
            // Prepare product data
            const quantity = parseInt(row.quantity, 10) || 0;

            const productData = {
              sku,
              name: row.name?.trim(),
              description: row.description?.trim(),
              details: row.details?.trim() || row.description?.trim(),
              price: parseFloat(row.price) || 0,
              category: resolvedCategoryId,
              quantityOnHand: quantity,
              quantityAvailable: quantity,
              showIfOutOfStock: row.showIfOutOfStock?.toLowerCase() === 'true',
              customizationSchema: row.customizationSchema?.trim() ? JSON.parse(row.customizationSchema) : {},
            };

            if (existingProduct) {
              status = 'updated';

              const committedQuantity = await getCommitedStock(Order, existingProduct._id);
              const newPhysicalQty = quantity;

              productData.quantityOnHand = newPhysicalQty;
              productData.quantityAvailable = Math.max(0, newPhysicalQty - committedQuantity);

              // Convert to a plain object and cast to any to allow field overrides
              const currentData: any = existingProduct.toObject();

              // Normalize the Category ID to a string for clean diffing
              currentData.category = currentData.category?._id?.toString() || currentData.category?.toString();

              // Prepare the target data
              const targetData = { ...productData, category: productData.category.toString() };

              // Run the diff
              diff = detailedDiff(currentData, targetData) as IProductDiff;

              if (!isPreview) {
                existingProduct.set(productData);
                await existingProduct.save();
              }
            } else {
              status = 'created';
              const newProduct = new Product(productData);
              isPreview ? await newProduct.validate() : await newProduct.save();
            }
          }
        } catch (err: any) {
          // This only catches real system/DB errors (e.g. invalid JSON or DB timeout)
          status = 'error';
          errorMessage = err.message;
        }
      }

      // Update stats and push result
      if (status === 'error') {
        stats.errors++;
      } else {
        status === 'updated' ? stats.updated++ : stats.created++;
      }

      importResults.push({ ...row, status, diff, error: errorMessage });
    }

    res.status(StatusCodes.OK).json({
      message: isPreview ? "Preview completed successfully" : "Import completed successfully",
      isPreview,
      summary: stats,
      results: importResults,
    });
  } catch (err) {
    next(err);
  } finally {
    // 3. GUARANTEED CLEANUP: Happens whether success or failure
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
};

/**
 * Export a product template for import
 * @route GET /api/products/export-template
 * @permission create:products
 */
export const getImportTemplate: RequestHandler = (_req, res, _next) => {
  // Join headers with commas
  const csvContent = CSV_PRODUCT_HEADERS.join(',') + '\n';

  // Set headers to trigger a browser download
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=product_import_template.csv');

  return res.status(StatusCodes.OK).send(csvContent);
};
