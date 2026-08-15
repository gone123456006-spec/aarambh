import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import {
  initializePushNotifications,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  unregisterDeviceToken,
  getStoredToken,
} from '@/services/notificationService';

interface NotificationContextType {
  isInitialized: boolean;
  hasPermission: boolean;
  lastNotification: Notifications.Notification | null;
  expoPushToken: string | null;
}

const NotificationContext = createContext<NotificationContextType>({
  isInitialized: false,
  hasPermission: false,
  lastNotification: null,
  expoPushToken: null,
});

export function useNotifications() {
  return useContext(NotificationContext);
}

interface NotificationProviderProps {
  children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [lastNotification, setLastNotification] = useState<Notifications.Notification | null>(null);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  const initialize = useCallback(async () => {
    try {
      // Load stored token first
      const storedToken = await getStoredToken();
      if (storedToken) {
        setExpoPushToken(storedToken);
      }

      // Initialize push notifications
      const success = await initializePushNotifications();
      setHasPermission(success);
      setIsInitialized(true);

      if (success) {
        // Get fresh token
        const token = await getStoredToken();
        setExpoPushToken(token);
      }
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    // Initialize notifications
    void initialize();

    // Set up notification listeners
    notificationListener.current = addNotificationReceivedListener((notification) => {
      console.log('📩 Notification received:', notification);
      setLastNotification(notification);
    });

    responseListener.current = addNotificationResponseListener((response) => {
      console.log('👆 Notification tapped:', response);
      const data = response.notification.request.content.data;
      
      // Handle notification tap based on data
      // You can add navigation logic here
      // For example, navigate to a specific screen based on notification type
      if (data?.type === 'course') {
        // Navigate to course screen
        console.log('Navigate to course:', data.courseId);
      } else if (data?.type === 'update') {
        // Navigate to updates screen
        console.log('Navigate to updates');
      }
    });

    // Cleanup on unmount
    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [initialize]);

  const value: NotificationContextType = {
    isInitialized,
    hasPermission,
    lastNotification,
    expoPushToken,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
