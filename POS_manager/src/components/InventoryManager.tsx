import { useState } from "react";
import { Product } from "@/types/sales";
import { Package, Plus, Pencil, Trash2, Minus } from "lucide-react";
import { formatVND } from "@/lib/format";

interface Props {
  products: Product[];
  addProduct: (p: Omit<Product, "id">) => Promise<void>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
}

export default function InventoryManager({ products, addProduct, updateProduct, deleteProduct }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [image, setImage] = useState("");

  const resetForm = () => {
    setName("");
    setPrice("");
    setQuantity("");
    setImage("");
    setEditId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price || !quantity) return;

    if (editId) {
      await updateProduct(editId, { name, price: +price, quantity: +quantity, image: image || undefined });
    } else {
      await addProduct({ name, price: +price, quantity: +quantity, image: image || undefined });
    }
    resetForm();
  };

  const startEdit = (p: Product) => {
    setEditId(p.id);
    setName(p.name);
    setPrice(String(p.price));
    setQuantity(String(p.quantity));
    setImage(p.image || "");
    setShowForm(true);
  };

  const adjustStock = (id: string, delta: number) => {
    const p = products.find(pr => pr.id === id);
    if (p) updateProduct(id, { quantity: Math.max(0, p.quantity + delta) });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 400;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h = h * MAX / w; w = MAX; } }
        else { if (h > MAX) { w = w * MAX / h; h = MAX; } }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        setImage(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-display font-bold">Kho hàng</h2>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={18} /> Thêm sản phẩm
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-card rounded-xl p-5 shadow-sm border border-border space-y-4">
          <h3 className="font-display font-semibold text-lg">{editId ? "Sửa sản phẩm" : "Sản phẩm mới"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input placeholder="Tên sản phẩm" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" required />
            <input type="number" placeholder="Giá" value={price} onChange={e => setPrice(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" min="0" step="0.01" required />
            <input type="number" placeholder="Số lượng" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" min="0" required />
            <input type="file" accept="image/*" onChange={handleImageUpload} className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm file:font-medium" />
          </div>
          {image && <img src={image} alt="Xem trước" className="h-20 w-20 object-cover rounded-lg border border-border" />}
          <div className="flex gap-3">
            <button type="submit" className="bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-medium hover:opacity-90 transition-opacity">
              {editId ? "Cập nhật" : "Thêm"}
            </button>
            <button type="button" onClick={resetForm} className="bg-secondary text-secondary-foreground px-5 py-2.5 rounded-lg font-medium hover:opacity-90 transition-opacity">
              Hủy
            </button>
          </div>
        </form>
      )}

      {products.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package size={48} className="mx-auto mb-4 opacity-40" />
          <p className="text-lg">Chưa có sản phẩm. Hãy thêm sản phẩm đầu tiên!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(p => (
            <div key={p.id} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              {p.image ? (
                <img src={p.image} alt={p.name} className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 bg-secondary flex items-center justify-center">
                  <Package size={40} className="text-muted-foreground opacity-40" />
                </div>
              )}
              <div className="p-4 space-y-3">
                <div>
                  <h4 className="font-display font-semibold text-lg truncate">{p.name}</h4>
                  <p className="text-primary font-bold text-xl">{formatVND(p.price)}</p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => adjustStock(p.id, -1)} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-border transition-colors">
                      <Minus size={14} />
                    </button>
                    <span className={`font-semibold min-w-[2rem] text-center ${p.quantity === 0 ? 'text-destructive' : ''}`}>{p.quantity}</span>
                    <button onClick={() => adjustStock(p.id, 1)} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-border transition-colors">
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(p)} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-border transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => deleteProduct(p.id)} className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
