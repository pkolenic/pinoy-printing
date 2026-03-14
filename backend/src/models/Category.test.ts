import mongoose, { Types } from "mongoose";
import { describe, it, expect } from 'vitest'
import {
  getRelatedCategoryIds,
  resolveCategory,
} from "./Category";

import { getTenantModels } from "../types/tenantContext";
// Create the model for the test
const { Category } = getTenantModels(mongoose.connection);

describe('Category Model Hooks', () => {
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

  it('should update descendant paths with a parent is renamed', async () => {
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

  it('should update descendant paths with a parent is deleted', async () => {
    const parent = new Category({ name: 'Parent' });
    await parent.save();

    const child = new Category({
      name: 'Child',
      parent: parent._id,
    })
    await child.save();

    // Delete the parent
    await parent.deleteOne();

    // Re-fetch child to check the updated path
    const updatedChild = await Category.findById(child._id);
    expect(updatedChild?.path).toBe('child');
  });

  it('should update multi-generational descendant paths with a parent is deleted', async () => {
    const parent = new Category({ name: 'Parent' });
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

    // Delete the parent
    await parent.deleteOne();

    // Re-fetch child to check the updated path
    const updatedGrandchild = await Category.findById(grandchild._id);
    expect(updatedGrandchild?.path).toBe('child/grandchild');
  });

  it('should delete a leaf category without affecting others', async () => {
    const parent = await new Category({ name: 'Parent' }).save();
    const child = await new Category({ name: 'Child', parent: parent._id }).save();

    await child.deleteOne();

    const stillExists = await Category.findById(parent._id);
    expect(stillExists).toBeDefined();
    const children = await Category.find({ parent: parent._id });
    expect(children.length).toBe(0);
  });

  it('should update descendant paths with a parent is moved', async () => {
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

  it('should fail if a category is set as its own parent', async () => {
    const category = new Category({ name: 'Self Parent' });
    await category.save();

    category.parent = category._id;

    // This should throw a validation error
    // noinspection ES6RedundantAwait
    await expect(() => category.save()).rejects.toThrow();
  });

  it('should fail if a category is moved under one of its own descendants', async () => {
    // 1. Setup: Parent -> Child -> Grandchild
    const parent = new Category({ name: 'Parent' });
    await parent.save();

    const child = new Category({ name: 'Child', parent: parent._id });
    await child.save();

    const grandchild = new Category({ name: 'Grandchild', parent: child._id });
    await grandchild.save();

    // 2. Attempt to move Parent under Grandchild (Circular!)
    parent.parent = grandchild._id;

    // This should throw a validation error once we add the logic
    // noinspection ES6RedundantAwait
    await expect(() => parent.save()).rejects.toThrow();
  });

  it('should fail if two categories with the same slug share the same parent', async () => {
    const parent = new Category({ name: 'Parent' });
    await parent.save();

    await new Category({ name: 'Unique', parent: parent._id }).save();

    const duplicate = new Category({ name: 'Unique', parent: parent._id });
    // noinspection ES6RedundantAwait
    await expect(duplicate.save()).rejects.toThrow();
  });
});

describe('getRelatedCategoryIds Utility', () => {
  it('should return only the parent ID if it has no children', async () => {
    const category = await new Category({ name: 'Standalone' }).save();

    const ids = await getRelatedCategoryIds(Category, 'standalone');

    expect(ids).toHaveLength(1);
    expect(ids[0].toString()).toBe(category._id.toString());
  });

  it('should return the parent and all descendant IDs in a branch', async () => {
    // Setup: Electronics > Phones > iPhone
    const root = await new Category({ name: 'Electronics' }).save();
    const middle = await new Category({ name: 'Phones', parent: root._id }).save();
    const leaf = await new Category({ name: 'iPhone', parent: middle._id }).save();

    // Create a sibling that SHOULD NOT be included (e.g., Computers)
    const sibling = await new Category({ name: 'Computers', parent: root._id }).save();

    // Query for "Electronics/Phones"
    const ids = await getRelatedCategoryIds(Category, 'electronics/phones');

    expect(ids).toHaveLength(2); // Should include Phones and iPhone
    const idStrings = ids.map(id => id.toString());
    expect(idStrings).toContain(middle._id.toString());
    expect(idStrings).toContain(leaf._id.toString());
    expect(idStrings).not.toContain(root._id.toString());
    expect(idStrings).not.toContain(sibling._id.toString());
  });

  it('should return all generations (root, child, grandchild) when querying root', async () => {
    const root = await new Category({ name: 'A' }).save();
    const b = await new Category({ name: 'B', parent: root._id }).save();
    const c = await new Category({ name: 'C', parent: b._id }).save();

    const ids = await getRelatedCategoryIds(Category, 'a');

    expect(ids).toHaveLength(3);
    const idStrings = ids.map(id => id.toString());
    expect(idStrings).toContain(root._id.toString());
    expect(idStrings).toContain(b._id.toString());
    expect(idStrings).toContain(c._id.toString());
  });

  it('should handle special characters in the paths safely', async () => {
    // Setup: A path with regex special characters like "+"
    const category = await new Category({ name: 'C++ Programming' }).save();
    const subCategory = await new Category({ name: 'Standard Library', parent: category._id }).save();

    const ids = await getRelatedCategoryIds(Category, 'c-programming');

    expect(ids).toHaveLength(2);
    expect(ids.map(id => id.toString())).toContain(subCategory._id.toString());
  });

  it('should return an empty array if the path does not exist', async () => {
    const ids = await getRelatedCategoryIds(Category, 'non-existent-path');
    expect(ids).toEqual([]);
  });

  it('should return an empty array if the path is empty', async () => {
    await new Category({ name: 'Standalone' }).save();

    const ids = await getRelatedCategoryIds(Category, '');
    expect(ids).toEqual([]);
  });

  it('should return an empty array if the path is just a slash', async () => {
    await new Category({ name: 'Standalone' }).save();

    const ids = await getRelatedCategoryIds(Category, '/');
    expect(ids).toEqual([]);
  });

  it('should return the correct branch when two are similar', async () => {
    const mens = await new Category({ name: 'Mens' }).save();
    const mensShoes = await new Category({ name: 'Shoes', parent: mens._id }).save();

    const womens = await new Category({ name: 'Womens' }).save();
    const womensShoes = await new Category({ name: 'Shoes', parent: womens._id }).save();

    // Query for "Mens/Shoes"
    const ids = await getRelatedCategoryIds(Category, 'mens/shoes');

    expect(ids).toHaveLength(1);
    const idsStrings = ids.map(id => id.toString());
    expect(idsStrings).toContain(mensShoes._id.toString());
    expect(idsStrings).not.toContain(womensShoes._id.toString());
  });

  it('should return the correct sibling when one is a substring of the other', async () => {
    const groceries = await new Category({ name: 'Groceries' }).save();
    const corn = await new Category({ name: 'Corn', parent: groceries._id }).save();
    const cornflakes = await new Category({ name: 'Cornflakes', parent: groceries._id }).save();

    // Query for "Groceries/Corn"
    const ids = await getRelatedCategoryIds(Category, 'groceries/corn');

    expect(ids).toHaveLength(1);
    const idsStrings = ids.map((id => id.toString()));
    expect(idsStrings).toContain(corn._id.toString());
    expect(idsStrings).not.toContain(cornflakes._id.toString());
  })

  it('should not match a sibling path that starts with the target path string but is a different category', async () => {
    // Setup: /pro vs /products
    const root = await new Category({ name: 'Pro' }).save(); // path: 'pro'
    const rootChild = await new Category({ name: 'Tools', parent: root._id }).save(); // path: 'pro/tools'

    const otherRoot = await new Category({ name: 'Products' }).save(); // path: 'products'
    const otherChild = await new Category({ name: 'Tools', parent: otherRoot._id }).save(); // path: 'products/tools'

    // Query for "pro"
    const ids = await getRelatedCategoryIds(Category, 'pro');

    expect(ids).toHaveLength(2);

    const idStrings = ids.map(id => id.toString());
    expect(idStrings).toContain(root._id.toString());
    expect(idStrings).toContain(rootChild._id.toString());

    // This is the critical check for the (\/|$) logic:
    expect(idStrings).not.toContain(otherRoot._id.toString());
    expect(idStrings).not.toContain(otherChild._id.toString());
  });
});

describe('resolveCategory Utility', () => {
  it('should resolve a category by its ObjectID string', async () => {
    const category = await new Category({ name: 'Find Me' }).save();

    const resolvedId = await resolveCategory(Category, category._id.toString());

    expect(resolvedId?.toString()).toBe(category._id.toString());
  });

  it('should resolve a category by its Path string', async () => {
    const root = await new Category({ name: 'Electronics' }).save();
    const child = await new Category({ name: 'Audio', parent: root._id }).save();

    const resolvedId = await resolveCategory(Category, 'electronics/audio');

    expect(resolvedId?.toString()).toBe(child._id.toString());
  });

  it('should be case-insensitive when resolving via path', async () => {
    const root = await new Category({ name: 'Electronics' }).save();
    const child = await new Category({ name: 'Audio', parent: root._id }).save();

    const resolvedId = await resolveCategory(Category, 'ELECTRONICS > AUDIO');

    expect(resolvedId?.toString()).toBe(child._id.toString());
  });

  it('should resolve a path using the ">" delimiter (common in CSVs)', async () => {
    const root = await new Category({ name: 'Men' }).save();
    const child = await new Category({ name: 'Shoes', parent: root._id }).save();

    // Simulate a CSV user typing "Men > Shoes"
    const resolvedId = await resolveCategory(Category, 'Men > Shoes');

    expect(resolvedId?.toString()).toBe(child._id.toString());
  });

  it('should resolve a path using the "+" delimiter', async () => {
    const root = await new Category({ name: 'Men' }).save();
    const child = await new Category({ name: 'Shoes', parent: root._id }).save();

    // Simulate a CSV user typing "Men > Shoes"
    const resolvedId = await resolveCategory(Category, 'Men + Shoes');

    expect(resolvedId?.toString()).toBe(child._id.toString());
  });

  it('should handle messy input with extra spaces and mixed delimiters', async () => {
    const root = await new Category({ name: 'Electronics' }).save();
    const child = await new Category({ name: 'Audio', parent: root._id }).save();

    // Test input with accidental double-delimiters and extra whitespace
    const resolvedId = await resolveCategory(Category, ' Electronics  //  Audio ++ ');

    expect(resolvedId?.toString()).toBe(child._id.toString());
  });

  it('should resolve a category whose slug looks exactly like an ObjectId', async () => {
    // A string that is a valid 24-char hex ObjectId
    const fakeIdSlug = new Types.ObjectId('507f1f77bcf86cd799439011').toString();
    const category = await new Category({ name: fakeIdSlug }).save();

    // The utility should find it via the 'path' field even though isId is true
    const resolvedId = await resolveCategory(Category, fakeIdSlug);

    expect(resolvedId?.toString()).toBe(category._id.toString());
  });

  it('should prioritize ObjectId over path when both match (rare collision)', async () => {
    // Category A has an actual ID of '507f1f77bcf86cd799439011'
    // Category B has a slug of '507f1f77bcf86cd799439011'
    const targetId = new Types.ObjectId('507f1f77bcf86cd799439011');

    const catA = await new Category({ _id: targetId, name: 'Real ID' }).save();
    await new Category({ name: '507f1f77bcf86cd799439011' }).save();

    const resolvedId = await resolveCategory(Category, targetId.toString());

    // Should return Cat A because _id is checked in the $or array
    expect(resolvedId?.toString()).toBe(catA._id.toString());
  });

  it('should return null if Path does not matches', async () => {
    const resolvedId = await resolveCategory(Category, 'some/fake/path');
    expect(resolvedId).toBeNull();
  });

  it('should return null if ID does not match', async () => {
    const targetId = new Types.ObjectId('507f1f77bcf86cd799439011');
    const resolvedId = await resolveCategory(Category, targetId.toString());
    expect(resolvedId).toBeNull();
  });

  it('should return null for empty or whitespace-only strings', async () => {
    const result1 = await resolveCategory(Category, '');
    const result2 = await resolveCategory(Category, '   ');

    expect(result1).toBeNull();
    expect(result2).toBeNull();
  });
});
