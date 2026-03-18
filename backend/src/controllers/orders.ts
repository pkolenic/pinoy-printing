import { RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";

import {
  IOrderDocument,
  IOrderItem,
  AddressSubdocument,
  IAddress, IProduct,
} from "../models/index.js";
import { ICreateOrderRequest } from "../types/requests/index.js";

import { AppError } from '../utils/errors/index.js';
import mongoose, { FilterQuery } from "mongoose";
import { parsePagination } from "../utils/controllers/queryHelper.js";

/**
 * Create a new order
 * @route POST /api/orders/:userId/create
 */
export const createOrder: RequestHandler = async (req, res, next) => {
  // Start a Transaction for atomicity
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { Order, Product, CustomerProduct } = req.tenantModels;
    const { user } = req;

    if (!user) {
      return next(new AppError('User not found', StatusCodes.NOT_FOUND));
    }

    /**
     * Address Selection Logic
     * Prioritizes:
     *  a) An address attached by middleware (e.g., req. Address)
     *  b) The user's primary address
     *  c) The user's first available address
     */
    const selectedAddress = req.address || user.addresses.id(user.primaryAddressId!) || user.addresses[0];

    if (!selectedAddress) {
      return next(new AppError('Shipping address is required', StatusCodes.BAD_REQUEST));
    }

    /**
     * Snapshot the Address
     * We convert the subdocument to a plain object and remove the _id and isPrimary properties.
     * This creates a permanent snapshot of the address at the time of order,
     * ensuring it doesn't change if the user updates their profile later.
     */
    const shippingAddress = (selectedAddress as AddressSubdocument).toObject();
    const { _id, isPrimary, ...addressSnapshot } = shippingAddress;

    /**
     * Price Lookup Logic
     * Fetch all products in the order as well as any customer-specific overrides.
     * Prefer customer-specific overrides if they exist, otherwise use the base product price.
     */
      // Prepare Data Fetching for prices
    const { items: itemsFromRequest = [] } = req.body as ICreateOrderRequest;

    // Guard against empty order
    if (itemsFromRequest.length === 0) {
      return next(new AppError('Order must contain at least one item', StatusCodes.BAD_REQUEST));
    }

    const productIds = itemsFromRequest.map(item => item.product);

    // Concurrent fetch for performance
    const [products, customerOverrides] = await Promise.all([
      Product.find({ _id: { $in: productIds } }),
      CustomerProduct.find({
        customer: user._id,
        product: { $in: productIds }
      })
    ]);

    // Map Items with Price Logic
    const orderItems: IOrderItem[] = itemsFromRequest.map(item => {
      const productDoc = products.find(p => p._id.equals(item.product));
      if (!productDoc) {
        throw new AppError(`Product ${item.product} not found`, StatusCodes.NOT_FOUND);
      }

      // Check for a customer-specific price override
      const override = customerOverrides.find(o => productDoc._id.equals(o.product));

      // FALLBACK: Use override price if it exists, otherwise use base product price
      const finalPrice = override ? override.price : productDoc.price;

      return {
        product: productDoc._id,
        quantity: item.quantity,
        price: finalPrice, // Snapshot the correct price for this specific customer
        customization: item.customization
      };
    });

    // Create the Order
    const newOrder: IOrderDocument = new Order({
      customer: user._id,
      address: addressSnapshot as IAddress,
      items: orderItems,
    });

    await newOrder.save({ session });

    // Atomic Inventory Deduction
    for (const item of orderItems) {
      const result = await Product.findOneAndUpdate(
        {
          _id: item.product,
          quantityAvailable: { $gte: item.quantity } // ONLY if enough stock exists
        },
        {
          $inc: { quantityAvailable: -item.quantity } // Deduct from available stock immediately
        },
        { session, new: true }
      );

      if (!result) {
        await session.abortTransaction();
        await session.endSession();
        return next(new AppError(`Product ${item.product} is out of stock`, StatusCodes.BAD_REQUEST));
      }
    }

    // Commit the transaction
    await session.commitTransaction();
    res.status(StatusCodes.CREATED).json(newOrder);
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    await session.endSession();
  }
};

/**
 * Get a single order by ID
 * @route GET /api/orders/:orderId
 */
export const getOrder: RequestHandler = async (req, res, next) => {
  const { Order } = req.tenantModels;
  const { orderId } = req.params;
}

/**
 * Update an order by ID
 * @route PUT /api/orders/:orderId
 */
export const updateOrder: RequestHandler = async (req, res, next) => {
  const { Order } = req.tenantModels;
  const { orderId } = req.params;
}

/**
 * Delete an order by ID
 * @param req
 * @param res
 * @param next
 */
export const deleteOrder: RequestHandler = async (req, res, next) => {
  const { Order } = req.tenantModels;
  const { orderId } = req.params;
}

/**
 * Get all orders
 * @route GET /api/orders
 * @filter {string} [search] - Search term to filter order by customer name, email, or phone
 * @filter {string} [status] - Filter by order status (e.g., 'pending', 'shipped', 'delivered')
 * @filter {string} [date] - Filter by order date (YYYY-MM-DD)
 * @filter {string} [shipped] - Filter by ship date (YYYY-MM-DD)
 * @filter {string} [paid] - Filter by paid date (YYYY-MM-DD)
 * @filter {string} [sortBy=customer] - Sort products by a specific field (e.g., customer, status)
 * @filter {number} [page=1] - Page number
 * @filter {number} [limit=10] - Number of orders per page
 */
export const getOrders: RequestHandler = async (req, res, next) => {
  // TODO: Implement pagination and filtering
  const { Order } = req.tenantModels;
  const { limit, page, skip } = parsePagination(req);

   // Build Query
    type queryType = {
      search?: string,
      status?: string,
      date?: Date,
      shipped?: Date,
      paid?: Date,
      sortBy?: string
    };
    const query: FilterQuery<IProduct> = {};
    const { search, status, date, shipped, paid, sortBy } = req.query as queryType
}

/**
 * Get all orders for a specific user
 * @route GET /api/orders/:userId
 * @permission read:orders
 */
export const getUserOrders: RequestHandler = async (req, res, next) => {
   // TODO: Implement pagination and filtering
   const { Order } = req.tenantModels;
   const { userId } = req.params;
   const { limit, page, skip } = parsePagination(req);
}
