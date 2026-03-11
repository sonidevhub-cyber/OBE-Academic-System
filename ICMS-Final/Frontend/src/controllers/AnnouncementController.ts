export class AnnouncementController {
  static async getAllAnnouncements() {
    try {
      const response = await fetch('/api/announcements/');
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch announcements' };
    }
  }

  static async createAnnouncement(announcementData: any) {
    try {
      const response = await fetch('/api/announcements/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(announcementData)
      });
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create announcement' };
    }
  }

  static async deleteAnnouncement(id: number) {
    try {
      await fetch(`/api/announcements/${id}/`, { method: 'DELETE' });
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete announcement' };
    }
  }
}