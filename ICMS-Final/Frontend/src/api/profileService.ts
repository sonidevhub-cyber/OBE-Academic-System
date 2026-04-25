import { api } from './api';

export type ProfileRole =
  | 'student'
  | 'instructor'
  | 'hod'
  | 'coordinator'
  | 'admin'
  | 'principal'
  | 'super_admin';

const PROFILE_ENDPOINTS: Record<ProfileRole, string> = {
  student: 'students/profile/',
  instructor: 'instructors/profile/',
  hod: 'hods/profile/',
  coordinator: 'coordinators/profile/',
  admin: 'admin/profile/',
  principal: 'principal/profile/',
  super_admin: 'admin/profile/',
};

export const getProfileEndpoint = (role?: string | null): string | null => {
  if (!role) return null;
  return PROFILE_ENDPOINTS[role as ProfileRole] || null;
};

export const fetchCurrentProfile = async (role?: string | null) => {
  const endpoint = getProfileEndpoint(role);
  if (!endpoint) {
    throw new Error(`No profile endpoint available for role "${role || 'unknown'}"`);
  }

  return api.get(endpoint);
};

