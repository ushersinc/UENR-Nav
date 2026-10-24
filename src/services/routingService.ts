import { RouteInfo, RouteStep } from '../types/campus';

/* ==========================================================================
   UENR CAMPUS PEDESTRIAN WALKWAY GRAPH & DIJKSTRA ROUTING ENGINE
   ========================================================================== */

export interface NetworkNode {
  id: string;
  name: string;
  coordinates: [number, number]; // [lat, lng]
}

export interface NetworkEdge {
  from: string;
  to: string;
  distance: number; // in meters
  pathwayName: string;
}

// 1. Verified Campus Walkway Intersections & Entrance Nodes
export const CAMPUS_NODES: Record<string, NetworkNode> = {
  main_gate: { id: 'main_gate', name: 'Main Campus Gate Checkpoint', coordinates: [7.3510, -2.3496] },
  hall1_avenue: { id: 'hall1_avenue', name: 'University Hall 1 Walkway', coordinates: [7.3528, -2.3480] },
  hall2_lane: { id: 'hall2_lane', name: 'University Hall 2 North Connector', coordinates: [7.3550, -2.3485] },
  field_nw: { id: 'field_nw', name: 'Sports Field Northwest Walkway', coordinates: [7.3508, -2.3478] },
  field_ne: { id: 'field_ne', name: 'Sports Field Northeast Sidewalk', coordinates: [7.3508, -2.3444] },
  pavilion: { id: 'pavilion', name: 'Campus Pavilion Crossroads', coordinates: [7.3501, -2.3444] },
  lt_plaza: { id: 'lt_plaza', name: 'LT Block Central Plaza', coordinates: [7.3500, -2.3438] },
  rcees_drive: { id: 'rcees_drive', name: 'RCEES Avenue Entrance', coordinates: [7.3504, -2.3424] },
  bog_junction: { id: 'bog_junction', name: 'Bank of Ghana Forecourt', coordinates: [7.3524, -2.3421] },
  lts_crossing: { id: 'lts_crossing', name: 'LTS South Wing Walkway', coordinates: [7.3486, -2.3418] },
  sh_plaza: { id: 'sh_plaza', name: 'SH Block Quadrangle', coordinates: [7.3477, -2.3412] },
  app_lab_path: { id: 'app_lab_path', name: 'Applied Research Lab Walkway', coordinates: [7.3462, -2.3423] },
  summer_hut_hub: { id: 'summer_hut_hub', name: 'Summer Hut Garden Promenade', coordinates: [7.3460, -2.3442] },
  odum_walkway: { id: 'odum_walkway', name: 'Odum Block Crosswalk', coordinates: [7.3491, -2.3442] },
  admin_forecourt: { id: 'admin_forecourt', name: 'Central Administration Circle', coordinates: [7.3492, -2.3460] },
  cafeteria_square: { id: 'cafeteria_square', name: 'Central Cafeteria Plaza', coordinates: [7.3475, -2.3460] },
  old_aud_lane: { id: 'old_aud_lane', name: 'Old Auditorium Walkway', coordinates: [7.3475, -2.3466] },
  library_lane: { id: 'library_lane', name: 'Old Library Paved Corridor', coordinates: [7.3481, -2.3473] },
  clinic_drive: { id: 'clinic_drive', name: 'Health Services Ambulance Bay', coordinates: [7.3470, -2.3479] },
  chem_lab_path: { id: 'chem_lab_path', name: 'Chemistry Laboratory Lane', coordinates: [7.3478, -2.3478] },
  eng_lab_path: { id: 'eng_lab_path', name: 'Engineering Workshops Lane', coordinates: [7.3468, -2.3472] },
  dict_center: { id: 'dict_center', name: 'DICT / IT Directorate Concourse', coordinates: [7.3467, -2.3465] },
  getfund_south: { id: 'getfund_south', name: 'GETFund Hostel South Walkway', coordinates: [7.3450, -2.3410] },
  bball_court_lane: { id: 'bball_court_lane', name: 'Sports Court Walkway', coordinates: [7.3508, -2.3468] },
};

