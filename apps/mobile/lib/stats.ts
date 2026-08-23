import AsyncStorage from '@react-native-async-storage/async-storage';

const STREAK_KEY = 'fs_streak';
const XP_KEY = 'fs_xp';
const LAST_STOP_DAY_KEY = 'fs_last_stop_day';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export async function loadStats(): Promise<{ streak: number; xp: number }> {
  const [streakRaw, xpRaw] = await Promise.all([
    AsyncStorage.getItem(STREAK_KEY),
    AsyncStorage.getItem(XP_KEY),
  ]);
  return {
    streak: Number(streakRaw) || 0,
    xp: Number(xpRaw) || 0,
  };
}

export async function addXp(amount: number): Promise<number> {
  const { xp } = await loadStats();
  const next = xp + amount;
  await AsyncStorage.setItem(XP_KEY, String(next));
  return next;
}

/** Call when a 关卡 is fully completed — updates soft streak. */
export async function recordStopComplete(): Promise<{ streak: number; xp: number }> {
  const [stats, lastDay] = await Promise.all([loadStats(), AsyncStorage.getItem(LAST_STOP_DAY_KEY)]);
  const today = todayKey();
  let streak = stats.streak;

  if (lastDay !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`;
    if (lastDay === yKey) {
      streak = Math.max(1, streak + 1);
    } else if (!lastDay) {
      streak = 1;
    } else {
      streak = 1;
    }
    await AsyncStorage.setItem(LAST_STOP_DAY_KEY, today);
    await AsyncStorage.setItem(STREAK_KEY, String(streak));
  }

  return { streak, xp: stats.xp };
}
