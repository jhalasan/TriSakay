import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { colors, spacing, typography } from '@trisakay/ui';
import { useTranslation } from '../../src/hooks/useTranslation';

export default function TabsLayout() {
  const t = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentBlue,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarLabelStyle: { ...typography.caption, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.panel,
          borderTopColor: colors.lineSoft,
          height: 60,
          paddingBottom: spacing.xs,
          paddingTop: spacing.xs,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: t.driver.tabs.dashboard, tabBarIcon: ({ color, size }) => <Ionicons name="speedometer" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="requests"
        options={{ title: t.driver.tabs.requests, tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: t.driver.tabs.history, tabBarIcon: ({ color, size }) => <Ionicons name="time" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="earnings"
        options={{ title: t.driver.tabs.earnings, tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t.driver.tabs.profile, tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }}
      />
    </Tabs>
  );
}
