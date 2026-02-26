import { CartItem } from "@/types/sales";
import { formatVND } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrCode, CheckCircle, XCircle } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  total: number;
  cart: CartItem[];
}

export default function QRPaymentDialog({ open, onClose, onConfirm, total, cart }: Props) {
  const description = cart.map(c => `${c.product.name} x${c.quantity}`).join(", ");
  const qrUrl = `https://qr.sepay.vn/img?bank=MBBank&acc=0333502878&template=qronly&amount=${total}&des=${encodeURIComponent(description)}`;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode size={20} className="text-primary" />
            Thanh toán QR
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-center">
            <img
              src={qrUrl}
              alt="QR Thanh toán"
              className="w-64 h-64 rounded-xl border border-border object-contain bg-white"
            />
          </div>

          <div className="text-center space-y-1">
            <p className="text-2xl font-display font-bold text-primary">{formatVND(total)}</p>
            <p className="text-xs text-muted-foreground truncate max-w-full px-4">{description}</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onConfirm}
              className="flex-1 bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <CheckCircle size={18} /> Đã thanh toán
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-secondary text-secondary-foreground py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <XCircle size={18} /> Hủy
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