// 2. Verified Bidirectional Walkway Edges
export const CAMPUS_EDGES: NetworkEdge[] = [
  { from: 'main_gate', to: 'hall1_avenue', distance: 260, pathwayName: 'Hall 1 Access Boulevard' },
  { from: 'hall1_avenue', to: 'hall2_lane', distance: 250, pathwayName: 'Northern Hostels Walkway' },
  { from: 'main_gate', to: 'field_nw', distance: 200, pathwayName: 'Main Campus Entrance Walkway' },
  { from: 'field_nw', to: 'bball_court_lane', distance: 110, pathwayName: 'Sports Complex Path' },
  { from: 'bball_court_lane', to: 'field_ne', distance: 270, pathwayName: 'Sports Field North Sidewalk' },
  { from: 'field_nw', to: 'admin_forecourt', distance: 260, pathwayName: 'Administration West Avenue' },
  { from: 'field_ne', to: 'pavilion', distance: 80, pathwayName: 'Pavilion North Walkway' },
  { from: 'pavilion', to: 'lt_plaza', distance: 70, pathwayName: 'Central Lecture Concourse' },
  { from: 'lt_plaza', to: 'rcees_drive', distance: 160, pathwayName: 'RCEES Academic Walkway' },
  { from: 'rcees_drive', to: 'bog_junction', distance: 230, pathwayName: 'Bank of Ghana Avenue' },
  { from: 'lt_plaza', to: 'odum_walkway', distance: 110, pathwayName: 'Central Crossway' },
  { from: 'lt_plaza', to: 'lts_crossing', distance: 270, pathwayName: 'South Lecture Link' },
  { from: 'lts_crossing', to: 'sh_plaza', distance: 120, pathwayName: 'Science & Social Hall Promenade' },
  { from: 'sh_plaza', to: 'app_lab_path', distance: 210, pathwayName: 'Applied Research Pathway' },
  { from: 'app_lab_path', to: 'getfund_south', distance: 190, pathwayName: 'GETFund Footpath' },
  { from: 'app_lab_path', to: 'summer_hut_hub', distance: 210, pathwayName: 'Summer Hut Garden Promenade' },
  { from: 'summer_hut_hub', to: 'cafeteria_square', distance: 250, pathwayName: 'Student Dining Walkway' },
  { from: 'cafeteria_square', to: 'dict_center', distance: 100, pathwayName: 'DICT Concourse' },
  { from: 'cafeteria_square', to: 'old_aud_lane', distance: 70, pathwayName: 'Historic Campus Walkway' },
  { from: 'old_aud_lane', to: 'library_lane', distance: 100, pathwayName: 'Library Paved Corridor' },
  { from: 'library_lane', to: 'chem_lab_path', distance: 60, pathwayName: 'Science Laboratories Path' },
  { from: 'chem_lab_path', to: 'clinic_drive', distance: 90, pathwayName: 'Health Services Ambulance Way' },
  { from: 'clinic_drive', to: 'eng_lab_path', distance: 80, pathwayName: 'Engineering Workshops Lane' },
  { from: 'old_aud_lane', to: 'admin_forecourt', distance: 200, pathwayName: 'Central Administration Walk' },
  { from: 'admin_forecourt', to: 'odum_walkway', distance: 200, pathwayName: 'Odum Forestry Avenue' },
];

/**
 * Calculates geodesic distance between two points in meters using Haversine formula
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Calculates compass bearing from point 1 to point 2 in degrees (0 - 360)
 */
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

function getTurnDirection(b1: number, b2: number): string {
  let diff = (b2 - b1 + 360) % 360;
  if (diff > 180) diff -= 360;

  if (Math.abs(diff) < 25) return 'continue straight';
  if (diff > 25 && diff < 65) return 'slight right';
  if (diff >= 65 && diff < 120) return 'right';
  if (diff >= 120) return 'sharp right';
  if (diff < -25 && diff > -65) return 'slight left';
  if (diff <= -65 && diff > -120) return 'left';
  return 'sharp left';
}

/**
 * Finds the closest campus graph node to a given coordinate
 */
function findClosestNode(lat: number, lng: number): NetworkNode {
  let closest = Object.values(CAMPUS_NODES)[0];
  let minDist = Infinity;

  for (const node of Object.values(CAMPUS_NODES)) {
    const d = calculateDistanceMeters(lat, lng, node.coordinates[0], node.coordinates[1]);
    if (d < minDist) {
      minDist = d;
      closest = node;
    }
  }

  return closest;
}

/**
 * Dijkstra Shortest Path Solver across campus walkway network
 */
