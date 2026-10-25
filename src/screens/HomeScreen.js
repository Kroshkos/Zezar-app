// Главная: сводка "кто я / где работаю" + быстрые счётчики задач
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../state/AuthContext';
import { listEntities } from '../api/endpoints';
import { cachedRead, mergeLocalTasks } from '../api/offline';
import { colors } from '../theme/colors';
import { EmptyState } from '../components/ui';

const ROLE_LABELS = { admin: 'Администратор', coordinator: 'Координатор', head: 'Начальник', member: 'Сотрудник' };

export default function HomeScreen({ navigation }) {
  const { data, refresh } = useAuth();
  const [stats, setStats] = useState(null);
  const [offline, setOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const res = await cachedRead(
        () => listEntities({ module_key: 'tasks', limit: 500 }),
        'entities:tasks:',
      );
      const items = mergeLocalTasks(res.data, 'tasks');
      setOffline(!!res.offline);
      const open = items.filter((t) => t.status_key !== 'done' && t.status_key !== 'canceled');
      const mine = open.filter((t) => t.responsibles && data && t.responsibles.some(
        (r) => r.toLowerCase().includes((data.me.name || '').split(' ')[0].toLowerCase())));
      const overdue = open.filter((t) => t.due_date && new Date(t.due_date) < new Date(new Date().toDateString()));
      setStats({ total: items.length, open: open.length, mine: mine.length, overdue: overdue.length });
    } catch (_) { /* список обновится на экране задач */ }
  }, [data]);

  useFocusEffect(useCallback(() => { loadStats(); }, [loadStats]));

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    await loadStats();
    setRefreshing(false);
  };

  if (!data) return <EmptyState icon="⏳" text="Загрузка данных сервера…" />;
  const me = data.me;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }}
                contentContainerStyle={{ padding: 16 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {offline ? (
        <View style={{ backgroundColor: '#fef3c7', borderRadius: 10, padding: 10, marginBottom: 12 }}>
          <Text style={{ color: '#92400e', fontSize: 12, fontWeight: '600' }}>
            ⚠ Нет связи с сервером — показан последний снимок данных.
          </Text>
        </View>
      ) : null}
      <View style={{ backgroundColor: colors.ink, borderRadius: 18, padding: 18, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: me.color || colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>{me.initials || '??'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>{me.name}</Text>
            <Text style={{ color: '#cbd5e1', fontSize: 13 }}>{ROLE_LABELS[me.role] || me.role}</Text>
          </View>
        </View>
        <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 12 }}>
          {data.server.name} · подразделений: {data.departments.length} · модулей: {data.modules.length}
        </Text>
      </View>

      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink, marginBottom: 10 }}>Задачи</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {[
          { k: 'open', label: 'В работе', v: stats && stats.open, c: colors.accent, f: 'open' },
          { k: 'mine', label: 'Мои', v: stats && stats.mine, c: colors.primary, f: 'mine' },
          { k: 'overdue', label: 'Просрочено', v: stats && stats.overdue, c: colors.danger, f: 'overdue' },
          { k: 'total', label: 'Всего', v: stats && stats.total, c: colors.inkSoft, f: null },
        ].map((s) => (
          <TouchableOpacity key={s.k} onPress={() => navigation.navigate('Tasks', s.f ? { filter: s.f } : {})}
                            activeOpacity={0.7}
                            style={{ width: '47%', backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.line }}>
            <Text style={{ fontSize: 26, fontWeight: '800', color: s.c }}>{s.v == null ? '—' : s.v}</Text>
            <Text style={{ color: colors.inkSoft, fontSize: 13 }}>{s.label} ›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink, marginTop: 20, marginBottom: 10 }}>Пространства</Text>
      {data.departments.map((d) => (
        <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.line }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: d.color || colors.primary, marginRight: 10 }} />
          <Text style={{ flex: 1, color: colors.ink, fontSize: 15 }}>{d.name}</Text>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>{d.code}</Text>
        </View>
      ))}

      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink, marginTop: 20, marginBottom: 10 }}>Модули</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {data.modules.map((m) => (
          <TouchableOpacity key={m.key} activeOpacity={0.7}
                            onPress={() => navigation.navigate('Tasks', { module_key: m.key })}
                            style={{ backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.line }}>
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>{m.icon || '▫'} {m.title} ›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}
