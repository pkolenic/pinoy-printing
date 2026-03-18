import mongoose, { Types } from "mongoose";
import { describe, it, expect, beforeEach } from 'vitest';
import { getTenantModels } from "../types/tenantContext";
import { getCommitedStock, IOrderDocument } from "./Order.js";

const { Order, User } = getTenantModels(mongoose.connection);

describe('Order Model Logic', () => {
  let customerId: Types.ObjectId;
  let productId: Types.ObjectId;

  beforeEach(async () => {
    await Order.deleteMany({});
    await User.deleteMany({});

    const user = await new User({ name: 'Buyer', username: 'buyer', sub: 's1', email: 'b@t.com' }).save();
    customerId = user._id as Types.ObjectId;
    productId = new Types.ObjectId();
  });

  describe('Calculations & Virtuals', () => {
    it('should correctly calculate the order total via method and virtual', async () => {
      const order = new Order({
        customer: customerId,
        address: { name: 'Home', street: '123 St', city: 'C', region: 'R', postalCode: '1' },
        items: [
          { product: productId, name: 'Item 1', price: 10, quantity: 2 },
          { product: new Types.ObjectId(), name: 'Item 2', price: 5, quantity: 3 }
        ]
      }) as IOrderDocument;

      // Logic: (10 * 2) + (5 * 3) = 35
      expect(order.calculateTotal()).toBe(35);
      expect(order.orderTotal).toBe(35); // Now recognized by TS
    });

    it('should return 0 for total if there are no items', () => {
      const order = new Order({ items: [] }) as IOrderDocument;
      expect(order.calculateTotal()).toBe(0);
    });
  });

  describe('JSON Transformation', () => {
    it('should remove "isPrimary" from the address when converted to JSON', async () => {
      const order = new Order({
        customer: customerId,
        address: { name: 'Home', street: '123 St', city: 'C', region: 'R', postalCode: '1' },
        items: [{ product: productId, name: 'T', price: 1, quantity: 1 }]
      });

      await order.save();
      const json = order.toJSON() as any;

      // Hits the transform: if (ret.address) { delete ret.address.isPrimary; }
      expect(json.address.isPrimary).toBeUndefined();
    });

    it('should skip transformation if address is missing', () => {
      // This is an edge case to hit the "if (ret.address)" branch's 'else' (implicit)
      const order = new Order({ customer: customerId });
      const json = order.toJSON();
      expect(json.address).toBeUndefined();
    });
  });

  describe('getCommitedStock Aggregation', () => {
    it('should sum quantity across multiple active orders and ignore inactive ones', async () => {
      const address = { name: 'H', street: 'S', city: 'C', region: 'R', postalCode: '1' };

      // 1. Active: 5 units
      await new Order({
        customer: customerId, status: 'pending', address,
        items: [{ product: productId, name: 'T', price: 1, quantity: 5 }]
      }).save();

      // 2. Active (multiple items in one order): 3 units of the target product
      await new Order({
        customer: customerId, status: 'processing', address,
        items: [
          { product: productId, name: 'T', price: 1, quantity: 3 },
          { product: new Types.ObjectId(), name: 'Other', price: 1, quantity: 10 }
        ]
      }).save();

      // 3. Inactive: 10 units (Should be ignored)
      await new Order({
        customer: customerId, status: 'shipped', address,
        items: [{ product: productId, name: 'T', price: 1, quantity: 10 }]
      }).save();

      const committed = await getCommitedStock(Order, productId);
      expect(committed).toBe(8); // 5 + 3
    });

    it('should return 0 if no orders exist or none match the productId', async () => {
      const committed = await getCommitedStock(Order, productId);
      expect(committed).toBe(0);
    });
  });
});
