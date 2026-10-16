import { addDatabaseChangeListener, useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { CalEvent, listEvents } from './db';

// Live list of events whose date starts with prefix; reloads on any database write.
export function useEvents(prefix: string) {
  const db = useSQLiteContext();
  const [events, setEvents] = useState<CalEvent[]>([]);
  useEffect(() => {
    let active = true;
    const load = () => listEvents(db, prefix).then((rows) => active && setEvents(rows));
    load();
    const sub = addDatabaseChangeListener(load);
    return () => {
      active = false;
      sub.remove();
    };
  }, [db, prefix]);
  return events;
}
