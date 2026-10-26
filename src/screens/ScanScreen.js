// Встроенный сканер QR-кодов (v1.7): кнопка «Скан» по центру нижнего футера.
// Поддерживает два формата ссылок:
//  - https://<сервер>/open/e/{uid}?t=<гостевой токен> — QR с печатной карточки
//    на сайте: открываем карточку через гостевую сессию (основная сохраняется);
//  - zezar://entity/{uid}... — нативный deep link.
import React, { useRef, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator, Linking, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { extractEntityTarget } from '../state/LinkingContext';
import { useAuth } from '../state/AuthContext';
import { getServerUrl, normalizeUrl } from '../api/client';
import { colors } from '../theme/colors';

export default function ScanScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const { guestSession } = useAuth();
  const [message, setMessage] = useState('');
  const [manual, setManual] = useState(null); // null — поле скрыто
  const firedRef = useRef(false);

  const handleResult = async (url) => {
    if (firedRef.current) return; // один срабат на скан
    const target = extractEntityTarget(url);
    if (!target) {
      firedRef.current = true;
      setMessage('На QR-коде не распознана ссылка карточки ЦЕЗАРЬ');
      setTimeout(() => { firedRef.current = false; setMessage(''); }, 2500);
      return;
    }
    firedRef.current = true;
    setMessage('Открываем карточку…');
    try {
      if (target.t) {
        // Гостевой токен из QR выдаёт конкретный сервер — при сканировании
        // внутри приложения можно доверять baseUrl из ссылки (в отличие от
        // внешнего deep link, где мы не уводим прод-сессию на чужой стенд).
        await guestSession(target.t, target.baseUrl || (await getServerUrl()));
      }
      navigation.navigate('Entity', { uid: target.uid });
    } catch (e) {
      setMessage(e?.message || 'Ссылка устарела — отсканируйте QR заново');
      firedRef.current = false;
    }
  };

  const openManual = async () => {
    const v = manual.trim();
    if (!v) return;
    const url = /^(https?:|zezar:)/i.test(v) ? v : normalizeUrl(v);
    await handleResult(url);
  };

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator color="#fff" size="large" /></View>;
  }
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#fff', fontSize: 44, marginBottom: 12 }}>📷</Text>
        <Text style={{ color: '#cbd5e1', textAlign: 'center', marginBottom: 18, paddingHorizontal: 30 }}>
          Для сканирования QR-кодов нужен доступ к камере
        </Text>
        <Text style={styles.btn} onPress={async () => { const r = await requestPermission(); if (!r?.granted) setMessage('Разрешение на камеру не выдано'); }}>Разрешить камеру</Text>
        {message ? <Text style={styles.err}>{message}</Text> : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => handleResult(data)}
      />
      {/* рамка-прицел */}
      <View pointerEvents="none" style={styles.overlayWrap}>
        <View style={styles.frame} />
      </View>
      <View pointerEvents="box-none" style={styles.bottomPanel}>
        <Text style={styles.hint}>Наведите камеру на QR-код карточки</Text>
        {message ? <Text style={styles.err}>{message}</Text> : null}
        <View style={styles.manualRow}>
          <Text
            style={styles.linkBtn}
            onPress={() => Linking.openURL('https://zezar-patfiz.waw0.amvera.tech').catch(() => {})}
          >Открыть в браузере ↗</Text>
          <Text style={styles.manualToggle} onPress={() => setManual((m) => (m === null ? '' : null))}>
            {manual === null ? 'Ввести ссылку вручную ⌨' : 'Скрыть'}
          </Text>
        </View>
        {manual !== null ? (
          <View style={styles.manualBox}>
            <TextInput
              style={{ backgroundColor: 'rgba(255,255,255,.12)', color: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 }}
              placeholder="https://…/open/e/…"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
              value={manual}
              onChangeText={setManual}
              onSubmitEditing={openManual}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  btn: { backgroundColor: colors.primary, color: '#fff', fontWeight: '700', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
  err: { color: '#fca5a5', marginTop: 14, fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
  overlayWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 240, height: 240, borderRadius: 22, borderWidth: 3, borderColor: 'rgba(217,119,6,.9)' },
  bottomPanel: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 24, backgroundColor: 'rgba(15,23,42,.85)' },
  hint: { color: '#e2e8f0', textAlign: 'center', marginBottom: 8, fontSize: 13, fontWeight: '600' },
  manualRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  linkBtn: { color: '#93c5fd', fontSize: 12, fontWeight: '600' },
  manualToggle: { color: '#94a3b8', fontSize: 12 },
  manualBox: { marginTop: 10 },
});
