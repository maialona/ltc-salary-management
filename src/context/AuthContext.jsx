import { createContext, useContext, useEffect, useState } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { auth, signInWithGoogle, signOut } from '../lib/firebase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(undefined); // undefined = loading
  const [dbUser, setDbUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    return onIdTokenChanged(auth, async (user) => {
      if (!user) {
        setFirebaseUser(null);
        setDbUser(null);
        // 不在此處清除 error，讓登入頁能顯示白名單錯誤
        return;
      }

      setError(null);
      setFirebaseUser(user);

      // 向後端取使用者資料（同時驗證白名單）
      try {
        const token = await user.getIdToken();
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/me`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.status === 403) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? 'FORBIDDEN');
          await signOut();
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setDbUser(await res.json());
      } catch (err) {
        if (err.message !== 'auth/cancelled-popup-request') {
          setError(err.message);
        }
      }
    });
  }, []);

  const value = {
    firebaseUser,
    dbUser,
    loading: firebaseUser === undefined,
    error,
    signIn: signInWithGoogle,
    signOut: async () => {
      await signOut();
      setDbUser(null);
      setError(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
