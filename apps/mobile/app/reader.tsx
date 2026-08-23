import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { explainSelection, isAIConfigured } from '@/lib/ai';
import { useAuth } from '@/lib/auth';
import { getArticle, getCards, upsertProgress } from '@/lib/dataService';
import { useMaterials } from '@/lib/materials';
import { colors, XP_PER_CARD, XP_PER_STOP } from '@/lib/theme';
import type { Article, Card } from '@/lib/types';

export default function ReaderScreen() {
  const router = useRouter();
  const { isGuest } = useAuth();
  const { bumpXp, completeStop, refresh } = useMaterials();
  const params = useLocalSearchParams<{
    articleId: string;
    startIndex?: string;
    endIndex?: string;
  }>();

  const articleId = params.articleId;
  const startIndex = Number(params.startIndex || 0);
  const endIndex = Number(params.endIndex || 0);

  const [article, setArticle] = useState<Article | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(startIndex);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState('');
  const [explain, setExplain] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [a, c] = await Promise.all([getArticle(articleId), getCards(articleId)]);
        if (!cancelled) {
          setArticle(a);
          setCards(c);
          setIndex(Math.min(startIndex, Math.max(0, c.length - 1)));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [articleId, startIndex]);

  const card = cards[index];
  const stopProgress = useMemo(() => {
    const total = Math.max(1, endIndex - startIndex + 1);
    const done = Math.max(0, index - startIndex);
    return ((done + 1) / total) * 100;
  }, [index, startIndex, endIndex]);

  const finishCard = async () => {
    if (!card || !article) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await upsertProgress(article.id, index, cards.length, 'card');
    await bumpXp(XP_PER_CARD);

    if (index >= endIndex) {
      await bumpXp(XP_PER_STOP);
      await completeStop();
      await refresh();
      router.replace({
        pathname: '/celebration',
        params: { articleId: article.id },
      });
      return;
    }
    setIndex((i) => i + 1);
    setSelection('');
    setExplain(null);
    setNote('');
  };

  const runExplain = async () => {
    if (!card || !selection.trim()) return;
    if (isGuest) {
      router.push('/auth');
      return;
    }
    setExplaining(true);
    try {
      const text = await explainSelection(selection.trim(), card.content);
      setExplain(text);
    } catch (e) {
      setExplain(e instanceof Error ? e.message : '解释失败');
    } finally {
      setExplaining(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  if (!card || !article) {
    return (
      <View style={styles.center}>
        <Text style={styles.mute}>找不到卡片</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Text style={styles.progressLabel}>
          本关 {index - startIndex + 1} / {endIndex - startIndex + 1}
        </Text>
        <Pressable onPress={() => router.push({ pathname: '/original', params: { articleId } })}>
          <Text style={styles.originalLink}>原文</Text>
        </Pressable>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${stopProgress}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.label}>{card.semantic_label}</Text>
        <Text style={styles.content} selectable>
          {card.content}
        </Text>
        {card.context_summary ? (
          <Text style={styles.context}>{card.context_summary}</Text>
        ) : null}

        <View style={styles.toolCard}>
          <Text style={styles.toolTitle}>选句工具</Text>
          <TextInput
            style={styles.input}
            placeholder="粘贴或输入想理解的句子…"
            placeholderTextColor={colors.faint}
            value={selection}
            onChangeText={setSelection}
            multiline
          />
          <View style={styles.toolRow}>
            <Pressable
              style={[styles.toolBtn, !selection.trim() && styles.toolBtnDisabled]}
              disabled={!selection.trim() || explaining}
              onPress={() => void runExplain()}
            >
              <Text style={styles.toolBtnText}>
                {explaining ? '解释中…' : isAIConfigured() ? 'AI 解释' : '解释'}
              </Text>
            </Pressable>
            <Pressable
              style={styles.toolBtnSecondary}
              onPress={() => {
                if (selection.trim()) {
                  setNote((n) => (n ? `${n}\n• ${selection.trim()}` : `• ${selection.trim()}`));
                }
              }}
            >
              <Text style={styles.toolBtnSecondaryText}>加高亮笔记</Text>
            </Pressable>
          </View>
          {explain ? <Text style={styles.explain}>{explain}</Text> : null}
          {note ? (
            <View style={styles.noteBox}>
              <Text style={styles.noteTitle}>笔记</Text>
              <Text style={styles.noteBody}>{note}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.nextBtn} onPress={() => void finishCard()}>
          <Text style={styles.nextText}>{index >= endIndex ? '完成本关' : '下一张'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  mute: { color: colors.mute },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  progressLabel: { fontSize: 13, fontWeight: '600', color: colors.mute },
  originalLink: { fontSize: 14, fontWeight: '700', color: colors.teal },
  progressTrack: {
    height: 4,
    backgroundColor: colors.line,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.teal },
  body: { padding: 20, paddingBottom: 120 },
  label: {
    alignSelf: 'flex-start',
    backgroundColor: colors.tealSoft,
    color: colors.teal,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 12,
  },
  content: { fontSize: 18, lineHeight: 30, color: colors.ink, fontWeight: '500' },
  context: { marginTop: 12, fontSize: 13, color: colors.faint },
  toolCard: {
    marginTop: 24,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
  },
  toolTitle: { fontSize: 13, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  input: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 10,
    fontSize: 14,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  toolRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  toolBtn: {
    flex: 1,
    backgroundColor: colors.teal,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  toolBtnDisabled: { opacity: 0.4 },
  toolBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  toolBtnSecondary: {
    flex: 1,
    backgroundColor: colors.goldSoft,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  toolBtnSecondaryText: { color: colors.gold, fontWeight: '700', fontSize: 13 },
  explain: { marginTop: 12, fontSize: 14, lineHeight: 22, color: colors.mute },
  noteBox: { marginTop: 12, backgroundColor: colors.cream, borderRadius: 10, padding: 10 },
  noteTitle: { fontSize: 12, fontWeight: '700', color: colors.ink },
  noteBody: { marginTop: 4, fontSize: 13, color: colors.mute, lineHeight: 20 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: colors.cream,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  nextBtn: {
    backgroundColor: colors.teal,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
