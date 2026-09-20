import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider, AuthProvider } from '@/template';
import { ThemeProvider } from '@/contexts/ThemeContext';

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
              <Stack.Screen
                name="chat/[id]"
                options={{ headerShown: false, animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="edit-profile"
                options={{ headerShown: false, animation: 'slide_from_bottom' }}
              />
              <Stack.Screen
                name="group-info"
                options={{ headerShown: false, animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="search"
                options={{ headerShown: false, animation: 'slide_from_bottom' }}
              />
              <Stack.Screen
                name="starred"
                options={{ headerShown: false, animation: 'slide_from_right' }}
              />
            </Stack>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
