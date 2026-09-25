import { AdvancedMarker, Map } from '@vis.gl/react-google-maps';
import styles from './AlertLocationMap.module.css';

export interface AlertLocationMapProps {
  lat: number;
  lng: number;
}

const ZOOM = 16;

/** Same Map ID as LiveMap.tsx — see that file's comment on why AdvancedMarker needs one. */
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ?? undefined;

/**
 * Emergency Alerts detail panel's exact SOS pin — unlike Ride Monitoring's
 * LiveMap, this shows the literal reported coordinate, not a coarse
 * grid-snapped cell: an SOS location is safety-critical, so softening its
 * precision to match that screen's passenger-privacy rule (NFR-2.5) would
 * work against the feature's purpose.
 */
export function AlertLocationMap({ lat, lng }: AlertLocationMapProps) {
  return (
    <div className={styles.wrap}>
      <Map
        defaultCenter={{ lat, lng }}
        defaultZoom={ZOOM}
        mapId={MAP_ID}
        disableDefaultUI
        gestureHandling="none"
        zoomControl={false}
        scrollwheel={false}
      >
        <AdvancedMarker position={{ lat, lng }}>
          <span className={styles.pin} />
        </AdvancedMarker>
      </Map>
    </div>
  );
}
