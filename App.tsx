import React from "react";
import {NavigationContainer,DefaultTheme} from "@react-navigation/native";
import {createNativeStackNavigator} from "@react-navigation/native-stack";
import {createBottomTabNavigator} from "@react-navigation/bottom-tabs";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {StatusBar} from "react-native";
import {AuthProvider,useAuth} from "@/contexts/AuthContext";
import LoginScreen from "@/screens/LoginScreen";
import ChatsScreen from "@/screens/ChatsScreen";
import ContactsScreen from "@/screens/ContactsScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import ChatScreen from "@/screens/ChatScreen";
type RootStackParamList={Auth:undefined;Main:undefined;Chat:{conversationId:string}};
const Stack=createNativeStackNavigator<RootStackParamList>(); const Tabs=createBottomTabNavigator();
function MainTabs(){return <Tabs.Navigator screenOptions={{headerShown:false,tabBarStyle:{backgroundColor:"#0B1220",borderTopColor:"#1E293B"},tabBarActiveTintColor:"#25D366",tabBarInactiveTintColor:"#718096"}}><Tabs.Screen name="Chats" component={ChatsScreen}/><Tabs.Screen name="Contacts" component={ContactsScreen}/><Tabs.Screen name="Settings" component={SettingsScreen}/></Tabs.Navigator>}
function Root(){const{session,loading}=useAuth();if(loading)return null;return <NavigationContainer theme={{...DefaultTheme,colors:{...DefaultTheme.colors,background:"#0B1220",card:"#0B1220",text:"#fff",border:"#1E293B",primary:"#25D366"}}}><Stack.Navigator screenOptions={{headerShown:false}}>{session?<><Stack.Screen name="Main" component={MainTabs}/><Stack.Screen name="Chat" component={ChatScreen}/></>:<Stack.Screen name="Auth" component={LoginScreen}/>}</Stack.Navigator></NavigationContainer>}
export default function App(){return <SafeAreaProvider><AuthProvider><StatusBar barStyle="light-content" backgroundColor="#0B1220"/><Root/></AuthProvider></SafeAreaProvider>}
