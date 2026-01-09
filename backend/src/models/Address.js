import mongoose from "mongoose";
import startCase from "lodash.startcase";

export const AddressSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, lowercase: true },
  street: { type: String, required: true, trim: true, set: (v) => startCase(v) },
  street2: { type: String, required: false, trim: true, set: (v) => startCase(v) },
  city: { type: String, required: true, trim: true, set: (v) => startCase(v), index: true },
  region: { type: String, required: true, trim: true, set: (v) => startCase(v), index: true },
  postalCode: { type: String, required: true, trim: true, uppercase: true, index: true },
});
