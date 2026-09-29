import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../Avatar';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { Card } from '../Card';
import { colors } from '../../theme';
import type { PendingRequest } from './types';
import { styles } from './RequestCard.styles';

export interface RequestCardCopy {
  decline: string;
  accept: string;
  newRideRequest: string;
  seatsSingular: string;
  seatsPlural: string;
  pickupLabel: string;
  dropoffLabel: string;
  pickupAwaySuffix: string;
  paymentMethodCash: string;
  paymentMethodGcash: string;
}

export interface RequestCardProps {
  request: PendingRequest;
  onAccept: () => void;
  onDecline: () => void;
  accepting?: boolean;
  variant?: 'compact' | 'incoming';
  copy: RequestCardCopy;
  /** D7 (UAT audit): seconds remaining before this request expires — 'incoming' variant only. Drives the top countdown bar's fill; omit/null hides it entirely. */
  countdownSeconds?: number | null;
  /** The countdown's starting value (expiresAt − createdAt, in seconds) — needed to compute the bar's fill fraction. Omit/null hides the bar even if `countdownSeconds` is set. */
  totalSeconds?: number | null;
  /** Straight-line pickup→drop-off distance, computed by the caller (RequestCard has no geo utility of its own) — 'incoming' variant only. Omit/null hides the "· {n} km" segment. */
  distanceKm?: number | null;
}

/** "Pickup · 400 m away" once distance is known, else plain "Pickup". */
export function formatPickupLabel(distanceMeters: number | null, awaySuffix = 'm away', pickupWord = 'Pickup'): string {
  if (distanceMeters == null) return pickupWord;
  return `${pickupWord} · ${Math.round(distanceMeters)} ${awaySuffix}`;
}

/**
 * "Cash · 2 seats" / "GCash · 1 seat" — the incoming-card header band label.
 * Uppercasing is applied by `styles.headerBandLabel` (via `typography.eyebrow`),
 * not here, so this stays locale-agnostic and takes translated copy as input.
 */
export function formatPaymentSeatsLabel(
  paymentMethod: string,
  seats: number,
  copy: Pick<RequestCardCopy, 'seatsSingular' | 'seatsPlural' | 'paymentMethodCash' | 'paymentMethodGcash'>,
): string {
  const seatWord = seats === 1 ? copy.seatsSingular : copy.seatsPlural;
  const paymentWord = paymentMethod === 'gcash' ? copy.paymentMethodGcash : copy.paymentMethodCash;
  return `${paymentWord} · ${seats} ${seatWord}`;
}

export function RequestCard({
  request,
  onAccept,
  onDecline,
  accepting = false,
  variant = 'compact',
  copy,
  countdownSeconds = null,
  totalSeconds = null,
  distanceKm = null,
}: RequestCardProps) {
  const seatsLabel = `${request.seats} ${request.seats > 1 ? copy.seatsPlural : copy.seatsSingular}`;
  const routeLabel =
    request.pickupLabel && request.dropoffLabel ? `${request.pickupLabel} → ${request.dropoffLabel}` : copy.newRideRequest;

  if (variant === 'compact') {
    return (
      <Card style={styles.card}>
        <View style={styles.topRow}>
          <Avatar size="md" />
          <Text style={styles.route} numberOfLines={1}>
            {routeLabel}
          </Text>
          <Badge label={seatsLabel} tone="blue" />
        </View>
        <View style={styles.actions}>
          <View style={styles.actionButton}>
            <Button label={copy.decline} variant="outline" tone="neutral" size="sm" fullWidth disabled={accepting} onPress={onDecline} />
          </View>
          <View style={styles.actionButton}>
            <Button label={copy.accept} size="sm" fullWidth disabled={accepting} loading={accepting} onPress={onAccept} />
          </View>
        </View>
      </Card>
    );
  }

  const fareLabel = request.fare != null ? `₱${Math.round(request.fare)}` : '—';
  const paymentSeatsLine = formatPaymentSeatsLabel(request.paymentMethod, request.seats, copy);
  const metaLine = distanceKm != null ? `${paymentSeatsLine} · ${distanceKm.toFixed(1)} km` : paymentSeatsLine;
  const barFraction = countdownSeconds !== null && totalSeconds ? Math.max(0, Math.min(1, countdownSeconds / totalSeconds)) : null;

  return (
    <Card style={styles.incomingCard} variant="raised">
      {barFraction !== null && (
        <View style={styles.countdownTrack}>
          <View style={[styles.countdownFill, { width: `${barFraction * 100}%` }]} />
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.fare}>{fareLabel}</Text>
        <Text style={styles.metaLine}>{metaLine}</Text>
        <View style={styles.routeRow}>
          <View style={styles.timelineRail}>
            <View style={styles.timelineDotOuter} />
            <View style={styles.timelineConnector} />
            <View style={styles.timelineDotDest} />
          </View>
          <View style={styles.stops}>
            <View style={styles.stop}>
              <Text style={styles.stopLabel}>{formatPickupLabel(request.pickupDistanceMeters ?? null, copy.pickupAwaySuffix, copy.pickupLabel)}</Text>
              <Text style={styles.stopValue}>{request.pickupLabel ?? copy.newRideRequest}</Text>
            </View>
            <View style={styles.stop}>
              <Text style={styles.stopLabel}>{copy.dropoffLabel}</Text>
              <Text style={styles.stopValue}>{request.dropoffLabel ?? copy.newRideRequest}</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.incomingActions}>
        <View style={styles.declineButton}>
          <Button label={copy.decline} variant="outline" tone="neutral" disabled={accepting} onPress={onDecline} />
        </View>
        <View style={styles.acceptButton}>
          <Button label={copy.accept} fullWidth disabled={accepting} loading={accepting} onPress={onAccept} icon={<Ionicons name="checkmark" size={20} color={colors.white} />} />
        </View>
      </View>
    </Card>
  );
}
