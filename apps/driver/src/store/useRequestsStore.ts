import { create } from 'zustand';
import { randomBetween, wait } from '../mocks/delay.ts';
import type { PendingRequest } from '../types/request.ts';

interface RequestsState {
  pending: PendingRequest[];
  startSimulatingArrivals: () => void;
  stopSimulatingArrivals: () => void;
  accept: (id: string) => PendingRequest | undefined;
  decline: (id: string) => void;
}

let simulationEpoch = 0;
let nextRequestId = 1;

function createPlaceholderRequest(): PendingRequest {
  return {
    id: `req-${nextRequestId++}`,
    seats: randomBetween(1, 3),
    paymentMethod: randomBetween(0, 1) === 0 ? 'cash' : 'gcash',
    pickupLabel: null,
    dropoffLabel: null,
    fare: null,
    createdAt: new Date().toISOString(),
  };
}

export const useRequestsStore = create<RequestsState>()((set, get) => ({
  pending: [],

  startSimulatingArrivals: () => {
    const epoch = ++simulationEpoch;

    async function loop() {
      while (epoch === simulationEpoch) {
        await wait(randomBetween(8000, 15000));
        if (epoch !== simulationEpoch) return;
        set((state) => ({ pending: [...state.pending, createPlaceholderRequest()] }));
      }
    }

    void loop();
  },

  stopSimulatingArrivals: () => {
    simulationEpoch++;
    set({ pending: [] });
  },

  accept: (id) => {
    const request = get().pending.find((item) => item.id === id);
    if (request) set((state) => ({ pending: state.pending.filter((item) => item.id !== id) }));
    return request;
  },

  decline: (id) => set((state) => ({ pending: state.pending.filter((item) => item.id !== id) })),
}));
