import {
  VERIFIED_CAMPUS_NODES,
  VERIFIED_CAMPUS_EDGES,
  calculateGeodesicDistanceMeters,
  computeGeometryLength,
} from '../data/pedestrianGraphData';
import { INITIAL_CAMPUS_LOCATIONS } from '../data/campusLocations';
import {
  calculatePedestrianRoute,
  validateGraphConnectivity,
} from '../services/routingService';

console.log('====================================================');
console.log('   UENR NAV — PEDESTRIAN GRAPH & ROUTING AUDIT      ');
console.log('====================================================\n');

// 1. NODE AUDIT
const nodeKeys = Object.keys(VERIFIED_CAMPUS_NODES);
const nodeCount = nodeKeys.length;
console.log(`[1] NODES: ${nodeCount} registered in VERIFIED_CAMPUS_NODES`);

const duplicateNodeIds: string[] = [];
const seenNodeIds = new Set<string>();
const invalidCoordNodes: string[] = [];

for (const [key, node] of Object.entries(VERIFIED_CAMPUS_NODES)) {
  if (key !== node.id) {
    console.warn(`Mismatch between node key "${key}" and node.id "${node.id}"`);
  }
  if (seenNodeIds.has(node.id)) {
    duplicateNodeIds.push(node.id);
  }
  seenNodeIds.add(node.id);

  const [lat, lng] = node.coordinates;
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    isNaN(lat) ||
    isNaN(lng) ||
    lat < 7.33 ||
    lat > 7.37 ||
    lng < -2.36 ||
    lng > -2.32
  ) {
    invalidCoordNodes.push(`${node.id} (${lat}, ${lng})`);
  }
}

console.log(`    - Duplicate Node IDs: ${duplicateNodeIds.length === 0 ? 'None (PASS)' : duplicateNodeIds.join(', ')}`);
console.log(`    - Out-of-Bounds/Invalid Coordinates: ${invalidCoordNodes.length === 0 ? 'None (PASS)' : invalidCoordNodes.join(', ')}`);

// 2. EDGE AUDIT
const edgeCount = VERIFIED_CAMPUS_EDGES.length;
console.log(`\n[2] EDGES: ${edgeCount} registered in VERIFIED_CAMPUS_EDGES`);

const duplicateEdgeIds: string[] = [];
const seenEdgeIds = new Set<string>();
const missingEndpoints: string[] = [];
const selfLoops: string[] = [];
const distanceMismatches: { id: string; recorded: number; computed: number }[] = [];
const pairMap = new Map<string, string[]>();

for (const edge of VERIFIED_CAMPUS_EDGES) {
  if (seenEdgeIds.has(edge.id)) {
    duplicateEdgeIds.push(edge.id);
  }
  seenEdgeIds.add(edge.id);

  if (!VERIFIED_CAMPUS_NODES[edge.from]) {
    missingEndpoints.push(`Edge ${edge.id} missing origin node: ${edge.from}`);
  }
  if (!VERIFIED_CAMPUS_NODES[edge.to]) {
    missingEndpoints.push(`Edge ${edge.id} missing destination node: ${edge.to}`);
  }

  if (edge.from === edge.to) {
    selfLoops.push(edge.id);
  }

  // Check duplicate bidirectional pairs
  const pairKey = [edge.from, edge.to].sort().join('<->');
  if (!pairMap.has(pairKey)) {
    pairMap.set(pairKey, []);
  }
  pairMap.get(pairKey)!.push(edge.id);

  // Compare recorded distance vs geometry length
  const computedLength = computeGeometryLength(edge.geometry);
  const diff = Math.abs(edge.distance - computedLength);
  if (diff > 5) {
    distanceMismatches.push({
      id: edge.id,
      recorded: edge.distance,
      computed: computedLength,
    });
  }
}

const duplicateSegments = Array.from(pairMap.entries()).filter(([_, edges]) => edges.length > 1);

console.log(`    - Duplicate Edge IDs: ${duplicateEdgeIds.length === 0 ? 'None (PASS)' : duplicateEdgeIds.join(', ')}`);
console.log(`    - Missing Endpoints: ${missingEndpoints.length === 0 ? 'None (PASS)' : missingEndpoints.join('; ')}`);
console.log(`    - Self-loops: ${selfLoops.length === 0 ? 'None (PASS)' : selfLoops.join(', ')}`);
console.log(`    - Duplicate Segments between same nodes: ${duplicateSegments.length === 0 ? 'None (PASS)' : duplicateSegments.map(([k, v]) => `${k} (${v.join(', ')})`).join('; ')}`);
console.log(`    - Distance Geometry Mismatches (>5m): ${distanceMismatches.length === 0 ? 'None (PASS)' : JSON.stringify(distanceMismatches)}`);

// 3. GRAPH CONNECTIVITY AUDIT
console.log(`\n[3] GRAPH CONNECTIVITY`);
const connReport = validateGraphConnectivity(VERIFIED_CAMPUS_NODES, VERIFIED_CAMPUS_EDGES);
console.log(`    - Connected Components Count: ${connReport.connectedComponentCount}`);
console.log(`    - Is Single Connected Component: ${connReport.isValid && connReport.connectedComponentCount === 1 ? 'YES (PASS)' : 'NO (FAIL)'}`);
console.log(`    - Isolated Nodes: ${connReport.isolatedNodeIds.length === 0 ? 'None (PASS)' : connReport.isolatedNodeIds.join(', ')}`);
console.log(`    - Summary: ${connReport.summary}`);

