import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@trisakay/ui';
import { TabBarButton } from '../../src/components/TabBarButton';
import { OfflineStrip } from '../../src/components/OfflineStrip/OfflineStrip';
import { styles } from '../../src/styles/tabs/layout.styles';
import { useConnectivityStore } from '../../src/store/useConnectivityStore';
import { useTranslation } from '../../src/hooks/useTranslation';

export default function TabsLayout() {
  const t = useTranslation();
  const insets = useSafeAreaInsets();
  // P1-24 (2026-09-15 launch audit): mirrors apps/passenger's tab layout — a
  // persistent strip plus a dimmed tab bar, so a driver who loses signal
  // sees that reflected everywhere instead of "Listening for requests"
  // implying a live connection that no longer exists.
  const isOffline = useConnectivityStore((state) => state.isOffline);

  return (
    <View style={styles.root}>
      <OfflineStrip />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accentBlue,
          tabBarInactiveTintColor: colors.inkFaint,
          tabBarButton: (props) => <TabBarButton {...props} />,
          tabBarLabel: ({ focused, color, children }) => (
            <Text style={[styles.label, { color }, focused && styles.labelActive]}>{children}</Text>
          ),
          tabBarStyle: {
            backgroundColor: colors.panel,
            borderTopWidth: 1,
            borderTopColor: colors.lineSoft,
            height: 60 + insets.bottom,
            paddingBottom: spacing.xs + insets.bottom,
            paddingTop: spacing.xs,
            opacity: isOffline ? 0.5 : 1,
          },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{ title: t.driver.tabs.dashboard, tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} /> }}
        />
        <Tabs.Screen
          name="requests"
          options={{ title: t.driver.tabs.requests, tabBarIcon: ({ color }) => <Ionicons name="list" size={24} color={color} /> }}
        />
        <Tabs.Screen
          name="history"
          options={{ title: t.driver.tabs.history, tabBarIcon: ({ color }) => <Ionicons name="time" size={24} color={color} /> }}
        />
        <Tabs.Screen
          name="earnings"
          options={{ title: t.driver.tabs.earnings, tabBarIcon: ({ color }) => <Ionicons name="wallet" size={24} color={color} /> }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: t.driver.tabs.profile, tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} /> }}
        />
      </Tabs>
    </View>
  );
}
