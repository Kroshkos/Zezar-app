// Экран входа: адрес сервера + логин/пароль учётной записи Цезаря
import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth } from '../state/AuthContext';
import { Field, Button } from '../components/ui';
import { colors } from '../theme/colors';

export default function LoginScreen() {
  const { serverUrl, login } = useAuth();
  const [url, setUrl] = useState(serverUrl || '');
  const [log, setLog] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!url.trim()) return setErr('Укажите адрес сервера');
    if (!log.trim() || !pass) return setErr('Введите логин и пароль');
    setBusy(true);
    try {
      const ok = await login(url, log, pass);
      if (!ok) setErr('Сервер недоступен или данные не подошли');
    } catch (e) {
      setErr(e.message || 'Ошибка входа');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 34, fontWeight: '800', color: colors.primary, textAlign: 'center' }}>⚔ ЦЕЗАРЬ</Text>
        <Text style={{ color: colors.inkSoft, textAlign: 'center', marginTop: 6, marginBottom: 28 }}>
          Мобильный контур системы управления подразделением
        </Text>
        <Field label="Адрес сервера" value={url} onChangeText={setUrl} autoCapitalize="none"
               keyboardType="url" placeholder="https://zezar.example.com" />
        <Field label="Логин" value={log} onChangeText={setLog} autoCapitalize="none" placeholder="ivanov" />
        <Field label="Пароль" value={pass} onChangeText={setPass} secureTextEntry placeholder="••••••••" />
        {err ? <Text style={{ color: colors.danger, marginBottom: 10 }}>{err}</Text> : null}
        <Button title="Войти" onPress={submit} loading={busy} disabled={busy} />
        <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 18 }}>
          Используются ваша учётная запись и права из веб-версии. Токен хранится на устройстве.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
