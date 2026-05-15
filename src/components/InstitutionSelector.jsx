import { Building2 } from 'lucide-react';
import { INSTITUTIONS, getInstitutionName } from '../constants/institutions.js';
import { useInstitution } from '../context/InstitutionContext.jsx';
import { motion } from 'framer-motion';

export default function InstitutionSelector({ isCollapsed }) {
  const { currentInstitution, setCurrentInstitution, canSwitch } = useInstitution();

  return (
    <div
      className="flex items-center h-14 border-b px-2 shrink-0 overflow-hidden relative"
      style={{ borderColor: 'var(--nav-border)' }}
    >
      {/* Expanded */}
      <motion.div
        animate={{ opacity: isCollapsed ? 0 : 1 }}
        transition={{ duration: 0.15 }}
        className="absolute inset-y-0 flex items-center gap-3"
        style={{ left: '1.125rem', right: '0.625rem' }}
        style={{ pointerEvents: isCollapsed ? 'none' : 'auto' }}
      >
        <Building2 size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
        {canSwitch ? (
          <select
            value={currentInstitution}
            onChange={e => setCurrentInstitution(e.target.value)}
            className="flex-1 text-xs font-medium rounded px-1 py-0.5 border-0 outline-none cursor-pointer"
            style={{
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              minWidth: 0,
            }}
          >
            {INSTITUTIONS.map(inst => (
              <option key={inst.code} value={inst.code}>{inst.name}</option>
            ))}
          </select>
        ) : (
          <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-accent)' }}>
            {getInstitutionName(currentInstitution)}
          </span>
        )}
      </motion.div>

      {/* Collapsed: building icon only */}
      <motion.div
        animate={{ opacity: isCollapsed ? 1 : 0 }}
        transition={{ duration: 0.1 }}
        className="flex items-center justify-center w-full"
        style={{ pointerEvents: 'none' }}
      >
        <Building2 size={16} style={{ color: 'var(--text-accent)' }} />
      </motion.div>
    </div>
  );
}
