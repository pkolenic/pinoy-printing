import { Schema, Types } from "mongoose";

/**
 * Define the Interface for the OrderItem.
 */
export interface IOrderItem {
    product: Types.ObjectId;
    quantity: number;
    price: number; // This is the price at the time of order
    customization?: Record<string, any>;
}

/**
 * Hydrated Subdocument Type
 * Used when the OrderItem is accessed through a Mongoose Document.
 */
export type OrderItemSubdocument = IOrderItem & Types.Subdocument;

/**
 * Schema Definition
 * We use IOrderItem here. Mongoose will automatically upgrade
 * this to OrderItemSubdocument when embedded in a parent Document.
 */
export const OrderItemSchema = new Schema<IOrderItem>({
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: {type: Number, required: true, min: [1, 'Quantity cannot be less than 1.']},
    price: {type: Number, required: true},
    customization: {type: Schema.Types.Mixed, required: false},
});
