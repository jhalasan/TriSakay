import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, EmptyState, ListRow, OsmMap, TextField, colors } from '@trisakay/ui';
import { useBookingStore } from '../../src/store/useBookingStore';
import { reverseGeocode, searchPlaces } from '../../src/utils/geocode';
import type { LocationPoint } from '../../src/types/booking';
import { styles } from '../../src/styles/booking/set-destination.styles';

/** Keeps to roughly one Nominatim request per pause in typing, per its usage policy. */
const SEARCH_DEBOUNCE_MS = 450;

export default function SetDestinationScreen() {
  const router = useRouter();
  const setDropoff = useBookingStore((state) => state.setDropoff);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationPoint[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<LocationPoint | null>(null);
  const [resolvingPin, setResolvingPin] = useState(false);
  // Distinguishes "picked from the search list" from "dropped/dragged a pin
  // directly" — only the latter needs its own always-visible result row,
  // since it has no corresponding list entry to highlight.
  const [pinDropped, setPinDropped] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      searchPlaces(q)
        .then(setResults)
        .finally(() => setSearching(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  function handleSelectResult(point: LocationPoint) {
    setPinDropped(false);
    setSelected(point);
  }

  function handleMapPoint(point: { latitude: number; longitude: number }) {
    setResolvingPin(true);
    reverseGeocode(point.latitude, point.longitude)
      .then((resolved) => {
        setPinDropped(true);
        setSelected({ ...resolved, label: 'Dropped pin' });
      })
      .finally(() => setResolvingPin(false));
  }

  function handleConfirm() {
    if (!selected) return;
    setDropoff(selected);
    router.push('/booking/confirm');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
        <View style={styles.mapInner}>
          <OsmMap
            variant="pin"
            caption={resolvingPin ? 'Locating pin…' : 'Tap or drag the pin to drop a destination'}
            height={320}
            latitude={selected?.latitude}
            longitude={selected?.longitude}
            zoom={selected ? 16 : 14}
            // Sits between the search field and the results list, in no scroller
            // of its own — nothing to compete with for the drag.
            interactive
            tapToPlace
            marker={selected ? { latitude: selected.latitude, longitude: selected.longitude, draggable: true } : null}
            onMarkerMove={handleMapPoint}
          />
        </View>
      </View>

      <Text style={styles.resultsLabel}>Search results</Text>
      <FlatList
        style={styles.resultsList}
        data={pinDropped && selected ? [selected, ...results] : results}
        keyExtractor={(item, index) => `${item.label}-${index}`}
        renderItem={({ item }) => (
          <ListRow
            title={item.label}
            subtitle={item.address}
            leading={
              <View style={[styles.resultIcon, selected?.address === item.address && styles.resultIconSelected]}>
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={selected?.address === item.address ? colors.accentBluePressed : colors.inkSoft}
                />
              </View>
            }
            onPress={() => handleSelectResult(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title={searching ? 'Searching…' : query ? 'No matches' : 'Search for a destination'}
            message={
              searching
                ? 'Looking for places nearby.'
                : query
                  ? 'Try a different search term, or drop a pin on the map instead.'
                  : 'Type a place name, or tap the map to drop a pin.'
            }
          />
        }
      />

      <View style={styles.footer}>
        <Button label="Confirm destination" fullWidth disabled={!selected} onPress={handleConfirm} />
      </View>
    </SafeAreaView>
  );
}
