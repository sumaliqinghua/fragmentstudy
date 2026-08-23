import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/lib/auth';
import { MaterialsProvider } from '@/lib/materials';
import { colors } from '@/lib/theme';

export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  return (
    <AuthProvider>
      <MaterialsProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.cream },
            headerTintColor: colors.ink,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: colors.cream },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="reader" options={{ title: '学习', headerBackTitle: '返回' }} />
          <Stack.Screen name="original" options={{ title: '原文', presentation: 'modal' }} />
          <Stack.Screen name="celebration" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="auth" options={{ title: '登录', presentation: 'modal' }} />
          <Stack.Screen name="import" options={{ title: '导入长文' }} />
        </Stack>
      </MaterialsProvider>
    </AuthProvider>
  );
}
