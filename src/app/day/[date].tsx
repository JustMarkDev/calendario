import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { addEvent, type CalEvent, deleteEvent, updateEvent } from '@/lib/db';
import { eventStart, longDate, parseYmd } from '@/lib/dates';
import { askPermission, REMIND_OPTIONS } from '@/lib/reminders';
import { syncSoon } from '@/lib/sync';
import { eventColorsFor } from '@/lib/colors';
import { useColors } from '@/lib/theme';
import { useEvents } from '@/lib/use-events';

const remindLabel = (minutes: number | null) => REMIND_OPTIONS.find((o) => o.value === minutes)?.label;

export default function Day() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const parsed = parseYmd(date);
  const c = useColors();
  const db = useSQLiteContext();
  const events = useEvents(parsed ? date : 'invalid');
  const [title, setTitle] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [remind, setRemind] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!parsed) {
    return <Text style={{ color: c.fg, padding: 16 }}>Data non valida</Text>;
  }

  const load = (e: Pick<CalEvent, 'id' | 'title' | 'color' | 'time' | 'remind'> | null) => {
    setEditingId(e?.id ?? null);
    setTitle(e?.title ?? '');
    setColor(e?.color ?? null);
    setTime(e?.time ?? null);
    setRemind(e?.remind ?? null);
  };
  const reset = () => load(null);

  const save = async () => {
    const text = title.trim();
    if (!text) return;
    const fields = { title: text, color, time, remind: time ? remind : null };
    if (editingId) await updateEvent(db, editingId, fields);
    else await addEvent(db, date, fields);
    syncSoon(db);
    reset();
  };

  const pickTime = () => {
    const current = eventStart({ date, time: time ?? '09:00' })!;
    DateTimePickerAndroid.open({
      value: current,
      mode: 'time',
      is24Hour: true,
      onValueChange: (_, picked) =>
        setTime(`${String(picked.getHours()).padStart(2, '0')}:${String(picked.getMinutes()).padStart(2, '0')}`),
    });
  };

  const chooseRemind = async (value: number | null) => {
    setRemind(value);
    if (value !== null && !(await askPermission())) {
      Alert.alert(
        'Notifiche disattivate',
        'Per ricevere i promemoria, attiva le notifiche per Calendario nelle impostazioni del telefono.',
      );
    }
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
        {eventColorsFor(c.accent).map(({ value: swatch, name }) => (
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

      <View style={styles.row}>
        <Pressable onPress={pickTime} style={[styles.chip, { borderColor: time ? c.accent : c.line }]}>
          <Text style={{ color: time ? c.accent : c.fg, fontSize: 16 }}>{time ? `Ore ${time}` : 'Aggiungi ora'}</Text>
        </Pressable>
        {time && (
          <Pressable onPress={() => setTime(null)} hitSlop={8} accessibilityLabel="Togli l'ora">
            <Text style={{ color: c.muted, fontSize: 15 }}>Togli</Text>
          </Pressable>
        )}
      </View>
      {time && (
        <View style={styles.row}>
          {REMIND_OPTIONS.map((o) => (
            <Pressable
              key={o.label}
              onPress={() => chooseRemind(o.value)}
              accessibilityState={{ selected: remind === o.value }}
              style={[styles.chip, { borderColor: remind === o.value ? c.accent : c.line }]}
            >
              <Text style={{ color: remind === o.value ? c.accent : c.fg }}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        {editingId && (
          <Pressable onPress={reset} style={[styles.button, { borderColor: c.line }]}>
            <Text style={{ color: c.fg }}>Annulla</Text>
          </Pressable>
        )}
        <Pressable onPress={save} style={[styles.button, { backgroundColor: c.accent, borderColor: c.accent }]}>
          <Text style={[styles.buttonText, { color: c.onAccent }]}>{editingId ? 'Salva' : 'Aggiungi'}</Text>
        </Pressable>
      </View>

      {events.map((e) => (
        <View key={e.id} style={[styles.event, { borderColor: c.line }]}>
          <Pressable style={styles.eventBody} onPress={() => load(e)}>
            <View style={[styles.dot, { backgroundColor: e.color ?? c.muted }]} />
            <View style={styles.eventText}>
              <Text style={{ color: c.fg, fontSize: 17 }}>
                {e.time && <Text style={{ fontWeight: '600' }}>{e.time} </Text>}
                {e.title}
              </Text>
              {e.time && e.remind !== null && (
                <Text style={{ color: c.muted, fontSize: 14 }}>Promemoria: {remindLabel(e.remind)?.toLowerCase()}</Text>
              )}
            </View>
          </Pressable>
          <Pressable
            onPress={async () => {
              if (editingId === e.id) reset();
              await deleteEvent(db, e.id);
              syncSoon(db);
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
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  button: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10 },
  buttonText: { fontWeight: '600', fontSize: 16 },
  event: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    gap: 12,
  },
  eventBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  eventText: { flexShrink: 1 },
});
