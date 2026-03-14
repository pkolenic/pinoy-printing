import {
  Model,
  Schema,
  HydratedDocument,
  Types,
} from "mongoose";
import { AddressSchema, AddressSubdocument, IAddress } from "./Address.js";
import { IOrder } from "./Order.js";

/**
 * Define the Interface for the User.
 * This includes database fields and virtuals
 */
export interface IUser {
  picture?: string;
  name: string;
  username: string;
  sub: string;
  email: string;
  phone?: string;
  addresses: IAddress[];
  primaryAddressId?: Types.ObjectId;
  role: 'customer' | 'staff' | 'owner' | 'admin';
}

/**
 * Interface for Mongoose Documents
 * This is used to define methods that can be accessed on the User model.
 */
interface IUserOverrides {
  addresses: Types.DocumentArray<AddressSubdocument>;
  // Represents the array of Orders when .populate('orders') is called
  orders?: IOrder[];
}

/**
 * Interface for Mongoose Documents
 */
export type IUserDocument = HydratedDocument<IUser, IUserOverrides>;

export type UserModel = Model<IUser, {}, {}, {}, IUserDocument>;

/**
 * Define the Mongoose Schema for the User Model.
 */
export const UserSchema = new Schema<IUser, UserModel>({
  picture: { type: String, required: false },
  name: { type: String, required: true },
  username: { type: String, required: true },
  sub: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: false },
  addresses: {
    type: [AddressSchema],
    validate: {
      validator: function (addresses: IAddress[]) {
        const names: string[] = addresses.map((a: IAddress) => a.name.toLowerCase().trim());
        // If the unique name count matches the total count, there are no duplicates.
        const uniqueNames: Set<string> = new Set(names);
        return names.length === uniqueNames.size;
      },
      message: 'Each of your addresses must have a unique name (e.g., "Home", "Work").'
    }
  },
  primaryAddressId: {
    type: Schema.Types.ObjectId,
    required: false,
    ref: 'Address' // Optional, helpful for populating
  },
  role: {
    type: String,
    required: true,
    default: 'customer',
    enum: ['customer', 'staff', 'owner', 'admin'],
  },
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Virtual for Orders
UserSchema.virtual('orders', {
  ref: 'Order',
  localField: '_id',
  foreignField: 'customer',
  justOne: false,
});

/**
 * Pre-validate Middleware
 * 'this' is typed as the User Document
 */
UserSchema.pre('validate', function (this: IUserDocument, next) {
  // If no addresses exist, clear the primary pointer
  if (!this.addresses || this.addresses.length === 0) {
    this.primaryAddressId = undefined;
    return next();
  }

  /**
   * Identifies the address explicitly marked as primary from the input payload.
   * Uses the virtual/transient `_isPrimaryInput` field.
   */
  const newPrimary = this.addresses.find(addr => addr._isPrimaryInput === true);

  if (newPrimary) {
    // Update the pointer to the new primary address subdocument
    this.primaryAddressId = newPrimary._id;
  }

  // If no primary address is set, or the current ID is no longer valid
  else if (!this.primaryAddressId || !this.addresses.id(this.primaryAddressId)) {
    const firstAddress: AddressSubdocument = this.addresses[0];
    // Default the pointer to the first address in the array
    this.primaryAddressId = firstAddress._id;
  }

  next();
});
