import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, spacing, typography } from '@trisakay/ui';

// The active marker (22×3, centred on the item's top edge) and the
// active label's family swap (regular → bold) aren't expressible through
// `screenOptions.tabBarStyle`/`tabBarLabelStyle` alone — both need to react
// to per-item focus, so the marker lives in a custom `tabBarButton` and the
// label in a custom `tabBarLabel`.
//
// The installed @react-navigation/bottom-tabs passes selection state to a
// custom tabBarButton as an `aria-selected` prop (see BottomTabItem.js's
// `button({ ..., 'aria-selected': focused, ... })` call) — there is no
// `accessibilityState` key in that object at all, despite the TS type
// appearing to allow reading one. Reading `accessibilityState?.selected`
// here silently always resolved to `undefined`/false, which is why the
// marker never rendered.
function TabBarButton({
  children,
  style,
  onPress,
  onLongPress,
  testID,
  'aria-selected': ariaSelected,
  'aria-label': ariaLabel,
}: BottomTabBarButtonProps & { 'aria-selected'?: boolean; 'aria-label'?: string }) {
  const focused = ariaSelected ?? false;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityState={{ selected: focused }}
      accessibilityLabel={ariaLabel}
      testID={testID}
      android_ripple={{ color: 'transparent' }}
      style={(state) => [style, styles.tabButton, state.pressed && styles.tabButtonPressed]}
    >
      {focused && <View style={styles.activeMarker} />}
      {children}
    </Pressable>
  );
}

// No screen currently produces an unread count to pass in — this is the
// visual the spec describes, wired up and ready for whichever tab needs it
// once that data exists, rather than a number invented for this phase.
function TabIcon({ name, color, badge }: { name: keyof typeof Ionicons.glyphMap; color: string; badge?: number }) {
  return (
    <View>
      <Ionicons name={name} size={24} color={color} />
      {badge != null && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </View>
  );
}

function TabLabel({ label, color, focused }: { label: string; color: string; focused: boolean }) {
  return (
    <Text
      style={[styles.label, { color, fontFamily: focused ? fontFamily.bold : fontFamily.regular }]}
      numberOfLines={1}
      ellipsizeMode="clip"
      // The system font-scale setting on the reference device inflated an
      // 11px label past what a ~78px-wide tab column (five tabs / 390px)
      // can hold on one line — "Complaints" wrapped to two. Tab-bar labels
      // are a fixed-size chrome element, not reflowable body text, so this
      // caps scaling rather than letting the column overflow/wrap.
      allowFontScaling={false}
    >
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentBlue,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarButton: (props) => <TabBarButton {...props} />,
        tabBarStyle: {
          backgroundColor: colors.panel,
          borderTopWidth: 1,
          borderTopColor: colors.lineSoft,
          height: 60,
          paddingBottom: spacing.xs,
          paddingTop: spacing.xs,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
          tabBarLabel: ({ color, focused }) => <TabLabel label="Home" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <TabIcon name="time" color={color} />,
          tabBarLabel: ({ color, focused }) => <TabLabel label="History" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="complaints"
        options={{
          title: 'Complaints',
          tabBarIcon: ({ color }) => <TabIcon name="chatbox-ellipses" color={color} />,
          tabBarLabel: ({ color, focused }) => <TabLabel label="Complaints" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabIcon name="person" color={color} />,
          tabBarLabel: ({ color, focused }) => <TabLabel label="Profile" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <TabIcon name="settings-sharp" color={color} />,
          tabBarLabel: ({ color, focused }) => <TabLabel label="Settings" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabButton: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabButtonPressed: {
    backgroundColor: colors.fill,
  },
  // top:0 here is the top of this button's own box, which sits inset from
  // the tab bar's actual top edge by the bar's paddingTop (spacing.xs) plus
  // its 1px top hairline — pulling up by that same amount (-5) is what
  // lands the marker flush on the bar's real top edge, per spec, rather
  // than a few px below it.
  activeMarker: {
    position: 'absolute',
    top: -5,
    alignSelf: 'center',
    width: 22,
    height: 3,
    borderRadius: 2, // literal — no matching radius token, see docs/design_handoff_trisakay_passenger/PHASE0_NOTES.md
    backgroundColor: colors.accentBlue,
  },
  label: {
    ...typography.labelSm,
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.white,
  },
  badgeLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 9,
    lineHeight: 11,
    color: colors.white,
  },
});
