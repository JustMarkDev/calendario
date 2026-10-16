import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';

import { eventStart, toYmd, whenText } from './dates';
import type { CalEvent } from './db';

const CHANNEL = 'promemoria';
const MAX_SCHEDULED = 50;

export const REMIND_OPTIONS = [
  { value: null, label: 'Nessun promemoria' },
  { value: 0, label: "All'ora" },
  { value: 15, label: '15 min prima' },
  { value: 60, label: '1 ora prima' },
  { value: 24 * 60, label: 'Il giorno prima' },
];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const createChannel = () =>
  Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Promemoria',
    // eslint-disable-next-line import/namespace -- re-exported through export *, which the rule can't follow
    importance: Notifications.AndroidImportance.HIGH,
  });

// Android only shows the permission prompt once a channel exists.
export async function askPermission() {
  await createChannel();
  return (await Notifications.requestPermissionsAsync()).granted;
}

// Replaces every scheduled reminder with the next ones from the database.
// ponytail: only the next 50 are scheduled (Android caps alarms per app); later runs pick up the rest.
export async function scheduleReminders(db: SQLiteDatabase) {
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await createChannel();
  const rows = await db.getAllAsync<CalEvent>(
    'SELECT id, date, time, title, color, remind FROM events WHERE deleted = 0 AND time IS NOT NULL AND remind IS NOT NULL AND date >= ?',
    [toYmd(new Date())],
  );
  const now = Date.now();
  const upcoming = rows
    .map((e) => {
      const start = eventStart(e)!;
      return { e, start, at: new Date(start.getTime() - e.remind! * 60000) };
    })
    .filter(({ at }) => at.getTime() > now)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_SCHEDULED);

  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const { e, start, at } of upcoming) {
    await Notifications.scheduleNotificationAsync({
      identifier: e.id,
      content: { title: e.title, body: whenText(start, at), data: { url: `/day/${e.date}` } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
    });
  }
}
