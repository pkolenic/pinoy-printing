import mongoose from "mongoose";
import { describe, it, expect, beforeEach } from 'vitest';
import { getTenantModels } from "../types/tenantContext";
import {
  CSV_PRODUCT_HEADERS,
  IProductDocument,
  sanitizeProduct,
} from "./Product.js";

const { Category, Product } = getTenantModels(mongoose.connection);

describe('Product Model', () => {
  beforeEach(async () => {
    await Category.deleteMany({});
    await Product.deleteMany({});
  });

  it('should export the correct CSV headers for imports', () => {
    expect(CSV_PRODUCT_HEADERS).toContain('sku');
    expect(CSV_PRODUCT_HEADERS).toContain('category');
    expect(CSV_PRODUCT_HEADERS).toHaveLength(10);
  });

  describe('Field Normalization', () => {
    it('should lowercase and trim the SKU on save', async () => {
      const cat = await new Category({ name: 'Test' }).save();
      const product = new Product({
        sku: '  ABC-123  ', // Mixed case and spaces
        name: 'Test',
        description: 'Desc',
        price: 10,
        category: cat._id,
        quantityOnHand: 1,
        quantityAvailable: 1
      });

      await product.save();
      expect(product.sku).toBe('abc-123');
    });
  });

  describe('Virtuals: categoryName', () => {
    it('should return the category name when the category is populated', async () => {
      const cat = await new Category({ name: 'Furniture' }).save();
      const product = await new Product({
        sku: 'f-001',
        name: 'Chair',
        description: 'Desc',
        price: 50,
        category: cat._id,
        quantityOnHand: 1,
        quantityAvailable: 1
      }).save();

      const populatedProduct = await Product.findById(product._id).populate('category') as IProductDocument | null;

      // Hits the (this.category as any)?.name branch
      expect(populatedProduct?.categoryName).toBe('Furniture');
    });

    it('should return null when the category is not populated', async () => {
      const cat = await new Category({ name: 'Furniture' }).save();
      const product = await new Product({
        sku: 'f-002',
        name: 'Table',
        description: 'Desc',
        price: 100,
        category: cat._id,
        quantityOnHand: 1,
        quantityAvailable: 1
      }).save();

      const unpopulatedProduct = await Product.findById(product._id) as IProductDocument | null;

      // Hits the || null branch
      expect(unpopulatedProduct?.categoryName).toBeNull();
    });
  });
});

describe('Product Methods', () => {
  describe('sanitizeProduct', () => {
    const mockProduct = {
      sku: 'test-sku',
      name: 'Cool Shirt',
      price: 25,
      quantityOnHand: 100,
      quantityAvailable: 80,
      showIfOutOfStock: true,
      customizationSchema: { color: 'red' }
    } as any;

    it('should return all fields if user is staff', () => {
      const result = sanitizeProduct(mockProduct, true);

      expect(result.quantityOnHand).toBe(100);
      expect(result.quantityAvailable).toBe(80);
      expect(result.showIfOutOfStock).toBe(true);
      expect(result.sku).toBe('test-sku'); // public fields remain
    });

    it('should strip sensitive stock fields for non-staff users', () => {
      const result = sanitizeProduct(mockProduct, false);

      expect(result.quantityOnHand).toBeUndefined();
      expect(result.quantityAvailable).toBeUndefined();
      expect(result.showIfOutOfStock).toBeUndefined();
      expect(result.sku).toBe('test-sku'); // public fields remain
    });

    it('should ensure customizationSchema is null if missing', () => {
      const productNoSchema = { ...mockProduct, customizationSchema: undefined };
      const result = sanitizeProduct(productNoSchema, false);

      expect(result.customizationSchema).toBeNull();
    });
  })
})
