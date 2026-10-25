// Корневой компонент: AuthProvider + навигация (публичный/защищённый контуры)
import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './state/AuthContext';
import { colors } from './theme/colors';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import TasksScreen from './screens/TasksScreen';
import NewTaskScreen from './screens/NewTaskScreen';
import EntityScreen from './screens/EntityScreen';
import ProfileScreen from './screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: colors.primary, background: colors.bg, card: colors.tabBar, text: colors.ink, border: colors.line },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#94a3b8',
        headerStyle: { backgroundColor: colors.ink },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Главная', tabBarLabel: 'Главная', tabBarIcon: ({ color }) => <View><Text style={{ color, fontSize: 18 }}>⚔</Text></View> }} />
      <Tab.Screen name="Tasks" component={TasksScreen} options={{ title: 'Задачи', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🗂</Text> }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Профиль', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>👤</Text> }} />
    </Tab.Navigator>
  );
}

function Root() {
  const { booting, isAuthed } = useAuth();
  if (booting) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink }}>
        <Text style={{ color: colors.primary, fontSize: 30, fontWeight: '800', marginBottom: 20 }}>⚔ ЦЕЗАРЬ</Text>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.ink }, headerTintColor: '#fff' }}>
        {isAuthed ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="NewTask" component={NewTaskScreen} options={{ title: 'Новая задача' }} />
            <Stack.Screen name="Entity" component={EntityScreen} options={{ title: 'Карточка' }} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
