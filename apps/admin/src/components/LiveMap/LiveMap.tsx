import { DivIcon } from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
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
const DEFAULT_CENTER: [number, number] = [6.116243, 125.171738];
const DEFAULT_ZOOM = 13;

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

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

function cellIcon(count: number): DivIcon {
  return new DivIcon({
    html: renderToStaticMarkup(
      <div className={styles.markerBadge}>
        <TricycleGlyph />
        {count > 1 && <span className={styles.markerCount}>{count}</span>}
      </div>
    ),
    className: '', // suppress Leaflet's default marker box/shadow classes
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/**
 * Ride Monitoring live map (FR-5.1, 5.2). Plots grid-snapped driver
 * clusters, never exact coordinates — getActiveTricycleLocations() already
 * rounds every point before this component ever sees it (NFR-2.5). OSM
 * tiles, same source the Driver/Passenger apps use; a browser <img>-based
 * TileLayer can't set a custom User-Agent the way the mobile WebView does,
 * which is an accepted tradeoff for this low-volume, admin-only screen.
 */
export function LiveMap({ cells, loading = false }: LiveMapProps) {
  if (loading) {
    return <div className={`ph-box ${styles.loading}`}>Loading…</div>;
  }

  return (
    <div className={styles.wrap}>
      <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        {cells.map((cell) => (
          <Marker key={`${cell.lat},${cell.lng}`} position={[cell.lat, cell.lng]} icon={cellIcon(cell.count)}>
            <Popup>
              <div className={styles.popup}>
                <div className={styles.popupTitle}>{cell.count === 1 ? '1 tricycle' : `${cell.count} tricycles`}</div>
                <span className="mono">{cell.plateNos.join(', ')}</span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
