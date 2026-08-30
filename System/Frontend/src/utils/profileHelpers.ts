import { getFullImageUrl } from './imageHelpers';

// Fallback backend URL for cases where getFullImageUrl doesn't handle the path
const BACKEND_URL = 'http://localhost:8000';

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
  sac: 'SAC',
  student: 'Student',
  instructor: 'Instructor',
  coordinator: 'Coordinator',
  hod: 'Head of Department',
  admin: 'Administrator',
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

  // Try to use the utility function first
  const fullUrl = getFullImageUrl(raw);
  if (fullUrl) return fullUrl;

  // Fallback for paths that don't start with /media/ or http
  if (raw.startsWith('/')) {
    return `${BACKEND_URL}${raw}`;
  }

  return raw;
};

export const getDepartmentLabel = (department: any, profile?: any): string | null => {
  if (!department && !profile) return null;
  
  // First check if we have an instructor profile with department
  if (profile?.instructor_profile) {
    const instructorDept = firstText(
      profile.instructor_profile.department_name,
      profile.instructor_profile.department
    );
    if (instructorDept) {
      return formatProgramName(instructorDept);
    }
  }
  
  // Check programs_list from user serializer
  if (profile?.programs_list && Array.isArray(profile.programs_list) && profile.programs_list.length > 0) {
    return formatProgramName(profile.programs_list[0]);
  }
  
  // Check profile.programs directly
  if (profile?.programs && Array.isArray(profile.programs) && profile.programs.length > 0) {
    const programName = firstText(
      profile.programs[0].name,
      profile.programs[0].code
    );
    return formatProgramName(programName);
  }
  
  // Try to get department from profile fields directly
  if (profile) {
    const profileDept = firstText(
      profile.department,
      profile.department_name,
      profile.dept,
      profile.dept_name
    );
    if (profileDept) {
      if (typeof profileDept === 'string') {
        return formatProgramName(profileDept.trim() || null);
      } else {
        // Try to extract from object
        const deptName = firstText(
          (profileDept as any).name,
          (profileDept as any).department_name,
          (profileDept as any).code,
          (profileDept as any).title,
          (profileDept as any).dept,
          (profileDept as any).dept_name
        );
        return formatProgramName(deptName);
      }
    }
  }
  
  if (!department) return null;
  
  if (typeof department === 'string') {
    return formatProgramName(department.trim() || null);
  }

  const deptName = firstText(
    department.name,
    department.department_name,
    department.code,
    department.title,
    department.dept,
    department.dept_name
  );
  return formatProgramName(deptName);
};

// Helper function to format program names
const formatProgramName = (name: any): string | null => {
  if (!name) return null;
  const nameStr = String(name);
  
  // Special cases for common program codes
  if (nameStr.toLowerCase().includes('bscs') || nameStr.toLowerCase() === 'bscs') {
    return 'CS (Computer Science)';
  }
  if (nameStr.toLowerCase().includes('cs') && nameStr.length <= 4) {
    return 'CS (Computer Science)';
  }
  
  // If it's just a short code, try to expand it
  if (nameStr.length <= 4) {
    const mappings: Record<string, string> = {
      'cs': 'CS (Computer Science)',
      'se': 'SE (Software Engineering)',
      'it': 'IT (Information Technology)',
      'ai': 'AI (Artificial Intelligence)',
      'ds': 'DS (Data Science)',
      'bba': 'BBA (Business Administration)',
    };
    const lowerName = nameStr.toLowerCase();
    if (mappings[lowerName]) {
      return mappings[lowerName];
    }
  }
  
  return nameStr;
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
// 🔥 Bloom's Taxonomy level code -> display text mapping
// Backend sends raw bloom_level (e.g. "L1"); adjust keys/values below
// to exactly match what your CLO model's bloom_level choices actually are.
export const BLOOM_LEVEL_MAP: { [key: string]: string; } = {
  C1: "C1 - Remember",
  C2: "C2 - Understand",
  C3: "C3 - Apply",
  C4: "C4 - Analyze",
  C5: "C5 - Evaluate",
  C6: "C6 - Create",
};
