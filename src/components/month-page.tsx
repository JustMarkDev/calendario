import { router } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MONTHS, WEEKDAYS, daysInMonth, isoWeek, monthAt, toYmd, ymd } from '@/lib/dates';
import { useColors } from '@/lib/theme';
import { useEvents } from '@/lib/use-events';

type Props = {
  index: number;
  width: number;
  height: number;
  onGo: (index: number) => void;
  todayIndex: number;
};

// One month as a paper-planner column: one line per day, all days on screen at once.
export function MonthPage({ index, width, height, onGo, todayIndex }: Props) {
  const c = useColors();
  const { year, month } = monthAt(index);
  const events = useEvents(ymd(year, month, 1).slice(0, 7));
  const today = toYmd(new Date());
  const days = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1);

  return (
    <View style={{ width, height, backgroundColor: c.bg }}>
      <View style={styles.header}>
        <Pressable onPress={() => onGo(index - 1)} hitSlop={12} accessibilityLabel="Mese precedente">
          <Text style={[styles.arrow, { color: c.accent }]}>‹</Text>
        </Pressable>
        <Pressable onPress={() => onGo(todayIndex)} accessibilityLabel="Vai a oggi">
          <Text style={[styles.title, { color: c.fg }]}>
            {MONTHS[month]} {year}
          </Text>
        </Pressable>
        <Pressable onPress={() => onGo(index + 1)} hitSlop={12} accessibilityLabel="Mese successivo">
          <Text style={[styles.arrow, { color: c.accent }]}>›</Text>
        </Pressable>
      </View>
      {days.map((day) => {
        const date = ymd(year, month, day);
        const weekday = new Date(year, month, day).getDay();
        const isToday = date === today;
        const dayEvents = events.filter((e) => e.date === date);
        return (
          <Pressable
            key={day}
            onPress={() => router.push({ pathname: '/day/[date]', params: { date } })}
            style={[
              styles.row,
              { borderColor: c.line },
              weekday === 6 && { backgroundColor: c.saturday },
              weekday === 0 && { backgroundColor: c.sunday },
              isToday && { borderColor: c.accent, borderWidth: 2 },
            ]}
          >
            <Text style={[styles.day, { color: c.fg }, isToday && { color: c.accent }]}>{day}</Text>
            <Text style={[styles.weekday, { color: weekday === 0 ? c.accent : c.muted }]}>
              {WEEKDAYS[weekday]}
            </Text>
            {/* One Text so earlier notes stay whole and only the tail gets ellipsized. */}
            <Text numberOfLines={1} style={[styles.events, { color: c.fg }]}>
              {dayEvents.map((e, i) => (
                <Fragment key={e.id}>
                  {i > 0 && '  '}
                  {e.color ? (
                    <Text style={{ backgroundColor: e.color, color: '#fff' }}> {e.title} </Text>
                  ) : (
                    e.title
                  )}
                </Fragment>
              ))}
            </Text>
            {weekday === 0 && (
              <Text style={[styles.week, { color: c.muted }]}>{isoWeek(year, month, day)}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  arrow: { fontSize: 32, lineHeight: 34, paddingHorizontal: 8 },
  title: { fontSize: 20, fontWeight: '600' },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    gap: 6,
  },
  day: { width: 24, fontSize: 15, fontWeight: '600', textAlign: 'right' },
  weekday: { width: 22, fontSize: 13 },
  events: { flex: 1, fontSize: 14 },
  week: { fontSize: 12 },
});
