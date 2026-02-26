import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, googleProvider, db } from "@/lib/firebase";
import { AppUser, UserRole } from "@/types/sales";

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  role: UserRole | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userRef = doc(db, "users", u.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();
          const validRole = (data.role === "admin" || data.role === "staff" || data.role === "none") ? data.role : "none";
          // Fix role nếu bị thiếu hoặc sai trong Firestore
          if (data.role !== validRole) {
            await setDoc(userRef, { role: validRole }, { merge: true });
          }
          setAppUser({ ...data, role: validRole } as AppUser);
        } else {
          // First login — create user with default role "staff"
          const newUser: AppUser = {
            uid: u.uid,
            email: u.email || "",
            displayName: u.displayName || "",
            photoURL: u.photoURL || "",
            role: "none",
          };
          await setDoc(userRef, newUser);
          setAppUser(newUser);
        }
      } else {
        setAppUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const logout = async () => {
    await signOut(auth);
    setAppUser(null);
  };

  const role = appUser?.role ?? null;

  return (
    <AuthContext.Provider value={{ user, appUser, loading, role, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
