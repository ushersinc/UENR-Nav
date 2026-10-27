import {
  calculateBearing,
  deriveManeuver,
  projectPointOntoPolyline,
  computeRemainingDistance,
  calculateLiveNavigationProgress,
} from './liveNavigationService';
import { RouteInfo } from '../types/campus';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`TEST FAILED: ${msg}`);
}

console.log('--- Testing liveNavigationService ---');

// 1. Bearing & Maneuver Tests
{
  const northBearing = calculateBearing(7.349, -2.343, 7.350, -2.343);
  assert(Math.round(northBearing) === 0 || Math.round(northBearing) === 360, `North bearing should be ~0°, got ${northBearing}`);

  const eastBearing = calculateBearing(7.349, -2.344, 7.349, -2.343);
  assert(Math.round(eastBearing) === 90, `East bearing should be ~90°, got ${eastBearing}`);

  assert(deriveManeuver(0, 90) === 'turn_right', '0 -> 90 should be turn_right');
  assert(deriveManeuver(90, 0) === 'turn_left', '90 -> 0 should be turn_left');
  assert(deriveManeuver(0, 15) === 'straight', '0 -> 15 should be straight');
  assert(deriveManeuver(0, 45) === 'slight_right', '0 -> 45 should be slight_right');
  console.log('PASS: Bearing and maneuver calculations');
}

// 2. Polyline Projection & Distance Along Route
{
  const polyline: [number, number][] = [
    [7.34919, -2.34382], // Main Gate
    [7.34891, -2.34274], // Mid-Walkway
    [7.34850, -2.34232], // Admin Junction
  ];

  // Point right along the first segment
  const midPoint: [number, number] = [
    (7.34919 + 7.34891) / 2,
    (-2.34382 + -2.34274) / 2,
  ];

  const proj = projectPointOntoPolyline(midPoint, polyline);
  assert(proj.segmentIndex === 0, `Expected segmentIndex 0, got ${proj.segmentIndex}`);
  assert(proj.crossTrackDistance <= 2, `Expected cross track <= 2m, got ${proj.crossTrackDistance}m`);
  assert(proj.distanceAlongRoute > 0, `Expected distanceAlongRoute > 0, got ${proj.distanceAlongRoute}`);

  // Point with perpendicular offset (off-route test)
  const offsetPoint: [number, number] = [midPoint[0] + 0.0005, midPoint[1]];
  const offProj = projectPointOntoPolyline(offsetPoint, polyline);
  assert(offProj.crossTrackDistance > 40, `Expected cross track > 40m, got ${offProj.crossTrackDistance}m`);
  console.log('PASS: Polyline projection and cross-track measurement');
}

// 3. Live Navigation Progress & Monotonicity
{
  const mockRoute: RouteInfo = {
    coordinates: [
      [7.34919, -2.34382],
      [7.34891, -2.34274],
      [7.34850, -2.34232],
    ],
    distance: 210,
    duration: 160,
    steps: [
      {
        instruction: 'Head east along Main Boulevard',
        distance: 125,
        duration: 95,
        location: [7.34919, -2.34382],
      },
      {
        instruction: 'Turn right at Admin Junction',
        distance: 85,
        duration: 65,
        location: [7.34891, -2.34274],
      },
    ],
    startPoint: { name: 'Main Gate', coordinates: [7.34919, -2.34382] },
    endPoint: { name: 'Admin Junction', coordinates: [7.34850, -2.34232] },
  };

  // Step 1: User at start
  const p1 = calculateLiveNavigationProgress([7.34919, -2.34382], 5, 90, mockRoute, null);
  assert(p1.status === 'on_route', 'Status should be on_route');
  assert(!p1.isOffRoute, 'Should not be off route');
  assert(!p1.hasArrived, 'Should not have arrived yet');
  assert(p1.distanceRemaining > 190, 'Remaining distance should be ~210m');

  // Step 2: User moves halfway
  const midCoords: [number, number] = [
    (7.34919 + 7.34891) / 2,
    (-2.34382 + -2.34274) / 2,
  ];
  const p2 = calculateLiveNavigationProgress(midCoords, 5, 90, mockRoute, p1);
  assert(p2.distanceTraveled > p1.distanceTraveled, 'Progress should advance');
  assert(p2.distanceRemaining < p1.distanceRemaining, 'Remaining distance should decrease');

  // Step 3: User deviates off route
  const farOffCoords: [number, number] = [7.35100, -2.34500];
  const pOff = calculateLiveNavigationProgress(farOffCoords, 8, 0, mockRoute, p2);
  assert(pOff.isOffRoute, 'Should be flagged as off-route');
  assert(pOff.status === 'off_route', 'Status should be off_route');

  // Step 4: User arrives near destination (<10m)
  const destCoords: [number, number] = [7.34850, -2.34232];
  const pArr = calculateLiveNavigationProgress(destCoords, 5, 180, mockRoute, p2);
  assert(pArr.hasArrived, 'Should be flagged as arrived');
  assert(pArr.status === 'arrived', 'Status should be arrived');
  assert(pArr.currentInstruction.includes('arrived'), 'Instruction should state arrived');

  console.log('PASS: Live navigation progress, deviation detection, and arrival');
}

