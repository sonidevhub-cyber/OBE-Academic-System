// Utility functions for handling course data safely

/**
 * Safely extracts course name from course data
 * Handles both string and object formats
 * @param courseData - Course data that could be a string or object
 * @returns Course name as string or 'N/A' if not available
 */
export const getCourseName = (courseData: any): string => {
  if (!courseData) return 'N/A';

  // If it's an object with a name property, extract the name
  if (typeof courseData === 'object' && courseData !== null && 'name' in courseData) {
    return courseData.name || 'N/A';
  }

  // If it's a string, return as is
  if (typeof courseData === 'string') {
    return courseData || 'N/A';
  }

  // Fallback
  return 'N/A';
};

/**
 * Safely extracts course code from course data
 * @param courseData - Course data that could be a string or object
 * @returns Course code as string or 'N/A' if not available
 */
export const getCourseCode = (courseData: any): string => {
  if (!courseData) return 'N/A';

  // If it's an object with a code property, extract the code
  if (typeof courseData === 'object' && courseData !== null && 'code' in courseData) {
    return courseData.code || 'N/A';
  }

  // If it's a string, return as is
  if (typeof courseData === 'string') {
    return courseData || 'N/A';
  }

  // Fallback
  return 'N/A';
};
