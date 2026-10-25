// Создание карточки в текущем модуле через POST /api/mobile/entities.
// v1.4: при недоступном сервере карточка кладётся в локальную очередь мутаций
// и будет отправлена автоматически после восстановления связи.
import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useAuth } from '../state/AuthContext';
import { createEntity } from '../api/endpoints';
import { enqueue } from '../api/offline';
import { Field, Button, Chip, ddMmYyyyToIso } from '../components/ui';
import { colors } from '../theme/colors';
import { priorityColors } from '../theme/colors';

export default function NewTaskScreen({ navigation, route }) {
  const { data } = useAuth();
  // v1.6: экран универсальный — создаём сущность того модуля, из которого пришли.
  // Кнопка «+» передаёт module_key через params (раньше жёстко была задача).
  const moduleKey = route.params?.module_key || 'tasks';
  const moduleName = (data?.modules?.find((m) => m.key === moduleKey) || {}).title || 'Задачи';
  const isTask = moduleKey === 'tasks';
  // справочник статусов: по модулю (v1.6 бэкенд отдаёт module_statuses),
  // фолбэк на kind-справочник задач для старых серверов
  const statuses = (data && ((data.module_statuses || {})[moduleKey] || (data.statuses || {}).task)) || [];

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [statusKey, setStatusKey] = useState(null);
  const [prio, setPrio] = useState('medium');
  const [due, setDue] = useState('');
  const [deptId, setDeptId] = useState(data && data.departments.length ? data.departments[0].id : null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (title.trim().length < 3) return setErr('Название — не короче 3 символов');
    const dueIso = ddMmYyyyToIso(due);
    if (dueIso === undefined) return setErr('Срок в формате ДД.ММ.ГГГГ');
    setBusy(true);
    const payload = {
      module_key: moduleKey,
      title: title.trim(), description: desc.trim(),
      status_key: statusKey || undefined,
      // приоритет/срок имеют смысл у задач; остальным модулям не шлём (422 без них ок)
      ...(isTask ? { priority_key: prio, due_date: dueIso } : {}),
      department_id: deptId,
    };
    try {
      await createEntity(payload);
      navigation.goBack();
    } catch (e) {
      if (e.status === 0 || e.status === undefined) {
        await enqueue(isTask ? 'task' : 'entity', payload);
        navigation.goBack();
      } else {
        setErr(e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Field label="Название *" value={title} onChangeText={setTitle}
             placeholder={isTask ? 'Например: Подготовить отчёт' : `Название для модуля «${moduleName}»`} />
      <Field label="Описание" value={desc} onChangeText={setDesc} multiline numberOfLines={4} placeholder="Детали, контекст, ссылки…" />
      {statuses.length ? (
        <>
          <Text style={{ color: colors.inkSoft, fontSize: 13, marginBottom: 6 }}>Статус{isTask ? '' : ' (по умолчанию первый)'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {statuses.map((s) => (
              <Chip key={s.key} label={s.label} color={s.color || colors.primary}
                    active={(statusKey || statuses[0].key) === s.key} onPress={() => setStatusKey(s.key)} />
            ))}
          </View>
        </>
      ) : null}
      {isTask ? (
        <>
          <Text style={{ color: colors.inkSoft, fontSize: 13, marginBottom: 6 }}>Приоритет</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 }}>
            {(data ? data.priorities : []).map((p) => (
              <Chip key={p.key} label={p.label} color={priorityColors[p.key]} active={prio === p.key} onPress={() => setPrio(p.key)} />
            ))}
          </View>
          <Field label="Срок (ДД.ММ.ГГГГ)" value={due} onChangeText={setDue} placeholder="01.11.2026" autoCapitalize="none" keyboardType="numbers" />
        </>
      ) : null}
      {data && data.departments.length > 1 ? (
        <>
          <Text style={{ color: colors.inkSoft, fontSize: 13, marginBottom: 6 }}>Пространство</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 }}>
            {data.departments.map((d) => (
              <Chip key={d.id} label={d.name} active={deptId === d.id} onPress={() => setDeptId(d.id)} />
            ))}
          </View>
        </>
      ) : null}
      {err ? <Text style={{ color: colors.danger, marginBottom: 10 }}>{err}</Text> : null}
      <Button title={isTask ? 'Создать задачу' : `Создать — ${moduleName}`} onPress={submit} loading={busy} disabled={busy} />
    </ScrollView>
  );
}