function dijkstra(startId: string, endId: string): { pathNodeIds: string[]; totalDistance: number } {
  const distances: Record<string, number> = {};
  const previous: Record<string, string | null> = {};
  const unvisited = new Set<string>();

  // Build adjacency list
  const adj: Record<string, { to: string; dist: number; name: string }[]> = {};
  for (const id of Object.keys(CAMPUS_NODES)) {
    distances[id] = Infinity;
    previous[id] = null;
    unvisited.add(id);
    adj[id] = [];
  }

  for (const edge of CAMPUS_EDGES) {
    adj[edge.from]?.push({ to: edge.to, dist: edge.distance, name: edge.pathwayName });
    adj[edge.to]?.push({ to: edge.from, dist: edge.distance, name: edge.pathwayName });
  }

  distances[startId] = 0;

  while (unvisited.size > 0) {
    let currentId: string | null = null;
    let minD = Infinity;

    for (const id of unvisited) {
      if (distances[id] < minD) {
        minD = distances[id];
        currentId = id;
      }
    }

    if (!currentId || minD === Infinity || currentId === endId) {
      break;
    }

    unvisited.delete(currentId);

    const neighbors = adj[currentId] || [];
    for (const n of neighbors) {
      if (!unvisited.has(n.to)) continue;
      const alt = distances[currentId] + n.dist;
      if (alt < distances[n.to]) {
        distances[n.to] = alt;
        previous[n.to] = currentId;
      }
    }
  }

  const pathNodeIds: string[] = [];
  let curr: string | null = endId;
  while (curr) {
    pathNodeIds.unshift(curr);
    curr = previous[curr];
  }

  return {
    pathNodeIds: pathNodeIds[0] === startId ? pathNodeIds : [startId, endId],
    totalDistance: distances[endId] !== Infinity ? distances[endId] : 0,
  };
}

/**
 * Calculates pedestrian route between two geographic coordinates on UENR campus.
 * Tries the public OSRM foot routing engine first, and falls back to our verified
 * campus Dijkstra network graph for 100% offline and reliable routing.
 */
export async function calculatePedestrianRoute(
  start: { name: string; coordinates: [number, number] },
  end: { name: string; coordinates: [number, number] }
): Promise<RouteInfo> {
  const [startLat, startLng] = start.coordinates;
  const [endLat, endLng] = end.coordinates;

  // Validate start & end aren't identical
  const directDistance = calculateDistanceMeters(startLat, startLng, endLat, endLng);
  if (directDistance < 5) {
    return {
      coordinates: [[startLat, startLng]],
      distance: 0,
      duration: 0,
      steps: [
        {
          instruction: `You are already at ${end.name}.`,
          distance: 0,
          duration: 0,
          location: [startLat, startLng],
          type: 'arrive',
        },
      ],
      startPoint: start,
      endPoint: end,
    };
  }

  // 1. Try public OSRM Pedestrian Routing with 2.5s timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const url = `https://router.project-osrm.org/route/v1/foot/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates: [number, number][] = route.geometry.coordinates.map(
          (c: [number, number]) => [c[1], c[0]]
        );

        const steps: RouteStep[] = [];
        if (route.legs && route.legs[0] && route.legs[0].steps) {
          route.legs[0].steps.forEach((s: any) => {
            const maneuver = s.maneuver || {};
            const loc: [number, number] = maneuver.location
              ? [maneuver.location[1], maneuver.location[0]]
              : [startLat, startLng];

            let text = s.name ? `Walk on ${s.name}` : 'Walk along campus pathway';
            if (maneuver.type === 'depart') {
              text = `Start walk from ${start.name}`;
            } else if (maneuver.type === 'arrive') {
              text = `Arrive at ${end.name}`;
            } else if (maneuver.modifier) {
              const mod = maneuver.modifier.replace(/_/g, ' ');
              text = `Turn ${mod}${s.name ? ` onto ${s.name}` : ''}`;
            }

            steps.push({
              instruction: text,
              distance: Math.round(s.distance || 0),
              duration: Math.round(s.duration || 0),
              location: loc,
              modifier: maneuver.modifier,
              type: maneuver.type,
            });
          });
        }

        if (coordinates.length >= 2) {
          return {
            coordinates,
            distance: Math.round(route.distance),
            duration: Math.round(route.duration),
            steps: steps.length > 0 ? steps : generateStepInstructionsFromCoords(start, end, coordinates),
            startPoint: start,
            endPoint: end,
          };
        }
      }
    }
  } catch {
    // Network offline or rate limited, gracefully proceed to Dijkstra graph
  }

  // 2. Reliable Topological Dijkstra Walkway Routing
  return generateDijkstraCampusRoute(start, end);
}

