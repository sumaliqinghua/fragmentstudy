import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useMaterials } from '@/lib/materials';
import { colors } from '@/lib/theme';

export default function CelebrationScreen() {
  const router = useRouter();
  const { streak, xp } = useMaterials();

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  return (
    <View style={styles.root}>
      <Text style={styles.burst}>🎉</Text>
      <Text style={styles.title}>本关完成！</Text>
      <Text style={styles.subtitle}>连续 {streak} 天 · {xp} XP</Text>
      <Text style={styles.hint}>今天的一小步已经够了。想继续随时回来。</Text>

      <Pressable style={styles.primary} onPress={() => router.replace('/(tabs)')}>
        <Text style={styles.primaryText}>回到首页</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={() => router.back()}>
        <Text style={styles.secondaryText}>再看一眼</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  burst: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: colors.ink },
  subtitle: { marginTop: 8, fontSize: 16, fontWeight: '700', color: colors.teal },
  hint: { marginTop: 12, fontSize: 14, color: colors.mute, textAlign: 'center', lineHeight: 22 },
  primary: {
    marginTop: 32,
    backgroundColor: colors.teal,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  primaryText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  secondary: { marginTop: 12, padding: 12 },
  secondaryText: { color: colors.mute, fontWeight: '600' },
});
