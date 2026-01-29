export type StreakRecordResult = {
  streakDays: number;
  shouldShow: boolean;
};

type StreakStore = {
  days: number;
  lastDate: string;
  lastShownDate?: string;
};

const STREAK_KEY = 'fragmentArticle.streak';

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readStore(): StreakStore {
  if (typeof window === 'undefined') {
    return { days: 0, lastDate: '' };
  }
  try {
    const raw = window.localStorage.getItem(STREAK_KEY);
    if (!raw) return { days: 0, lastDate: '' };
    const parsed = JSON.parse(raw) as StreakStore;
    return {
      days: typeof parsed.days === 'number' ? parsed.days : 0,
      lastDate: typeof parsed.lastDate === 'string' ? parsed.lastDate : '',
      lastShownDate: typeof parsed.lastShownDate === 'string' ? parsed.lastShownDate : undefined,
    };
  } catch {
    return { days: 0, lastDate: '' };
  }
}

function writeStore(store: StreakStore): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STREAK_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent('streak:update', { detail: store.days }));
}

export function getStreakDays(): number {
  const store = readStore();
  return store.days || 0;
}

export function recordStreak(options?: { date?: Date; forceShow?: boolean }): StreakRecordResult {
  const date = options?.date ?? new Date();
  const forceShow = options?.forceShow ?? false;
  const todayKey = toDateKey(date);
  const yesterday = new Date(date);
  yesterday.setDate(date.getDate() - 1);
  const yesterdayKey = toDateKey(yesterday);

  const store = readStore();
  let days = store.days || 0;

  if (store.lastDate === todayKey) {
    // No change.
  } else if (store.lastDate === yesterdayKey) {
    days = days + 1;
  } else {
    days = 1;
  }

  const shouldShow = forceShow || store.lastShownDate !== todayKey;

  const nextStore: StreakStore = {
    days,
    lastDate: todayKey,
    lastShownDate: shouldShow ? todayKey : store.lastShownDate,
  };

  writeStore(nextStore);

  return { streakDays: days, shouldShow };
}
