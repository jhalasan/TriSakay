import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Modal, Text, View } from 'react-native';
import { Button, colors } from '@trisakay/ui';
import { useLocationPermission } from '../src/hooks/useLocationPermission';
import { styles } from './location-permission.styles';

export default function LocationPermissionScreen() {
  const router = useRouter();
  const { state, refresh, request, dismiss } = useLocationPermission();
  const [working, setWorking] = useState(false);

  // The hook's module-load refresh is sticky if it fails — state stays
  // 'unknown' with no retry until the next foreground transition. This screen
  // can also be reached directly (Task 7's inline notices) without an
  // intervening foreground transition, so refresh again on mount. `refresh` is
  // a Zustand action and so a stable reference for the store's lifetime, which
  // makes this a mount-only effect despite the honest dependency list.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Dismissal on grant lives here, not in handleEnable, because 'granted' can
  // arrive from outside this screen's own request() call: the 'blocked' →
  // "Open settings" path backgrounds the app into system Settings without
  // dismissing (request() short-circuits to Linking.openSettings() and
  // returns 'blocked'), and the AppState listener in useLocationPermission
  // refreshes state to 'granted' on return with the modal still mounted. This
  // effect is what closes it in that case, and it also covers permission
  // being granted from any other surface while the modal is open. Do not
  // fold this back into handleEnable — that would miss the Settings
  // round-trip entirely.
  useEffect(() => {
    if (state === 'granted') router.dismiss();
  }, [state, router]);

  const isBlocked = state === 'blocked';

  async function handleEnable() {
    setWorking(true);
    await request();
    setWorking(false);
    // No dismiss here — the effect above closes the modal once `state`
    // reflects 'granted'. After a fresh denial the sheet stays up and the
    // primary button re-labels to "Open settings", so the user can see why it
    // changed instead of the modal vanishing with nothing having happened.
  }

  function handleNotNow() {
    // Suppresses the automatic prompt until the next foreground — deliberately
    // not a permanent resolution.
    dismiss();
    router.dismiss();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleNotNow}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconBadge}>
            <Ionicons name="location-outline" size={26} color={colors.accentBluePressed} />
          </View>

          <Text style={styles.title}>Turn on location</Text>
          <Text style={styles.body}>
            TriSakay needs your location to match you with nearby drivers and estimate pickup accurately.
          </Text>

          {/*
            Not "turn it back on": on iOS a single "Don't allow" sets
            canAskAgain to false without location ever having been on for this
            app, so "back on" describes a state that never existed.
          */}
          {isBlocked ? (
            <Text style={styles.blockedNote}>
              Location is off for TriSakay in your device settings. Open settings to turn it on.
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Button
              label={isBlocked ? 'Open settings' : 'Enable location'}
              fullWidth
              loading={working}
              onPress={handleEnable}
            />
            {/*
              Disabled while the request is in flight: the OS dialog is modal
              on device, but a stray tap either side of it would fire a second
              router.dismiss() on an already-dismissing modal.
            */}
            <Button
              label="Not now"
              variant="ghost"
              tone="neutral"
              fullWidth
              disabled={working}
              onPress={handleNotNow}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
