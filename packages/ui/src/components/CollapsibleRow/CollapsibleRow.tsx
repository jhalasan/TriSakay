import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily } from '../../theme';

export interface CollapsibleRowProps {
  title: string;
  /** Leading slot — an IconTile, or an AccordionGroup's section number. */
  leading?: React.ReactNode;
  /** Slot between the title and the chevron (a count pill). */
  trailing?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  /** Colours the title and chevron navy while open (the Terms accordion). */
  highlightWhenOpen?: boolean;
  /** Indents the body to line up under the title (28 for the numbered accordion, 48 under a 36px tile). */
  bodyIndent?: number;
  children?: React.ReactNode;
}

/** A row that reveals its children under a chevron that rotates 180° when open. Controlled: wrap it in `AccordionGroup` for one-open-at-a-time. */
export function CollapsibleRow({
  title,
  leading,
  trailing,
  open,
  onToggle,
  highlightWhenOpen = false,
  bodyIndent = 0,
  children,
}: CollapsibleRowProps) {
  const active = open && highlightWhenOpen;
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        onPress={onToggle}
        style={styles.header}
      >
        {leading}
        <Text style={[styles.title, active && styles.titleActive]} numberOfLines={2}>
          {title}
        </Text>
        {trailing}
        <Ionicons
          name="chevron-down"
          size={14}
          color={active ? colors.accentBlue : colors.inkSoft}
          style={open ? styles.chevronOpen : undefined}
        />
      </Pressable>
      {open && <View style={[styles.body, { paddingLeft: bodyIndent }]}>{children}</View>}
    </View>
  );
}

export interface AccordionItem {
  id: string;
  title: string;
  /** Section number shown at the left ("1", "2", …). */
  number?: number;
  body: React.ReactNode;
}

export interface AccordionGroupProps {
  items: AccordionItem[];
  /** Section open on first render. Defaults to the first item; pass null for all-closed. */
  defaultOpenId?: string | null;
}

/** Numbered accordion where opening one section closes the others (Terms & Privacy). Remount it (change `key`) to reset to the default section. */
export function AccordionGroup({ items, defaultOpenId }: AccordionGroupProps) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId === undefined ? (items[0]?.id ?? null) : defaultOpenId);
  return (
    <View>
      {items.map((item, index) => {
        const open = item.id === openId;
        return (
          <View key={item.id} style={index > 0 ? styles.separator : undefined}>
            <CollapsibleRow
              title={item.title}
              open={open}
              highlightWhenOpen
              bodyIndent={28}
              onToggle={() => setOpenId(open ? null : item.id)}
              leading={
                item.number !== undefined ? (
                  <Text style={[styles.number, open && styles.numberActive]}>{item.number}</Text>
                ) : undefined
              }
            >
              {item.body}
            </CollapsibleRow>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13 },
  title: { flex: 1, fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 20, color: colors.ink },
  titleActive: { color: colors.accentBlue },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  body: { paddingBottom: 13 },
  separator: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
  number: { width: 18, fontFamily: fontFamily.bold, fontSize: 12, lineHeight: 18, color: colors.inkFaint },
  numberActive: { color: colors.accentBlue },
});