function generateDijkstraCampusRoute(
  start: { name: string; coordinates: [number, number] },
  end: { name: string; coordinates: [number, number] }
): RouteInfo {
  const [startLat, startLng] = start.coordinates;
  const [endLat, endLng] = end.coordinates;

  const startNode = findClosestNode(startLat, startLng);
  const endNode = findClosestNode(endLat, endLng);

  const { pathNodeIds, totalDistance } = dijkstra(startNode.id, endNode.id);

  // Build full coordinate polyline
  const fullPolyline: [number, number][] = [[startLat, startLng]];

  // Add path node coordinates
  for (const nodeId of pathNodeIds) {
    const node = CAMPUS_NODES[nodeId];
    if (node) {
      fullPolyline.push(node.coordinates);
    }
  }

  fullPolyline.push([endLat, endLng]);

  // Remove immediate duplicate points if any
  const cleanedCoords: [number, number][] = [];
  for (let i = 0; i < fullPolyline.length; i++) {
    const pt = fullPolyline[i];
    if (
      i === 0 ||
      calculateDistanceMeters(pt[0], pt[1], cleanedCoords[cleanedCoords.length - 1][0], cleanedCoords[cleanedCoords.length - 1][1]) > 2
    ) {
      cleanedCoords.push(pt);
    }
  }

  // Calculate actual distance
  let calculatedDist = 0;
  for (let i = 0; i < cleanedCoords.length - 1; i++) {
    calculatedDist += calculateDistanceMeters(
      cleanedCoords[i][0],
      cleanedCoords[i][1],
      cleanedCoords[i + 1][0],
      cleanedCoords[i + 1][1]
    );
  }

  // Walking speed: 1.25 m/s (~75 meters/min)
  const durationSec = Math.round(calculatedDist / 1.25);

  const steps = generateStepInstructionsFromCoords(start, end, cleanedCoords);

  return {
    coordinates: cleanedCoords,
    distance: calculatedDist,
    duration: durationSec,
    steps,
    startPoint: start,
    endPoint: end,
  };
}

function generateStepInstructionsFromCoords(
  start: { name: string; coordinates: [number, number] },
  end: { name: string; coordinates: [number, number] },
  coords: [number, number][]
): RouteStep[] {
  const steps: RouteStep[] = [];

  if (coords.length < 2) {
    return [
      {
        instruction: `Walk towards ${end.name}`,
        distance: 10,
        duration: 8,
        location: coords[0] || start.coordinates,
        type: 'arrive',
      },
    ];
  }

  // Step 1: Depart
  const d0 = calculateDistanceMeters(coords[0][0], coords[0][1], coords[1][0], coords[1][1]);
  steps.push({
    instruction: `Depart from ${start.name} along the illuminated walkway`,
    distance: d0,
    duration: Math.round(d0 / 1.25),
    location: coords[0],
    type: 'depart',
  });

  // Intermediate turns
  for (let i = 1; i < coords.length - 1; i++) {
    const pPrev = coords[i - 1];
    const pCurr = coords[i];
    const pNext = coords[i + 1];

    const b1 = calculateBearing(pPrev[0], pPrev[1], pCurr[0], pCurr[1]);
    const b2 = calculateBearing(pCurr[0], pCurr[1], pNext[0], pNext[1]);
    const turn = getTurnDirection(b1, b2);
    const segDist = calculateDistanceMeters(pCurr[0], pCurr[1], pNext[0], pNext[1]);

    if (turn !== 'continue straight' || i === Math.floor(coords.length / 2)) {
      steps.push({
        instruction:
          turn === 'continue straight'
            ? 'Continue along the paved walkway'
            : `Turn ${turn} onto the walkway`,
        distance: segDist,
        duration: Math.round(segDist / 1.25),
        location: pCurr,
        modifier: turn,
      });
    }
  }

  // Final Step: Arrive
  const lastIdx = coords.length - 1;
  const lastDist = calculateDistanceMeters(coords[lastIdx - 1][0], coords[lastIdx - 1][1], coords[lastIdx][0], coords[lastIdx][1]);
  steps.push({
    instruction: `Arrive at ${end.name}`,
    distance: lastDist,
    duration: Math.round(lastDist / 1.25),
    location: coords[lastIdx],
    type: 'arrive',
  });

  return steps;
}

export function formatWalkingDuration(seconds: number): string {
  const mins = Math.ceil(seconds / 60);
  if (mins < 1) return '< 1 min';
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hrs} hr ${remMins} min` : `${hrs} hr`;
  }
  return `${mins} min`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}
