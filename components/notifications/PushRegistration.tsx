import { useEffect } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useAuth } from '@/template';
import { updateProfile } from '@/services/profileService';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function PushRegistration() {
  const { user } = useAuth();

  useEffect(() => {
    let active = true;
    if (!user?.id || !Device.isDevice) return;
    (async () => {
      const current = await Notifications.getPermissionsAsync();
      let status = current.status;
      if (status !== 'granted') {
        const requested = await Notifications.requestPermissionsAsync();
        status = requested.status;
      }
      if (!active || status !== 'granted') return;
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('calls', {
            name: 'Calls', importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 300, 200, 300], sound: 'default',
          });
        }
        const token = (await Notifications.getExpoPushTokenAsync()).data;
        if (token) await updateProfile(user.id, { push_token: token });
      } catch {}
    })();
    return () => { active = false; };
  }, [user?.id]);

  return null;
}
