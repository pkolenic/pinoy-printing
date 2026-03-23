import mongoose, { Types } from "mongoose";
import {
  describe,
  it,
  vi,
  expect,
  beforeEach,
} from 'vitest'
import {
  getRelatedCategoryIds,
  resolveCategory,
} from "./Category";

import { getTenantModels } from "../types/tenantContext";

// Create the model for the test
const { Category } = getTenantModels(mongoose.connection);

describe('Category Model', () => {
  describe('Basic Creation & Path Logic', () => {
    beforeEach(async () => {
      await Category.deleteMany({});
    });

    it('should correctly set the path for a root category', async () => {
      const cat = new Category({ name: 'Electronics' });
      await cat.save();

      expect(cat.slug).toBe('electronics');
      expect(cat.path).toBe('electronics');
    });

    it('should correctly set the path for a child category', async () => {
      const parent = new Category({ name: 'Electronics' });
      await parent.save();

      const child = new Category({
        name: 'Phones',
        parent: parent._id,
      });
      await child.save();

      expect(child.slug).toBe('phones');
      expect(child.path).toBe('electronics/phones');
    });

    it('should correctly set the path for a grandchild category', async () => {
      const parent = new Category({ name: 'Electronics' });
      await parent.save();

      const child = new Category({
        name: 'Phones',
        parent: parent._id,
      });
      await child.save();

      const grandchild = new Category({
        name: 'Motorola',
        parent: child._id,
      });
      await grandchild.save();

      expect(grandchild.slug).toBe('motorola');
      expect(grandchild.path).toBe('electronics/phones/motorola');
    });

    it('should fallback to slug as path if the assigned parent does not exist', async () => {
      const ghostId = new Types.ObjectId();
      const cat = new Category({ name: 'Ghost Child', parent: ghostId });

      await cat.save();

      // Hits the 'this.slug' branch because parentDoc is null
      expect(cat.path).toBe('ghost-child');
    });
  });

  describe('Hierarchy Updates & Rebasing', () => {
    beforeEach(async () => {
      await Category.deleteMany({});
    });

    it('should update child paths when a parent is renamed', async () => {
      const parent = new Category({ name: 'Old Name' });
      await parent.save();

      const child = new Category({
        name: 'Child',
        parent: parent._id,
      });
      await child.save();

      // Rename the parent
      parent.name = 'New Name';
      await parent.save();

      // Re-fetch child to check the updated path
      const updatedChild = await Category.findById(child._id);
      expect(updatedChild?.path).toBe('new-name/child');
    });

    it('should update multi-generational descendant paths with a parent is renamed', async () => {
      const parent = new Category({ name: 'Old Name' });
      await parent.save();

      const child = new Category({
        name: 'Child',
        parent: parent._id,
      });
      await child.save();

      const grandchild = new Category({
        name: 'Grandchild',
        parent: child._id,
      });
      await grandchild.save();

      // Rename the parent
      parent.name = 'New Name';
      await parent.save();

      // Re-fetch grandchild to check the updated path
      const updatedGrandchild = await Category.findById(grandchild._id);
      expect(updatedGrandchild?.path).toBe('new-name/child/grandchild');
    });

    it('should update child paths when a middle category is renamed', async () => {
      const root = await new Category({ name: 'Electronics' }).save();
      const middle = await new Category({ name: 'Phones', parent: root._id }).save();
      const leaf = await new Category({ name: 'iPhone', parent: middle._id }).save();

      // Rename "Phones" to "Mobile"
      middle.name = 'Mobile';
      await middle.save();

      const updatedLeaf = await Category.findById(leaf._id);
      expect(updatedLeaf?.path).toBe('electronics/mobile/iphone');
    });

    it('should update descendant paths with a parent is moved to a new branch', async () => {
      const electronics = new Category({ name: 'Electronics' });
      await electronics.save();

      const mobiles = new Category({ name: 'Mobile Devices' });
      await mobiles.save();

      const phones = new Category({
        name: 'Phones',
        parent: electronics._id,
      })
      await phones.save();

      const motorola = new Category({
        name: 'Motorola',
        parent: phones._id,
      })
      await motorola.save();

      // Move Phones under Mobile Devices
      phones.parent = mobiles._id;
      await phones.save();

      // Re-fetch motorola to check the updated path
      const updatedMotorola = await Category.findById(motorola._id);
      expect(updatedMotorola?.path).toBe('mobile-devices/phones/motorola');
    });

    it('should update path when a root category becomes a child', async () => {
      const electronics = await new Category({ name: 'Electronics' }).save();
      const gadgets = await new Category({ name: 'Gadgets' }).save();

      // Move Gadgets to be a child of Electronics
      gadgets.parent = electronics._id;
      await gadgets.save();

      expect(gadgets.path).toBe('electronics/gadgets');
    });

    it('should update path when a child category becomes a root category', async () => {
      const root = await new Category({ name: 'Root' }).save();
      const child = await new Category({ name: 'Child', parent: root._id }).save();

      // Move child to root
      child.parent = null;
      await child.save();

      expect(child.path).toBe('child');
    });

    it('should skip path generation if no hierarchy-related fields are modified', async () => {
      const cat = await new Category({ name: 'Stay The Same' }).save();
      const pathBefore = cat.path;

      // We save without changing name, slug, or parent
      // We use a "dummy" change or just call save()
      await cat.save();

      expect(cat.path).toBe(pathBefore);
    });

    it('should skip post-save rebase for new categories', async () => {
      const cat = new Category({ name: 'New Root' });

      // This triggers post-save where oldPathPrefix is undefined
      await cat.save();

      expect(cat._originalPath).toBeUndefined();
    });

    it('should capture original path and regenerate hierarchy when the slug is manually modified', async () => {
      const cat = await new Category({ name: 'Original' }).save();
      const oldPath = cat.path;

      cat.slug = 'manual-slug';
      await cat.save();

      expect(cat._originalPath).toBe(oldPath);
      expect(cat.path).toBe('manual-slug');
    });
  })

  describe('Validation & Safety', () => {
    beforeEach(async () => {
      await Category.deleteMany({});
    });

    it('should fail if a category is set as its own parent', async () => {
      const category = await new Category({ name: 'Self Parent' }).save();
      category.parent = category._id;

      try {
        await category.save();
        expect.fail('Should have thrown an error for self-parenting');
      } catch (error: any) {
        expect(error.message).toBe('A category cannot be its own parent.');
      }
    });

    it('should fail if a category is moved under one of its own descendants (Circular Loop)', async () => {
      // 1. Setup: Parent -> Child -> Grandchild
      const parent = await new Category({ name: 'Parent' }).save();
      const child = await new Category({ name: 'Child', parent: parent._id }).save();
      const grandchild = await new Category({ name: 'Grandchild', parent: child._id }).save();

      // 2. Attempt to move Parent under Grandchild (Circular!)
      parent.parent = grandchild._id;

      try {
        await parent.save();
        expect.fail('Should have thrown an error for circular dependency');
      } catch (error: any) {
        expect(error.message).toContain('Circular dependency detected');
      }
    });

    it('should enforce unique slug constraint per parent level', async () => {
      const parent = await new Category({ name: 'Parent' }).save();
      await new Category({ name: 'Unique', parent: parent._id }).save();

      const duplicate = new Category({ name: 'Unique', parent: parent._id });

      try {
        await duplicate.save();
        expect.fail('Should have thrown an error for duplicate slug/parent combination');
      } catch (error: any) {
        // Mongoose unique index errors usually have code 11000
        expect(error.code).toBe(11000);
        expect(error.message).toContain('duplicate key error');
      }
    });

    it('should handle the case where the old document is missing during pre-save hook', async () => {
      // 1. Create a category so we have a valid document instance
      const cat = await new Category({ name: 'Mock Test' }).save();

      // 2. Mock Category.findById just once to return null
      // This forces the "if (oldDoc)" branch in your hook to be false
      const findSpy = vi.spyOn(Category, 'findById').mockReturnValue({
        select: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(null),
      } as any);

      cat.name = 'Trigger Hook';

      // 3. Save the document. It won't fail because the actual doc STILL EXISTS in the DB.
      // Only the internal hook's 'findById' call will see the 'null'.
      await cat.save();

      expect(cat._originalPath).toBeUndefined();

      // Clean up the spy
      findSpy.mockRestore();
    });
  })

  describe('Deletion Handling', () => {
    beforeEach(async () => {
      await Category.deleteMany({});
    });

    it('should skip re-parenting logic when deleting a leaf category with no children', async () => {
      const parent = await new Category({ name: 'Parent' }).save();
      const leaf = await new Category({ name: 'Leaf', parent: parent._id }).save();

      // Hits the 'if (children.length > 0)' branch as FALSE
      const result = await leaf.deleteOne();

      expect(result).toBeDefined();

      // Ensure the parent was not affected
      const parentStillExists = await Category.findById(parent._id);
      expect(parentStillExists).toBeDefined();

      // Ensure the leaf is gone
      const deletedCheck = await Category.findById(leaf._id);
      expect(deletedCheck).toBeNull();
    });

    it('should re-parent direct children and update paths when a parent is deleted', async () => {
      const parent = await new Category({ name: 'Parent' }).save();
      const child = await new Category({ name: 'Child', parent: parent._id }).save();

      // Delete the parent
      await parent.deleteOne();

      // Re-fetch the child to check it moved to root and regenerated its path
      const updatedChild = await Category.findById(child._id);
      expect(updatedChild?.parent).toBeNull();
      expect(updatedChild?.path).toBe('child');
    });

    it('should recursively update multi-generational descendant paths when a grandparent is deleted', async () => {
      const grandparent = await new Category({ name: 'Grandparent' }).save();
      const parent = await new Category({ name: 'Parent', parent: grandparent._id }).save();
      const child = await new Category({ name: 'Child', parent: parent._id }).save();

      // Delete the parent. Child should now point to GrandParent.
      await parent.deleteOne();

      const updatedChild = await Category.findById(child._id);

      // Verification: Child moves up to Grandparent
      expect(updatedChild?.parent?.equals(grandparent._id)).toBe(true);
      expect(updatedChild?.path).toBe('grandparent/child');
    });
  })
});

