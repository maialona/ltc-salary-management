import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, UserX, UserCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { INSTITUTIONS } from '../constants/institutions.js';
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/apiClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const ROLE_LABELS = { admin: '管理員', institution_user: '機構使用者' };

const emptyForm = { email: '', role: 'institution_user', institution_codes: [INSTITUTIONS[0].code], display_name: '' };

function InstitutionCheckboxes({ value, onChange }) {
  const toggle = (code, checked) => {
    onChange(checked ? [...value, code] : value.filter(c => c !== code));
  };

  return (
    <div className="flex flex-col gap-2 mt-1">
      {INSTITUTIONS.map(inst => (
        <label key={inst.code} className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={value.includes(inst.code)}
            onChange={e => toggle(inst.code, e.target.checked)}
            className="w-4 h-4 rounded cursor-pointer"
            style={{ accentColor: 'var(--nav-active-bg)' }}
          />
          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{inst.name}</span>
        </label>
      ))}
    </div>
  );
}

function UserForm({ initial = emptyForm, onSave, onCancel, loading }) {
  const [form, setForm] = useState(initial);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const canSave = form.email && (form.role !== 'institution_user' || form.institution_codes.length > 0);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--label-text-color)' }}>Email *</label>
        <input
          type="email"
          value={form.email}
          onChange={e => set('email', e.target.value)}
          placeholder="user@example.com"
          disabled={!!initial.id}
          className="w-full rounded px-3 h-9 text-sm disabled:opacity-50"
          style={{ background: 'var(--input-bg)', border: 'var(--input-border)', color: 'var(--text-primary)' }}
        />
      </div>
      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--label-text-color)' }}>顯示名稱</label>
        <input
          type="text"
          value={form.display_name}
          onChange={e => set('display_name', e.target.value)}
          placeholder="選填"
          className="w-full rounded px-3 h-9 text-sm"
          style={{ background: 'var(--input-bg)', border: 'var(--input-border)', color: 'var(--text-primary)' }}
        />
      </div>
      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--label-text-color)' }}>角色 *</label>
        <select
          value={form.role}
          onChange={e => set('role', e.target.value)}
          className="w-full rounded px-3 h-9 text-sm cursor-pointer"
          style={{ background: 'var(--input-bg)', border: 'var(--input-border)', color: 'var(--text-primary)' }}
        >
          <option value="institution_user">機構使用者</option>
          <option value="admin">管理員</option>
        </select>
      </div>
      {form.role === 'institution_user' && (
        <div>
          <label className="block text-xs" style={{ color: 'var(--label-text-color)' }}>
            機構權限 * <span style={{ color: 'var(--text-secondary)' }}>（可複選）</span>
          </label>
          {form.institution_codes.length === 0 && (
            <p className="text-xs mt-1" style={{ color: '#fca5a5' }}>請至少選擇一間機構</p>
          )}
          <InstitutionCheckboxes
            value={form.institution_codes}
            onChange={v => set('institution_codes', v)}
          />
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave(form)}
          disabled={loading || !canSave}
          className="flex-1 h-9 rounded text-sm font-medium disabled:opacity-50 cursor-pointer"
          style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
        >
          {loading ? '儲存中…' : '儲存'}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 h-9 rounded text-sm cursor-pointer hover:bg-white/5"
          style={{ color: 'var(--text-secondary)' }}
        >
          取消
        </button>
      </div>
    </div>
  );
}

