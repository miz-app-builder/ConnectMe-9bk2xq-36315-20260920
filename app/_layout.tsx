import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider, AuthProvider } from '@/template';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { IncomingCallOverlay } from '@/components/call/IncomingCallOverlay';
import { PushRegistration } from '@/components/notifications/PushRegistration';

export default function RootLayout() {
  return (
    <AlertProvider>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="chat/[id]" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="call/[id]" options={{ animation: 'fade' }} />
              <Stack.Screen name="call-history" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="edit-profile" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="group-info" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="search" options={{ animation: 'slide_from_bottom' }} />
              <Stack.Screen name="starred" options={{ animation: 'slide_from_right' }} />
            </Stack>
            <PushRegistration />
            <IncomingCallOverlay />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
