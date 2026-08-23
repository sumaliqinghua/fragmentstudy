import { Tabs, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';

function TabIcon({ label, active }: { label: string; active: boolean }) {
  return <Text style={{ fontSize: 18, opacity: active ? 1 : 0.45 }}>{label}</Text>;
}

export default function TabLayout() {
  const router = useRouter();
  const { isGuest } = useAuth();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.line,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '首页',
          tabBarIcon: ({ focused }) => <TabIcon label="🏠" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="import-tab"
        options={{
          title: '',
          tabBarLabel: () => null,
          tabBarIcon: () => (
            <View style={styles.plusOuter}>
              <Text style={styles.plus}>+</Text>
            </View>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            if (isGuest) {
              router.push('/auth');
            } else {
              router.push('/import');
            }
          },
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: '书库',
          tabBarIcon: ({ focused }) => <TabIcon label="📚" active={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  plusOuter: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  plus: { color: colors.white, fontSize: 28, fontWeight: '300', lineHeight: 30 },
});