// 4. DESTINATION REACHABILITY FROM MAIN ENTRANCE
console.log(`\n[4] CAMPUS DESTINATIONS REACHABILITY AUDIT`);
const mainGate = { name: 'Main Campus Gate', coordinates: [7.34919, -2.34382] as [number, number] };
let unreachableLocations: string[] = [];
let reachableCount = 0;

async function auditReachability() {
  for (const loc of INITIAL_CAMPUS_LOCATIONS) {
    if (loc.id === 'main-campus-gate') {
      reachableCount++;
      continue;
    }
    try {
      const route = await calculatePedestrianRoute(mainGate, {
        name: loc.name,
        coordinates: [loc.lat, loc.lng],
      });
      if (!route || route.distance <= 0 || route.error) {
        unreachableLocations.push(`${loc.name} (${loc.id}): ${route?.error?.message || 'zero distance returned'}`);
      } else {
        reachableCount++;
      }
    } catch (err: any) {
      unreachableLocations.push(`${loc.name} (${loc.id}): ${err.message}`);
    }
  }

  console.log(`    - Total Locations Tested: ${INITIAL_CAMPUS_LOCATIONS.length}`);
  console.log(`    - Successfully Reachable Destinations: ${reachableCount}/${INITIAL_CAMPUS_LOCATIONS.length}`);
  console.log(`    - Unreachable Locations: ${unreachableLocations.length === 0 ? '0 (ALL PASS)' : unreachableLocations.join('\n      ')}`);
}

// 5. TEST SPECIFIC REPRESENTATIVE ROUTES
console.log(`\n[5] REPRESENTATIVE ROUTE MEASUREMENTS`);

async function testRoute(name: string, from: [number, number], to: [number, number], pref: 'all' | 'wheelchair' | 'step_free' = 'all') {
  try {
    const route = await calculatePedestrianRoute(
      { name: 'Start', coordinates: from },
      { name: 'End', coordinates: to },
      { preference: pref }
    );
    if (route.error) {
      console.log(`    * ${name} [Preference: ${pref}]: ERROR - ${route.error.message}`);
      return route;
    }
    console.log(`    * ${name} [Preference: ${pref}]:`);
    console.log(`      - Total Distance: ${route.distance} metres (${(route.distance / 1000).toFixed(2)} km)`);
    console.log(`      - Turn-by-turn Step Count: ${route.steps.length}`);
    console.log(`      - Estimated Walking Time: ${Math.round(route.duration / 60)} minutes (${route.duration} seconds)`);
    console.log(`      - Geometry points: ${route.coordinates.length} vertices`);
    console.log(`      - Step-free: ${route.accessibility?.isStepFree ? 'Yes' : 'No'}`);
    console.log(`      - Stairs encountered: ${route.accessibility?.hasStairs ? 'Yes' : 'No'}`);
    if (route.accessibility?.accessibilityWarnings && route.accessibility.accessibilityWarnings.length > 0) {
      console.log(`      - Warnings: ${route.accessibility.accessibilityWarnings.join('; ')}`);
    }
    return route;
  } catch (err: any) {
    console.error(`    * ${name} [FAILED]: ${err.message}`);
    return null;
  }
}

async function runRoutes() {
  await auditReachability();

  // Route 1: Main Campus Gate to LT Block Complex
  await testRoute(
    'Route 1: Main Campus Gate -> LT Block Complex',
    [7.34919, -2.34382],
    [7.35124, -2.34158]
  );

  // Route 2: GETFund Hostel -> Central Cafeteria
  await testRoute(
    'Route 2: GETFund Hostel -> Central Cafeteria',
    [7.35331, -2.34515],
    [7.34951, -2.34248]
  );

  // Route 3: University Hall 1 -> Bank of Ghana Auditorium
  await testRoute(
    'Route 3: University Hall 1 -> Bank of Ghana Auditorium',
    [7.35280, -2.34420],
    [7.35337, -2.34024]
  );

  // Route 4: Accessibility Test - LT Block Plaza to LT Block Upper Classrooms (Standard vs Wheelchair)
  console.log(`\n[6] ACCESSIBLE ROUTING VERIFICATION`);
  const standardLtRoute = await testRoute(
    'LT Plaza -> Upper Classrooms (Standard Unrestricted)',
    [7.35124, -2.34158],
    [7.35135, -2.34125],
    'all'
  );

  const wheelchairLtRoute = await testRoute(
    'LT Plaza -> Upper Classrooms (Wheelchair Accessible Only)',
    [7.35124, -2.34158],
    [7.35135, -2.34125],
    'wheelchair'
  );

  if (standardLtRoute && wheelchairLtRoute) {
    console.log(`    - Standard route uses stairs: ${standardLtRoute.accessibility?.hasStairs ? 'YES' : 'NO'}`);
    console.log(`    - Wheelchair route avoids stairs: ${!wheelchairLtRoute.accessibility?.hasStairs ? 'YES (PASS)' : 'NO (FAIL)'}`);
    console.log(`    - Wheelchair route is step-free: ${wheelchairLtRoute.accessibility?.isStepFree ? 'YES (PASS)' : 'NO (FAIL)'}`);
  }
}

runRoutes().then(() => {
  console.log('\n====================================================');
  console.log('   AUDIT SCRIPT FINISHED                            ');
  console.log('====================================================');
});
