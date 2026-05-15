import { createContext, useContext, useEffect, useState } from 'react';
import { INSTITUTIONS } from '../constants/institutions.js';
import { setApiInstitution } from '../lib/apiClient.js';
import { useAuth } from './AuthContext.jsx';

const InstitutionContext = createContext(null);

const DEFAULT_CODE = INSTITUTIONS[0].code;

function storageKey(uid) {
  return `selected_institution:${uid}`;
}

export function InstitutionProvider({ children }) {
  const { dbUser } = useAuth();
  const [currentInstitution, setCurrentInstitutionState] = useState(DEFAULT_CODE);

  useEffect(() => {
    if (!dbUser) return;

    if (dbUser.role === 'institution_user') {
      // 機構使用者：永遠鎖定自己的 institution
      setCurrentInstitutionState(dbUser.institution_code);
      setApiInstitution(dbUser.institution_code);
    } else {
      // Admin：從 localStorage 復原（key 帶 uid 避免帳號間互染）
      const saved = localStorage.getItem(storageKey(dbUser.id));
      const code = saved ?? DEFAULT_CODE;
      setCurrentInstitutionState(code);
      setApiInstitution(code);
    }
  }, [dbUser]);

  const setCurrentInstitution = (code) => {
    if (dbUser?.role === 'institution_user') return; // 不允許切換
    setCurrentInstitutionState(code);
    setApiInstitution(code);
    if (dbUser) localStorage.setItem(storageKey(dbUser.id), code);
  };

  const value = {
    currentInstitution,
    setCurrentInstitution,
    canSwitch: dbUser?.role === 'admin',
  };

  return (
    <InstitutionContext.Provider value={value}>
      {children}
    </InstitutionContext.Provider>
  );
}

export function useInstitution() {
  const ctx = useContext(InstitutionContext);
  if (!ctx) throw new Error('useInstitution must be used within InstitutionProvider');
  return ctx;
}
