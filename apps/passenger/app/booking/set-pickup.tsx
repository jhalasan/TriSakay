import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { FlatList, Keyboard, Pressable, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ListRow, MapOverlaySheet, MapSearchBar, OsmMap, TextField, colors } from '@trisakay/ui';
import { SavePlaceSheet } from '../../src/components/SavePlaceSheet';
import { useBookingStore } from '../../src/store/useBookingStore';
import { reverseGeocode, searchPlaces } from '../../src/utils/geocode';
import type { LocationPoint } from '../../src/types/booking';
import { styles } from '../../src/styles/booking/set-pickup.styles';
import { useTranslation } from '../../src/hooks/useTranslation';

/** Keeps to roughly one Nominatim request per pause in typing, per its usage policy. */
const SEARCH_DEBOUNCE_MS = 450;

type ResultItem = { kind: 'current-location' } | { kind: 'point'; point: LocationPoint };

export default function SetPickupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pickup = useBookingStore((state) => state.pickup);
  const setPickup = useBookingStore((state) => state.setPickup);
  const t = useTranslation();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationPoint[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<LocationPoint | null>(pickup);
  const [resolvingPin, setResolvingPin] = useState(false);
  const [locatingCurrent, setLocatingCurrent] = useState(false);
  // Distinguishes "picked from the search list" from "dropped/dragged a pin
  // directly" — only the latter needs its own always-visible result row,
  // since it has no corresponding list entry to highlight.
  const [pinDropped, setPinDropped] = useState(false);
  const [placeToSave, setPlaceToSave] = useState<LocationPoint | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  // Drives the compact suggestion strip under the search bar — visible only
  // while the keyboard is up, so the rider can confirm what they're typing
  // without the full bottom sheet (which the keyboard can cover).
  const [searchFocused, setSearchFocused] = useState(false);

  function keyFor(point: LocationPoint) {
    return `${point.latitude},${point.longitude}`;
  }

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
    Keyboard.dismiss();
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

  function handleUseCurrentLocation() {
    setLocatingCurrent(true);
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then((position) => reverseGeocode(position.coords.latitude, position.coords.longitude))
      .then((point) => {
        setPinDropped(false);
        setSelected(point);
        Keyboard.dismiss();
      })
      .catch(() => {
        // No GPS fix available — the rider can still search or drop a pin by hand.
      })
      .finally(() => setLocatingCurrent(false));
  }

  function handleConfirm() {
    if (!selected) return;
    setPickup(selected);
    router.back();
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.mapFill}>
        <OsmMap
          variant="pin"
          caption={resolvingPin ? t.setDestination.locatingPin : t.setPickup.tapOrDragPin}
          height="100%"
          latitude={selected?.latitude}
          longitude={selected?.longitude}
          zoom={selected ? 16 : 14}
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
            placeholder={t.setPickup.searchForPickup}
            value={query}
            onChangeText={setQuery}
            autoFocus
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
        </MapSearchBar>

        {searchFocused && query.trim().length >= 2 && (
          <View style={styles.suggestStripShadowWrap}>
            <View style={styles.suggestStrip}>
              {searching ? (
                <Text style={styles.suggestHint}>{t.setDestination.searching}</Text>
              ) : results.length === 0 ? (
                <Text style={styles.suggestHint}>{t.setDestination.noMatches}</Text>
              ) : (
                results.slice(0, 4).map((item, index) => (
                  <Pressable
                    key={`${item.label}-${index}`}
                    style={[styles.suggestRow, index === 0 && styles.suggestRowFirst]}
                    onPress={() => handleSelectResult(item)}
                    accessibilityRole="button"
                  >
                    <Ionicons name="location-outline" size={15} color={colors.inkSoft} />
                    <View style={styles.suggestRowTextSlot}>
                      <Text style={styles.suggestRowTitle} numberOfLines={1}>
                        {item.label}
                      </Text>
                      <Text style={styles.suggestRowAddress} numberOfLines={1} ellipsizeMode="tail">
                        {item.address}
                      </Text>
                    </View>
                  </Pressable>
                ))
              )}
            </View>
          </View>
        )}
      </View>

      <MapOverlaySheet maxHeight={360} bottomInset={insets.bottom}>
        <Text style={styles.resultsLabel}>{t.setDestination.searchResults}</Text>
        {query.trim().length >= 2 && (searching || results.length === 0) && (
          <Text style={styles.statusHint}>{searching ? t.setDestination.searching : t.setDestination.noMatches}</Text>
        )}
        <FlatList
          style={styles.resultsList}
          data={[
            { kind: 'current-location' } as ResultItem,
            ...(pinDropped && selected ? [{ kind: 'point', point: selected } as ResultItem] : []),
            ...results.map((point): ResultItem => ({ kind: 'point', point })),
          ]}
          keyExtractor={(item, index) => (item.kind === 'current-location' ? 'current-location' : `${item.point.label}-${index}`)}
          renderItem={({ item }) =>
            item.kind === 'current-location' ? (
              <ListRow
                title={locatingCurrent ? t.setPickup.locatingCurrentLocation : t.setPickup.useCurrentLocation}
                leading={
                  <View style={[styles.resultIcon, styles.currentLocationIcon]}>
                    <Ionicons name="locate" size={18} color={colors.accentBluePressed} />
                  </View>
                }
                onPress={handleUseCurrentLocation}
              />
            ) : (
              <ListRow
                title={item.point.label}
                subtitle={item.point.address}
                leading={
                  <View style={[styles.resultIcon, selected?.address === item.point.address && styles.resultIconSelected]}>
                    <Ionicons
                      name="location-outline"
                      size={18}
                      color={selected?.address === item.point.address ? colors.accentBluePressed : colors.inkSoft}
                    />
                  </View>
                }
                trailing={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={savedKeys.has(keyFor(item.point)) ? t.savePlace.savedAccessibilityLabel : t.savePlace.saveAccessibilityLabel}
                    hitSlop={8}
                    onPress={() => setPlaceToSave(item.point)}
                  >
                    <Ionicons
                      name={savedKeys.has(keyFor(item.point)) ? 'bookmark' : 'bookmark-outline'}
                      size={20}
                      color={colors.accentBluePressed}
                    />
                  </Pressable>
                }
                onPress={() => handleSelectResult(item.point)}
              />
            )
          }
        />
        <Button label={t.setPickup.confirmPickup} fullWidth disabled={!selected} onPress={handleConfirm} />
      </MapOverlaySheet>
      <SavePlaceSheet
        place={placeToSave}
        onClose={() => setPlaceToSave(null)}
        onSaved={(point) => setSavedKeys((prev) => new Set(prev).add(keyFor(point)))}
      />
    </SafeAreaView>
  );
}
