import { interpolate } from './interpolate.ts';

/** The strings from `driver.transfer` that this message needs. */
export interface TransferInviteCopy {
  inviteReason: string;
  invitePickupAt: string;
  inviteOnBoard: string;
  inviteMeetingPoint: string;
  inviteDestination: string;
  inviteFare: string;
  inviteSeats: string;
  inviteTripKm: string;
  inviteSecondsLeft: string;
}

/** What the invited driver can see about the ride before accepting. */
export interface TransferInviteInfo {
  pickupPlace: string | null;
  destinationPlace: string | null;
  seats: number;
  rideKm: number | null;
  fare: number | null;
  handoffAfterPickup: boolean;
  handoffKm: number | null;
}

interface Input {
  reason: string;
  /** Null until the details have loaded. The prompt still shows the reason and the time left. */
  details: TransferInviteInfo | null;
  secondsLeft: number;
  copy: TransferInviteCopy;
  formatMoney: (amount: number) => string;
}

function oneDecimal(km: number): string {
  return km.toFixed(1);
}

/**
 * The text of the transfer prompt: why it is being passed on, where to meet the passenger, where the ride
 * goes, what it pays, and how long the driver has to answer. A line with no data is left out.
 */
export function buildTransferInviteMessage({ reason, details, secondsLeft, copy, formatMoney }: Input): string {
  const lines: string[] = [];

  if (reason.trim()) lines.push(interpolate(copy.inviteReason, { reason: reason.trim() }));

  if (details) {
    if (details.handoffAfterPickup) lines.push(copy.inviteOnBoard);
    else if (details.pickupPlace) lines.push(interpolate(copy.invitePickupAt, { place: details.pickupPlace }));

    if (details.handoffKm !== null) lines.push(interpolate(copy.inviteMeetingPoint, { km: oneDecimal(details.handoffKm) }));
    if (details.destinationPlace) lines.push(interpolate(copy.inviteDestination, { place: details.destinationPlace }));

    const facts: string[] = [];
    if (details.fare !== null) facts.push(interpolate(copy.inviteFare, { fare: formatMoney(details.fare) }));
    facts.push(interpolate(copy.inviteSeats, { seats: details.seats }));
    if (details.rideKm !== null) facts.push(interpolate(copy.inviteTripKm, { km: oneDecimal(details.rideKm) }));
    lines.push(facts.join(' · '));
  }

  lines.push(interpolate(copy.inviteSecondsLeft, { seconds: Math.max(0, Math.ceil(secondsLeft)) }));

  return lines.join('\n');
}
