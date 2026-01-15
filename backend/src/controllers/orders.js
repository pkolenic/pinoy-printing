import Order from '../models/Order.js';

export const createOrder = async (req, res, next) => {
  try {
    const { user } = req;

    // Pick the address: either from request or user's first address
    const selectedAddress = req.address || user.addresses.id(user.primaryAddressId) || user.addresses[0];

    if (!selectedAddress) {
      return res.status(400).json({ message: 'Shipping address is required' });
    }

    // Convert Shipping Address to a plain object and delete the _id so the Order gets its own unique ID for this address
    const shippingAddress = selectedAddress.toObject();
    delete shippingAddress._id;

    const newOrder = new Order({
      customer: user._id,
      address: shippingAddress,
      items: req.body.items || []
    });

    await newOrder.save();

    return res.status(201).json(newOrder);
  } catch (error) {
    return next(error);
  }
}
