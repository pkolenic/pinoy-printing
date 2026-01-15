import mongoose from "mongoose";
import startCase from "lodash.startcase";

export const AddressSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, lowercase: true },
  street: { type: String, required: true, trim: true, set: (v) => startCase(v) },
  street2: { type: String, required: false, trim: true, set: (v) => startCase(v) },
  city: { type: String, required: true, trim: true, set: (v) => startCase(v), index: true },
  region: { type: String, required: true, trim: true, set: (v) => startCase(v), index: true },
  postalCode: { type: String, required: true, trim: true, uppercase: true, index: true },
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

AddressSchema.virtual('isPrimary')
  .get(function () {
    const parent = this.parent();

    // 1. Safety check: Does the parent exist and have the primaryAddressId field?
    // This prevents issues when AddressSchema is used in OrderSchema or other models.
    if (!parent || !parent.primaryAddressId) {
      return false;
    }

    // 2. Standard comparison for User model
    return parent.primaryAddressId.equals(this._id);
  })
  .set(function (value) {
    // Store the incoming value in a temporary/transient property
    // Mongoose will not save this to the database.
    this._isPrimaryInput = value;
  });
