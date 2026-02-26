import { useState, useEffect, useRef } from "react";
import { Product, CartItem, Order } from "@/types/sales";
import { Search, ShoppingCart, Plus, Minus, Trash2, Receipt, Package, Undo2 } from "lucide-react";
import { formatVND } from "@/lib/format";
import { toast } from "sonner";
import QRPaymentDialog from "./QRPaymentDialog";

interface Props {
  products: Product[];
  updateProduct: (id: string, data: Partial<Product>) => Promise<void>;
  addOrder: (order: Omit<Order, "id">) => Promise<void>;
  staffName: string;
}

export default function SalesInterface({ products, updateProduct, addOrder, staffName }: Props) {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [note, setNote] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [undoData, setUndoData] = useState<{ cart: CartItem[]; note: string; timeoutId: ReturnType<typeof setTimeout> } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = products.filter(p => p && p.name && p.name.toLowerCase().includes(search.toLowerCase()) && typeof p.price === 'number');

  const addToCart = (product: Product) => {
    if (product.quantity <= 0) { toast.error("Hết hàng!"); return; }
    const existing = cart.find(c => c.product.id === product.id);
    if (existing) {
      if (existing.quantity >= product.quantity) { toast.error("Không đủ hàng trong kho!"); return; }
      setCart(cart.map(c => c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
  };

  const updateCartQty = (productId: string, delta: number) => {
    const item = cart.find(c => c.product.id === productId);
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty <= 0) { setCart(cart.filter(c => c.product.id !== productId)); return; }
    const product = products.find(p => p.id === productId);
    if (product && newQty > product.quantity) { toast.error("Không đủ hàng trong kho!"); return; }
    setCart(cart.map(c => c.product.id === productId ? { ...c, quantity: newQty } : c));
  };

  const removeFromCart = (productId: string) => setCart(cart.filter(c => c.product.id !== productId));
  const total = cart.reduce((sum, c) => sum + c.product.price * c.quantity, 0);

  const handleCheckoutClick = () => {
    if (cart.length === 0) return;
    setShowQR(true);
  };

  const handleConfirmPayment = async () => {
    setShowQR(false);
    const savedCart = [...cart];
    const savedNote = note;

    const order: Omit<Order, "id"> = {
      date: new Date().toISOString(),
      items: cart.map(c => ({
        name: c.product.name,
        quantity: c.quantity,
        unitPrice: c.product.price,
        subtotal: c.product.price * c.quantity,
      })),
      total,
      note,
      staffName,
    };

    await addOrder(order);
    for (const c of cart) {
      const p = products.find(pr => pr.id === c.product.id);
      if (p) await updateProduct(p.id, { quantity: p.quantity - c.quantity });
    }

    setCart([]);
    setNote("");

    // Undo mechanism - 3 seconds
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    const timeoutId = setTimeout(() => {
      setUndoData(null);
    }, 3000);
    undoTimerRef.current = timeoutId;
    setUndoData({ cart: savedCart, note: savedNote, timeoutId });

    toast.success("Thanh toán thành công!", { duration: 3000 });
  };

  const handleUndo = async () => {
    if (!undoData) return;
    clearTimeout(undoData.timeoutId);
    // Restore stock
    for (const c of undoData.cart) {
      const p = products.find(pr => pr.id === c.product.id);
      if (p) await updateProduct(p.id, { quantity: p.quantity + c.quantity });
    }
    setCart(undoData.cart);
    setNote(undoData.note);
    setUndoData(null);
    toast.info("Đã hoàn tác đơn hàng!");
  };

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 space-y-4">
        <h2 className="text-2xl font-display font-bold">Bán hàng</h2>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input placeholder="Tìm sản phẩm..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package size={40} className="mx-auto mb-3 opacity-40" />
            <p>Không tìm thấy sản phẩm</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filtered.map(p => (
              <button key={p.id} onClick={() => addToCart(p)} disabled={p.quantity <= 0} className="bg-card rounded-xl border border-border p-3 text-left hover:shadow-md hover:border-primary/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                {p.image ? (
                  <img src={p.image} alt={p.name} className="w-full h-24 object-cover rounded-lg mb-2" />
                ) : (
                  <div className="w-full h-24 bg-secondary rounded-lg mb-2 flex items-center justify-center">
                    <Package size={24} className="text-muted-foreground opacity-40" />
                  </div>
                )}
                <p className="font-medium text-sm truncate">{p.name}</p>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-primary font-bold">{formatVND(p.price)}</span>
                  <span className={`text-xs ${p.quantity === 0 ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                    {p.quantity === 0 ? "Hết" : `Còn ${p.quantity}`}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="lg:col-span-2">
        {/* Undo banner */}
        {undoData && (
          <button
            onClick={handleUndo}
            className="w-full mb-3 bg-accent text-accent-foreground py-3 rounded-lg font-semibold flex items-center justify-center gap-2 animate-pulse hover:opacity-90 transition-opacity"
          >
            <Undo2 size={18} /> Hoàn tác đơn hàng (3s)
          </button>
        )}

        <div className="bg-card rounded-xl border border-border shadow-sm sticky top-4">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <ShoppingCart size={20} className="text-primary" />
            <h3 className="font-display font-semibold text-lg">Giỏ hàng</h3>
            <span className="ml-auto text-sm text-muted-foreground">{cart.length} sản phẩm</span>
          </div>
          <div className="p-4 space-y-3 max-h-[50vh] overflow-y-auto scrollbar-thin">
            {cart.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">Giỏ hàng trống</p>
            ) : (
              cart.map(c => (
                <div key={c.product.id} className="flex items-center gap-3 bg-secondary/50 rounded-lg p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{c.product.name}</p>
                    <p className="text-xs text-muted-foreground">{formatVND(c.product.price)} × {c.quantity}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => updateCartQty(c.product.id, -1)} className="w-7 h-7 rounded bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors"><Minus size={12} /></button>
                    <span className="text-sm font-semibold w-6 text-center">{c.quantity}</span>
                    <button onClick={() => updateCartQty(c.product.id, 1)} className="w-7 h-7 rounded bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors"><Plus size={12} /></button>
                    <button onClick={() => removeFromCart(c.product.id)} className="w-7 h-7 rounded bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-colors ml-1"><Trash2 size={12} /></button>
                  </div>
                  <p className="font-bold text-sm w-20 text-right">{formatVND(c.product.price * c.quantity)}</p>
                </div>
              ))
            )}
          </div>
          {cart.length > 0 && (
            <div className="p-4 border-t border-border space-y-3">
              <textarea placeholder="Thêm ghi chú (không bắt buộc)..." value={note} onChange={e => setNote(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
              <div className="flex justify-between items-center text-lg font-display font-bold">
                <span>Tổng cộng</span>
                <span className="text-primary">{formatVND(total)}</span>
              </div>
              <button onClick={handleCheckoutClick} className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                <Receipt size={18} /> Thanh toán
              </button>
            </div>
          )}
        </div>
      </div>

      <QRPaymentDialog
        open={showQR}
        onClose={() => setShowQR(false)}
        onConfirm={handleConfirmPayment}
        total={total}
        cart={cart}
      />
    </div>
  );
}
