export class EventController {
  static async getAllEvents() {
    try {
      const response = await fetch('/api/events/');
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch events' };
    }
  }

  static async createEvent(eventData: any) {
    try {
      const response = await fetch('/api/events/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create event' };
    }
  }

  static async updateEvent(id: number, eventData: any) {
    try {
      const response = await fetch(`/api/events/${id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update event' };
    }
  }
}