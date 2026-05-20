import { api } from './api';

export type ProfileRole =
  | 'student'
  | 'instructor'
  | 'hod'
  | 'coordinator'
  | 'admin'
  | 'principal'
  | 'super_admin'
  | 'SAC';

const PROFILE_ENDPOINTS: Record<ProfileRole, string> = {
  student: 'students/profile/',
  instructor: 'instructors/profile/',
  hod: 'hods/profile/',
  coordinator: 'coordinators/profile/',
  admin: 'admin/profile/',
  principal: 'principal/profile/',
  super_admin: 'admin/profile/',
  SAC: 'admin/profile/',
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

<<<<<<< HEAD
export const updateProfile = async (data: any, isFormData: boolean = false) => {
  const headers: Record<string, string> = {};
  
  // When sending FormData, let axios set the Content-Type with boundary
  // For JSON data, explicitly set the content type
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  
  console.log('profileService: Sending updateProfile request');
  console.log('profileService: isFormData:', isFormData);
  console.log('profileService: data:', data);
  console.log('profileService: headers:', headers);
  
  try {
    const response = await api.put('auth/users/profile/update/', data, { headers });
    console.log('profileService: Response:', response.data);
    return response;
  } catch (error) {
    console.error('profileService: Error:', error);
    throw error;
  }
};
=======
export const updateProfile = async (data: any) => {
  return api.put('auth/users/profile/update/', data);
};
>>>>>>> d20874b4c7f20ce286a33d5060e426742042dd03