// 4. GPS Noise Monotonicity Test
{
  const mockRoute: RouteInfo = {
    coordinates: [
      [7.34919, -2.34382],
      [7.34891, -2.34274],
      [7.34850, -2.34232],
    ],
    distance: 210,
    duration: 160,
    steps: [],
    startPoint: { name: 'Start', coordinates: [7.34919, -2.34382] },
    endPoint: { name: 'End', coordinates: [7.34850, -2.34232] },
  };

  // Traveled to 60m
  const p1 = calculateLiveNavigationProgress([7.34905, -2.34328], 5, 90, mockRoute, null);
  const initialDistance = p1.distanceTraveled;
  assert(initialDistance > 40 && initialDistance < 80, `Initial distance should be ~60m, got ${initialDistance}`);

  // Minor backward jitter of 4 meters due to sensor noise
  const jitterCoords: [number, number] = [7.34908, -2.34340];
  const pJitter = calculateLiveNavigationProgress(jitterCoords, 6, 90, mockRoute, p1);

  // Monotonic filter must hold the progress at initialDistance
  assert(
    pJitter.distanceTraveled >= initialDistance,
    `Progress should not regress under 4m noise. Expected >= ${initialDistance}, got ${pJitter.distanceTraveled}`
  );
  console.log('PASS: Monotonic jitter dampening holds progress steady under sensor noise');
}

// 5. False Arrival Prevention (Rear Exterior Wall Proximity)
{
  const loopRoute: RouteInfo = {
    coordinates: [
      [7.34919, -2.34382],
      [7.34950, -2.34382],
      [7.34950, -2.34365],
      [7.34920, -2.34365],
    ],
    distance: 140, // 140m walk around obstacle
    duration: 110,
    steps: [],
    startPoint: { name: 'Start', coordinates: [7.34919, -2.34382] },
    endPoint: { name: 'Destination', coordinates: [7.34920, -2.34365] },
  };

  // User is at start: physically 18m from destination coordinate across the building, but 140m walk remaining!
  const pStart = calculateLiveNavigationProgress([7.34919, -2.34382], 5, 0, loopRoute, null);
  assert(
    !pStart.hasArrived,
    'False arrival bug: User standing at start near destination perimeter should NOT be marked as arrived when 140m remain!'
  );
  assert(pStart.distanceRemaining > 120, 'Distance remaining must reflect actual route geometry');
  console.log('PASS: False arrival prevented when physically near destination rear wall at route start');
}

// 6. Dynamic Deviation Threshold under Low GPS Accuracy
{
  const mockRoute: RouteInfo = {
    coordinates: [
      [7.34919, -2.34382],
      [7.34891, -2.34274],
    ],
    distance: 120,
    duration: 90,
    steps: [],
    startPoint: { name: 'Start', coordinates: [7.34919, -2.34382] },
    endPoint: { name: 'End', coordinates: [7.34891, -2.34274] },
  };

  // Point 28m off the route
  const offsetPoint: [number, number] = [7.34919 + 0.00025, -2.34328];

  // Case A: High GPS accuracy (±5m) -> deviation threshold is ~25m -> should trigger off-route
  const pGoodGps = calculateLiveNavigationProgress(offsetPoint, 5, 0, mockRoute, null);
  assert(pGoodGps.isOffRoute, 'Should trigger off-route when cross-track is 28m with ±5m accuracy');

  // Case B: Degraded indoor/foliage GPS accuracy (±35m) -> threshold expands to 35 + 12 = 47m -> should NOT trigger off-route
  const pPoorGps = calculateLiveNavigationProgress(offsetPoint, 35, 0, mockRoute, null);
  assert(!pPoorGps.isOffRoute, 'Should not trigger false off-route when uncertainty is ±35m');
  console.log('PASS: Dynamic deviation threshold expands safely under degraded GPS accuracy');
}

console.log('ALL EXTENDED ACCEPTANCE TESTS PASSED SUCCESSFULLY!');
