import { DivIcon } from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import styles from './AlertLocationMap.module.css';

export interface AlertLocationMapProps {
  lat: number;
  lng: number;
}

const ZOOM = 16;
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function pinIcon(): DivIcon {
  return new DivIcon({
    html: renderToStaticMarkup(<span className={styles.pin} />),
    className: '', // suppress Leaflet's default marker box/shadow classes
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

/**
 * Emergency Alerts detail panel's exact SOS pin — unlike Ride Monitoring's
 * LiveMap, this shows the literal reported coordinate, not a coarse
 * grid-snapped cell: an SOS location is safety-critical, so softening its
 * precision to match that screen's passenger-privacy rule (NFR-2.5) would
 * work against the feature's purpose. Same OSM tile source as LiveMap.
 */
export function AlertLocationMap({ lat, lng }: AlertLocationMapProps) {
  return (
    <div className={styles.wrap}>
      <MapContainer
        center={[lat, lng]}
        zoom={ZOOM}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
        dragging={false}
        zoomControl={false}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <Marker position={[lat, lng]} icon={pinIcon()} />
      </MapContainer>
    </div>
  );
}
