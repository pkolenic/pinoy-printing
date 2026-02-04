import { RequestHandler } from "express";
import { FilterQuery } from 'mongoose';
import { StatusCodes } from "http-status-codes";
import { matchedData } from 'express-validator';
import fs from 'fs';
import csv from 'csv-parser';

import { AppError } from '../utils/errors/index.js';

import {
  Product,
  IProduct,
  IProductImportRow,
  CSV_PRODUCT_HEADERS,
  getRelatedCategoryIds,
} from '../models/index.js'
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
  const { quantity, showIfOutOfStock, ...publicProduct } = baseProduct;

  return publicProduct as IProduct;
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
    const allowedSort = isStaff ? ['name', 'price', 'quantity', 'category'] : ['name', 'price', 'category'];
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

/**
 * Import products from a CSV file
 * @route POST /api/products/import
 * @permission create:products
 */
export const importProducts: RequestHandler = async (req, res, next) => {
  const filePath = req.file!.path;
  const results: IProductImportRow[] = [];

  // Parse flags
  const isPreview = req.query.preview === 'true';
  const allowUpdate = req.query.allowUpdate === 'true';

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data: IProductImportRow) => results.push(data))
    .on('end', async () => {
      try {
        const stats = { created: 0, updated: 0, errors: 0 };
        const importResults: any[] = [];

        for (const row of results) {
          let status: 'created' | 'updated' | 'error' = 'error';
          let errorMessage: string | null = null;

          try {
            const productData = {
              ...row,
              price: parseFloat(row.price),
              quantity: parseInt(row.quantity, 10),
              categories: [row.category.trim()],
              showIfOutOfStock: row.showIfOutOfStock?.toLowerCase() === 'true',
              customizationSchema: row.customizationSchema?.trim() ? JSON.parse(row.customizationSchema) : {},
            };

            const existingProduct = await Product.findOne({ sku: productData.sku });

            // Logic Check: Handle Duplicate SKU without throwing
            if (existingProduct && !allowUpdate) {
              status = 'error';
              errorMessage = `SKU ${row.sku} already exists.`;
            } else {
              // Determine Action Type
              status = existingProduct ? 'updated' : 'created';

              if (isPreview) {
                // PREVIEW MODE
                const testDoc = existingProduct
                  ? Object.assign(existingProduct, productData)
                  : new Product(productData);

                await testDoc.validate();
              } else {
                // EXECUTION MODE
                if (existingProduct) {
                  Object.assign(existingProduct, productData);
                  await existingProduct.save();
                } else {
                  await Product.create(productData);
                }
              }
            }

            // If the logic above resulted in an error (the duplicate SKU case),
            // the catch block won't run, so we update stats here.
            if (status === 'error') {
              stats.errors++;
            } else {
              status === 'updated' ? stats.updated++ : stats.created++;
            }
          } catch (err: any) {
            // This catches Mongoose Validation errors or JSON.parse errors
            status = 'error';
            errorMessage = err.message;
            stats.errors++;
          }

          // Push the full row data + metadata
          importResults.push({
            ...row,
            status,
            error: errorMessage
          });
        }

        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        res.status(StatusCodes.OK).json({
          message: isPreview ? "Preview completed" : "Import completed",
          isPreview,
          summary: stats,
          results: importResults // Every row from the CSV is here
        });
      } catch (error) {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        next(error);
      }
    });
};

/**
 * Export a product template for import
 * @route GET /api/products/export-template
 * @permission create:products
 */
export const getImportTemplate: RequestHandler = (req, res) => {
  // Join headers with commas
  const csvContent = CSV_PRODUCT_HEADERS.join(',') + '\n';

  // Set headers to trigger a browser download
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=product_import_template.csv');

  return res.status(200).send(csvContent);
};
