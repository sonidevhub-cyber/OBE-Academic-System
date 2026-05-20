import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Simulate real-time notifications (in a real app, this would connect to WebSocket)
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate random notifications
      if (Math.random() < 0.1) { // 10% chance every 30 seconds
        const types: ('info' | 'success' | 'warning' | 'error')[] = ['info', 'success', 'warning', 'error'];
        const messages = [
          { title: 'New Student Registration', message: 'A new student has registered for admission.' },
          { title: 'Course Enrollment Full', message: 'CS101 course has reached maximum capacity.' },
          { title: 'System Maintenance', message: 'Scheduled maintenance in 2 hours.' },
          { title: 'Grade Submission Due', message: 'Final grades for Spring semester due tomorrow.' },
          { title: 'Payment Received', message: 'Tuition payment received from student ID: 2024001.' },
        ];

        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        const randomType = types[Math.floor(Math.random() * types.length)];

        addNotification({
          type: randomType,
          title: randomMessage.title,
          message: randomMessage.message,
        });
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false,
    };
    setNotifications(prev => [newNotification, ...prev]);
  };

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notif => ({ ...notif, read: true }))
    );
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
