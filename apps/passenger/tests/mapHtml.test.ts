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
