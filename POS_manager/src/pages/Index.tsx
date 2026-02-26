import { useAuth } from "@/contexts/AuthContext";
import { useProducts, useOrders } from "@/hooks/useFirestore";
import { useState } from "react";
import InventoryManager from "@/components/InventoryManager";
import SalesInterface from "@/components/SalesInterface";
import BillHistory from "@/components/BillHistory";
import DailyStats from "@/components/DailyStats";
import { Package, ShoppingCart, Receipt, BarChart3, LogOut, Shield, Users } from "lucide-react";
import UserManager from "@/components/UserManager";

const Index = () => {
  const { user, appUser, role, logout } = useAuth();
  const { products, addProduct, updateProduct, deleteProduct } = useProducts();
  const { orders, addOrder } = useOrders();

  const isAdmin = role === "admin";
  const isNone = role === "none";

  const tabs = [
    ...(isAdmin ? [{ id: "inventory" as const, label: "Kho hàng", icon: Package }] : []),
    ...(!isNone ? [{ id: "sales" as const, label: "Bán hàng", icon: ShoppingCart }] : []),
    ...(!isNone ? [{ id: "bills" as const, label: "Đơn hàng", icon: Receipt }] : []),
    ...(isAdmin ? [{ id: "stats" as const, label: "Thống kê", icon: BarChart3 }] : []),
    ...(isAdmin ? [{ id: "users" as const, label: "Người dùng", icon: Users }] : []),
  ];

  type TabId = "inventory" | "sales" | "bills" | "stats" | "users";
  const [activeTab, setActiveTab] = useState<TabId>(isAdmin ? "inventory" : isNone ? "inventory" : "sales");

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-display font-bold text-xl tracking-tight">
            <span className="text-primary">Quản lý</span> Bán hàng
          </h1>
          <nav className="flex gap-1 bg-secondary rounded-lg p-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon size={16} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {user?.photoURL && (
                <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />
              )}
              <div className="hidden sm:block text-right">
                <p className="text-xs font-medium truncate max-w-[120px]">{appUser?.displayName}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Shield size={10} />
                  {role === "admin" ? "Admin" : role === "none" ? "Chưa phân quyền" : "Staff"}
                </p>
              </div>
            </div>
            <button onClick={logout} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {isNone && (
          <div className="text-center py-16 text-muted-foreground">
            <Shield size={48} className="mx-auto mb-4 opacity-40" />
            <p className="text-lg">Tài khoản chưa được phân quyền. Vui lòng liên hệ Admin.</p>
          </div>
        )}
        {activeTab === "inventory" && isAdmin && (
          <InventoryManager products={products} addProduct={addProduct} updateProduct={updateProduct} deleteProduct={deleteProduct} />
        )}
        {activeTab === "sales" && !isNone && (
          <SalesInterface products={products} updateProduct={updateProduct} addOrder={addOrder} staffName={appUser?.displayName || ""} />
        )}
        {activeTab === "bills" && !isNone && <BillHistory orders={orders} />}
        {activeTab === "stats" && isAdmin && <DailyStats orders={orders} />}
        {activeTab === "users" && isAdmin && <UserManager />}
      </main>
    </div>
  );
};

export default Index;
