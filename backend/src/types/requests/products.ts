import { IProduct } from "../../models/index.js";

export type IProductImportRow = Omit<
  IProduct,
  'categories' | 'category' | 'price' | 'quantityOnHand' | 'quantityAvailable' | 'customizationSchema' | 'showIfOutOfStock'
> & {
  category: string; // The single Leaf Category ID from the CSV
  price: string;
  quantity: string;
  showIfOutOfStock?: string;
  customizationSchema?: string;
};

/**
 * The shape of the detailed-diff library's output
 */
export interface IProductDiff {
  added: Record<string, any>;
  deleted: Record<string, any>;
  updated: Record<string, any>;
}

/**
 * The individual row result sent back to the client
 */
export interface IImportResult extends IProductImportRow {
  status: 'created' | 'updated' | 'error';
  diff: IProductDiff | null;
  error: string | null;
}

/**
 * The response sent back to the client after the import is complete.
 */
export interface IImportResponse {
  message: string;
  isPreview: boolean;
  summary: {
    created: number;
    updated: number;
    errors: number;
  };
  results: IImportResult[];
}
