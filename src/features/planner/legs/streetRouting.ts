import { haversineKm, type LatLng } from '../../map';

const osrmCache = new Map<string, LatLng[]>();

/** Decodes a Valhalla/OSRM polyline (precision 6) into coordinates. */
export function decodePolyline6(shape: string): LatLng[] {
  const out: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  function decodeNumber(): number {
    let shift = 0;
    let result = 0;
    for (;;) {
      const b = shape.charCodeAt(index) - 63;
      index += 1;
      result |= (b & 0x1f) << shift;
      shift += 5;
      if (b < 0x20) break;
    }
    return (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
  }
  while (index < shape.length) {
    lat += decodeNumber();
    lng += decodeNumber();
    out.push({ lat: lat / 1e6, lng: lng / 1e6 });
  }
  return out;
}

/** Haversine distance in meters. */
function haversineM(a: LatLng, b: LatLng): number {
  return haversineKm(a, b) * 1000;
}

/** Closest point of segment index `from`… of `path` to `p` (equirectangular, fine at city scale). */
function closestOnPath(path: LatLng[], p: LatLng, from = 0): { idx: number; point: LatLng } {
  let best = { idx: from, point: path[from], d: Infinity };
  const kx = Math.cos((p.lat * Math.PI) / 180);
  for (let i = from; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dx = (b.lng - a.lng) * kx;
    const dy = b.lat - a.lat;
    const len2 = dx * dx + dy * dy;
    const tt = len2 === 0 ? 0 : Math.max(0, Math.min(1, (((p.lng - a.lng) * kx * dx + (p.lat - a.lat) * dy) / len2)));
    const point = { lat: a.lat + tt * dy, lng: a.lng + (tt * dx) / kx };
    const d = haversineM(point, p);
    if (d < best.d) best = { idx: i, point, d };
  }
  return best;
}

/**
 * Forces the routed path to touch the exact requested endpoints. Routers snap
 * to the road graph and GTFS shape slices start at the previous vertex, so the
 * path is cut where it passes the stop (no spike back to an earlier point)
 * and joined to the pin with a short connector.
 */
export function pinEndpoints(path: LatLng[], points: LatLng[]): LatLng[] {
  if (path.length < 2) return [...points];
  const start = points[0];
  const end = points[points.length - 1];
  const head = closestOnPath(path, start);
  const tail = closestOnPath(path, end, head.idx);
  const middle = path.slice(head.idx + 1, tail.idx + 1);
  const out = [start, head.point, ...middle, tail.point, end];
  // Drop zero-length hops (pin already on the path).
  return out.filter((q, i) => i === 0 || haversineM(out[i - 1], q) > 1);
}

function resolveCampusPedestrianCorridor(from: LatLng, to: LatLng): LatLng[] | null {
  const inCampus = (p: LatLng) =>
    p.lat >= 45.7450 && p.lat <= 45.7515 && p.lng >= 21.2350 && p.lng <= 21.2440;
  if (!inCampus(from) || !inCampus(to)) return null;

  if (from.lat >= 45.7485 && from.lng >= 21.2405 && to.lat <= 45.7475) {
    return [
      from,
      { lat: 45.74880, lng: 21.24140 },
      { lat: 45.74858, lng: 21.24118 },
      { lat: 45.74842, lng: 21.24049 },
      { lat: 45.74814, lng: 21.23989 },
      { lat: 45.74783, lng: 21.23963 },
      { lat: 45.74736, lng: 21.24006 },
      { lat: 45.74704, lng: 21.24025 },
      { lat: 45.74682, lng: 21.24038 },
      to,
    ];
  }

  if (to.lat >= 45.7485 && to.lng >= 21.2405 && from.lat <= 45.7475) {
    return [
      from,
      { lat: 45.74682, lng: 21.24038 },
      { lat: 45.74704, lng: 21.24025 },
      { lat: 45.74736, lng: 21.24006 },
      { lat: 45.74783, lng: 21.23963 },
      { lat: 45.74814, lng: 21.23989 },
      { lat: 45.74842, lng: 21.24049 },
      { lat: 45.74858, lng: 21.24118 },
      { lat: 45.74880, lng: 21.24140 },
      to,
    ];
  }

  return null;
}

export async function fetchOsrmGeometry(
  points: LatLng[],
  mode: 'walking' | 'driving',
  timeoutMs = 6000,
): Promise<LatLng[] | null> {
  if (points.length < 2) return null;
  if (mode === 'walking' && points.length === 2) {
    if (haversineKm(points[0], points[1]) > 4) return [points[0], points[1]];
    const campus = resolveCampusPedestrianCorridor(points[0], points[1]);
    if (campus) return campus;
  }
  const key = `${mode}:${points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';')}`;
  const cached = osrmCache.get(key);
  if (cached) return cached;

  const coordsStr = points.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/${mode}/${coordsStr}?overview=full&geometries=geojson`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const rawCoords = data?.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
    const distance = data?.routes?.[0]?.distance as number | undefined;
    if (!rawCoords || !Array.isArray(rawCoords) || rawCoords.length === 0) return null;
    if (mode === 'walking' && typeof distance === 'number' && points.length === 2) {
      // Pedestrian detours (fences, railways, parks) are often longer than a
      // driver's; only reject clearly absurd snaps.
      const directKm = haversineKm(points[0], points[1]);
      if (directKm > 0.05 && distance > directKm * 1000 * 2.0) return null;
    }
    const resolved = pinEndpoints(
      rawCoords.map(([lng, lat]) => ({ lat, lng })),
      points,
    );
    osrmCache.set(key, resolved);
    return resolved;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Pedestrian fallback when OSRM is unreachable or rejects the route:
 * Valhalla (FOSSGIS public server) follows footpaths, stairs and squares
 * that the car-oriented graph sometimes misses.
 */
export async function fetchValhallaWalking(points: LatLng[], timeoutMs = 8000): Promise<LatLng[] | null> {
  if (points.length < 2) return null;
  const key = `valhalla:${points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';')}`;
  const cached = osrmCache.get(key);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://valhalla1.openstreetmap.de/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locations: points.map((p) => ({ lat: p.lat, lon: p.lng })),
        costing: 'pedestrian',
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const shape = data?.trip?.legs?.[0]?.shape as string | undefined;
    if (typeof shape !== 'string' || shape.length === 0) return null;
    const decoded = decodePolyline6(shape);
    if (decoded.length < 2) return null;
    const resolved = pinEndpoints(decoded, points);
    osrmCache.set(key, resolved);
    return resolved;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Walking geometry: campus shortcut → Valhalla → OSRM → straight line.
 * Valhalla's pedestrian costing knows footpaths, squares and crossings; the
 * public OSRM demo serves only the car profile (one-ways, no footpaths), so
 * it is the fallback, not the source.
 */
export async function fetchWalkingGeometry(points: LatLng[]): Promise<LatLng[]> {
  if (points.length < 2) return [...points];
  if (points.length === 2) {
    if (haversineKm(points[0], points[1]) > 4) return [points[0], points[1]];
    const campus = resolveCampusPedestrianCorridor(points[0], points[1]);
    if (campus) return campus;
  }
  const viaValhalla = await fetchValhallaWalking(points);
  if (viaValhalla && viaValhalla.length >= 2) return viaValhalla;
  const viaOsrm = await fetchOsrmGeometry(points, 'walking');
  if (viaOsrm && viaOsrm.length >= 2) return viaOsrm;
  return [...points];
}
