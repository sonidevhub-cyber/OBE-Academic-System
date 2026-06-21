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

  const response = await api.get(endpoint);
  // The backend uses api_response() which returns { data: ..., message: ... }
  if (response.data?.data) {
    // Create a new response-like object with the actual profile as response.data
    return { data: response.data.data };
  }
  return response;
};

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
