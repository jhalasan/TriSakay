const BASE_FARE = 15;
const PER_EXTRA_SEAT = 5;
const DISTANCE_RATE_PER_KM = 8;
const MOCK_DISTANCE_KM = 2.4;

export function estimateFare(seats: number, distanceKm: number = MOCK_DISTANCE_KM) {
  const extraSeats = Math.max(0, seats - 1);
  return BASE_FARE + PER_EXTRA_SEAT * extraSeats + DISTANCE_RATE_PER_KM * distanceKm;
}
