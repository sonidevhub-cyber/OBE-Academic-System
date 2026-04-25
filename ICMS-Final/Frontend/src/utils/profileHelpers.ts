import { getFullImageUrl } from './imageHelpers';

export type ProfileLike = Record<string, any> | null | undefined;

const hasText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const firstText = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (hasText(value)) {
      return value.trim();
    }
  }
  return null;
};

const toTitleCase = (value: string): string =>
  value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const ROLE_LABELS: Record<string, string> = {
  student: 'Student',
  instructor: 'Instructor',
  coordinator: 'Coordinator',
  hod: 'Head of Department',
  admin: 'Administrator',
  principal: 'Principal',
  super_admin: 'Super Admin',
  staff: 'Staff',
};

export const getEffectiveRole = (profile: ProfileLike, fallback = 'user'): string => {
  if (!profile) return fallback;
  return (
    firstText(
      profile.effective_role,
      profile.active_role,
      profile.role,
      profile.user_type
    ) ?? fallback
  );
};

export const getDisplayName = (profile: ProfileLike, fallback = 'User'): string => {
  if (!profile) return fallback;

  const fullName = firstText(
    profile.display_name,
    profile.full_name,
    profile.name
  );
  if (fullName) return fullName;

  const combined = firstText(
    `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
  );
  if (combined) return combined;

  return (
    firstText(
      profile.username,
      profile.email
    ) ?? fallback
  );
};

export const getProfileInitials = (profile: ProfileLike, fallback = 'U'): string => {
  const name = getDisplayName(profile, fallback);
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length === 0) return fallback;
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || fallback;
};

export const getProfileImageUrl = (profile: ProfileLike): string | null => {
  if (!profile) return null;

  const raw = firstText(
    profile.profile_pic,
    profile.profile_image,
    profile.profile_picture,
    profile.image,
    profile.avatar,
    profile.photo
  );

  if (!raw) return null;

  return getFullImageUrl(raw) ?? (raw.startsWith('/') ? `http://127.0.0.1:8000${raw}` : raw);
};

export const getDepartmentLabel = (department: any): string | null => {
  if (!department) return null;
  if (typeof department === 'string') return department.trim() || null;

  return firstText(
    department.name,
    department.department_name,
    department.code,
    department.title
  );
};

export const getSemesterLabel = (semester: any): string | null => {
  if (!semester) return null;
  if (typeof semester === 'string') return semester.trim() || null;

  return firstText(
    semester.name,
    semester.semester_name,
    semester.semester_code
  );
};

export const formatProfileDate = (value: any): string | null => {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const formatProfileValue = (value: any): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  if (value instanceof Date) {
    return formatProfileDate(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    const labels = value
      .map((item) => formatProfileValue(item))
      .filter((item): item is string => Boolean(item));
    return labels.length ? labels.join(', ') : `${value.length} item${value.length === 1 ? '' : 's'}`;
  }

  if (typeof value === 'object') {
    return (
      firstText(
        value.name,
        value.full_name,
        value.title,
        value.code
      ) ??
      formatProfileValue(value.id) ??
      null
    );
  }

  return String(value);
};

export const getStatusLabel = (profile: ProfileLike): string | null => {
  if (!profile) return null;

  const status = firstText(
    profile.status,
    profile.account_status,
    profile.state,
    profile.is_active === false ? 'inactive' : undefined
  );

  if (!status) return profile.is_active === false ? 'Inactive' : null;

  return toTitleCase(status);
};

export const getRoleLabel = (profile: ProfileLike, fallback = 'User'): string => {
  if (!profile) return fallback;

  const role = getEffectiveRole(profile, '');
  if (!role) return fallback;

  return ROLE_LABELS[role.toLowerCase()] || toTitleCase(role);
};

export const buildProfileField = (label: string, value: any, formatter = formatProfileValue) => {
  const formatted = formatter(value);
  if (!formatted) return null;

  return {
    label,
    value: formatted,
  };
};
