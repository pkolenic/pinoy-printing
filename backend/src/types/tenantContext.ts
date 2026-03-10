import { Connection, Model } from 'mongoose';
import {
  IProduct,
  ProductSchema,
  ICategory,
  CategorySchema,
  ICustomerProductDocument,
  CustomerProductSchema,
  IOrderDocument,
  OrderSchema,
  IUserDocument,
  UserSchema,
} from '../models/index.js';


// Define the shape of all available tenant models
export interface TenantModels {
  Category: Model<ICategory>;
  CustomerProduct: Model<ICustomerProductDocument>;
  Order: Model<IOrderDocument>;
  Product: Model<IProduct>;
  User: Model<IUserDocument>;
  [key: string]: Model<any>;
}

/**
 * Helper to get all models bound to a specific tenant connection.
 */
export const getTenantModels = (conn: Connection): TenantModels => {
  return {
    Category: conn.model<ICategory>('Category', CategorySchema),
    CustomerProduct: conn.model<ICustomerProductDocument>('CustomerProduct', CustomerProductSchema),
    Order: conn.model<IOrderDocument>('Order', OrderSchema),
    Product: conn.model<IProduct>('Product', ProductSchema),
    User: conn.model<IUserDocument>('User', UserSchema),
  };
};
