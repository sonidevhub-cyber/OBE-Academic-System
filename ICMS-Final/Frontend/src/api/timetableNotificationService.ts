import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

interface NotificationPayload {
  recipient_type: 'instructor' | 'student' | 'semester';
  recipient_id?: string;
  semester_id?: string;
  message: string;
  timetable_data?: any;
}

class TimetableNotificationService {
  private getAuthHeaders() {
    const authData = localStorage.getItem('auth');
    if (!authData) throw new Error('No authentication data found');
    
    const { access_token } = JSON.parse(authData);
    return {
      'Authorization': `Token ${access_token}`,
      'Content-Type': 'application/json'
    };
  }

  // Send timetable to instructor when class is assigned
  async notifyInstructorAssignment(instructorId: string, classDetails: any) {
    try {
      const payload: NotificationPayload = {
        recipient_type: 'instructor',
        recipient_id: instructorId,
        message: `New class assigned: ${classDetails.course_name} (${classDetails.course_code}) - ${classDetails.day} at ${classDetails.start_time}`,
        timetable_data: classDetails
      };

      await axios.post(`${API_BASE_URL}/notifications/timetable-assignment/`, payload, {
        headers: this.getAuthHeaders()
      });

      // Also send email notification
      await this.sendEmailNotification({
        recipient_id: instructorId,
        subject: 'New Class Assignment',
        template: 'instructor_assignment',
        data: classDetails
      });

    } catch (error) {
      console.error('Error notifying instructor:', error);
    }
  }

  // Send timetable to all students when HOD approves
  async notifyStudentsOnApproval(semesterId: string, timetableData: any) {
    try {
      const payload: NotificationPayload = {
        recipient_type: 'semester',
        semester_id: semesterId,
        message: 'Your timetable has been approved and is now available',
        timetable_data: timetableData
      };

      await axios.post(`${API_BASE_URL}/notifications/timetable-approval/`, payload, {
        headers: this.getAuthHeaders()
      });

      // Send bulk email to all students in semester
      await this.sendBulkEmailNotification({
        semester_id: semesterId,
        subject: 'Timetable Approved - Now Available',
        template: 'timetable_approval',
        data: timetableData
      });

    } catch (error) {
      console.error('Error notifying students:', error);
    }
  }

  // Send email notification
  private async sendEmailNotification(emailData: any) {
    try {
      await axios.post(`${API_BASE_URL}/notifications/email/`, emailData, {
        headers: this.getAuthHeaders()
      });
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }

  // Send bulk email notification
  private async sendBulkEmailNotification(emailData: any) {
    try {
      await axios.post(`${API_BASE_URL}/notifications/bulk-email/`, emailData, {
        headers: this.getAuthHeaders()
      });
    } catch (error) {
      console.error('Error sending bulk email:', error);
    }
  }
}

export const timetableNotificationService = new TimetableNotificationService();
export default timetableNotificationService;