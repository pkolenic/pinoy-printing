import mongoose, { Schema } from "mongoose";
import { describe, it, expect, beforeEach } from 'vitest';
import { AddressSchema, AddressSubdocument } from "./Address.js";

// Create a dummy parent model to test subdocument behavior
const ParentSchema = new Schema({
  primaryAddressId: { type: Schema.Types.ObjectId },
  addresses: [AddressSchema]
});
const ParentModel = mongoose.model('AddressTestParent', ParentSchema);

// Create an alternative parent without the primaryAddressId field (for safety check branch)
const OtherParentSchema = new Schema({
  shipping: [AddressSchema]
});
const OtherParentModel = mongoose.model('AddressOtherParent', OtherParentSchema);

describe('Address Subdocument Logic', () => {
  beforeEach(async () => {
    await ParentModel.deleteMany({});
    await OtherParentModel.deleteMany({});
  });

  describe('Field Normalization (Setters)', () => {
    it('should correctly format strings using setters (StartCase, Trim, Uppercase)', async () => {
      const parent = new ParentModel({
        addresses: [{
          name: '  HOME  ',           // trim + lowercase
          street: '123 main st',      // startCase
          street2: 'apt 4b',          // startCase
          city: 'boise',              // startCase
          region: 'idaho',            // startCase
          postalCode: 'abc 123'       // uppercase
        }]
      });

      const addr = parent.addresses[0] as unknown as AddressSubdocument;

      expect(addr.name).toBe('home');
      expect(addr.street).toBe('123 Main St');
      expect(addr.street2).toBe('Apt 4 B');
      expect(addr.city).toBe('Boise');
      expect(addr.region).toBe('Idaho');
      expect(addr.postalCode).toBe('ABC 123');
    });

    it('should handle undefined values in setters gracefully', async () => {
      const parent = new ParentModel({
        addresses: [{
          name: 'Work',
          street: '123 Main St',
          city: 'Boise',
          region: 'ID',
          postalCode: '83702'
          // street2 is missing
        }]
      });

      const addr = parent.addresses[0] as unknown as AddressSubdocument;
      expect(addr.street2).toBeUndefined(); // Hits the (v: string | undefined) branch
    });
  });

  describe('isPrimary Virtual', () => {
    it('should return true when the address ID matches parent.primaryAddressId', async () => {
      const parent = new ParentModel({
        addresses: [{ name: 'Home', street: 'S', city: 'C', region: 'R', postalCode: '1' }]
      });

      const addr = parent.addresses[0] as unknown as AddressSubdocument;
      parent.primaryAddressId = addr._id;

      // Hits the getter branch: return parent.primaryAddressId.equals(this._id)
      expect(addr.isPrimary).toBe(true);
    });

    it('should return false when the address ID does not match parent.primaryAddressId', async () => {
      const parent = new ParentModel({
        addresses: [{ name: 'Home', street: 'S', city: 'C', region: 'R', postalCode: '1' }],
        primaryAddressId: new mongoose.Types.ObjectId() // Different ID
      });

      const addr = parent.addresses[0] as unknown as AddressSubdocument;
      expect(addr.isPrimary).toBe(false);
    });

    it('should set the transient _isPrimaryInput field via the setter', () => {
      const parent = new ParentModel({
        addresses: [{ name: 'Home', street: 'S', city: 'C', region: 'R', postalCode: '1' }]
      });

      const addr = parent.addresses[0] as unknown as AddressSubdocument;

      // Hits the setter: this._isPrimaryInput = value;
      addr.isPrimary = true;
      expect(addr._isPrimaryInput).toBe(true);
    });

    it('should return false if the parent is missing or lacks primaryAddressId field', () => {
      // Use the alternative parent model that doesn't have primaryAddressId
      const parent = new OtherParentModel({
        shipping: [{ name: 'Home', street: 'S', city: 'C', region: 'R', postalCode: '1' }]
      });

      const addr = parent.shipping[0] as unknown as AddressSubdocument;

      // Hits safety check: if (!parent || !parent.primaryAddressId)
      expect(addr.isPrimary).toBe(false);
    });
  });
});
