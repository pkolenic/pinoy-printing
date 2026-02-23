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

export type Category = {
  id: string;
  name: string;
  slug: string;
  path: string;
  parent?: Category;
  children?: Category[];
}

export type Order = {}

export type User = {
  id: string;
  picture?: string;
  name: string;
  username: string;
  sub: string;
  email: string;
  phone: string;
  addresses: Address[];
  role: "admin" | "customer" | "owner" | "staff";
  orders: Order[];
}

export type SiteConfig = {
  auth0Domain: string;
  auth0Audience: string;
  auth0ClientId: string;

  siteName: string;
  siteAddress: string;
  sitePhone: string;
  siteEmail: string;
  siteCurrency: string;

  requireAuthentication: boolean;

  primaryColor: string;
  secondaryColor: string;
  errorColor: string;
  paperColor: string;
  selectedColor: string;
  selectedHoverColor: string;

  heroTitle: string;
  heroDescription: string;
  heroImage: string;
}