function UserRow({ user, onEdit, onToggleDisabled, isSelf }) {
  const [open, setOpen] = useState(false);
  const instNames = (user.institution_codes ?? [])
    .map(code => INSTITUTIONS.find(i => i.code === code)?.name)
    .filter(Boolean)
    .join('、');

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: 'var(--accordion-bg)' }}>
      <button
        className="flex items-center w-full px-4 h-12 gap-3 text-left cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ background: 'var(--nav-active-bg)', color: 'var(--nav-active-text)' }}
        >
          {(user.display_name || user.email)[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: user.disabled ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
            {user.display_name || user.email}
          </p>
          <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
            {ROLE_LABELS[user.role]}{instNames ? ` · ${instNames}` : ''}{user.disabled ? ' · 已停用' : ''}
          </p>
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t flex flex-col gap-2" style={{ borderColor: 'var(--glass-border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{user.email}</p>
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(user)}
              className="flex items-center gap-1.5 text-xs rounded px-3 py-1.5 cursor-pointer hover:bg-white/5"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Pencil size={12} /> 編輯
            </button>
            {!isSelf && (
              <button
                onClick={() => onToggleDisabled(user)}
                className="flex items-center gap-1.5 text-xs rounded px-3 py-1.5 cursor-pointer hover:bg-white/5"
                style={{ color: user.disabled ? '#86efac' : '#fca5a5' }}
              >
                {user.disabled ? <UserCheck size={12} /> : <UserX size={12} />}
                {user.disabled ? '啟用' : '停用'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function UserList({ users, selfId, onEdit, onToggleDisabled }) {
  const [disabledOpen, setDisabledOpen] = useState(false);
  const active = users.filter(u => !u.disabled);
  const disabled = users.filter(u => u.disabled);

  const rowProps = u => ({
    key: u.id,
    user: u,
    isSelf: u.id === selfId,
    onEdit,
    onToggleDisabled,
  });

  if (users.length === 0) {
    return <p className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>尚無使用者</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {active.map(u => <UserRow {...rowProps(u)} />)}

      {disabled.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          <button
            onClick={() => setDisabledOpen(v => !v)}
            className="flex items-center gap-2 text-xs cursor-pointer hover:opacity-80 transition-opacity w-fit"
            style={{ color: 'var(--text-secondary)' }}
          >
            {disabledOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            已停用（{disabled.length}）
          </button>
          {disabledOpen && disabled.map(u => <UserRow {...rowProps(u)} />)}
        </div>
      )}
    </div>
  );
}

export default function UserManagement() {
  const { dbUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await apiGet('/api/users'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleAdd = async (form) => {
    setSaving(true);
    setError(null);
    try {
      await apiPost('/api/users', {
        email: form.email,
        role: form.role,
        institution_codes: form.role === 'admin' ? undefined : form.institution_codes,
        display_name: form.display_name || undefined,
      });
      setShowAdd(false);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (form) => {
    setSaving(true);
    setError(null);
    try {
      await apiPut(`/api/users/${form.id}`, {
        role: form.role,
        institution_codes: form.role === 'admin' ? [] : form.institution_codes,
        display_name: form.display_name || null,
      });
      setEditing(null);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDisabled = async (user) => {
    setError(null);
    try {
      if (user.disabled) {
        await apiPut(`/api/users/${user.id}`, { disabled: false });
      } else {
        await apiDelete(`/api/users/${user.id}`);
      }
      await loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>使用者管理</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            新增帳號並指派機構權限
          </p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setEditing(null); }}
          className="flex items-center gap-2 rounded-lg px-4 h-9 text-sm font-medium cursor-pointer"
          style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)' }}
        >
          <Plus size={15} /> 新增使用者
        </button>
      </div>

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: '#3f1212', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {/* 新增表單 */}
      {showAdd && (
        <div className="rounded-xl p-5" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
          <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>新增使用者</h3>
          <UserForm onSave={handleAdd} onCancel={() => setShowAdd(false)} loading={saving} />
        </div>
      )}

      {/* 編輯表單 */}
      {editing && (
        <div className="rounded-xl p-5" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
          <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>編輯使用者</h3>
          <UserForm
            initial={editing}
            onSave={handleEdit}
            onCancel={() => setEditing(null)}
            loading={saving}
          />
        </div>
      )}

      {/* 使用者列表 */}
      {loading ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>載入中…</p>
      ) : (
        <UserList
          users={users}
          selfId={dbUser?.id}
          onEdit={u => {
            setEditing({
              ...u,
              display_name: u.display_name ?? '',
              institution_codes: u.institution_codes ?? [INSTITUTIONS[0].code],
            });
            setShowAdd(false);
          }}
          onToggleDisabled={handleToggleDisabled}
        />
      )}
    </div>
  );
}
