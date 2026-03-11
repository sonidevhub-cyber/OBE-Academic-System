import React, { useMemo, useState } from 'react';

type GenericUser = Record<string, any> | null | undefined;

interface TopbarProfileMenuProps {
  userData?: GenericUser;
  label?: string;
}

const HIDDEN_KEYS = new Set([
  'password',
  'access_token',
  'refresh_token',
  'token'
]);

const prettifyKey = (key: string) =>
  key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const formatValue = (value: any): string => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const resolveImage = (user: GenericUser): string | null => {
  if (!user) return null;
  const raw =
    user.profile_image ||
    user.profile_picture ||
    user.image ||
    user.avatar ||
    user.photo ||
    null;
  if (!raw) return null;
  if (typeof raw !== 'string') return null;
  if (raw.startsWith('http')) return raw;
  if (raw.startsWith('/')) return `http://127.0.0.1:8000${raw}`;
  return raw;
};

const resolveDisplayName = (user: GenericUser): string => {
  if (!user) return 'User';
  const first = user.first_name || '';
  const last = user.last_name || '';
  const full = `${first} ${last}`.trim();
  return full || user.name || user.full_name || user.username || 'User';
};

const TopbarProfileMenu: React.FC<TopbarProfileMenuProps> = ({ userData, label }) => {
  const [open, setOpen] = useState(false);
  const displayName = resolveDisplayName(userData);
  const role = userData?.effective_role || userData?.active_role || userData?.role || '-';
  const imageUrl = resolveImage(userData);
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join('') || 'U';

  const fields = useMemo(() => {
    if (!userData) return [];
    return Object.entries(userData)
      .filter(([key, value]) => !HIDDEN_KEYS.has(key) && value !== undefined && value !== null)
      .map(([key, value]) => ({
        key,
        label: prettifyKey(key),
        value: formatValue(value)
      }));
  }, [userData]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 rounded-xl bg-white/15 hover:bg-white/25 px-3 py-2 transition-colors border border-white/20"
        title="View Profile"
      >
        <div className="h-10 w-10 rounded-full bg-white/25 text-white flex items-center justify-center overflow-hidden border border-white/50">
          {imageUrl ? (
            <img src={imageUrl} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            <span className="font-semibold text-sm">{initials}</span>
          )}
        </div>
        <div className="text-left hidden sm:block">
          <p className="text-sm font-semibold text-white leading-tight">{displayName}</p>
          <p className="text-xs text-white/80">{label || role}</p>
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-label="Close"
          />
          <div className="relative z-10 w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-200">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-300">
                  {imageUrl ? (
                    <img src={imageUrl} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-bold text-lg text-gray-700">{initials}</span>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{displayName}</h3>
                  <p className="text-sm text-gray-600">{label || role}</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-9 w-9 rounded-full hover:bg-gray-100 text-gray-700"
                aria-label="Close profile"
              >
                x
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {fields.map((field) => (
                  <div key={field.key} className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{field.label}</p>
                    <p className="text-sm text-gray-900 break-words mt-1">{field.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TopbarProfileMenu;
