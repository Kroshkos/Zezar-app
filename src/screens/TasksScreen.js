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

export default function TasksScreen({ navigation }) {
  const { data } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [moduleKey, setModuleKey] = useState('tasks');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const res = await cachedRead(
        () => listEntities({ module_key: moduleKey || undefined, q: q || undefined, limit: 300 }),
        `entities:${moduleKey || 'all'}:${q || ''}`,
      );
      setItems(mergeLocalTasks(res.data, moduleKey));
      setOffline(!!res.offline);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [moduleKey, q]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const modules = useMemo(() => (data ? data.modules : []), [data]);
  const statuses = data && data.statuses ? (data.statuses.task || []) : [];

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
      </View>

      {err ? <EmptyState icon="⚠️" text={err} /> : (
        <FlatList
          data={items}
          keyExtractor={(x) => x.uid}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 90 }}
          refreshControl={<RefreshControl refreshing={loading && items.length === 0} onRefresh={load} tintColor={colors.primary} />}
          ListEmptyComponent={!loading ? <EmptyState icon="🗂" text="Нет карточек. Нажмите «+», чтобы создать задачу." /> : null}
          renderItem={({ item }) => (
            <EntityCard item={item} statuses={statuses}
                        onPress={() => navigation.navigate('Entity', { uid: item.uid, local: !!item.local })} />
          )}
        />
      )}

      <TouchableOpacity
        onPress={() => navigation.navigate('NewTask')}
        style={{ position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }}
      >
        <Text style={{ color: '#fff', fontSize: 28, marginTop: -2 }}>+</Text>
      </TouchableOpacity>
    </View>
  );
}
