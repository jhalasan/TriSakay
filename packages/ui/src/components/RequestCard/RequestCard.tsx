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
}

export interface RequestCardProps {
  request: PendingRequest;
  onAccept: () => void;
  onDecline: () => void;
  accepting?: boolean;
  variant?: 'compact' | 'incoming';
  copy: RequestCardCopy;
}

/** "Pickup · 400 m away" once distance is known, else plain "Pickup". */
export function formatPickupLabel(distanceMeters: number | null, awaySuffix = 'm away', pickupWord = 'Pickup'): string {
  if (distanceMeters == null) return pickupWord;
  return `${pickupWord} · ${Math.round(distanceMeters)} ${awaySuffix}`;
}

/** "CASH · 2 SEATS" / "GCASH · 1 SEAT" — the incoming-card header band label. */
export function formatPaymentSeatsLabel(paymentMethod: string, seats: number): string {
  const seatWord = seats === 1 ? 'SEAT' : 'SEATS';
  return `${paymentMethod.toUpperCase()} · ${seats} ${seatWord}`;
}

export function RequestCard({ request, onAccept, onDecline, accepting = false, variant = 'compact', copy }: RequestCardProps) {
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

  return (
    <Card style={styles.incomingCard} variant="raised">
      <View style={styles.headerBand}>
        <View style={styles.headerBandLeft}>
          <Ionicons name="cash-outline" size={18} color={colors.accentGreenPressed} />
          <Text style={styles.headerBandLabel}>{formatPaymentSeatsLabel(request.paymentMethod, request.seats)}</Text>
        </View>
        <Text style={styles.fare}>{fareLabel}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.timelineRail}>
          <View style={styles.timelineDotOuter} />
          <View style={styles.timelineConnector} />
          <View style={styles.timelineDotDest} />
        </View>
        <View style={styles.stops}>
          <View style={styles.stop}>
            <Text style={styles.stopLabel}>{formatPickupLabel(request.pickupDistanceMeters ?? null, copy.pickupAwaySuffix, copy.pickupLabel)}</Text>
            <Text style={styles.stopValue} numberOfLines={1}>
              {request.pickupLabel ?? copy.newRideRequest}
            </Text>
          </View>
          <View style={styles.stop}>
            <Text style={styles.stopLabel}>{copy.dropoffLabel}</Text>
            <Text style={styles.stopValue} numberOfLines={1}>
              {request.dropoffLabel ?? copy.newRideRequest}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.incomingActions}>
        <View style={styles.declineButton}>
          <Button label={copy.decline} variant="outline" tone="neutral" size="sm" disabled={accepting} onPress={onDecline} />
        </View>
        <View style={styles.acceptButton}>
          <Button label={copy.accept} size="sm" fullWidth disabled={accepting} loading={accepting} onPress={onAccept} icon={<Ionicons name="checkmark" size={20} color={colors.white} />} />
        </View>
      </View>
    </Card>
  );
}
