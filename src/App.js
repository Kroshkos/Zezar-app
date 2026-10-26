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
import { UpdateProvider, useUpdate } from './state/UpdateContext';
import EventsScreen from './screens/EventsScreen';
import ScanScreen from './screens/ScanScreen';
import { ScreenErrorBoundary } from './components/ui';
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
      {/* v1.7: встроенный QR-сканер — кнопка по середине нижнего футера */}
      <Tab.Screen
        name="ScanTab"
        component={() => null}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault(); // сам таб не открывается — редиректим на модалку сканера
            navigation.navigate('Scan');
          },
        })}
        options={{
          title: 'Скан',
          tabBarLabel: 'Скан',
          tabBarStyle: { backgroundColor: colors.tabBar },
          tabBarIcon: () => (
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: -18, borderWidth: 3, borderColor: colors.tabBar, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 6 }}>
              <Text style={{ color: '#fff', fontSize: 20 }}>▣</Text>
            </View>
          ),
        }}
      />
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

// v1.6: баннер доступного обновления (тап = скачать APK со страницы релиза)
function UpdateBanner() {
  const { update, promptInstall, dismiss } = useUpdate();
  if (!update) return null;
  return (
    <View style={{ backgroundColor: '#dbeafe', paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' }}>
      <Text style={{ color: '#1e40af', fontSize: 12, flex: 1, fontWeight: '600' }} onPress={promptInstall}>
        ⬆ Доступна версия {update.version} — нажмите, чтобы обновить
      </Text>
      <Text style={{ color: '#1e40af', fontSize: 12, paddingLeft: 10 }} onPress={dismiss}>✕</Text>
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
      <UpdateBanner />
      {guest ? <GuestBanner /> : null}
      <ScreenErrorBoundary>
        <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.ink }, headerTintColor: '#fff' }}>
          {isAuthed ? (
            <>
              <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
              <Stack.Screen name="NewTask" component={NewTaskScreen} options={{ title: 'Новая задача' }} />
              <Stack.Screen name="Entity" component={EntityScreen} options={{ title: 'Карточка' }} />
              <Stack.Screen name="Scan" component={ScanScreen} options={{ title: 'Сканер QR', headerStyle: { backgroundColor: '#000' }, headerShadowVisible: false }} />
            </>
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          )}
        </Stack.Navigator>
      </ScreenErrorBoundary>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <UpdateProvider>
          <NotificationsProvider>
            <LinkingProvider>
              <StatusBar style="light" />
              <Root />
            </LinkingProvider>
          </NotificationsProvider>
        </UpdateProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
