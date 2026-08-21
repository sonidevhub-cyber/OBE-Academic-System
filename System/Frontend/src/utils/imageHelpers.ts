/**
 * Helper functions for handling image URLs across the application
 */

const BACKEND_URL = 'http://localhost:8000';

/**
 * Ensures an image URL has the full domain prefix
 * @param url - Either a full URL or relative path starting with /
 */
export const getFullImageUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  
  // If it's already a full URL (starts with http), return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // If it's a relative path starting with /media/, prepend backend URL
  if (url.startsWith('/media/')) {
    return `${BACKEND_URL}${url}`;
  }
  
  // If it starts with media/, prepend backend URL and /
  if (url.startsWith('media/')) {
    return `${BACKEND_URL}/${url}`;
  }
  
  return undefined;
};

/**
 * Get initials from first letter of each word in name(s)
 */
export const getInitials = (...names: (string | undefined)[]): string => {
  return names
    .filter((n): n is string => Boolean(n))
    .map(name => name.charAt(0).toUpperCase())
    .join('');
};

export default { getFullImageUrl, getInitials };
