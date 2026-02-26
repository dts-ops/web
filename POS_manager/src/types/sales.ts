export type UserRole = "admin" | "staff" | "none";

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Order {
  id: string;
  date: string;
  items: { name: string; quantity: number; unitPrice: number; subtotal: number }[];
  total: number;
  note: string;
  staffName?: string;
}
