import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

interface Notification {
  id: number;
  message: string;
  feedback_id: number;
  feedback_title: string;
  is_read: boolean;
  created_at: string;
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [newNotification, setNewNotification] = useState<Notification | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = JSON.parse(sessionStorage.getItem("auth") || localStorage.getItem("auth") || "{}")?.access_token;
      const response = await axios.get(
        'http://127.0.0.1:8000/api/feedback/notifications/',
        { headers: { Authorization: `Token ${token}` } }
      );
      
      const newNotifications = response.data.notifications;
      const newUnreadCount = response.data.unread_count;
      
      // Check for new notifications
      if (notifications.length > 0 && newNotifications.length > notifications.length) {
        const latestNotification = newNotifications[0];
        if (!notifications.find(n => n.id === latestNotification.id)) {
          setNewNotification(latestNotification);
          showBrowserNotification(latestNotification);
        }
      }
      
      setNotifications(newNotifications);
      setUnreadCount(newUnreadCount);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, [notifications.length]);

  const showBrowserNotification = (notification: Notification) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('New Feedback Received', {
        body: notification.message,
        icon: '/favicon.ico',
        tag: `feedback-${notification.id}`
      });
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  const markAsRead = async (notificationId: number) => {
    try {
      const token = JSON.parse(sessionStorage.getItem("auth") || localStorage.getItem("auth") || "{}")?.access_token;
      await axios.patch(
        `http://127.0.0.1:8000/api/feedback/notifications/${notificationId}/read/`,
        {},
        { headers: { Authorization: `Token ${token}` } }
      );
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const clearNewNotification = () => {
    setNewNotification(null);
  };

  useEffect(() => {
    requestNotificationPermission();
    fetchNotifications();
    
    // Poll for new notifications every 5 seconds
    const interval = setInterval(fetchNotifications, 5000);
    
    return () => clearInterval(interval);
  }, []);

  return {
    notifications,
    unreadCount,
    newNotification,
    markAsRead,
    clearNewNotification,
    fetchNotifications
  };
};