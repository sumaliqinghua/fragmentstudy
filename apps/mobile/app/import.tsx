import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { generateTitle, splitArticle } from '@/lib/ai';
import { useAuth } from '@/lib/auth';
import { createArticle, createCards } from '@/lib/dataService';
import { useMaterials } from '@/lib/materials';
import { colors } from '@/lib/theme';

type Step = 'paste' | 'processing' | 'ready';

export default function ImportScreen() {
  const router = useRouter();
  const { isGuest } = useAuth();
  const { refresh, setActiveArticleId } = useMaterials();
  const [step, setStep] = useState<Step>('paste');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [resolvedTitle, setResolvedTitle] = useState('');
  const [cardCount, setCardCount] = useState(0);
  const [articleId, setArticleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isGuest) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>需要登录</Text>
        <Text style={styles.mute}>导入与 AI 拆分仅对登录用户开放。</Text>
        <Pressable style={styles.primary} onPress={() => router.replace('/auth')}>
          <Text style={styles.primaryText}>去登录</Text>
        </Pressable>
      </View>
    );
  }

  const runImport = async () => {
    if (!body.trim()) return;
    setError(null);
    setStep('processing');
    try {
      const finalTitle = title.trim() || (await generateTitle(body));
      const splits = await splitArticle(body.trim());
      const article = await createArticle(finalTitle, body.trim(), 'card', undefined, {
        sourceType: 'text',
      });
      await createCards(article.id, splits);
      setResolvedTitle(finalTitle);
      setCardCount(splits.length);
      setArticleId(article.id);
      setActiveArticleId(article.id);
      await refresh();
      setStep('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败');
      setStep('paste');
    }
  };

  if (step === 'processing') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.teal} />
        <Text style={styles.processing}>正在提炼卡片、划分关卡…</Text>
      </View>
    );
  }

  if (step === 'ready' && articleId) {
    return (
      <View style={styles.center}>
        <Text style={styles.burst}>✨</Text>
        <Text style={styles.title}>准备好了</Text>
        <Text style={styles.readyTitle}>{resolvedTitle}</Text>
        <Text style={styles.mute}>共 {cardCount} 张卡片，已排成关卡路径</Text>
        <Pressable
          style={styles.primary}
          onPress={() => {
            router.replace('/(tabs)');
          }}
        >
          <Text style={styles.primaryText}>开始第一关</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.lead}>把长文粘进来。标题可选——不写的话我们帮你起。</Text>

      <Text style={styles.fieldLabel}>正文（必填）</Text>
      <TextInput
        style={[styles.input, styles.bodyInput]}
        multiline
        textAlignVertical="top"
        placeholder="粘贴文章、笔记、讲义…"
        placeholderTextColor={colors.faint}
        value={body}
        onChangeText={setBody}
      />

      <Text style={styles.fieldLabel}>标题（可选）</Text>
      <TextInput
        style={styles.input}
        placeholder="不填则由 AI 生成"
        placeholderTextColor={colors.faint}
        value={title}
        onChangeText={setTitle}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.primary, !body.trim() && styles.disabled]}
        disabled={!body.trim()}
        onPress={() => void runImport()}
      >
        <Text style={styles.primaryText}>开始拆分</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 20, paddingBottom: 48 },
  center: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  lead: { fontSize: 15, color: colors.mute, lineHeight: 22, marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.ink, marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
  },
  bodyInput: { minHeight: 220 },
  primary: {
    marginTop: 24,
    backgroundColor: colors.teal,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  disabled: { opacity: 0.4 },
  primaryText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  error: { marginTop: 12, color: colors.danger },
  processing: { marginTop: 16, color: colors.mute, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink },
  mute: { marginTop: 8, color: colors.mute, textAlign: 'center' },
  burst: { fontSize: 48, marginBottom: 12 },
  readyTitle: { marginTop: 12, fontSize: 18, fontWeight: '700', color: colors.teal, textAlign: 'center' },
});
