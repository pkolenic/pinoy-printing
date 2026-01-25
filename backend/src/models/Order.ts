import mongoose, { Schema, Document, Types, Model } from "mongoose";
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
  _id: Types.ObjectId;
  customer: Types.ObjectId;
  items: IOrderItem[];
  address: IAddress;
  paid?: Date;
  shipped?: Date;
}

/**
 * Interface for Mongoose Documents
 */
export interface IOrderDocument extends Omit<IOrder, 'items'>, Document {
  items: Types.DocumentArray<OrderItemSubdocument>;
}

/**
 * Define the Mongoose Schema for the Order Model.
 */
export const OrderSchema = new Schema<IOrderDocument>({
  customer: {type: Schema.Types.ObjectId, ref: 'User', required: true},
  items: [OrderItemSchema],
  address: {
    type: AddressSchema,
    required: [true, 'Shipping address is required']
  },
  paid: {type: Date, required: false},
  shipped: {type: Date, required: false},
}, {
  // Enable virtuals so that Order virtuals show
  toJSON: {
    virtuals: true,
    /**
     * Type-Safe Transform
     * Using explicit types for 'ret' ensures you don't delete properties blindly
     */
    transform: function (doc: Document, ret: Record<string, any>) {
      if (ret.address) {
        // Remove the virtual isPrimary as it only makes sense in the User's address list
        delete ret.address.isPrimary;
      }
      return ret;
    }
  },
  toObject: {virtuals: true}
});

// User Model<IOrder> for the export
export const Order: Model<IOrderDocument> = mongoose.models.Order || mongoose.model<IOrderDocument>('Order', OrderSchema);
