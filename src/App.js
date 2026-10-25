// Корневой компонент: AuthProvider + навигация (публичный/защищённый контуры)
import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './state/AuthContext';
import { NotificationsProvider, useNotifications } from './state/NotificationsContext';
import { LinkingProvider } from './state/LinkingContext';
import EventsScreen from './screens/EventsScreen';
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
  const { unread } = useNotifications();
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
      <Tab.Screen name="Events" component={EventsScreen} options={{
        title: 'События',
        tabBarBadge: unread || undefined,
        tabBarBadgeStyle: { backgroundColor: colors.primary },
        tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🔔</Text>,
      }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Профиль', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>👤</Text> }} />
    </Tab.Navigator>
  );
}

function GuestBanner() {
  const { exitGuest } = useAuth();
  return (
    <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ color: '#92400e', fontSize: 12, flex: 1, fontWeight: '600' }}>
        ⚔ Открыто по QR-коду карточки (гостевой доступ)
      </Text>
      <Text style={{ color: '#b45309', fontSize: 12, fontWeight: '700' }} onPress={async () => {
        const back = await exitGuest();
        if (!back) globalThis.__zezarResetNav && globalThis.__zezarResetNav();
      }}> Вернуться ↩</Text>
    </View>
  );
}

function Root() {
  const { booting, isAuthed, guest } = useAuth();
  const navRef = React.useRef(null);
  React.useEffect(() => {
    globalThis.__zezarDeepLink = (uid) => {
      try {
        const nav = navRef.current;
        if (!nav || !nav.isReady()) return; // стек ещё не смонтирован — LinkingContext поставит в очередь
        nav.navigate('Entity', { uid });
      } catch (_) {}
    };
    globalThis.__zezarResetNav = () => {
      try { navRef.current && navRef.current.reset({ index: 0, routes: [{ name: isAuthed ? 'Main' : 'Login' }] }); } catch (_) {}
    };
    return () => { globalThis.__zezarDeepLink = null; globalThis.__zezarResetNav = null; };
  }, []);
  if (booting) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink }}>
        <Text style={{ color: colors.primary, fontSize: 30, fontWeight: '800', marginBottom: 20 }}>⚔ ЦЕЗАРЬ</Text>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }
  return (
    <NavigationContainer ref={navRef} theme={navTheme}>
      {guest ? <GuestBanner /> : null}
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
        <NotificationsProvider>
          <LinkingProvider>
            <StatusBar style="light" />
            <Root />
          </LinkingProvider>
        </NotificationsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
