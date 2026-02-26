import { useMemo, useState } from "react";
import { Order } from "@/types/sales";
import { formatVND } from "@/lib/format";
import { BarChart3, TrendingUp, ShoppingBag, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  orders: Order[];
}

function formatDateVN(date: Date): string {
  return date.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
}

function toDateKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DailyStats({ orders }: Props) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });

  const changeDate = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  };

  const dailyOrders = useMemo(() => orders.filter(b => toDateKey(b.date) === selectedDate), [orders, selectedDate]);

  const stats = useMemo(() => {
    const totalRevenue = dailyOrders.reduce((sum, b) => sum + b.total, 0);
    const totalOrders = dailyOrders.length;
    const totalItems = dailyOrders.reduce((sum, b) => b.items.reduce((s, i) => s + i.quantity, 0) + sum, 0);

    const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    dailyOrders.forEach(b => {
      b.items.forEach(item => {
        if (!productMap[item.name]) {
          productMap[item.name] = { name: item.name, qty: 0, revenue: 0 };
        }
        productMap[item.name].qty += item.quantity;
        productMap[item.name].revenue += item.subtotal;
      });
    });
    const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    const hourly: Record<number, number> = {};
    dailyOrders.forEach(b => {
      const hour = new Date(b.date).getHours();
      hourly[hour] = (hourly[hour] || 0) + b.total;
    });

    return { totalRevenue, totalOrders, totalItems, topProducts, hourly };
  }, [dailyOrders]);

  const maxHourlyRevenue = Math.max(...Object.values(stats.hourly), 1);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-display font-bold">Thống kê bán hàng</h2>

      <div className="flex items-center gap-3">
        <button onClick={() => changeDate(-1)} className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center hover:bg-border transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-2.5">
          <CalendarDays size={16} className="text-primary" />
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-transparent text-foreground font-medium focus:outline-none" />
        </div>
        <button onClick={() => changeDate(1)} className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center hover:bg-border transition-colors">
          <ChevronRight size={18} />
        </button>
        <span className="text-sm text-muted-foreground hidden sm:inline">{formatDateVN(new Date(selectedDate))}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><TrendingUp size={20} className="text-primary" /></div>
            <span className="text-sm text-muted-foreground">Doanh thu</span>
          </div>
          <p className="text-2xl font-display font-bold text-primary">{formatVND(stats.totalRevenue)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-accent/50 flex items-center justify-center"><ShoppingBag size={20} className="text-accent-foreground" /></div>
            <span className="text-sm text-muted-foreground">Đơn hàng</span>
          </div>
          <p className="text-2xl font-display font-bold">{stats.totalOrders}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center"><BarChart3 size={20} className="text-muted-foreground" /></div>
            <span className="text-sm text-muted-foreground">Sản phẩm bán ra</span>
          </div>
          <p className="text-2xl font-display font-bold">{stats.totalItems}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border"><h3 className="font-display font-semibold">Sản phẩm bán chạy</h3></div>
          <div className="p-4">
            {stats.topProducts.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">Chưa có dữ liệu</p>
            ) : (
              <div className="space-y-3">
                {stats.topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.qty} sản phẩm</p>
                    </div>
                    <span className="font-bold text-sm text-primary">{formatVND(p.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border"><h3 className="font-display font-semibold">Doanh thu theo giờ</h3></div>
          <div className="p-4">
            {Object.keys(stats.hourly).length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">Chưa có dữ liệu</p>
            ) : (
              <div className="space-y-2">
                {Array.from({ length: 24 }, (_, h) => h).filter(h => stats.hourly[h]).map(h => (
                  <div key={h} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-12">{String(h).padStart(2, "0")}:00</span>
                    <div className="flex-1 bg-secondary rounded-full h-5 overflow-hidden">
                      <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${(stats.hourly[h] / maxHourlyRevenue) * 100}%` }} />
                    </div>
                    <span className="text-xs font-medium w-24 text-right">{formatVND(stats.hourly[h])}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
