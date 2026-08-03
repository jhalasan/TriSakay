import { create } from 'zustand';
import type { LocationPoint, PaymentMethod, TripStatus } from '../types/booking';
import type { Driver } from '../types/driver';

interface BookingState {
  /** Null until device GPS or the backend resolves it — there is no default rider. */
  pickup: LocationPoint | null;
  dropoff: LocationPoint | null;
  seats: number;
  fare: number | null;
  paymentMethod: PaymentMethod;
  driver: Driver | null;
  rideRequestId: string | null;
  tripStatus: TripStatus;
  setPickup: (point: LocationPoint) => void;
  setDropoff: (point: LocationPoint) => void;
  setSeats: (seats: number) => void;
  setFare: (fare: number | null) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setDriver: (driver: Driver) => void;
  setRideRequestId: (id: string | null) => void;
  setTripStatus: (status: TripStatus) => void;
  reset: () => void;
}

const initialState = {
  pickup: null as LocationPoint | null,
  dropoff: null as LocationPoint | null,
  seats: 1,
  fare: null as number | null,
  paymentMethod: 'cash' as PaymentMethod,
  driver: null as Driver | null,
  rideRequestId: null as string | null,
  tripStatus: 'idle' as TripStatus,
};

export const useBookingStore = create<BookingState>()((set) => ({
  ...initialState,
  setPickup: (point) => set({ pickup: point }),
  setDropoff: (point) => set({ dropoff: point }),
  setSeats: (seats) => set({ seats }),
  setFare: (fare) => set({ fare }),
  setPaymentMethod: (method) => set({ paymentMethod: method }),
  setDriver: (driver) => set({ driver }),
  setRideRequestId: (id) => set({ rideRequestId: id }),
  setTripStatus: (status) => set({ tripStatus: status }),
  reset: () => set({ ...initialState }),
}));
