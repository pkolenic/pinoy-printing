export interface ICreateOrderRequest {
  items: {
    product: string; // The ID sent by the frontend
    quantity: number;
    customization?: Record<string, any>;
  }[];
}
