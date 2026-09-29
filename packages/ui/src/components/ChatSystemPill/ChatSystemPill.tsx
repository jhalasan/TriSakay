import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { styles } from './ChatSystemPill.styles';

export type ChatSystemPillIcon = 'checkmark-circle' | 'swap-horizontal' | 'location' | 'lock-closed';

export interface ChatSystemPillProps {
  icon: ChatSystemPillIcon;
  text: string;
}

const ICON_COLOR: Record<ChatSystemPillIcon, string> = {
  'checkmark-circle': colors.accentGreen,
  'swap-horizontal': colors.accentBlue,
  location: colors.accentGreen,
  'lock-closed': colors.inkSoft,
};

/** A centred, client-derived system pill (Part C §C5) — "accepted"/"moved"/"arrived"/"ended" events built from ride timestamps the screen already has. Nothing is written to the DB for these. */
export function ChatSystemPill({ icon, text }: ChatSystemPillProps) {
  return (
    <View style={styles.row}>
      <View style={styles.pill}>
        <Ionicons name={icon} size={12} color={ICON_COLOR[icon]} />
        <Text style={styles.text}>{text}</Text>
      </View>
    </View>
  );
}
