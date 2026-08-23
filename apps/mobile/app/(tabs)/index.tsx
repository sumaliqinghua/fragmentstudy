import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GuestHint, PathTrail, StreakRow } from '@/components/Chrome';
import { useAuth } from '@/lib/auth';
import { useMaterials } from '@/lib/materials';
import { buildPathNodes, currentStopNode } from '@/lib/path';
import { colors } from '@/lib/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { isGuest } = useAuth();
  const {
    articles,
    activeArticleId,
    cards,
    progress,
    streak,
    xp,
    isReady,
    error,
    refresh,
  } = useMaterials();

  const active = articles.find((a) => a.id === activeArticleId) || articles[0];
  const nodes = buildPathNodes(cards, progress);
  const current = currentStopNode(nodes);

  const openCurrentStop = () => {
    if (!active || !current || current.cardStart == null) return;
    router.push({
      pathname: '/reader',
      params: {
        articleId: active.id,
        startIndex: String(current.cardStart),
        endIndex: String(current.cardEnd ?? current.cardStart),
      },
    });
  };

  if (!isReady) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.teal} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StreakRow streak={streak} xp={xp} onProfile={() => router.push('/auth')} />
      {isGuest ? <GuestHint onLogin={() => router.push('/auth')} /> : null}

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => void refresh()} />}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {active ? (
          <>
            <Text style={styles.materialTitle}>{active.title}</Text>
            <Text style={styles.subtitle}>今天走一关就好</Text>
            <PathTrail nodes={nodes} onContinue={openCurrentStop} />
          </>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>还没有资料</Text>
            <Text style={styles.emptyBody}>点中间的 + 导入一篇长文，AI 会帮你拆成关卡。</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 40 },
  materialTitle: {
    marginTop: 16,
    paddingHorizontal: 20,
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
  },
  subtitle: {
    marginTop: 4,
    paddingHorizontal: 20,
    fontSize: 14,
    color: colors.mute,
  },
  empty: { padding: 32, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  emptyBody: { marginTop: 8, fontSize: 14, color: colors.mute, textAlign: 'center' },
  error: { color: colors.danger, padding: 16, fontSize: 13 },
});
