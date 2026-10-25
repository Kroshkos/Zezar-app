// Список карточек: фильтр по модулям, поиск, pull-to-refresh, FAB "+",
// v1.4: оффлайн-кэш (последний снимок при недоступном сервере) + локальные
// задачи из очереди мутаций с бейджем "⏳ без сети".
import React, { useCallback, useMemo, useState } from 'react';
import { View, FlatList, TextInput, TouchableOpacity, Text, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../state/AuthContext';
import { listEntities } from '../api/endpoints';
import { cachedRead, mergeLocalTasks } from '../api/offline';
import EntityCard from '../components/EntityCard';
import { Chip, EmptyState } from '../components/ui';
import { colors } from '../theme/colors';

export default function TasksScreen({ navigation, route }) {
  const { data } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  // v1.5.1: главный экран передаёт module_key через params (клик по модулю)
  const [moduleKey, setModuleKey] = useState(route.params?.module_key ?? 'tasks');
  // v1.5.1: быстрый фильтр со сводной («В работе» / «Мои» / «Просрочено»)
  const [filter, setFilter] = useState(route.params?.filter ?? null);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const res = await cachedRead(
        () => listEntities({ module_key: moduleKey || undefined, q: q || undefined, limit: 300 }),
        `entities:${moduleKey || 'all'}:${q || ''}`,
      );
      let list = mergeLocalTasks(res.data, moduleKey);
      if (filter) {
        const meName = (data && data.me && data.me.name ? data.me.name : '').split(' ')[0].toLowerCase();
        const isOpen = (t) => t.status_key !== 'done' && t.status_key !== 'canceled';
        if (filter === 'open') list = list.filter(isOpen);
        else if (filter === 'overdue') list = list.filter((t) => isOpen(t) && t.due_date && new Date(t.due_date) < new Date(new Date().toDateString()));
        else if (filter === 'mine') list = list.filter((t) => isOpen(t) && t.responsibles && meName &&
          t.responsibles.some((r) => r.toLowerCase().includes(meName)));
      }
      setItems(list);
      setOffline(!!res.offline);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [moduleKey, q, filter, data]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // переход с главной по клику на модуль/счётчик: применяем параметры навигации
  const paramMod = route.params?.module_key;
  const paramFilter = route.params?.filter;
  React.useEffect(() => {
    if (paramMod !== undefined && paramMod !== moduleKey) setModuleKey(paramMod);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramMod]);
  React.useEffect(() => {
    if (paramFilter !== undefined && paramFilter !== filter) setFilter(paramFilter || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramFilter]);

  const modules = useMemo(() => (data ? data.modules : []), [data]);
  // v1.6: справочник статусов текущего модуля (module_statuses), фолбэк — task
  const statuses = (data && ((data.module_statuses || {})[moduleKey] || (data.statuses || {}).task)) || [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {offline ? (
        <View style={{ backgroundColor: '#fef3c7', paddingVertical: 6, paddingHorizontal: 12 }}>
          <Text style={{ color: '#92400e', fontSize: 12, fontWeight: '600' }}>
            ⚠ Нет связи с сервером — показан последний снимок. Изменения будут отправлены автоматически.
          </Text>
        </View>
      ) : null}
      <View style={{ padding: 12 }}>
        {moduleKey && moduleKey !== 'tasks' ? (
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: 8 }}>
            {(modules.find((m) => m.key === moduleKey) || {}).title || moduleKey}
          </Text>
        ) : null}
        <TextInput
          value={q} onChangeText={setQ} placeholder="Поиск по названию/описанию…"
          placeholderTextColor="#94a3b8" onSubmitEditing={load} returnKeyType="search"
          style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: colors.ink }}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
          <Chip label="Все" active={!moduleKey} onPress={() => setModuleKey('')} />
          {modules.map((m) => (
            <Chip key={m.key} label={m.title} active={moduleKey === m.key} onPress={() => setModuleKey(m.key)} />
          ))}
        </View>
        {filter ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <Chip label={{ open: 'только в работе', mine: 'только мои', overdue: 'только просроченные' }[filter] || filter}
                  active onPress={() => setFilter(null)} />
            <Text style={{ color: '#94a3b8', fontSize: 12, marginLeft: 8 }}>фильтр со сводной — нажмите, чтобы снять</Text>
          </View>
        ) : null}
      </View>

      {err ? <EmptyState icon="⚠️" text={err} /> : (
        <FlatList
          data={items}
          keyExtractor={(x) => x.uid}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 90 }}
          refreshControl={<RefreshControl refreshing={loading && items.length === 0} onRefresh={load} tintColor={colors.primary} />}
          ListEmptyComponent={!loading ? <EmptyState icon="🗂" text={moduleKey && moduleKey !== 'tasks' ? 'В этом модуле пока нет карточек. Нажмите «+», чтобы создать.' : 'Нет задач. Нажмите «+», чтобы создать задачу.'} /> : null}
          renderItem={({ item }) => (
            <EntityCard item={item} statuses={statuses}
                        onPress={() => navigation.navigate('Entity', { uid: item.uid, local: !!item.local })} />
          )}
        />
      )}

      <TouchableOpacity
        onPress={() => navigation.navigate('NewTask', { module_key: moduleKey || 'tasks' })}
        style={{ position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }}
      >
        <Text style={{ color: '#fff', fontSize: 28, marginTop: -2 }}>+</Text>
      </TouchableOpacity>
    </View>
  );
}
