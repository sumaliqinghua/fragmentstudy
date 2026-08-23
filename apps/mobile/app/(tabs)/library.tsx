import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StreakRow } from '@/components/Chrome';
import { useMaterials } from '@/lib/materials';
import { formatStopProgress } from '@/lib/path';
import { colors } from '@/lib/theme';

export default function LibraryScreen() {
  const router = useRouter();
  const { articles, streak, xp, isReady, setActiveArticleId, refresh } = useMaterials();

  if (!isReady) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.teal} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StreakRow streak={streak} xp={xp} onProfile={() => router.push('/auth')} />
      <Text style={styles.heading}>书库</Text>
      <FlatList
        data={articles}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onRefresh={() => void refresh()}
        refreshing={false}
        ListEmptyComponent={
          <Text style={styles.empty}>暂无资料。导入一篇长文开始学习。</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => {
              setActiveArticleId(item.id);
              router.push('/(tabs)');
            }}
          >
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={styles.meta}>
              <Text style={styles.metaText}>
                {formatStopProgress(item.progress, item.cardCount || 0)}
              </Text>
              <Text style={styles.metaPill}>
                {(item.progress?.completed_count || 0) > 0 ? '进行中' : '未开始'}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.ink },
  meta: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaText: { fontSize: 13, color: colors.mute },
  metaPill: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.teal,
    backgroundColor: colors.tealSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  empty: { textAlign: 'center', color: colors.mute, marginTop: 40 },
});
