import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';

type Mode = 'signin' | 'signup';

export default function AuthScreen() {
  const router = useRouter();
  const { user, isGuest, configError, signIn, signUp, signOut, emailDeliveryEnabled } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isGuest && user) {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>已登录</Text>
        <Text style={styles.email}>{user.email}</Text>
        <Pressable
          style={styles.primary}
          onPress={async () => {
            await signOut();
            router.back();
          }}
        >
          <Text style={styles.primaryText}>退出登录</Text>
        </Pressable>
        <Pressable style={styles.link} onPress={() => router.back()}>
          <Text style={styles.linkText}>关闭</Text>
        </Pressable>
      </View>
    );
  }

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email.trim(), password);
        if (error) throw error;
        router.back();
      } else {
        const { error, requiresEmailConfirmation } = await signUp(email.trim(), password);
        if (error) throw error;
        if (requiresEmailConfirmation) {
          setMessage(
            emailDeliveryEnabled
              ? '注册成功，请查收确认邮件后再登录。'
              : '注册成功。若未开启邮件确认，可直接登录。'
          );
          setMode('signin');
        } else {
          router.back();
        }
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{mode === 'signin' ? '登录' : '注册'}</Text>
      <Text style={styles.subtitle}>登录后可导入长文、使用 AI，并跨设备同步进度。</Text>

      {configError ? <Text style={styles.error}>{configError}</Text> : null}

      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="邮箱"
        placeholderTextColor={colors.faint}
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        secureTextEntry
        placeholder="密码"
        placeholderTextColor={colors.faint}
        value={password}
        onChangeText={setPassword}
      />

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <Pressable
        style={[styles.primary, busy && styles.disabled]}
        disabled={busy || !email.trim() || password.length < 6}
        onPress={() => void submit()}
      >
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.primaryText}>{mode === 'signin' ? '登录' : '注册'}</Text>
        )}
      </Pressable>

      <Pressable
        style={styles.link}
        onPress={() => setMode((m) => (m === 'signin' ? 'signup' : 'signin'))}
      >
        <Text style={styles.linkText}>
          {mode === 'signin' ? '没有账号？注册' : '已有账号？登录'}
        </Text>
      </Pressable>

      <Pressable style={styles.link} onPress={() => router.back()}>
        <Text style={styles.linkText}>先以访客继续试用</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream, padding: 24 },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink },
  subtitle: { marginTop: 8, fontSize: 14, color: colors.mute, lineHeight: 20 },
  email: { marginTop: 12, fontSize: 16, color: colors.teal, fontWeight: '600' },
  input: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  primary: {
    marginTop: 20,
    backgroundColor: colors.teal,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disabled: { opacity: 0.5 },
  primaryText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  link: { marginTop: 16, alignItems: 'center' },
  linkText: { color: colors.teal, fontWeight: '600' },
  error: { marginTop: 12, color: colors.danger, fontSize: 13 },
  message: { marginTop: 12, color: colors.mute, fontSize: 13 },
});
