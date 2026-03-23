import {
  Schema,
  Model,
  Document,
  HydratedDocument,
  Types,
} from "mongoose";
import { AddressSchema, IAddress } from "./Address.js";
import {
  IOrderItem,
  OrderItemSchema,
  OrderItemSubdocument
} from "./OrderItem.js";

/**
 * Define the Interface for the Order.
 * This includes database fields and virtuals
 */
export interface IOrder {
  customer: Types.ObjectId;
  items: IOrderItem[];
  address: IAddress;
  status: 'pending' | 'processing' | 'shipped' | 'cancelled';
  paid?: Date;
  shipped?: Date;
}

/**
 * Define the Interface for Order Methods.
 * This is used to define methods that can be accessed on the Order model.
 */
export interface IOrderMethods {
  calculateTotal(): number;
}

/**
 * Interface for Mongoose Documents
 */
export type IOrderDocument = HydratedDocument<
  IOrder,
  IOrderMethods & {
  items: Types.DocumentArray<OrderItemSubdocument>
  orderTotal: number;
}
>;

/**
 * Define the Model type for use in static contexts
 */
export type OrderModel = Model<IOrder, {}, IOrderMethods, {}, IOrderDocument>;

export const ACTIVE_ORDER_STATUSES = ['pending', 'processing'];

/**
 * Define the Mongoose Schema for the Order Model.
 */
export const OrderSchema = new Schema<IOrder, OrderModel, IOrderMethods>({
  customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  items: [OrderItemSchema],
  address: {
    type: AddressSchema,
    required: [true, 'Shipping address is required']
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'cancelled'],
    default: 'pending',
  },
  paid: { type: Date, required: false },
  shipped: { type: Date, required: false },
}, {
  // Enable virtuals so that Order virtuals show
  toJSON: {
    virtuals: true,
    /**
     * Type-Safe Transform
     * Using explicit types for 'ret' ensures you don't delete properties blindly
     */
    transform: function (_doc: Document, ret: Record<string, any>) {
      if (ret.address) {
        // Remove the virtual isPrimary as it only makes sense in the User's address list
        delete ret.address.isPrimary;
      }
      return ret;
    }
  },
  toObject: { virtuals: true }
});

OrderSchema.virtual('orderTotal').get(function (this: IOrderDocument) {
  return this.calculateTotal();
});

OrderSchema.method('calculateTotal', function calculateTotal(this: IOrderDocument) {
  return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
});

export async function getCommitedStock(Order: OrderModel, productId: Types.ObjectId): Promise<number> {
  const result = await Order.aggregate([
    {
      $match: {
        // Active orders: Pending or Processing
        status: { $in: ACTIVE_ORDER_STATUSES },
        'items.product': productId
      }
    },
    { $unwind: '$items' },
    {
      $match: {
        'items.product': productId
      }
    },
    {
      $group: {
        _id: null,
        totalCommitted: { $sum: '$items.quantity' }
      }
    }
  ]);

  return result.length > 0 ? result[0].totalCommitted : 0;
}
