import { useState, useEffect } from "react";
import { collection, onSnapshot, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppUser, UserRole } from "@/types/sales";
import { Users, Shield, ShieldOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const ROLE_OPTIONS: { value: UserRole | "none"; label: string; icon: typeof Shield; color: string }[] = [
  { value: "admin", label: "Admin", icon: ShieldCheck, color: "text-primary" },
  { value: "staff", label: "Staff", icon: Shield, color: "text-foreground" },
  { value: "none", label: "None", icon: ShieldOff, color: "text-destructive" },
];

export default function UserManager() {
  const [users, setUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map(d => ({ ...d.data(), uid: d.id } as AppUser)));
    });
    return unsub;
  }, []);

  const changeRole = async (uid: string, newRole: UserRole | "none") => {
    await setDoc(doc(db, "users", uid), { role: newRole }, { merge: true });
    toast.success("Đã cập nhật quyền!");
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-display font-bold flex items-center gap-2">
        <Users size={24} /> Quản lý người dùng
      </h2>
      {users.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Chưa có người dùng</p>
      ) : (
        <div className="space-y-3">
          {users.map(u => {
            const currentRole = ROLE_OPTIONS.find(r => r.value === u.role) || ROLE_OPTIONS[2];
            return (
              <div key={u.uid} className="bg-card rounded-xl border border-border p-4 flex items-center gap-4">
                {u.photoURL ? (
                  <img src={u.photoURL} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground font-bold">
                    {u.displayName?.charAt(0) || "?"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{u.displayName || u.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <select
                  value={u.role}
                  onChange={e => changeRole(u.uid, e.target.value as UserRole | "none")}
                  className="px-3 py-1.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {ROLE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
