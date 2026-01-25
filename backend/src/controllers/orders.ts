import { RequestHandler } from "express";

import {
  Order,
  IOrderDocument,
  AddressSubdocument,
} from "../models/index.js";

import { AppError } from '../utils/errors/index.js';

/**
 * Create a new order
 * @route POST /api/orders/:userId/create
 */
export const createOrder: RequestHandler = async (req, res, next) => {
  try {
    const { user } = req;

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    /**
     * 1. Address Selection Logic
     * Prioritizes:
     *  a) An address attached by middleware (e.g., req. Address)
     *  b) The user's primary address
     *  c) The user's first available address
     */
    const selectedAddress = req.address || user.addresses.id(user.primaryAddressId!) || user.addresses[0];

    if (!selectedAddress) {
      return next(new AppError('Shipping address is required', 400));
    }

    /**
     * 2. Snapshot the Address
     * We convert the subdocument to a plain object and remove the _id and isPrimary properties.
     * This creates a permanent snapshot of the address at the time of order,
     * ensuring it doesn't change if the user updates their profile later.
     */
    const shippingAddress = (selectedAddress as AddressSubdocument).toObject();
    delete (shippingAddress as any)._id;
    delete (shippingAddress as any).isPrimary;

    // 3. Create the Order
    const newOrder: IOrderDocument = new Order({
      customer: user._id,
      address: shippingAddress,
      items: req.body.items || []
    });

    await newOrder.save();

    res.status(201).json(newOrder);
  } catch (error) {
    next(error);
  }
}
