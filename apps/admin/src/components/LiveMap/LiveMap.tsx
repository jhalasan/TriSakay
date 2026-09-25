import { useState } from 'react';
import { AdvancedMarker, InfoWindow, Map } from '@vis.gl/react-google-maps';
import type { ActiveTricycleLocationCell } from '../../services/monitoring';
import styles from './LiveMap.module.css';

export interface LiveMapProps {
  cells: ActiveTricycleLocationCell[];
  loading?: boolean;
}

/**
 * General Santos City centre — transcribed from packages/ui's OsmMap
 * DEFAULT_CENTER (packages/ui is React Native-only and can't be imported
 * into this Vite app directly).
 */
const DEFAULT_CENTER = { lat: 6.116243, lng: 125.171738 };
const DEFAULT_ZOOM = 13;

/**
 * G2 (Google Maps): AdvancedMarker (not the classic Marker) is what supports
 * arbitrary HTML/React content as the pin — needed for the badge + count
 * overlay this used to render as a Leaflet DivIcon. It requires a Map ID
 * (Google Cloud Console > Maps Management > Map ID, vector rendering,
 * free) set below; without one, AdvancedMarker falls back to a plain red
 * pin with no custom content.
 */
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ?? undefined;

/** Same tricycle glyph as the Sidebar nav icon and DetailSection's VehicleIcon — one icon vocabulary across the app, not a marker-specific one. */
function TricycleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16v-4.2c0-.4.15-.8.43-1.08l1.7-1.72A2 2 0 0 1 8.06 8.3h7.88c.53 0 1.04.21 1.42.6l1.7 1.72c.29.28.44.67.44 1.08V16" />
      <path d="M4.5 16h15v2a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1h-9v1a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-2Z" />
      <circle cx="8" cy="16" r="1.4" />
      <circle cx="16" cy="16" r="1.4" />
    </svg>
  );
}

/**
 * Ride Monitoring live map (FR-5.1, 5.2). Plots grid-snapped driver
 * clusters, never exact coordinates — getActiveTricycleLocations() already
 * rounds every point before this component ever sees it (NFR-2.5).
 */
export function LiveMap({ cells, loading = false }: LiveMapProps) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  if (loading) {
    return <div className={`ph-box ${styles.loading}`}>Loading…</div>;
  }

  const openCell = cells.find((cell) => `${cell.lat},${cell.lng}` === openKey) ?? null;

  return (
    <div className={styles.wrap}>
      <Map defaultCenter={DEFAULT_CENTER} defaultZoom={DEFAULT_ZOOM} mapId={MAP_ID} disableDefaultUI={false} gestureHandling="greedy">
        {cells.map((cell) => {
          const key = `${cell.lat},${cell.lng}`;
          return (
            <AdvancedMarker key={key} position={{ lat: cell.lat, lng: cell.lng }} onClick={() => setOpenKey(key)}>
              <div className={styles.markerBadge}>
                <TricycleGlyph />
                {cell.count > 1 && <span className={styles.markerCount}>{cell.count}</span>}
              </div>
            </AdvancedMarker>
          );
        })}
        {openCell && (
          <InfoWindow position={{ lat: openCell.lat, lng: openCell.lng }} onCloseClick={() => setOpenKey(null)}>
            <div className={styles.popup}>
              <div className={styles.popupTitle}>{openCell.count === 1 ? '1 tricycle' : `${openCell.count} tricycles`}</div>
              <span className="mono">{openCell.plateNos.join(', ')}</span>
            </div>
          </InfoWindow>
        )}
      </Map>
    </div>
  );
}
