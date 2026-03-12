
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AppNotification, NotificationType } from '../types';

interface NotificationContextType {
  notifications: AppNotification[];
  addNotification: (type: NotificationType, title: string, message: string, details?: string) => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const lastNotifiedRef = React.useRef<{ [key: string]: number }>({});

  const addNotification = useCallback((type: NotificationType, title: string, message: string, details?: string) => {
    const now = Date.now();
    const key = `${type}-${title}-${message}`;
    
    // Prevent duplicate notifications within 3 seconds
    if (lastNotifiedRef.current[key] && now - lastNotifiedRef.current[key] < 3000) {
      return;
    }
    
    lastNotifiedRef.current[key] = now;
    const id = `${now}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: AppNotification = { id, type, title, message, details };
    setNotifications(prev => [newNotification, ...prev]);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      addNotification, 
      dismissNotification, 
      clearAll,
      unreadCount: notifications.length 
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
