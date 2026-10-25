// Профиль и настройки сессии
import React from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useAuth } from '../state/AuthContext';
import { Button } from '../components/ui';
import { colors } from '../theme/colors';

const ROLE_LABELS = { admin: 'Администратор', coordinator: 'Координатор', head: 'Начальник', member: 'Сотрудник' };

export default function ProfileScreen() {
  const { data, serverUrl, logout } = useAuth();
  if (!data) return null;
  const me = data.me;

  const doLogout = () => {
    Alert.alert('Выйти?', 'Токен этого устройства будет отозван на сервере.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <View style={{ alignItems: 'center', marginBottom: 20, marginTop: 10 }}>
        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: me.color || colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 30 }}>{me.initials || '??'}</Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink }}>{me.name}</Text>
        <Text style={{ color: colors.inkSoft }}>{ROLE_LABELS[me.role] || me.role} · {me.login}</Text>
      </View>

      {me.must_change_password ? (
        <View style={{ backgroundColor: '#fef3c7', borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <Text style={{ color: '#92400e' }}>⚠ Требуется смена пароля — сделайте это в веб-версии Цезаря.</Text>
        </View>
      ) : null}

      <Card title="Сервер">
        <Line k="Название" v={data.server.name} />
        <Line k="Версия" v={data.server.version} />
        <Line k="Адрес" v={serverUrl} />
      </Card>

      <Card title="Пространства">
        {data.departments.map((d) => <Line key={d.id} k={d.code} v={d.name} />)}
      </Card>

      <Card title="Модули">
        {data.modules.map((m) => <Line key={m.key} k={m.icon || '▫'} v={m.title} />)}
      </Card>

      <View style={{ marginTop: 10 }}>
        <Button title="Выйти" variant="danger" onPress={doLogout} />
      </View>
      <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 24 }}>
        Zezar-app · мобильный клиент системы «ЦЕЗАРЬ»
      </Text>
    </ScrollView>
  );
}

function Card({ title, children }) {
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: colors.line }}>
      <Text style={{ fontWeight: '700', color: colors.ink, marginBottom: 8 }}>{title}</Text>
      {children}
    </View>
  );
}
function Line({ k, v }) {
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 5 }}>
      <Text style={{ width: 110, color: colors.inkSoft }}>{k}</Text>
      <Text style={{ flex: 1, color: colors.ink }}>{v}</Text>
    </View>
  );
}
