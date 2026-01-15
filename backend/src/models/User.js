import mongoose from "mongoose";
import { AddressSchema } from "./Address.js";
import './Order.js';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sub: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: false },
  addresses: {
    type: [AddressSchema],
    validate: {
      validator: function (addresses) {
        const names = addresses.map(a => a.name.toLowerCase().trim());
        // Logic: If unique name count matches total count, there are no duplicates.
        return names.length === new Set(names).size;
      },
      message: 'Each of your addresses must have a unique name (e.g., "Home", "Work").'
    }
  },
  primaryAddressId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
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

UserSchema.virtual('orders', {
  ref: 'Order',
  localField: '_id',
  foreignField: 'customer',
  justOne: false,
});

// UserSchema.pre('save', function (next) {
//   const addresses = this.get('addresses');
//   const currentPrimary = this.get('primaryAddressId');
//
//   if (addresses && addresses.length > 0 && !currentPrimary) {
//     this.set('primaryAddressId', addresses[0]._id);
//   }
//   next();
// });

UserSchema.pre('validate', function (next) {
  // If no addresses exist, clear the primary pointer
  if (!this.addresses || this.addresses.length === 0) {
    this.primaryAddressId = undefined;
    return next();
  }

  // 1. Check if the user is explicitly setting a new primary via the isPrimary flag
  // Note: We use the virtual/transient 'isPrimary' field from the payload
  const newPrimary = this.addresses.find(addr => addr._isPrimaryInput === true);

  if (newPrimary) {
    this.primaryAddressId = newPrimary._id;
  }
  // 2. If no address is marked primary, but the current primaryAddressId is missing or invalid
  else if (!this.primaryAddressId || !this.addresses.id(this.primaryAddressId)) {
    // Default to the first address in the array
    this.primaryAddressId = this.addresses[0]._id;
  }

  next();
});

export default mongoose.models.User || mongoose.model('User', UserSchema);

export const UserRole = {
  'admin': process.env.AUTH0_ADMIN_ROLE_ID,
  'customer': process.env.AUTH0_CUSTOMER_ROLE_ID,
  'owner': process.env.AUTH0_OWNER_ROLE_ID,
  'staff': process.env.AUTH0_STAFF_ROLE_ID,
}
