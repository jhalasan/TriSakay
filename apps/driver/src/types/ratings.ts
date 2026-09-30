export interface DriverRatingItem {
  id: string;
  stars: number;
  comment: string | null;
  rideRequestId: string;
  tags: string[];
  createdAt: string;
}
