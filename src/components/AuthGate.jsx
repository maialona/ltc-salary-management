import { useAuth } from '../context/AuthContext.jsx';
import LoginPage from '../pages/LoginPage.jsx';

export default function AuthGate({ children }) {
  const { firebaseUser, dbUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--glass-border)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>載入中…</p>
        </div>
      </div>
    );
  }

  // 未登入或後端尚未回應 dbUser（含 NOT_WHITELISTED 後被登出的狀態）
  if (!firebaseUser || !dbUser) {
    return <LoginPage />;
  }

  return children;
}
