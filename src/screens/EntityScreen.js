// Детали карточки: статус/приоритет/срок/описание — с сохранением через PATCH.
// v1.4: оффлайн — читаем последний снимок из кэша; мутации при недоступном
// сервере попадают в локальную очередь и применяются оптимистично.
import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../state/AuthContext';
import { getEntity, patchEntity } from '../api/endpoints';
import { cachedRead, enqueue, optimisticPatchToCache, localEntityOverlay } from '../api/offline';
import { Field, Button, Chip, Sheet, StatusBadge, PriorityBadge, Badge, EmptyState, isoToDdMmYyyy, ddMmYyyyToIso } from '../components/ui';
import { colors, priorityColors } from '../theme/colors';
import { formatDate, isOverdue } from '../utils/format';

export default function EntityScreen({ route, navigation }) {
  const { uid } = route.params;
  const { data } = useAuth();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [err, setErr] = useState('');
  const [sheet, setSheet] = useState(null); // 'status' | 'priority' | 'due' | 'desc'
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (route.params.local) {
        // Локальная (ещё не отправленная) задача — берём её из очереди
        const q = JSON.parse((await AsyncStorage.getItem('zezar.mutations.v1')) || '[]');
        const m = q.find((x) => x.id === uid);
        if (m) {
          setItem({
            uid, local: true, kind: 'task', module_key: 'tasks',
            title: m.payload.title, description: m.payload.description || '',
            status_key: 'new', priority_key: m.payload.priority_key || 'medium',
            due_date: m.payload.due_date || null,
            responsibles: [], executors: [], tags: [], perm: 'owner', can_edit: true,
          });
          setOffline(true); setErr(''); return;
        }
      }
      const res = await cachedRead(() => getEntity(uid), `entity:${uid}`);
      let view = res.data;
      // поверх кэша накладываем самый свежий неотправленный патч из очереди
      const overlay = await localEntityOverlay(uid);
      if (overlay) view = { ...view, ...Object.fromEntries(Object.entries(overlay).filter(([, v]) => v !== undefined)) };
      setItem(view);
      setOffline(!!res.offline);
      setErr(res.offline ? '' : '');
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }, [uid]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async (payload) => {
    setSaving(true); setErr('');
    try {
      const updated = await patchEntity(uid, payload);
      setItem(updated);
      setOffline(false);
      await AsyncStorage.setItem('zezar.cache.entity:' + uid, JSON.stringify({ ts: Date.now(), data: updated }));
      setSheet(null);
    } catch (e) {
      if (e.status === 0 || e.status === undefined) {
        // сервер недоступен — в очередь + оптимистично в UI и кэш списка
        await enqueue('patch', payload, uid);
        setItem((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined)) }));
        await optimisticPatchToCache(uid, payload);
        setOffline(true);
        setSheet(null);
      } else {
        setErr(e.message);
      }
    } finally { setSaving(false); }
  };

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (!item) return <EmptyState icon="🤷" text={err || 'Карточка не найдена (возможно, удалена)'} />;

  const statuses = (data && data.statuses && data.statuses[item.kind]) || [];
  const priorities = (data && data.priorities) || [];
  const overdue = isOverdue(item.due_date) && item.status_key !== 'done';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      {offline ? (
        <View style={{ backgroundColor: '#fef3c7', borderRadius: 10, padding: 10, marginBottom: 12 }}>
          <Text style={{ color: '#92400e', fontSize: 12, fontWeight: '600' }}>
            ⚠ Нет связи с сервером. Данные могут быть устаревшими, изменения сохранятся локально и отправятся позже.
          </Text>
        </View>
      ) : null}
      <Text style={{ fontSize: 22, fontWeight: '800', color: colors.ink }}>{item.title}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        <StatusBadge statusKey={item.status_key} statuses={statuses} />
        <PriorityBadge priorityKey={item.priority_key} />
        {item.due_date ? <Badge label={'⏰ ' + formatDate(item.due_date)} color={overdue ? colors.danger : colors.inkSoft} /> : null}
      </View>

      <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 14, marginTop: 16, borderWidth: 1, borderColor: colors.line }}>
        <Row k="Модуль" v={item.module_key} />
        <Row k="Ответственный" v={item.responsibles.length ? item.responsibles.join(', ') : '—'} />
        {item.executors.length ? <Row k="Исполнители" v={item.executors.join(', ')} /> : null}
        {item.tags.length ? <Row k="Метки" v={item.tags.join(', ')} /> : null}
        <Row k="Доступ" v={item.perm + (item.can_edit ? ' (можно редактировать)' : ' (только чтение)')} last />
      </View>

      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink, marginTop: 20, marginBottom: 6 }}>Описание</Text>
      <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.line }}>
        <Text style={{ color: item.description ? colors.ink : '#94a3b8', fontSize: 15 }}>
          {item.description || 'Пусто. Нажмите «Изменить описание».'}
        </Text>
      </View>

      {err ? <Text style={{ color: colors.danger, marginTop: 12 }}>{err}</Text> : null}

      {item.can_edit ? (
        <View style={{ marginTop: 20, gap: 10 }}>
          <Button title="Сменить статус" variant="secondary" onPress={() => setSheet('status')} />
          <Button title="Сменить приоритет" variant="secondary" onPress={() => setSheet('priority')} />
          <Button title="Изменить срок" variant="secondary" onPress={() => { setDraft(isoToDdMmYyyy(item.due_date)); setSheet('due'); }} />
          <Button title="Изменить описание" variant="secondary" onPress={() => { setDraft(item.description || ''); setSheet('desc'); }} />
          {item.kind === 'task' && item.status_key !== 'done' ? (
            <Button title="✔ Отметить выполненной" onPress={() => save({ status_key: 'done' })} loading={saving} />
          ) : null}
        </View>
      ) : (
        <Text style={{ color: '#94a3b8', marginTop: 20 }}>Редактирование недоступно для вашей роли.</Text>
      )}

      {/* --- bottom sheets --- */}
      <Sheet visible={sheet === 'status'} onClose={() => setSheet(null)} title="Статус">
        {statuses.map((s) => (
          <Chip key={s.key} label={s.label} color={s.color} active={item.status_key === s.key}
                onPress={() => save({ status_key: s.key })} />
        ))}
        {!statuses.length ? <Text style={{ color: colors.inkSoft }}>Справочник пуст на сервере.</Text> : null}
      </Sheet>

      <Sheet visible={sheet === 'priority'} onClose={() => setSheet(null)} title="Приоритет">
        {priorities.map((p) => (
          <Chip key={p.key} label={p.label} color={priorityColors[p.key]} active={item.priority_key === p.key}
                onPress={() => save({ priority_key: p.key })} />
        ))}
      </Sheet>

      <Sheet visible={sheet === 'due'} onClose={() => setSheet(null)} title="Срок (ДД.ММ.ГГГГ)">
        <Field value={draft} onChangeText={setDraft} placeholder="01.11.2026" autoCapitalize="none" keyboardType="numbers" />
        <Button title="Сохранить" onPress={() => {
          const iso = ddMmYyyyToIso(draft);
          if (iso === undefined) { setErr('Неверная дата. Формат: ДД.ММ.ГГГГ'); return; }
          save({ due_date: iso });
        }} loading={saving} />
      </Sheet>

      <Sheet visible={sheet === 'desc'} onClose={() => setSheet(null)} title="Описание">
        <Field value={draft} onChangeText={setDraft} multiline numberOfLines={5} />
        <Button title="Сохранить" onPress={() => save({ description: draft })} loading={saving} />
      </Sheet>
    </ScrollView>
  );
}

function Row({ k, v, last }) {
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: last ? 0 : 1, borderBottomColor: '#f1f5f9' }}>
      <Text style={{ width: 120, color: colors.inkSoft, fontSize: 14 }}>{k}</Text>
      <Text style={{ flex: 1, color: colors.ink, fontSize: 14 }}>{String(v)}</Text>
    </View>
  );
}
