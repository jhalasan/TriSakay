import { useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccordionGroup, IconTile, NavyBandHeader, type IconTileTone } from '@trisakay/ui';
import { CURRENT_PRIVACY_VERSION, CURRENT_TOS_VERSION } from '@trisakay/services';
import { useTranslation } from '../../src/hooks/useTranslation';
import { interpolate } from '../../src/utils/interpolate';
import { DISCLOSURES, PRIVACY_POLICY, TERMS_OF_SERVICE, type PolicySection } from '../../src/content/legalCopy';
import { styles } from '../../src/styles/profile/legal.styles';

type Tab = 'terms' | 'privacy';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** One icon per disclosure, in DISCLOSURES order: name & contact, live location, ride & payment history, payment details. */
const DISCLOSURE_ICONS: Array<{ icon: IconName; tone: IconTileTone }> = [
  { icon: 'person', tone: 'navy' },
  { icon: 'location', tone: 'green' },
  { icon: 'time', tone: 'navy' },
  { icon: 'wallet', tone: 'navy' },
];

/** The copy is verbatim from legalCopy.ts — only the leading "1. " moves out of the heading into the number column. */
function toAccordionItems(sections: PolicySection[]) {
  return sections.map((section, index) => {
    const match = /^(\d+)\.\s*(.*)$/.exec(section.heading);
    return {
      id: section.heading,
      number: match ? Number(match[1]) : index + 1,
      title: match ? match[2] : section.heading,
      body: <Text style={styles.sectionBody}>{section.body}</Text>,
    };
  });
}

export default function LegalScreen() {
  const t = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [tab, setTab] = useState<Tab>('terms');

  const sections = tab === 'terms' ? TERMS_OF_SERVICE : PRIVACY_POLICY;

  function switchTab(next: Tab) {
    if (next === tab) return;
    setTab(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  const tabs: Array<{ value: Tab; label: string }> = [
    { value: 'terms', label: t.legal.tabTerms },
    { value: 'privacy', label: t.legal.tabPrivacy },
  ];

  return (
    <View style={styles.container}>
      <NavyBandHeader
        title={t.legal.title}
        titleSize="lg"
        onBack={() => router.back()}
        backAccessibilityLabel={t.common.goBackA11y}
        topInset={insets.top}
        paddingBottom={18}
        elevated
      >
        <View style={styles.bandBody}>
          <View style={styles.track} accessibilityRole="tablist">
            {tabs.map((item) => {
              const active = item.value === tab;
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => switchTab(item.value)}
                  style={[styles.segment, active && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.version}>
            Terms {CURRENT_TOS_VERSION} · Privacy {CURRENT_PRIVACY_VERSION}
          </Text>
        </View>
      </NavyBandHeader>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {tab === 'privacy' && (
          <View>
            <Text style={styles.sectionLabel}>{t.legal.whatWeCollect}</Text>
            <View style={styles.card}>
              {DISCLOSURES.map((item, index) => {
                const meta = DISCLOSURE_ICONS[index] ?? DISCLOSURE_ICONS[0];
                return (
                  <View key={item.title} style={[styles.disclosureRow, index > 0 && styles.disclosureDivider]}>
                    <IconTile icon={meta.icon} tone={meta.tone} size={32} />
                    <View style={styles.disclosureBody}>
                      <Text style={styles.disclosureTitle}>{item.title}</Text>
                      <Text style={styles.disclosureText}>{item.body}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View>
          <Text style={styles.sectionLabel}>{interpolate(t.legal.fullPolicy, { n: sections.length })}</Text>
          <View style={styles.accordionCard}>
            {/* Keyed by tab so switching resets the accordion to section 1. */}
            <AccordionGroup key={tab} items={toAccordionItems(sections)} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
