import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getArticle } from '@/lib/dataService';
import { colors } from '@/lib/theme';

export default function OriginalScreen() {
  const { articleId } = useLocalSearchParams<{ articleId: string }>();
  const [body, setBody] = useState<string | null>(null);
  const [title, setTitle] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const article = await getArticle(articleId);
      if (!cancelled && article) {
        setTitle(article.title);
        setBody(article.original_content);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  if (body == null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  content: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink, marginBottom: 16 },
  body: { fontSize: 16, lineHeight: 28, color: colors.ink },
});