describe('Category Utilities', () => {
  describe('getRelatedCategoryIds', () => {
    beforeEach(async () => {
      await Category.deleteMany({});
    });

    it('should return only the parent ID if it has no children', async () => {
      const category = await new Category({ name: 'Standalone' }).save();
      const ids = await getRelatedCategoryIds(Category, 'standalone');

      expect(ids).toHaveLength(1);
      expect(ids[0].equals(category._id)).toBe(true);
    });

    it('should return the parent and all descendant IDs in a branch, excluding siblings', async () => {
      // Setup: Electronics > Phones > iPhone
      const root = await new Category({ name: 'Electronics' }).save();
      const middle = await new Category({ name: 'Phones', parent: root._id }).save();
      const leaf = await new Category({ name: 'iPhone', parent: middle._id }).save();

      // Create a sibling that SHOULD NOT be included (e.g., Computers)
      const sibling = await new Category({ name: 'Computers', parent: root._id }).save();

      // Query for the middle category "Electronics/Phones"
      const ids = await getRelatedCategoryIds(Category, 'electronics/phones');

      expect(ids).toHaveLength(2); // Should include Phones and iPhone
      expect(ids.some(id => id.equals(middle._id))).toBe(true);
      expect(ids.some(id => id.equals(leaf._id))).toBe(true);
      expect(ids.some(id => id.equals(root._id))).toBe(false);
      expect(ids.some(id => id.equals(sibling._id))).toBe(false);
    });

    it('should return all generations (root, child, grandchild) when querying root', async () => {
      const root = await new Category({ name: 'Root' }).save();
      const child = await new Category({ name: 'Child', parent: root._id }).save();
      const grandchild = await new Category({ name: 'Grandchild', parent: child._id }).save();

      const ids = await getRelatedCategoryIds(Category, 'root');

      expect(ids).toHaveLength(3);
      expect(ids.some(id => id.equals(root._id))).toBe(true);
      expect(ids.some(id => id.equals(child._id))).toBe(true);
      expect(ids.some(id => id.equals(grandchild._id))).toBe(true);
    });

    it('should handle special characters in the paths safely', async () => {
      // Setup: A path with regex special characters like "+"
      const category = await new Category({ name: 'C++ Programming' }).save();
      const subCategory = await new Category({ name: 'Standard Library', parent: category._id }).save();

      const ids = await getRelatedCategoryIds(Category, 'c-programming');

      expect(ids).toHaveLength(2);
      expect(ids.some(id => id.equals(subCategory._id))).toBe(true);
    });

    it('should return an empty array for non-existent, empty, or malformed paths', async () => {
      await new Category({ name: 'Standalone' }).save();

      expect(await getRelatedCategoryIds(Category, 'non-existent-path')).toEqual([]);
      expect(await getRelatedCategoryIds(Category, '')).toEqual([]);
      expect(await getRelatedCategoryIds(Category, '/')).toEqual([]);
    });

    it('should distinguish between similar branches (Mens/Shoes vs Womens/Shoes)', async () => {
      const mens = await new Category({ name: 'Mens' }).save();
      const mensShoes = await new Category({ name: 'Shoes', parent: mens._id }).save();

      const womens = await new Category({ name: 'Womens' }).save();
      const womensShoes = await new Category({ name: 'Shoes', parent: womens._id }).save();

      // Query for "Mens/Shoes"
      const ids = await getRelatedCategoryIds(Category, 'mens/shoes');

      expect(ids).toHaveLength(1);
      expect(ids[0].equals(mensShoes._id)).toBe(true);
      expect(ids.some(id => id.equals(womensShoes._id))).toBe(false);
    });

    it('should correctly anchor the path to prevent substring matches (Corn vs Cornflakes)', async () => {
      const groceries = await new Category({ name: 'Groceries' }).save();
      const corn = await new Category({ name: 'Corn', parent: groceries._id }).save();
      const cornflakes = await new Category({ name: 'Cornflakes', parent: groceries._id }).save();

      // Query for "Groceries/Corn"
      const ids = await getRelatedCategoryIds(Category, 'groceries/corn');

      expect(ids).toHaveLength(1);
      expect(ids[0].equals(corn._id)).toBe(true);
      expect(ids.some(id => id.equals(cornflakes._id))).toBe(false);
    })

    it('should not match a sibling path that starts with the same string (Pro vs Products)', async () => {
      // Setup: /pro vs /products
      const root = await new Category({ name: 'Pro' }).save(); // path: 'pro'
      const rootChild = await new Category({ name: 'Tools', parent: root._id }).save(); // path: 'pro/tools'

      const otherRoot = await new Category({ name: 'Products' }).save(); // path: 'products'
      const otherChild = await new Category({ name: 'Tools', parent: otherRoot._id }).save(); // path: 'products/tools'

      // Query for "pro"
      const ids = await getRelatedCategoryIds(Category, 'pro');

      expect(ids).toHaveLength(2);
      expect(ids.some(id => id.equals(root._id))).toBe(true);
      expect(ids.some(id => id.equals(rootChild._id))).toBe(true);
      // Critical check for (\/|$) regex logic
      expect(ids.some(id => id.equals(otherRoot._id))).toBe(false);
      expect(ids.some(id => id.equals(otherChild._id))).toBe(false);
    });
  });

  describe('resolveCategory', () => {
    beforeEach(async () => {
      await Category.deleteMany({});
    });

    it('should resolve a category by its ObjectID string', async () => {
      const category = await new Category({ name: 'Find Me' }).save();
      const resolvedId = await resolveCategory(Category, category._id.toString());

      expect(resolvedId?.equals(category._id)).toBe(true);
    });

    it('should resolve a category by its Path string (case-insensitive)', async () => {
      const root = await new Category({ name: 'Electronics' }).save();
      const child = await new Category({ name: 'Audio', parent: root._id }).save();

      const resolvedId = await resolveCategory(Category, 'ELECTRONICS/AUDIO');

      expect(resolvedId?.equals(child._id)).toBe(true);
    });

    it('should resolve paths using various delimiters (">", "+", "//") and extra spaces', async () => {
      const root = await new Category({ name: 'Men' }).save();
      const child = await new Category({ name: 'Shoes', parent: root._id }).save();

      // Simulate a CSV user using various delimiters
      const results = await Promise.all([
        resolveCategory(Category, 'Men > Shoes'),
        resolveCategory(Category, 'Men + Shoes'),
        resolveCategory(Category, ' Men // Shoes ')
      ]);

      results.forEach(res => expect(res?.equals(child._id)).toBe(true));
    });

    it('should resolve a category whose slug looks exactly like an ObjectId', async () => {
      // A string that is a valid 24-char hex ObjectId
      const fakeId = new Types.ObjectId().toString();
      const category = await new Category({ name: fakeId }).save();

      // The utility should find it via the 'path' field even though isId is true
      const resolvedId = await resolveCategory(Category, fakeId);
      expect(resolvedId?.equals(category._id)).toBe(true);
    });

    it('should prioritize actual ObjectId match over a path match (Collision Handling)', async () => {
      const collisionId = new Types.ObjectId();
      const catA = await new Category({ _id: collisionId, name: 'Real ID' }).save();
      await new Category({ name: collisionId.toString() }).save(); // Cat B has this as a slug

      const resolvedId = await resolveCategory(Category, collisionId.toString());

      // Matches Cat A via the _id check in the $or array
      expect(resolvedId?.equals(catA._id)).toBe(true);
    });

    it('should slugify individual segments of a human-provided path', async () => {
      const cat = await new Category({ name: 'Plain Path' }).save(); // path: 'plain-path'

      // 'Plain Path' -> 'plain-path'
      const result = await resolveCategory(Category, 'Plain Path');

      expect(result).not.toBeNull();
      expect(result?.equals(cat._id)).toBe(true);
    });

    it('should handle complex human-entered paths with mixed casing and spaces', async () => {
      const root = await new Category({ name: 'Electronics' }).save();
      const child = await new Category({ name: 'Cell Phones', parent: root._id }).save();

      // 'Electronics > Cell Phones' -> 'electronics/cell-phones'
      const result = await resolveCategory(Category, 'Electronics > Cell Phones');

      expect(result?.equals(child._id)).toBe(true);
    });

    it('should return null for non-matching, empty, or whitespace strings', async () => {
      expect(await resolveCategory(Category, 'fake/path')).toBeNull();
      expect(await resolveCategory(Category, new Types.ObjectId().toString())).toBeNull();
      expect(await resolveCategory(Category, '')).toBeNull();
      expect(await resolveCategory(Category, '   ')).toBeNull();
    });
  });
});
