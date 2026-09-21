# NexTalk

NexTalk is a native React Native Android communication app.

## Stack
- React Native 0.79.7
- Native Android + Gradle
- React Navigation
- Supabase Auth / Realtime
- react-native-webrtc for calling foundation
- react-native-config for build-time environment configuration

## No Expo
This branch does not use Expo, Expo Router, Expo Go, EAS, or Expo prebuild. Android is a committed native project.

## Environment
Copy `.env.example` to `.env` and set the Supabase URL and anon key. Mobile client configuration is public by design; never put service-role keys or signing secrets in `.env`.

## Android
Install dependencies with `npm install`, then use Android Studio/Gradle for the native build. GitHub Actions builds the debug APK directly with Gradle 8.13.

## Current V1
- Native authentication screen
- Chats list
- Contacts search
- Direct chat
- Supabase realtime messages
- Read-state RPC/unread-count backend foundation
- Native Android project ready for the next calling/notification layers
