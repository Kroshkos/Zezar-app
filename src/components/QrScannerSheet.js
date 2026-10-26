// Встроенный QR-сканер (v1.7): полноэкранная модалка с камерой expo-camera.
// Отсканированный текст разбирается тем же парсером, что и deep link
// zezar://entity/{uid}[?t=<гостевой токен>] — см. LinkingContext, поэтому
// коды карточек работают так же, как при открытии ссылки извне.
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors } from '../theme/colors';
import { Button } from './ui';

export default function QrScannerSheet({ visible, onClose, onResult }) {
  const [perm, requestPermission] = useCameraPermissions();
  const [error, setError] = useState('');
  const [manual, setManual] = useState(''); // запасной ввод: вставить ссылку из QR вручную
  const lockRef = useRef(false); // защита от повторных срабатываний сканера за один кадр

  useEffect(() => {
    if (visible) { setError(''); setManual(''); lockRef.current = false; }
  }, [visible]);

  const submit = (text) => {
    if (lockRef.current) return;
    lockRef.current = true;
    onResult(text);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.ink }}>
        {!perm ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Text style={{ color: '#fff' }}>Запрашиваем доступ к камере…</Text>
          </View>
        ) : !perm.granted ? (
          <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Нужен доступ к камере</Text>
            <Text style={{ color: '#94a3b8', marginBottom: 16 }}>
              Без разрешения камера недоступна.{'\n'}
              {perm.canAskAgain ? 'Нажмите кнопку ниже.' : 'Разрешите камеру в настройках приложения.'}
            </Text>
            {perm.canAskAgain && (
              <Button title="Разрешить камеру" onPress={async () => {
                const r = await requestPermission();
                if (!r.granted) setError('Камера недоступна');
              }} />
            )}
          </View>
        ) : (
          <>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeTypes={['qr']}
              onBarcodeScanned={({ data }) => submit(data)}
            />
            {/* рамка-прицел поверх превью (не перехватывает касания) */}
            <View pointerEvents="none" style={{ position: 'absolute', top: 90, left: 44, right: 44, bottom: 220 }}>
              <View style={{ flex: 1, borderWidth: 2, borderColor: colors.primary, borderRadius: 24 }} />
            </View>
            <View style={{ position: 'absolute', bottom: 24, left: 16, right: 16 }}>
              <Text style={{ color: '#fff', textAlign: 'center', fontSize: 13, marginBottom: 10, opacity: 0.9 }}>
                Наведите камеру на QR-код карточки ⚔
              </Text>
              {error ? <Text style={{ color: '#fca5a5', textAlign: 'center', fontSize: 12, marginBottom: 8 }}>{error}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <TextInput
                  value={manual}
                  onChangeText={setManual}
                  placeholder="…или вставьте ссылку из QR"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{ flex: 1, backgroundColor: 'rgba(255,255,255,.12)', color: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12 }}
                />
                <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 15, paddingHorizontal: 6 }}
                  onPress={() => { manual.trim() ? submit(manual.trim()) : setError('Сначала вставьте ссылку'); }}>
                  ОК
                </Text>
              </View>
              <Button title="Отмена" variant="secondary" onPress={onClose} />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}
