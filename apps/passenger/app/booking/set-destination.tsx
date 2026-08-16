import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, EmptyState, ListRow, MapOverlaySheet, MapSearchBar, OsmMap, TextField, colors } from '@trisakay/ui';
import { useBookingStore } from '../../src/store/useBookingStore';
import { reverseGeocode, searchPlaces } from '../../src/utils/geocode';
import type { LocationPoint } from '../../src/types/booking';
import { styles } from '../../src/styles/booking/set-destination.styles';
import { useTranslation } from '../../src/hooks/useTranslation';

/** Keeps to roughly one Nominatim request per pause in typing, per its usage policy. */
const SEARCH_DEBOUNCE_MS = 450;

export default function SetDestinationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setDropoff = useBookingStore((state) => state.setDropoff);
  const t = useTranslation();

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
        setSelected({ ...resolved, label: t.setDestination.droppedPin });
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
      <View style={styles.mapFill}>
        <OsmMap
          variant="pin"
          caption={resolvingPin ? t.setDestination.locatingPin : t.setDestination.tapOrDragPin}
          height="100%"
          latitude={selected?.latitude}
          longitude={selected?.longitude}
          zoom={selected ? 16 : 14}
          // No scroller above it to compete with for the drag — the results
          // list below lives in its own bounded, separately-scrolling sheet.
          interactive
          edgeToEdge
          tapToPlace
          marker={selected ? { latitude: selected.latitude, longitude: selected.longitude, draggable: true } : null}
          onMarkerMove={handleMapPoint}
        />
      </View>

      <View style={styles.topFloating}>
        <MapSearchBar onBack={() => router.back()}>
          <TextField
            placeholder={t.setDestination.searchForDestination}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
        </MapSearchBar>
      </View>

      <MapOverlaySheet maxHeight={360} bottomInset={insets.bottom}>
        <Text style={styles.resultsLabel}>{t.setDestination.searchResults}</Text>
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
              title={searching ? t.setDestination.searching : query ? t.setDestination.noMatches : t.setDestination.searchForDestination}
              message={
                searching
                  ? t.setDestination.lookingForPlacesNearby
                  : query
                    ? t.setDestination.tryDifferentSearchTerm
                    : t.setDestination.typePlaceNameOrTapMap
              }
            />
          }
        />
        <Button label={t.setDestination.confirmDestination} fullWidth disabled={!selected} onPress={handleConfirm} />
      </MapOverlaySheet>
    </SafeAreaView>
  );
}
