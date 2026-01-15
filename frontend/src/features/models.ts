export type Address = {
  id: string;
  name: string;
  street: string;
  street2: string;
  city: string;
  region: string;
  postalCode: string;
  isPrimary: boolean;
}

export type Order = {}

export type User = {
  id: string;
  name: string;
  sub: string;
  email: string;
  phone: string;
  addresses: Address[];
  role: "admin" | "customer" | "owner" | "staff";
  orders: Order[];
}
