import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import { type Href, router } from 'expo-router';
import { addDatabaseChangeListener, type SQLiteDatabase, useSQLiteContext } from 'expo-sqlite';
import * as TaskManager from 'expo-task-manager';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { updateAgendaWidget } from '@/widget/agenda';

import { openDb } from './db';
import { scheduleReminders } from './reminders';
import { sync } from './sync';

const TASK = 'calendario-sync';

// Everything derived from the notes: phone reminders and the home screen widget.
async function refresh(db: SQLiteDatabase) {
  await scheduleReminders(db);
  if (Platform.OS === 'android') await updateAgendaWidget(db);
}

// Picks up notes added by agents while the app is closed, so their reminders still fire.
TaskManager.defineTask(TASK, async () => {
  try {
    const db = await openDb();
    await sync(db);
    await refresh(db);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

const quietly = (p: Promise<unknown>) => p.catch((e) => console.warn(e));

// Mounted once in the root layout.
export function useBackgroundWork() {
  const db = useSQLiteContext();
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    quietly(BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 60 }));
    quietly(sync(db));
    quietly(refresh(db));
    const appState = AppState.addEventListener('change', (state) => state === 'active' && quietly(sync(db)));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const change = addDatabaseChangeListener(() => {
      clearTimeout(timer);
      timer = setTimeout(() => quietly(refresh(db)), 500);
    });
    return () => {
      appState.remove();
      change.remove();
      clearTimeout(timer);
    };
  }, [db]);

  // Tapping a reminder opens its day.
  useEffect(() => {
    const url = response?.notification.request.content.data?.url;
    if (typeof url !== 'string') return;
    router.push(url as Href);
    quietly(Notifications.clearLastNotificationResponseAsync());
  }, [response]);
}
