import {
  Schema,
  Document,
  Types
} from "mongoose";
import startCase from "lodash.startcase";

/**
 * Define the Interface for the Address Document.
 * This includes database fields, virtuals, and transient properties.
 */
export interface IAddress {
  _id: Types.ObjectId;
  name: string;
  street: string;
  street2?: string;
  city: string;
  region: string;
  postalCode: string;
  // Virtuals and transient properties
  isPrimary: boolean;
  _isPrimaryInput?: boolean;
}

/**
 * Hydrated Subdocument Type
 * Used when the Address is accessed through a Mongoose Document.
 */
export type AddressSubdocument = IAddress & Types.Subdocument;

/**
 * Schema Definition
 * We use IAddress here. Mongoose will automatically upgrade
 * this to AddressSubdocument when embedded in a parent Document.
 */
export const AddressSchema = new Schema<IAddress>({
  name: {type: String, required: true, trim: true, lowercase: true},
  street: {type: String, required: true, trim: true, set: (v: string | undefined) => startCase(v)},
  street2: {type: String, required: false, trim: true, set: (v: string | undefined) => startCase(v)},
  city: {type: String, required: true, trim: true, set: (v: string | undefined) => startCase(v), index: true},
  region: {type: String, required: true, trim: true, set: (v: string | undefined) => startCase(v), index: true},
  postalCode: {type: String, required: true, trim: true, uppercase: true, index: true},
}, {
  toJSON: {virtuals: true},
  toObject: {virtuals: true}
});

/**
 * Define Virtuals for the Address Model.
 * Using 'this' inside the getter/setter requires it to be typed as the Document.
 */
AddressSchema.virtual('isPrimary')
  .get(function (this: AddressSubdocument) {
    // Typing as AddressSubdocument gives access to .parent()
    const parent = this.parent() as any;

    // Safety check: Does the parent exist and have the primaryAddressId field?
    // This prevents issues when AddressSchema is not used in a UserSchema such as OrderSchema or other models.
    if (!parent || !parent.primaryAddressId) {
      return false;
    }

    // Use .equals() for ObjectId comparison
    return parent.primaryAddressId.equals(this._id);
  })
  .set(function (this: AddressSubdocument, value: boolean) {
    // This transient property helps logic in the parent's pre-save hooks
    this._isPrimaryInput = value;
  });
