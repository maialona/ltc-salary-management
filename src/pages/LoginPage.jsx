import { useState } from 'react';
import { LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const ERROR_MESSAGES = {
  NOT_WHITELISTED: '您的帳號尚未在白名單內，請聯絡系統管理員。',
  ACCOUNT_DISABLED: '此帳號已停用，請聯絡系統管理員。',
};

export default function LoginPage() {
  const { signIn, error } = useAuth();
  const [loading, setLoading] = useState(false);
  const [popupError, setPopupError] = useState(null);

  const handleSignIn = async () => {
    setLoading(true);
    setPopupError(null);
    try {
      await signIn();
    } catch (err) {
      if (!err.code?.includes('cancelled') && !err.code?.includes('popup-closed')) {
        setPopupError('登入失敗，請再試一次。');
      }
    } finally {
      setLoading(false);
    }
  };

  const displayError = error
    ? (ERROR_MESSAGES[error] ?? `登入錯誤：${error}`)
    : popupError;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 flex flex-col items-center gap-6"
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--modal-shadow)',
        }}
      >
        {/* Logo area */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold"
            style={{ background: 'var(--nav-active-bg)', color: 'var(--text-primary)' }}
          >
            薪
          </div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            薪資管理系統
          </h1>
          <p className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
            府城・鴻康・謙益・寬澤
          </p>
        </div>

        {/* Error banner */}
        {displayError && (
          <div
            className="w-full flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
            style={{ background: '#3f1212', border: '1px solid #7f1d1d', color: '#fca5a5' }}
          >
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{displayError}</span>
          </div>
        )}

        {/* Sign-in button */}
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 rounded-lg h-11 text-sm font-medium transition-opacity disabled:opacity-50 cursor-pointer"
          style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
        >
          {/* Google "G" logo SVG */}
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          {loading ? '登入中…' : '使用 Google 帳號登入'}
          {!loading && <LogIn size={15} />}
        </button>

        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          僅限受邀帳號登入
        </p>
      </div>
    </div>
  );
}
