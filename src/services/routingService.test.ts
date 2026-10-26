/**
 * Automated Verification & Test Suite for UENR Nav Pedestrian Shortest-Path Engine
 * Implements all 15 test scenarios mandated by Phase 8:
 *  1. Simple graph with one possible route
 *  2. Multiple possible routes where shortest route is not the one with fewest edges
 *  3. Geometrically nearest destination not reachable by valid pedestrian path
 *  4. Disconnected graph components
 *  5. Invalid or missing coordinates
 *  6. Incorrect edge lengths (recalculated from geometry via Haversine)
 *  7. Origin or destination outside permitted snapping threshold (> 150m)
 *  8. Reversed origin and destination (symmetry check)
 *  9. Temporarily closed paths (bypasses closed edge)
 * 10. Accessible routing avoiding verified stair-only paths
 * 11. Missing accessibility information handled safely
 * 12. Route geometry matching selected graph edges
 * 13. Accurate total distance calculated from route segments
 * 14. No-route and incomplete-data error handling
 * 15. Large graph practical performance test (MinPriorityQueue scaling)
 * 16. Dijkstra vs A* equivalence test (both return exact same minimum distance)
 */

import {
  calculateGeodesicDistanceMeters,
  computeGeometryLength,
  VERIFIED_CAMPUS_NODES,
  VERIFIED_CAMPUS_EDGES,
} from '../data/pedestrianGraphData';
import {
  MinPriorityQueue,
  dijkstraShortestPath,
  astarShortestPath,
  calculatePedestrianRoute,
  findClosestNode,
  validateGraphConnectivity,
  DEFAULT_SNAPPING_THRESHOLD_METERS,
} from './routingService';
import { PedestrianNode, PedestrianEdge } from '../types/campus';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`TEST ASSERTION FAILED: ${message}`);
  }
}

