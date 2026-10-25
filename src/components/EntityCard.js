// Карточка сущности в списке (задача/проект/риск…)
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';
import { StatusBadge, PriorityBadge, Badge } from './ui';
import { formatDate, isOverdue, relTime } from '../utils/format';

export default function EntityCard({ item, statuses, onPress }) {
  const overdue = isOverdue(item.due_date) && item.status_key !== 'done';
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.line }}
    >
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }} numberOfLines={2}>
        {item.title}
      </Text>
      {item.description ? (
        <Text style={{ fontSize: 13, color: colors.inkSoft, marginTop: 4 }} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, alignItems: 'center' }}>
        <StatusBadge statusKey={item.status_key} statuses={statuses} />
        <PriorityBadge priorityKey={item.priority_key} />
        {item.due_date ? (
          <Badge label={'⏰ ' + formatDate(item.due_date)} color={overdue ? colors.danger : colors.inkSoft} />
        ) : null}
        {!item.can_edit ? <Badge label="только чтение" color="#94a3b8" /> : null}
        {item.local ? <Badge label="⏳ без сети, будет отправлено" color="#b45309" /> : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        <Text style={{ fontSize: 12, color: colors.inkSoft }} numberOfLines={1}>
          👤 {item.responsibles && item.responsibles.length ? item.responsibles.join(', ') : '—'}
        </Text>
        <Text style={{ fontSize: 12, color: '#94a3b8' }}>{relTime(item.updated_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}
