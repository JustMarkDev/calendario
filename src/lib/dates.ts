export const MONTHS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];
export const WEEKDAYS = ['Do', 'Lu', 'Ma', 'Me', 'Gi', 'Ve', 'Sa'];
const WEEKDAYS_LONG = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

// Pager months are indexes from January 2000 through December 2099.
const FIRST_YEAR = 2000;
export const MONTH_COUNT = 100 * 12;

export const monthAt = (index: number) => ({
  year: FIRST_YEAR + Math.floor(index / 12),
  month: index % 12,
});

export const indexOf = (date: Date) => (date.getFullYear() - FIRST_YEAR) * 12 + date.getMonth();

const pad = (n: number) => String(n).padStart(2, '0');

// Dates are stored as local 'YYYY-MM-DD' strings so time zones never shift a day.
export const ymd = (year: number, month: number, day: number) =>
  `${year}-${pad(month + 1)}-${pad(day)}`;

export const toYmd = (date: Date) => ymd(date.getFullYear(), date.getMonth(), date.getDate());

export const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

export function parseYmd(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  const date = new Date(year, month, day);
  return date.getMonth() === month && date.getDate() === day ? date : null;
}

export const longDate = (date: Date) =>
  `${WEEKDAYS_LONG[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()].toLowerCase()} ${date.getFullYear()}`;

// A note's date + 'HH:MM' time as a local Date, or null without a time.
export function eventStart(e: { date: string; time: string | null }) {
  const day = parseYmd(e.date);
  if (!day || !e.time) return null;
  const [h, m] = e.time.split(':').map(Number);
  day.setHours(h, m);
  return day;
}

const dayNumber = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000;

// Reminder text as read when it fires: "Oggi alle 10:30", "Domani alle 10:30" or the full date.
export function whenText(start: Date, firesAt: Date) {
  const days = dayNumber(start) - dayNumber(firesAt);
  const day = days === 0 ? 'Oggi' : days === 1 ? 'Domani' : longDate(start);
  return `${day} alle ${pad(start.getHours())}:${pad(start.getMinutes())}`;
}
