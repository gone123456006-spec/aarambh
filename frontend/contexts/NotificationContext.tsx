import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import {
  initializePushNotifications,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  getStoredToken,
} from '@/services/notificationService';
import { isLoggedInLocally } from '@/utils/authStorage';

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
      const loggedIn = await isLoggedInLocally();
      if (!loggedIn) {
        setIsInitialized(true);
        return;
      }

      const storedToken = await getStoredToken();
      if (storedToken) {
        setExpoPushToken(storedToken);
      }

      const success = await initializePushNotifications();
      setHasPermission(success);
      setIsInitialized(true);

      if (success) {
        const token = await getStoredToken();
        setExpoPushToken(token);
      }
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    void initialize();

    notificationListener.current = addNotificationReceivedListener((notification) => {
      console.log('📩 Notification received:', notification);
      setLastNotification(notification);
    });

    responseListener.current = addNotificationResponseListener((response) => {
      console.log('👆 Notification tapped:', response);
    });

    const retryTimer = setInterval(() => {
      void (async () => {
        const loggedIn = await isLoggedInLocally();
        if (loggedIn && !hasPermission) {
          await initialize();
        }
      })();
    }, 8000);

    return () => {
      clearInterval(retryTimer);
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [initialize, hasPermission]);

  const value: NotificationContextType = {
    isInitialized,
    hasPermission,
    lastNotification,
    expoPushToken,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
