import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Button, EmptyState, ListRow, OsmMap, TextField, colors } from '@trisakay/ui';
import { useBookingStore } from '../../src/store/useBookingStore';
import { searchDestinations } from '../../src/mocks/destinations';
import type { LocationPoint } from '../../src/types/booking';
import { styles } from './set-destination.styles';

export default function SetDestinationScreen() {
  const router = useRouter();
  const setDropoff = useBookingStore((state) => state.setDropoff);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<LocationPoint | null>(null);

  const results = searchDestinations(query);

  function handleConfirm() {
    if (!selected) return;
    setDropoff(selected);
    router.push('/booking/confirm');
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </Pressable>
        <View style={styles.searchField}>
          <TextField
            placeholder="Search for a destination"
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
        </View>
      </View>

      <View style={styles.mapWrap}>
        <OsmMap
          variant="pin"
          caption="Map · drop pin"
          height={160}
          latitude={selected?.latitude}
          longitude={selected?.longitude}
          zoom={selected ? 16 : 14}
          // Sits between the search field and the results list, in no scroller
          // of its own — nothing to compete with for the drag.
          interactive
        />
      </View>

      <Text style={styles.resultsLabel}>Search results</Text>
      <FlatList
        style={styles.resultsList}
        data={results}
        keyExtractor={(item) => item.label}
        renderItem={({ item }) => (
          <ListRow
            title={item.label}
            subtitle={item.address}
            leading={
              <View style={[styles.resultIcon, selected?.label === item.label && styles.resultIconSelected]}>
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={selected?.label === item.label ? colors.accentBluePressed : colors.inkSoft}
                />
              </View>
            }
            onPress={() => setSelected(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title={query ? 'No matches' : 'No destinations yet'}
            message={
              query
                ? 'Try a different search term.'
                : 'Places will appear here once the service is connected.'
            }
          />
        }
      />

      <View style={styles.footer}>
        <Button label="Confirm destination" fullWidth disabled={!selected} onPress={handleConfirm} />
      </View>
    </View>
  );
}
