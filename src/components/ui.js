// Мелкие переиспользуемые виджеты
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { colors, statusColor, priorityColors } from '../theme/colors';

export function Badge({ label, color }) {
  if (!label) return null;
  return (
    <View style={{ backgroundColor: color + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export function StatusBadge({ statusKey, statuses }) {
  const s = (statuses || []).find((x) => x.key === statusKey);
  const label = s ? s.label : (statusKey ? statusKey : 'Новая');
  const color = statusColor(statusKey, s && s.color);
  return <Badge label={label} color={color} />;
}

export function PriorityBadge({ priorityKey }) {
  if (!priorityKey) return null;
  return <Badge label={priorityKey} color={priorityColors[priorityKey] || colors.inkSoft} />;
}

export function Field({ label, ...props }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={{ color: colors.inkSoft, fontSize: 13, marginBottom: 6 }}>{label}</Text> : null}
      <TextInput
        placeholderTextColor="#94a3b8"
        style={{
          backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
          borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
          color: colors.ink, fontSize: 16,
        }}
        {...props}
      />
    </View>
  );
}

export function Button({ title, onPress, variant = 'primary', disabled, loading }) {
  const base = { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6 };
  const styles = variant === 'primary'
    ? [base, { backgroundColor: disabled ? '#cbd5e1' : colors.primary }]
    : variant === 'danger'
      ? [base, { backgroundColor: '#fee2e2' }]
      : [base, { backgroundColor: colors.line }];
  const textColor = variant === 'primary' ? '#fff' : variant === 'danger' ? colors.danger : colors.ink;
  return (
    <TouchableOpacity style={styles} onPress={onPress} disabled={disabled || loading}>
      {loading ? <ActivityIndicator color={textColor} /> : <Text style={{ color: textColor, fontSize: 16, fontWeight: '700' }}>{title}</Text>}
    </TouchableOpacity>
  );
}

export function Chip({ label, active, onPress, color }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8,
        backgroundColor: active ? (color || colors.primary) : colors.card,
        borderWidth: 1, borderColor: active ? (color || colors.primary) : colors.line,
      }}
    >
      <Text style={{ color: active ? '#fff' : colors.inkSoft, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Sheet({ visible, onClose, title, children }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' }} onStartShouldSetResponder={onClose}>
        <View
          onStartShouldSetResponder={() => true}
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.bg,
            borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '75%',
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink, marginBottom: 12 }}>{title}</Text>
          {children}
        </View>
      </View>
    </Modal>
  );
}

export function EmptyState({ icon, text }) {
  return (
    <View style={{ padding: 40, alignItems: 'center' }}>
      <Text style={{ fontSize: 40, marginBottom: 10 }}>{icon}</Text>
      <Text style={{ color: colors.inkSoft, textAlign: 'center', fontSize: 15 }}>{text}</Text>
    </View>
  );
}
