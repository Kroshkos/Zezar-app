// Корневой компонент: AuthProvider + навигация (публичный/защищённый контуры)
import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './state/AuthContext';
import { NotificationsProvider, useNotifications } from './state/NotificationsContext';
import { LinkingProvider, useDeepLink } from './state/LinkingContext';
import { UpdateProvider, useUpdate } from './state/UpdateContext';
import EventsScreen from './screens/EventsScreen';
import { ScreenErrorBoundary, Button } from './components/ui';
import QrScannerSheet from './components/QrScannerSheet';
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

// v1.7: круглая кнопка-сканер по центру нижнего футера (между вкладками «Задачи» и «События»)
function QrTabButton({ onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Сканировать QR-код"
      style={{
        width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary,
        alignItems: 'center', justifyContent: 'center', marginBottom: 22,
        shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
        elevation: 6,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 24 }}>▣</Text>
    </TouchableOpacity>
  );
}

function MainTabs() {
  const { unread } = useNotifications();
  const { handleScannedCode } = useDeepLink();
  const [scanOpen, setScanOpen] = React.useState(false);
  return (
    <>
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
        {/* пустая вкладка-заглушка под плавающей кнопкой — не переключается */}
        <Tab.Screen name="QrScan" component={HomeScreen} listeners={{ tabPress: (e) => e.preventDefault() }}
          options={{ title: '', tabBarButton: () => <QrTabButton onPress={() => setScanOpen(true)} /> }} />
        <Tab.Screen name="Events" component={EventsScreen} options={{
          title: 'События',
          tabBarBadge: unread || undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary },
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🔔</Text>,
        }} />
        <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Профиль', tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>👤</Text> }} />
      </Tab.Navigator>
      <QrScannerSheet visible={scanOpen} onClose={() => setScanOpen(false)} onResult={handleScannedCode} />
    </>
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

function LinkErrorBanner() {
  const { linkError, clearLinkError } = useDeepLink();
  if (!linkError) return null;
  return (
    <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ color: colors.danger, fontSize: 12, flex: 1, fontWeight: '600' }}>{linkError}</Text>
      <Text style={{ color: colors.danger, fontSize: 12, paddingLeft: 10 }} onPress={clearLinkError}>✕</Text>
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
      <LinkErrorBanner />
      {guest ? <GuestBanner /> : null}
      <ScreenErrorBoundary>
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
