export class TimetableController {
  static async getTimetable(filters: any) {
    try {
      const response = await fetch('/api/timetable/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters)
      });
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch timetable' };
    }
  }

  static async updateTimetable(timetableData: any) {
    try {
      const response = await fetch('/api/timetable/update/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(timetableData)
      });
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update timetable' };
    }
  }

  static async generateTimetable(params: any) {
    try {
      const response = await fetch('/api/timetable/generate/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to generate timetable' };
    }
  }
}