import React, { createContext, useContext, type ReactNode } from 'react';
import { Alert, Platform } from 'react-native';

type AlertButton = { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' };
type AlertContextValue = { showAlert: (title: string, message?: string, buttons?: AlertButton[]) => void };
const AlertContext = createContext<AlertContextValue | null>(null);

export function AlertProvider({ children }: { children: ReactNode }) {
  const showAlert = (title: string, message?: string, buttons?: AlertButton[]) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.alert([title, message].filter(Boolean).join('\n'));
      return;
    }
    Alert.alert(title, message ?? '', buttons?.length ? buttons : [{ text: 'OK' }]);
  };
  return <AlertContext.Provider value={{ showAlert }}>{children}</AlertContext.Provider>;
}
export function useAlert() {
  const value = useContext(AlertContext);
  if (!value) throw new Error('useAlert must be used inside AlertProvider');
  return value;
}