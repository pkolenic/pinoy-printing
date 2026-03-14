import {
  Schema,
  HydratedDocument,
  Types,
} from "mongoose";

/**
 * Define the Interface for the CustomerProduct.
 * This includes database fields and virtuals
 */
export interface ICustomerProduct {
  product: Types.ObjectId;
  customer: Types.ObjectId;
  price: number;
}

/**
 * Hydrated Interface (Mongoose Document)
 * Used for active document instances and model methods.
 */
export type ICustomerProductDocument = HydratedDocument<ICustomerProduct>;


/**
 * Define the Mongoose Schema for the CustomerProduct Model.
 */
export const CustomerProductSchema = new Schema<ICustomerProductDocument>({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  price: { type: Number, required: true },
});
