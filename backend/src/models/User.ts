import mongoose, { Schema, Document, Types, Model } from "mongoose";
import { AddressSchema, AddressSubdocument, IAddress } from "./Address.js";

/**
 * Define the Interface for the User.
 * This includes database fields and virtuals
 */
export interface IUser {
  _id: Types.ObjectId;
  picture?: string;
  name: string;
  username: string;
  sub: string;
  email: string;
  phone?: string;
  // Use Types.DocumentArray to enable helper methods like .id()
  // addresses: Types.DocumentArray<AddressSubdocument>;
  addresses: IAddress[];
  primaryAddressId?: Types.ObjectId;
  role: 'customer' | 'staff' | 'owner' | 'admin';
  // Virtuals
  orders?: any[]; // Replace 'any' with your IOrder interface later
}

/**
 * Interface for Mongoose Documents
 */
export interface IUserDocument extends Omit<IUser, 'addresses'>, Document {
  addresses: Types.DocumentArray<AddressSubdocument>;
}

/**
 * Define the Mongoose Schema for the User Model.
 */
const UserSchema = new Schema<IUserDocument>({
  picture: {type: String, required: false},
  name: {type: String, required: true},
  username: {type: String, required: true},
  sub: {type: String, required: true},
  email: {type: String, required: true},
  phone: {type: String, required: false},
  addresses: {
    type: [AddressSchema],
    validate: {
      validator: function (addresses: IAddress[]) {
        const names: string[] = addresses.map((a: IAddress) => a.name.toLowerCase().trim());
        // If unique name count matches total count, there are no duplicates.
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
  toJSON: {virtuals: true},
  toObject: {virtuals: true},
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
UserSchema.pre('validate', function (this: IUserDocument, next: (err?: Error) => void): void {
  // If no addresses exist, clear the primary pointer
  if (!this.addresses || this.addresses.length === 0) {
    this.primaryAddressId = undefined;
    return next();
  }

  /**
   * Identifies the address explicitly marked as primary from the input payload.
   * Uses the virtual/transient `_isPrimaryInput` field.
   */
  const newPrimary: AddressSubdocument | undefined = this.addresses.find((addr: AddressSubdocument): boolean => addr._isPrimaryInput === true);

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

// Use Model<IUser> for the export
export const User: Model<IUserDocument> = mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema);

/**
 * Role Mapping
 * Added 'as string' to handle potential undefined env variables
 */
export const UserRole: Record<string, string | undefined> = {
  'admin': process.env.AUTH0_ADMIN_ROLE_ID,
  'customer': process.env.AUTH0_CUSTOMER_ROLE_ID,
  'owner': process.env.AUTH0_OWNER_ROLE_ID,
  'staff': process.env.AUTH0_STAFF_ROLE_ID,
};
