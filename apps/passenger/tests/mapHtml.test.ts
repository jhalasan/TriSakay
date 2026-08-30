import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMapHtml } from '../../../packages/ui/src/components/OsmMap/mapHtml.ts';

const ROUTE = [
  { latitude: 6.1164, longitude: 125.1717 },
  { latitude: 6.118, longitude: 125.176 },
  { latitude: 6.12, longitude: 125.18 },
];

test('draws a polyline and fits bounds when a route of >=2 points is given', () => {
  const html = buildMapHtml({ latitude: 6.1, longitude: 125.1, zoom: 14, route: ROUTE });
  assert.match(html, /L\.polyline\(/);
  assert.match(html, /fitBounds\(/);
  // the route coordinates are embedded as [lat, lng] pairs
  assert.match(html, /6\.1164/);
});

test('omits the polyline when no route is given', () => {
  const html = buildMapHtml({ latitude: 6.1, longitude: 125.1, zoom: 14 });
  assert.doesNotMatch(html, /L\.polyline\(/);
});

test('omits the polyline for a single-point route', () => {
  const html = buildMapHtml({ latitude: 6.1, longitude: 125.1, zoom: 14, route: [ROUTE[0]] });
  assert.doesNotMatch(html, /L\.polyline\(/);
});

test('buildMapHtml exposes window.__setDriverLocation when a marker is present', () => {
  const html = buildMapHtml({
    latitude: 6.1164,
    longitude: 125.1717,
    zoom: 15,
    marker: { latitude: 6.1164, longitude: 125.1717 },
  });
  assert.ok(html.includes('window.__setDriverLocation'));
});

test('buildMapHtml does not remount-relevant content change when only marker coordinates would differ — the bridge function reads live pin coordinates, not baked-in ones', () => {
  // The bridge function must reference `pin.getLatLng()` (the pickup marker's
  // live position) rather than a second hard-coded lat/lng pair, so that a
  // caller can rely on it drawing the line to wherever the pickup pin already
  // is without rebuilding the HTML string.
  const html = buildMapHtml({
    latitude: 6.1164,
    longitude: 125.1717,
    zoom: 15,
    marker: { latitude: 6.1164, longitude: 125.1717 },
  });
  assert.ok(html.includes('pin.getLatLng()'));
});
