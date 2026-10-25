// Экран «События»: лента мобильных событий (назначено/статус/срок/комментарий)
// + статус push-подписки. Открытие экрана отмечает события прочитанными.
import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useNotifications } from '../state/NotificationsContext';
import { colors } from '../theme/colors';
import { relTime as agoLabel } from '../utils/format';

const TYPE_META = {
  assigned:        { icon: '🎯', color: '#dc2626', label: 'Назначена задача' },
  executor_added:  { icon: '👤', color: '#7c3aed', label: 'Добавлен исполнитель' },
  status_changed:  { icon: '🔄', color: '#2563eb', label: 'Статус изменён' },
  due_soon:        { icon: '⏳', color: '#d97706', label: 'Срок/приоритет' },
  overdue:         { icon: '⌛', color: '#b91c1c', label: 'Просрочено' },
  comment:         { icon: '💬', color: '#0891b2', label: 'Комментарий' },
  entity_updated:  { icon: '✏️', color: '#475569', label: 'Карточка обновлена' },
};

const PUSH_HINT = {
  granted:     { text: 'Push включены — уведомления приходят на это устройство', ok: true },
  denied:      { text: 'Push отключены в настройках системы. Разрешите уведомления, чтобы не пропустить назначения.', ok: false },
  unsupported: { text: 'Push недоступны на симуляторе — лента событий работает и без них.', ok: false },
  error:       { text: 'Не удалось зарегистрировать токен устройства. Попробуйте выйти и войти заново.', ok: false },
};

export default function EventsScreen({ navigation }) {
  const { latest, unread, pushState, markAllRead, refreshList, registerPush } = useNotifications();
  const [loading, setLoading] = useState(true);
  const focused = useIsFocused();

  const load = useCallback(async () => {
    setLoading(true);
    await refreshList();
    setLoading(false);
  }, [refreshList]);

  useEffect(() => { load(); }, [load]);

  // при открытии экрана — отметить прочитанными
  useEffect(() => {
    if (focused && unread > 0) markAllRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused]);

  const openEntity = (uid) => uid && navigation.navigate('Entity', { uid });

  const renderItem = ({ item }) => {
    const meta = TYPE_META[item.type] || TYPE_META.entity_updated;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => openEntity(item.entity_uid)}
        style={{
          flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12,
          padding: 14, marginBottom: 10, borderWidth: 1,
          borderColor: item.read_at ? colors.line : meta.color + '55',
          opacity: item.read_at ? 0.75 : 1,
        }}
      >
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: meta.color + '18', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Text style={{ fontSize: 17 }}>{meta.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', color: colors.ink, fontSize: 14 }} numberOfLines={2}>{item.title}</Text>
          {item.body ? <Text style={{ color: colors.inkSoft, fontSize: 12, marginTop: 2 }} numberOfLines={2}>{item.body}</Text> : null}
          <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>
            {meta.label} · {agoLabel(item.created_at)}
          </Text>
        </View>
        {!item.read_at ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: meta.color, marginTop: 6 }} /> : null}
      </TouchableOpacity>
    );
  };

  const hint = PUSH_HINT[pushState.status];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {hint ? (
        <View style={{ backgroundColor: hint.ok ? '#ecfdf5' : '#fef3c7', paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ flex: 1, fontSize: 12, color: hint.ok ? '#065f46' : '#92400e' }}>{hint.text}</Text>
          {!hint.ok && pushState.status !== 'unsupported' ? (
            <TouchableOpacity onPress={registerPush}><Text style={{ color: colors.primary, fontWeight: '700' }}>Включить</Text></TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={latest}
          keyExtractor={(e) => String(e.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 14 }}
          onRefresh={load}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ fontSize: 40, marginBottom: 10 }}>🕊</Text>
              <Text style={{ color: colors.inkSoft }}>Пока тихо. Здесь появятся назначения, смены статусов и напоминания о сроках.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
