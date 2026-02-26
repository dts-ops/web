import { Order } from "@/types/sales";
import { Receipt, Calendar, StickyNote, User, TrendingUp, ShoppingBag } from "lucide-react";
import { formatVND } from "@/lib/format";

interface Props {
  orders: Order[];
}

export default function BillHistory({ orders }: Props) {
  const validOrders = orders.filter(o => o && o.items && o.date);

  // Thống kê tổng quan
  const totalOrders = validOrders.length;
  const totalRevenue = validOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalItemsSold = validOrders.reduce(
    (sum, o) => sum + (o.items || []).reduce((s, item) => s + (item?.quantity || 0), 0),
    0
  );

  // Thống kê theo nhân viên
  const staffStats = validOrders.reduce((acc, o) => {
    const name = o.staffName || "Không rõ";
    if (!acc[name]) acc[name] = { count: 0, revenue: 0 };
    acc[name].count += 1;
    acc[name].revenue += o.total || 0;
    return acc;
  }, {} as Record<string, { count: number; revenue: number }>);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-display font-bold">Lịch sử đơn hàng</h2>

      {/* Thống kê tổng quan */}
      {totalOrders > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <ShoppingBag size={20} className="text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tổng đơn hàng</p>
              <p className="text-xl font-display font-bold">{totalOrders}</p>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp size={20} className="text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tổng doanh thu</p>
              <p className="text-xl font-display font-bold">{formatVND(totalRevenue)}</p>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Receipt size={20} className="text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tổng SP đã bán</p>
              <p className="text-xl font-display font-bold">{totalItemsSold}</p>
            </div>
          </div>
        </div>
      )}

      {/* Thống kê theo nhân viên */}
      {totalOrders > 0 && Object.keys(staffStats).length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="font-medium text-sm text-muted-foreground mb-3 flex items-center gap-2">
            <User size={14} /> Thống kê theo nhân viên
          </h3>
          <div className="space-y-2">
            {Object.entries(staffStats)
              .sort((a, b) => b[1].revenue - a[1].revenue)
              .map(([name, stat]) => (
                <div key={name} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <span className="font-medium text-sm">{name}</span>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">{stat.count} đơn</span>
                    <span className="font-display font-bold text-primary">{formatVND(stat.revenue)}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Danh sách đơn hàng */}
      {validOrders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Receipt size={48} className="mx-auto mb-4 opacity-40" />
          <p className="text-lg">Chưa có đơn hàng. Hoàn tất bán hàng để xem lịch sử.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {validOrders.map(order => (
            <div key={order.id} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border flex flex-wrap items-center gap-3">
                <Calendar size={16} className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {new Date(order.date).toLocaleString("vi-VN")}
                </span>
                {order.staffName && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <User size={12} /> {order.staffName}
                  </span>
                )}
                <span className="ml-auto font-display font-bold text-lg text-primary">
                  {formatVND(order.total)}
                </span>
              </div>
              <div className="p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground text-left">
                      <th className="pb-2 font-medium">Sản phẩm</th>
                      <th className="pb-2 font-medium text-center">SL</th>
                      <th className="pb-2 font-medium text-right">Đơn giá</th>
                      <th className="pb-2 font-medium text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(order.items || []).map((item, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="py-2">{item?.name || "—"}</td>
                        <td className="py-2 text-center">{item?.quantity || 0}</td>
                        <td className="py-2 text-right">{formatVND(item?.unitPrice || 0)}</td>
                        <td className="py-2 text-right font-medium">{formatVND(item?.subtotal || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {order.note && (
                  <div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground bg-secondary/50 rounded-lg p-3">
                    <StickyNote size={14} className="mt-0.5 shrink-0" />
                    <p>{order.note}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
