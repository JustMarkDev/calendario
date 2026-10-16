'use no memo'; // widget trees are built by calling components as plain functions, which the React Compiler breaks
import type { SQLiteDatabase } from 'expo-sqlite';
import { FlexWidget, requestWidgetUpdate, TextWidget, type WidgetTaskHandler } from 'react-native-android-widget';

import { MONTHS, toYmd, WEEKDAYS } from '@/lib/dates';
import { type CalEvent, listBetween, openDb } from '@/lib/db';
import { dark, light, type Palette } from '@/lib/theme';

const NAME = 'Agenda';
const ROW_HEIGHT = 26; // dp, matches fontSize 13 plus breathing room
const HEADER_HEIGHT = 40;

type Day = { date: Date; text: string };

// The home screen version of the month view: the next days, one line each, as many as fit.
function Agenda({ days, c }: { days: Day[]; c: Palette }) {
  const today = days[0].date;
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: c.bg, borderRadius: 16, padding: 8 }}
    >
      <TextWidget
        text={`${MONTHS[today.getMonth()]} ${today.getFullYear()}`}
        style={{ fontSize: 15, fontWeight: '600', color: c.fg, marginLeft: 4, marginBottom: 4 }}
      />
      {days.map(({ date, text }, i) => {
        const weekday = date.getDay();
        return (
          <FlexWidget
            key={toYmd(date)}
            clickAction="OPEN_URI"
            clickActionData={{ uri: `calendario://day/${toYmd(date)}` }}
            style={{
              flex: 1,
              width: 'match_parent',
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 4,
              borderBottomWidth: 1,
              borderBottomColor: c.line,
              backgroundColor: weekday === 6 ? c.saturday : weekday === 0 ? c.sunday : c.bg,
            }}
          >
            <TextWidget
              text={String(date.getDate())}
              style={{ width: 22, fontSize: 13, fontWeight: '600', textAlign: 'right', color: i === 0 ? c.accent : c.fg }}
            />
            <TextWidget
              text={WEEKDAYS[weekday]}
              style={{ width: 24, marginLeft: 6, fontSize: 12, color: weekday === 0 ? c.accent : c.muted }}
            />
            <FlexWidget style={{ flex: 1 }}>
              <TextWidget text={text} maxLines={1} truncate="END" style={{ width: 'match_parent', fontSize: 13, color: c.fg }} />
            </FlexWidget>
          </FlexWidget>
        );
      })}
    </FlexWidget>
  );
}

const label = (e: CalEvent) => (e.time ? `${e.time} ${e.title}` : e.title);

async function render(db: SQLiteDatabase, height: number | undefined) {
  // Some launcher callbacks come without a size; a week is a sensible default.
  const fits = Math.floor(((height ?? 0) - HEADER_HEIGHT) / ROW_HEIGHT);
  const count = Number.isFinite(fits) && fits > 0 ? Math.max(3, Math.min(14, fits)) : 7;
  const now = new Date();
  const dates = Array.from({ length: count }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + i));
  const events = await listBetween(db, toYmd(dates[0]), toYmd(dates[count - 1]));
  const days = dates.map((date) => ({
    date,
    text: events
      .filter((e) => e.date === toYmd(date))
      .map(label)
      .join('  ·  '),
  }));
  return { light: <Agenda days={days} c={light} />, dark: <Agenda days={days} c={dark} /> };
}

export const updateAgendaWidget = (db: SQLiteDatabase) =>
  requestWidgetUpdate({ widgetName: NAME, renderWidget: (info) => render(db, info.height) });

// Runs headless when the widget is added, resized, or its 30-minute refresh comes up (which also rolls the day over).
export const widgetTaskHandler: WidgetTaskHandler = async ({ widgetAction, widgetInfo, renderWidget }) => {
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  renderWidget(await render(await openDb(), widgetInfo.height));
};
