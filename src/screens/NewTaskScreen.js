// Создание задачи через POST /api/mobile/tasks
import React, { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useAuth } from '../state/AuthContext';
import { createTask } from '../api/endpoints';
import { Field, Button, Chip, ddMmYyyyToIso } from '../components/ui';
import { colors } from '../theme/colors';
import { priorityColors } from '../theme/colors';

export default function NewTaskScreen({ navigation }) {
  const { data } = useAuth();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
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
    try {
      await createTask({
        title: title.trim(), description: desc.trim(), priority_key: prio,
        due_date: dueIso, department_id: deptId,
      });
      navigation.goBack();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Field label="Название *" value={title} onChangeText={setTitle} placeholder="Например: Подготовить отчёт" />
      <Field label="Описание" value={desc} onChangeText={setDesc} multiline numberOfLines={4} placeholder="Детали, контекст, ссылки…" />
      <Text style={{ color: colors.inkSoft, fontSize: 13, marginBottom: 6 }}>Приоритет</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 }}>
        {(data ? data.priorities : []).map((p) => (
          <Chip key={p.key} label={p.label} color={priorityColors[p.key]} active={prio === p.key} onPress={() => setPrio(p.key)} />
        ))}
      </View>
      <Field label="Срок (ДД.ММ.ГГГГ)" value={due} onChangeText={setDue} placeholder="01.11.2026" autoCapitalize="none" keyboardType="numbers" />
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
      <Button title="Создать задачу" onPress={submit} loading={busy} disabled={busy} />
    </ScrollView>
  );
}
