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
      const codes = dbUser.institution_codes ?? [];
      const defaultCode = codes[0] ?? DEFAULT_CODE;
      if (codes.length <= 1) {
        // 只有一間機構：鎖定，不需切換
        setCurrentInstitutionState(defaultCode);
        setApiInstitution(defaultCode);
      } else {
        // 多間機構：從 localStorage 復原，需在授權範圍內
        const saved = localStorage.getItem(storageKey(dbUser.id));
        const code = (saved && codes.includes(saved)) ? saved : defaultCode;
        setCurrentInstitutionState(code);
        setApiInstitution(code);
      }
    } else {
      // Admin：從 localStorage 復原（key 帶 uid 避免帳號間互染）
      const saved = localStorage.getItem(storageKey(dbUser.id));
      const code = saved ?? DEFAULT_CODE;
      setCurrentInstitutionState(code);
      setApiInstitution(code);
    }
  }, [dbUser]);

  const setCurrentInstitution = (code) => {
    if (dbUser?.role === 'institution_user') {
      const codes = dbUser.institution_codes ?? [];
      if (codes.length <= 1 || !codes.includes(code)) return;
    } else if (dbUser?.role !== 'admin') {
      return;
    }
    setCurrentInstitutionState(code);
    setApiInstitution(code);
    if (dbUser) localStorage.setItem(storageKey(dbUser.id), code);
  };

  const institutionCodes = dbUser?.institution_codes ?? [];
  const availableInstitutions = dbUser?.role === 'admin'
    ? INSTITUTIONS
    : INSTITUTIONS.filter(i => institutionCodes.includes(i.code));

  const canSwitch = dbUser?.role === 'admin' ||
    (dbUser?.role === 'institution_user' && institutionCodes.length > 1);

  const value = {
    currentInstitution,
    setCurrentInstitution,
    canSwitch,
    availableInstitutions,
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
