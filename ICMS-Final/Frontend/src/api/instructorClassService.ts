interface ClassAssignment {
  id: number;
  course_code: string;
  course_name: string;
  room: string;
  start_time: string;
  end_time: string;
  day: string;
  semester: string;
  department: string;
  credits: number;
  type: 'lecture' | 'lab' | 'tutorial';
  status: 'approved' | 'pending';
  approved_by: string;
  approved_date: string;
}

export const instructorClassService = {
  // Fetch classes assigned to instructor by HOD
  async getMyClasses(instructorId: string): Promise<ClassAssignment[]> {
    try {
      const response = await fetch(`/api/instructor/${instructorId}/classes`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching instructor classes:', error);
      // Return mock data as fallback
      return [
        {
          id: 1,
          course_code: 'CS101',
          course_name: 'Introduction to Computer Science',
          room: 'Room A-101',
          start_time: '09:00',
          end_time: '10:00',
          day: 'Monday',
          semester: 'Fall 2024',
          department: 'Computer Science',
          credits: 3,
          type: 'lecture',
          status: 'approved',
          approved_by: 'Dr. HOD Smith',
          approved_date: '2024-01-15'
        }
      ];
    }
  },

  // Fetch weekly schedule for instructor
  async getWeeklySchedule(instructorId: string): Promise<ClassAssignment[]> {
    try {
      const response = await fetch(`/api/instructor/${instructorId}/schedule`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching weekly schedule:', error);
      return [];
    }
  },

  // Accept a class assignment
  async acceptClass(classId: number): Promise<void> {
    try {
      const response = await fetch(`/api/instructor/classes/${classId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error accepting class:', error);
      throw error;
    }
  },

  // Request modification for a class assignment
  async requestModification(classId: number, reason: string): Promise<void> {
    try {
      const response = await fetch(`/api/instructor/classes/${classId}/modify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ reason })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error requesting modification:', error);
      throw error;
    }
  }
};