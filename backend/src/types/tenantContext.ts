import { Connection, Model } from 'mongoose';
import {
  IProduct,
  ProductSchema,
  ICategory,
  CategorySchema,
  ICustomerProductDocument,
  CustomerProductSchema,
  IOrder,
  OrderModel,
  OrderSchema,
  IUser,
  UserModel,
  UserSchema,
} from '../models/index.js';


// Define the shape of all available tenant models
export interface TenantModels {
  Category: Model<ICategory>;
  CustomerProduct: Model<ICustomerProductDocument>;
  Order: OrderModel;
  Product: Model<IProduct>;
  User: UserModel;

  [key: string]: Model<any>;
}

/**
 * Helper to get all models bound to a specific tenant connection.
 */
export const getTenantModels = (conn: Connection): TenantModels => {
  return {
    Category: conn.model<ICategory>('Category', CategorySchema),
    CustomerProduct: conn.model<ICustomerProductDocument>('CustomerProduct', CustomerProductSchema),
    Order: (conn.models.Order || conn.model<IOrder, OrderModel>('Order', OrderSchema)) as OrderModel,
    Product: conn.model<IProduct>('Product', ProductSchema),
    User: (conn.models.User || conn.model<IUser, UserModel>('User', UserSchema)) as UserModel,
  };
};
