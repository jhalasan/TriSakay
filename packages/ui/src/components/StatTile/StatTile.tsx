import { Text, View } from 'react-native';
import { Card } from '../Card';
import { styles } from './StatTile.styles';

export interface StatTileProps {
  label: string;
  value: string;
  /** 'onNavy' is for placement on a navy/gradient surface (white label at 60% opacity, mint or white value) — the passenger Home stats strip. Defaults to the original ink-on-white card styling. */
  tone?: 'default' | 'onNavy';
  /** Skips the Card wrapper/shadow — used when the parent surface already provides the background and a hairline divider (the stats strip), not a floating tile. */
  bare?: boolean;
}

export function StatTile({ label, value, tone = 'default', bare = false }: StatTileProps) {
  const content = (
    <>
      <Text style={[styles.label, tone === 'onNavy' && styles.labelOnNavy]}>{label}</Text>
      <Text style={[styles.value, tone === 'onNavy' && styles.valueOnNavy]}>{value}</Text>
    </>
  );

  if (bare) return <View style={styles.bare}>{content}</View>;
  return <Card style={styles.card}>{content}</Card>;
}
