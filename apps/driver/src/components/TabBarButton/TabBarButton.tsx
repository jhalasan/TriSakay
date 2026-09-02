import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import { styles } from './TabBarButton.styles';

export function TabBarButton({ children, style, href: _href, ...rest }: BottomTabBarButtonProps) {
  const focused = rest['aria-selected'] ?? false;

  return (
    <Pressable
      {...(rest as ComponentProps<typeof Pressable>)}
      style={(state) => [style, styles.button, state.pressed && styles.buttonPressed]}
    >
      {focused && <View style={styles.marker} />}
      {children}
    </Pressable>
  );
}