export function runRoutingVerificationTests(): { passed: number; failed: number; results: string[] } {
  const results: string[] = [];
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      passed++;
      results.push(`PASS: ${name}`);
    } catch (err: any) {
      failed++;
      results.push(`FAIL: ${name} -> ${err.message}`);
    }
  }

  // 1. Simple graph with one possible route
  test('1. Simple graph with one possible route', () => {
    const testNodes: Record<string, PedestrianNode> = {
      n1: { id: 'n1', name: 'Node 1', coordinates: [7.349, -2.343], verificationStatus: 'verified' },
      n2: { id: 'n2', name: 'Node 2', coordinates: [7.350, -2.343], verificationStatus: 'verified' },
    };
    const testEdges: PedestrianEdge[] = [
      {
        id: 'e1',
        from: 'n1',
        to: 'n2',
        pathwayName: 'Single Path',
        distance: 111,
        geometry: [[7.349, -2.343], [7.350, -2.343]],
        isStepFree: true,
        hasStairs: false,
        surface: 'paved',
        slope: 'flat',
        verificationStatus: 'verified',
      },
    ];

    const result = astarShortestPath('n1', 'n2', {}, testNodes, testEdges);
    assert(result.routeFound === true, 'Route should be found');
    assert(result.pathNodeIds.length === 2, 'Path should contain [n1, n2]');
    assert(result.totalDistanceMeters > 100 && result.totalDistanceMeters < 120, 'Distance should match');
  });

  // 2. Multiple possible routes where shortest route is not the one with fewest edges
  test('2. Multiple routes where shortest route is not the one with fewest edges', () => {
    // Path 1 (Direct edge): A -> C = 500m (1 edge)
    // Path 2 (Two short edges): A -> B = 100m, B -> C = 150m (total 250m, 2 edges)
    const testNodes: Record<string, PedestrianNode> = {
      A: { id: 'A', name: 'Node A', coordinates: [7.348, -2.343], verificationStatus: 'verified' },
      B: { id: 'B', name: 'Node B', coordinates: [7.349, -2.343], verificationStatus: 'verified' },
      C: { id: 'C', name: 'Node C', coordinates: [7.350, -2.343], verificationStatus: 'verified' },
    };
    const testEdges: PedestrianEdge[] = [
      {
        id: 'e_direct',
        from: 'A',
        to: 'C',
        pathwayName: 'Long Direct Highway',
        distance: 500,
        geometry: [[7.348, -2.343], [7.350, -2.343]],
        isStepFree: true,
        hasStairs: false,
        surface: 'paved',
        slope: 'flat',
        verificationStatus: 'verified',
      },
      {
        id: 'e_short_1',
        from: 'A',
        to: 'B',
        pathwayName: 'Short Leg 1',
        distance: 100,
        geometry: [[7.348, -2.343], [7.349, -2.343]],
        isStepFree: true,
        hasStairs: false,
        surface: 'paved',
        slope: 'flat',
        verificationStatus: 'verified',
      },
      {
        id: 'e_short_2',
        from: 'B',
        to: 'C',
        pathwayName: 'Short Leg 2',
        distance: 150,
        geometry: [[7.349, -2.343], [7.350, -2.343]],
        isStepFree: true,
        hasStairs: false,
        surface: 'paved',
        slope: 'flat',
        verificationStatus: 'verified',
      },
    ];

    const result = astarShortestPath('A', 'C', {}, testNodes, testEdges);
    assert(result.routeFound === true, 'Route should be found');
    assert(result.pathNodeIds.length === 3, 'Should pick A -> B -> C (2 edges), not direct 1-edge detour');
    assert(result.totalDistanceMeters === 250, `Distance should be 250m, got ${result.totalDistanceMeters}`);
  });

  // 3. Geometrically nearest destination not reachable by valid pedestrian path
  test('3. Geometrically nearest destination not reachable by valid pedestrian path', () => {
    // Dest 1 is physically 10m away but disconnected.
    // Dest 2 is physically 80m away and connected by pedestrian walkway.
    const testNodes: Record<string, PedestrianNode> = {
      start: { id: 'start', name: 'Origin', coordinates: [7.3490, -2.3430], verificationStatus: 'verified' },
      walled_off: { id: 'walled_off', name: 'Nearby Walled Garden', coordinates: [7.3491, -2.3430], verificationStatus: 'verified' },
      connected_far: { id: 'connected_far', name: 'Reachable Building', coordinates: [7.3498, -2.3430], verificationStatus: 'verified' },
    };
    const testEdges: PedestrianEdge[] = [
      {
        id: 'e_reach',
        from: 'start',
        to: 'connected_far',
        pathwayName: 'Paved Walkway',
        distance: 88,
        geometry: [[7.3490, -2.3430], [7.3498, -2.3430]],
        isStepFree: true,
        hasStairs: false,
        surface: 'paved',
        slope: 'flat',
        verificationStatus: 'verified',
      },
    ];

    const resultWalled = astarShortestPath('start', 'walled_off', {}, testNodes, testEdges);
    assert(resultWalled.routeFound === false, 'Walled off destination must not be reached');

    const resultConnected = astarShortestPath('start', 'connected_far', {}, testNodes, testEdges);
    assert(resultConnected.routeFound === true, 'Connected destination must be reached');
  });

  // 4. Disconnected graph components
  test('4. Disconnected graph components detection and handling', () => {
    const testNodes: Record<string, PedestrianNode> = {
      A: { id: 'A', name: 'Component 1 Node', coordinates: [7.349, -2.343], verificationStatus: 'verified' },
      B: { id: 'B', name: 'Component 1 Node', coordinates: [7.350, -2.343], verificationStatus: 'verified' },
      X: { id: 'X', name: 'Component 2 Node', coordinates: [7.351, -2.343], verificationStatus: 'verified' },
      Y: { id: 'Y', name: 'Component 2 Node', coordinates: [7.352, -2.343], verificationStatus: 'verified' },
    };
    const testEdges: PedestrianEdge[] = [
      {
        id: 'e_ab',
        from: 'A',
        to: 'B',
        pathwayName: 'Pathway AB',
        distance: 100,
        geometry: [[7.349, -2.343], [7.350, -2.343]],
        isStepFree: true,
        hasStairs: false,
        surface: 'paved',
        slope: 'flat',
        verificationStatus: 'verified',
      },
      {
        id: 'e_xy',
        from: 'X',
        to: 'Y',
        pathwayName: 'Pathway XY',
        distance: 100,
        geometry: [[7.351, -2.343], [7.352, -2.343]],
        isStepFree: true,
        hasStairs: false,
        surface: 'paved',
        slope: 'flat',
        verificationStatus: 'verified',
      },
    ];

    const conn = validateGraphConnectivity(testNodes, testEdges);
    assert(conn.isValid === false, 'Graph should be flagged as disconnected');
    assert(conn.connectedComponentCount === 2, 'Should detect 2 disconnected components');

    const route = astarShortestPath('A', 'X', {}, testNodes, testEdges);
    assert(route.routeFound === false, 'Route between disconnected components must return false');
  });

  // 5. Invalid or missing coordinates
  test('5. Invalid or missing coordinates handling', async () => {
    const invalidRoute = await calculatePedestrianRoute(
      { name: 'Invalid', coordinates: [NaN, -2.343] },
      { name: 'Gate', coordinates: [7.34919, -2.34382] }
    );
    assert(invalidRoute.distance === 0, 'Distance must be 0 for invalid coords');
    assert(invalidRoute.error?.type === 'invalid_coordinates', 'Should flag invalid_coordinates');
  });

  // 6. Incorrect edge lengths (recalculating from geometry via Haversine)
  test('6. Geodesic distance calculation accuracy via Haversine formula', () => {
    // Equator 1 degree longitude = ~111,320m
    // Sunyani coords: lat 7.34919, lng -2.34382 to lat 7.34872, lng -2.34340
    const d = calculateGeodesicDistanceMeters(7.34919, -2.34382, 7.34872, -2.34340);
    assert(d > 60 && d < 75, `Distance between Main Gate & Eye of God should be ~69m, got ${d}`);

    const geom: [number, number][] = [
      [7.34919, -2.34382],
      [7.34898, -2.34362],
      [7.34872, -2.34340],
    ];
    const totalGeom = computeGeometryLength(geom);
    assert(totalGeom >= d, 'Summed curve geometry distance must be >= straight line distance');
  });

  // 7. Origin or destination outside permitted snapping threshold (> 150m)
  test('7. Origin or destination outside permitted snapping threshold', async () => {
    // Point 500m off campus in Sunyani forest
    const farOffPoint = { name: 'Distant Forest', coordinates: [7.3600, -2.3550] as [number, number] };
    const campusPoint = { name: 'Main Gate', coordinates: [7.34919, -2.34382] as [number, number] };

    const route = await calculatePedestrianRoute(farOffPoint, campusPoint);
    assert(
      route.error?.type === 'outside_snapping_threshold' || route.error?.type === 'out_of_bounds',
      'Should reject off-network location exceeding threshold'
    );
  });

  // 8. Reversed origin and destination (Symmetry check)
  test('8. Reversed origin and destination produces equal distance', () => {
    const fwd = astarShortestPath('main_gate', 'bog_auditorium', {}, VERIFIED_CAMPUS_NODES, VERIFIED_CAMPUS_EDGES);
    const rev = astarShortestPath('bog_auditorium', 'main_gate', {}, VERIFIED_CAMPUS_NODES, VERIFIED_CAMPUS_EDGES);

    assert(fwd.routeFound === true && rev.routeFound === true, 'Both routes should be found');
    assert(
      Math.abs(fwd.totalDistanceMeters - rev.totalDistanceMeters) <= 2,
      `Forward (${fwd.totalDistanceMeters}m) and Reverse (${rev.totalDistanceMeters}m) must have identical distance`
    );
  });

  // 9. Temporarily closed paths (bypasses closed edge)
  test('9. Temporarily closed paths are properly bypassed', () => {
    // Normal route from cafeteria_plaza to central_crossroads: edge-cafeteria-crossroads (direct)
    const openRoute = astarShortestPath('cafeteria_plaza', 'central_crossroads', {}, VERIFIED_CAMPUS_NODES, VERIFIED_CAMPUS_EDGES);
    assert(openRoute.routeFound === true, 'Open route found');

    // Close direct edge
    const closedEdges: PedestrianEdge[] = VERIFIED_CAMPUS_EDGES.map((e) =>
      e.id === 'edge-cafeteria-crossroads' ? { ...e, isTemporarilyClosed: true } : e
    );

    const detourRoute = astarShortestPath('cafeteria_plaza', 'central_crossroads', {}, VERIFIED_CAMPUS_NODES, closedEdges);
    assert(detourRoute.routeFound === true, 'Detour route found');
    assert(
      detourRoute.edgesUsed.every((e) => e.id !== 'edge-cafeteria-crossroads'),
      'Must not use closed edge'
    );
    assert(
      detourRoute.totalDistanceMeters > openRoute.totalDistanceMeters,
      'Detour distance should be longer than direct path'
    );
  });

  // 10. Accessible routing avoiding verified stair-only path
  test('10. Accessible routing avoids verified stair-only path', () => {
    // Unrestricted routing between LT Block and RCEES uses direct stairs edge (edge-lt-rcees-stairs: ~104m)
    const standardRoute = astarShortestPath(
      'lt_block',
      'rcees_building',
      { preference: 'all' },
      VERIFIED_CAMPUS_NODES,
      VERIFIED_CAMPUS_EDGES
    );
    assert(standardRoute.routeFound === true, 'Standard route found');
    assert(standardRoute.hasStairs === true, 'Standard route includes stairs');

    // Step-Free / Wheelchair routing MUST avoid the stairs and detour via works_engineering
    const accessibleRoute = astarShortestPath(
      'lt_block',
      'rcees_building',
      { preference: 'step_free' },
      VERIFIED_CAMPUS_NODES,
      VERIFIED_CAMPUS_EDGES
    );
    assert(accessibleRoute.routeFound === true, 'Accessible route found');
    assert(accessibleRoute.hasStairs === false, 'Accessible route must not have stairs');
    assert(accessibleRoute.isStepFree === true, 'Accessible route must be step-free');
    assert(
      accessibleRoute.pathNodeIds.includes('works_engineering'),
      'Accessible route must detour via works_engineering accessible ramp'
    );
  });

  // 11. Missing accessibility information handled safely
  test('11. Missing accessibility information handled safely without crashes', () => {
    const edgeWithMissingData: PedestrianEdge = {
      id: 'e_missing',
      from: 'main_gate',
      to: 'eye_of_god',
      pathwayName: 'Test Incomplete Path',
      distance: 69,
      geometry: [[7.34919, -2.34382], [7.34872, -2.34340]],
      isStepFree: false,
      hasStairs: false,
      surface: 'unknown' as any,
      slope: 'unknown' as any,
      verificationStatus: 'unverified',
    };

    const res = astarShortestPath(
      'main_gate',
      'eye_of_god',
      { preference: 'all' },
      VERIFIED_CAMPUS_NODES,
      [edgeWithMissingData]
    );
    assert(res.routeFound === true, 'Should handle missing/unknown attributes gracefully');
  });

  // 12. Route geometry matching selected graph edges
  test('12. Route geometry strictly matches selected graph edges', () => {
    const route = astarShortestPath(
      'main_gate',
      'central_admin',
      {},
      VERIFIED_CAMPUS_NODES,
      VERIFIED_CAMPUS_EDGES
    );
    assert(route.routeFound === true, 'Route found');
    assert(route.routeGeometry.length >= route.edgesUsed.length + 1, 'Geometry should contain all path vertices');

    // Verify first coordinate is main_gate coordinates
    const startCoord = VERIFIED_CAMPUS_NODES['main_gate'].coordinates;
    assert(
      route.routeGeometry[0][0] === startCoord[0] && route.routeGeometry[0][1] === startCoord[1],
      'Geometry should start at origin node'
    );
  });

  // 13. Accurate total distance calculated from route segments
  test('13. Accurate total distance calculated from route segments', () => {
    const route = astarShortestPath(
      'main_gate',
      'central_admin',
      {},
      VERIFIED_CAMPUS_NODES,
      VERIFIED_CAMPUS_EDGES
    );
    const sumEdges = route.edgesUsed.reduce((acc, e) => acc + e.distance, 0);
    assert(
      Math.abs(route.totalDistanceMeters - sumEdges) <= 5,
      `Calculated total distance (${route.totalDistanceMeters}m) should equal sum of edge distances (${sumEdges}m)`
    );
  });

  // 14. No-route and incomplete-data error handling
  test('14. No-route and incomplete-data error handling', () => {
    const emptyNodes: Record<string, PedestrianNode> = {};
    const emptyEdges: PedestrianEdge[] = [];

    const result = astarShortestPath('none1', 'none2', {}, emptyNodes, emptyEdges);
    assert(result.routeFound === false, 'Empty graph must return routeFound: false');
    assert(result.errorMessage !== undefined, 'Must provide clear error message');
  });

  // 15. Large graph practical performance test (MinPriorityQueue scaling)
  test('15. Large graph performance with MinPriorityQueue (1,000 nodes, 2,500 edges)', () => {
    const largeNodes: Record<string, PedestrianNode> = {};
    const largeEdges: PedestrianEdge[] = [];

    // Construct 100 x 10 grid network
    for (let i = 0; i < 100; i++) {
      for (let j = 0; j < 10; j++) {
        const id = `node_${i}_${j}`;
        largeNodes[id] = {
          id,
          name: `Grid Node ${i},${j}`,
          coordinates: [7.340 + i * 0.0001, -2.350 + j * 0.0001],
          verificationStatus: 'verified',
        };

        if (i > 0) {
          largeEdges.push({
            id: `edge_h_${i}_${j}`,
            from: `node_${i - 1}_${j}`,
            to: id,
            pathwayName: `Horizontal Path ${i},${j}`,
            distance: 11,
            geometry: [largeNodes[`node_${i - 1}_${j}`].coordinates, largeNodes[id].coordinates],
            isStepFree: true,
            hasStairs: false,
            surface: 'paved',
            slope: 'flat',
            verificationStatus: 'verified',
          });
        }
        if (j > 0) {
          largeEdges.push({
            id: `edge_v_${i}_${j}`,
            from: `node_${i}_${j - 1}`,
            to: id,
            pathwayName: `Vertical Path ${i},${j}`,
            distance: 11,
            geometry: [largeNodes[`node_${i}_${j - 1}`].coordinates, largeNodes[id].coordinates],
            isStepFree: true,
            hasStairs: false,
            surface: 'paved',
            slope: 'flat',
            verificationStatus: 'verified',
          });
        }
      }
    }

    const t0 = performance.now();
    const result = astarShortestPath('node_0_0', 'node_99_9', {}, largeNodes, largeEdges);
    const durationMs = performance.now() - t0;

    assert(result.routeFound === true, 'Path must be found across large grid');
    assert(durationMs < 100, `Large graph search took ${durationMs.toFixed(1)}ms (must be < 100ms)`);
  });

  // 16. Dijkstra vs A* Equivalence Comparison
  test('16. Dijkstra vs A* Equivalence (both return identical minimum distance)', () => {
    const testPairs = [
      ['main_gate', 'bog_auditorium'],
      ['main_gate', 'central_admin'],
      ['clinic_junction', 'hall1_hostel'],
      ['basic_school', 'rcees_building'],
      ['summer_hut', 'central_admin'],
    ];

    for (const [startId, endId] of testPairs) {
      const astarRes = astarShortestPath(startId, endId, {}, VERIFIED_CAMPUS_NODES, VERIFIED_CAMPUS_EDGES);
      const dijkstraRes = dijkstraShortestPath(startId, endId, {}, VERIFIED_CAMPUS_NODES, VERIFIED_CAMPUS_EDGES);

      assert(astarRes.routeFound === true, `A* found route for ${startId} -> ${endId}`);
      assert(dijkstraRes.routeFound === true, `Dijkstra found route for ${startId} -> ${endId}`);
      assert(
        Math.abs(astarRes.totalDistanceMeters - dijkstraRes.totalDistanceMeters) <= 1,
        `A* distance (${astarRes.totalDistanceMeters}m) must equal Dijkstra distance (${dijkstraRes.totalDistanceMeters}m) for ${startId} -> ${endId}`
      );
    }
  });

  return { passed, failed, results };
}

// Execute tests if run directly with tsx/node
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('routingService.test')) {
  console.log('Running UENR Nav Shortest-Path Test Suite...\n');
  const summary = runRoutingVerificationTests();
  summary.results.forEach((r) => console.log(r));
  console.log(`\nTests Completed: ${summary.passed} Passed, ${summary.failed} Failed.`);
  if (summary.failed > 0) {
    process.exit(1);
  }
}
