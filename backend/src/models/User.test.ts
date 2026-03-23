import mongoose, { Types } from "mongoose";
import { describe, it, expect, beforeEach } from 'vitest';
import { getTenantModels } from "../types/tenantContext";
import { IUserDocument } from "./User.js";
import { AddressSubdocument } from "./Address.js";

const { User } = getTenantModels(mongoose.connection);

describe('User Model Logic', () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('Address Array Validation', () => {
    it('should fail if address names are not unique (case-insensitive and trimmed)', async () => {
      const user = new User({
        name: 'Dup Test',
        username: 'dup',
        sub: 'sub1',
        email: 'd@test.com',
        addresses: [
          { name: '  Home  ', street: '123 St', city: 'C', region: 'R', postalCode: '1' },
          { name: 'home', street: '456 St', city: 'C', region: 'R', postalCode: '2' },
          { name: 'Home', street: '789 St', city: 'C', region: 'R', postalCode: '3' },
          { name: ' HOME ', street: '987 St', city: 'C', region: 'R', postalCode: '4' }
        ]
      });

      try {
        await user.save();
        // If we reach this line, the test should fail because it didn't throw
        expect.fail('Should have thrown a validation error for duplicate address names');
      } catch (error: any) {
        expect(error.message).toContain('Each of your addresses must have a unique name');
        expect(error.name).toBe('ValidationError');
      }
    });

    it('should pass if address names are unique', async () => {
      const user = new User({
        name: 'Unique Test',
        username: 'unique',
        sub: 'sub2',
        email: 'u@test.com',
        addresses: [
          { name: 'Home', street: '123 St', city: 'C', region: 'R', postalCode: '1' },
          { name: 'Work', street: '456 St', city: 'C', region: 'R', postalCode: '2' }
        ]
      });

      const savedUser = await user.save();
      expect(savedUser).toBeDefined();
      expect(savedUser.addresses).toHaveLength(2);
    });
  });

  describe('pre-validate Hook (Primary Address Management)', () => {
    it('should clear primaryAddressId if addresses array is empty', async () => {
      const user = new User({
        name: 'Empty Test',
        username: 'empty',
        sub: 'sub3',
        email: 'e@test.com',
        primaryAddressId: new Types.ObjectId(), // Initial ID to be cleared
        addresses: []
      }) as IUserDocument;

      // Hits: if (!this.addresses || this.addresses.length === 0)
      await user.validate();
      expect(user.primaryAddressId).toBeUndefined();
    });

    it('should set primaryAddressId via _isPrimaryInput transient field', async () => {
      const user = new User({
        name: 'Input Test',
        username: 'input',
        sub: 'sub4',
        email: 'i@test.com',
        addresses: [
          { name: 'Home', street: 'S', city: 'C', region: 'R', postalCode: '1' },
          { name: 'Work', street: 'S', city: 'C', region: 'R', postalCode: '2' }
        ]
      }) as IUserDocument;

      // Manually set the transient field on the second address
      const work = user.addresses.at(1) as AddressSubdocument;
      work.isPrimary = true; // This sets _isPrimaryInput = true via the AddressSchema virtual

      // Hits: if (newPrimary)
      await user.validate();
      expect(user.primaryAddressId?.equals(work._id)).toBe(true);
    });

    it('should default to the first address if no primary is set', async () => {
      const user = new User({
        name: 'Default Test',
        username: 'default',
        sub: 'sub5',
        email: 'def@test.com',
        addresses: [
          { name: 'Home', street: 'S', city: 'C', region: 'R', postalCode: '1' },
          { name: 'Work', street: 'S', city: 'C', region: 'R', postalCode: '2' }
        ]
      }) as IUserDocument;

      // Hits: else if (!this.primaryAddressId || !this.addresses.id(this.primaryAddressId))
      await user.validate();

      const firstAddress = user.addresses.at(0) as AddressSubdocument;
      expect(user.primaryAddressId?.equals(firstAddress._id)).toBe(true);
    });

    it('should reset to first address if current primary ID no longer exists in array', async () => {
      const user = new User({
        name: 'Invalidate Test',
        username: 'inv',
        sub: 'sub6',
        email: 'inv@test.com',
        addresses: [
          { name: 'A', street: 'S', city: 'C', region: 'R', postalCode: '1' },
          { name: 'B', street: 'S', city: 'C', region: 'R', postalCode: '2' }
        ]
      }) as IUserDocument;

      await user.save();
      const firstAddr = user.addresses.at(0) as AddressSubdocument;
      const secondAddr = user.addresses.at(1) as AddressSubdocument;

      // Set primary to B
      user.primaryAddressId = secondAddr._id;
      await user.save();

      // Remove B from the array
      user.addresses.pull({ _id: secondAddr._id });

      // Hits: !this.addresses.id(this.primaryAddressId) branch
      await user.validate();
      expect(user.primaryAddressId?.equals(firstAddr._id)).toBe(true);
    });
  });

  describe('Virtual Metadata', () => {
    it('should have the "orders" virtual correctly configured', () => {
      // .virtualpath() is the type-safe way to get a virtual definition
      const virtual = User.schema.virtualpath('orders');

      // We cast to 'any' here because Mongoose's internal VirtualType
      // options are not always exported in the public TS types.
      const options = (virtual as any).options;

      expect(options.ref).toBe('Order');
      expect(options.localField).toBe('_id');
      expect(options.foreignField).toBe('customer');
      expect(options.justOne).toBe(false);
    });
  });
});
