import { useState, useEffect, useCallback } from "react";
import {
  collection,
  doc,
  onSnapshot,
  deleteDoc,
  addDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Product, Order } from "@/types/sales";

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const col = collection(db, "products");
    const unsub = onSnapshot(col, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      setLoading(false);
    });
    return unsub;
  }, []);

  const addProduct = useCallback(async (p: Omit<Product, "id">) => {
    await addDoc(collection(db, "products"), p);
  }, []);

  const updateProduct = useCallback(async (id: string, data: Partial<Product>) => {
    await updateDoc(doc(db, "products", id), data);
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "products", id));
  }, []);

  return { products, loading, addProduct, updateProduct, deleteProduct };
}

export function useOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const col = collection(db, "orders");
    const unsub = onSnapshot(col, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setOrders(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const addOrder = useCallback(async (order: Omit<Order, "id">) => {
    await addDoc(collection(db, "orders"), order);
  }, []);

  return { orders, loading, addOrder };
}
