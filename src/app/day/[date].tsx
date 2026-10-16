import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { addEvent, deleteEvent, updateEvent } from '@/lib/db';
import { longDate, parseYmd } from '@/lib/dates';
import { EVENT_COLORS, useColors } from '@/lib/theme';
import { useEvents } from '@/lib/use-events';

export default function Day() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const parsed = parseYmd(date);
  const c = useColors();
  const db = useSQLiteContext();
  const events = useEvents(parsed ? date : 'invalid');
  const [title, setTitle] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!parsed) {
    return <Text style={{ color: c.fg, padding: 16 }}>Data non valida</Text>;
  }

  const reset = () => {
    setTitle('');
    setColor(null);
    setEditingId(null);
  };

  const save = async () => {
    const text = title.trim();
    if (!text) return;
    if (editingId) await updateEvent(db, editingId, text, color);
    else await addEvent(db, date, text, color);
    reset();
  };

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: longDate(parsed) }} />

      <TextInput
        value={title}
        onChangeText={setTitle}
        onSubmitEditing={save}
        placeholder="Scrivi una nota…"
        placeholderTextColor={c.muted}
        returnKeyType="done"
        autoFocus={events.length === 0}
        style={[styles.input, { color: c.fg, borderColor: c.line }]}
      />
      <View style={styles.swatches}>
        {EVENT_COLORS.map(({ value: swatch, name }) => (
          <Pressable
            key={name}
            onPress={() => setColor(swatch)}
            accessibilityLabel={name}
            accessibilityState={{ selected: color === swatch }}
            style={[
              styles.swatch,
              { backgroundColor: swatch ?? c.bg, borderColor: color === swatch ? c.fg : c.line },
              color === swatch && { borderWidth: 3 },
            ]}
          />
        ))}
      </View>
      <View style={styles.actions}>
        {editingId && (
          <Pressable onPress={reset} style={[styles.button, { borderColor: c.line }]}>
            <Text style={{ color: c.fg }}>Annulla</Text>
          </Pressable>
        )}
        <Pressable onPress={save} style={[styles.button, { backgroundColor: c.accent, borderColor: c.accent }]}>
          <Text style={styles.buttonText}>{editingId ? 'Salva' : 'Aggiungi'}</Text>
        </Pressable>
      </View>

      {events.map((e) => (
        <View key={e.id} style={[styles.event, { borderColor: c.line }]}>
          <Pressable
            style={styles.eventBody}
            onPress={() => {
              setEditingId(e.id);
              setTitle(e.title);
              setColor(e.color);
            }}
          >
            <View style={[styles.dot, { backgroundColor: e.color ?? c.muted }]} />
            <Text style={[styles.eventText, { color: c.fg }]}>{e.title}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (editingId === e.id) reset();
              deleteEvent(db, e.id);
            }}
            hitSlop={8}
            accessibilityLabel={`Elimina ${e.title}`}
          >
            <Text style={{ color: c.muted, fontSize: 15 }}>Elimina</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  input: { fontSize: 17, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  swatches: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  button: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  event: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    gap: 12,
  },
  eventBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  eventText: { fontSize: 17, flexShrink: 1 },
});
