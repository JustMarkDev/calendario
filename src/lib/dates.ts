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

export function isoWeek(year: number, month: number, day: number) {
  const d = new Date(Date.UTC(year, month, day));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
}

export function parseYmd(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  const date = new Date(year, month, day);
  return date.getMonth() === month && date.getDate() === day ? date : null;
}

export const longDate = (date: Date) =>
  `${WEEKDAYS_LONG[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()].toLowerCase()} ${date.getFullYear()}`;
