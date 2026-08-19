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

function cellIcon(count: number): DivIcon {
  return new DivIcon({
    html: renderToStaticMarkup(<div className={styles.markerBadge}>{count}</div>),
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
    return <div className={styles.loading}>Loading…</div>;
  }

  return (
    <div className={styles.wrap}>
      <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        {cells.map((cell) => (
          <Marker key={`${cell.lat},${cell.lng}`} position={[cell.lat, cell.lng]} icon={cellIcon(cell.count)}>
            <Popup>
              <div className={styles.popup}>
                <div className={styles.popupTitle}>{cell.count === 1 ? '1 tricycle' : `${cell.count} tricycles`}</div>
                {cell.driverNames.join(', ')}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
