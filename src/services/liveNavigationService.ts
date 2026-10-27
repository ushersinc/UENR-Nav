import {
  LiveNavigationProgress,
  ManeuverType,
  NavigationStatus,
  RouteInfo,
  RouteStep,
} from '../types/campus';
import { calculateGeodesicDistanceMeters } from '../data/pedestrianGraphData';
import { isCoordinateWithinCampus } from './routingService';

/**
 * Calculates initial bearing from point 1 to point 2 in degrees (0 - 360)
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  return (theta * 180 / Math.PI + 360) % 360;
}

/**
 * Derives turn maneuver type from entry bearing and exit bearing
 */
export function deriveManeuver(entryBearing: number, exitBearing: number): ManeuverType {
  const diff = ((exitBearing - entryBearing + 540) % 360) - 180;

  if (Math.abs(diff) <= 22) return 'straight';
  if (diff > 22 && diff <= 65) return 'slight_right';
  if (diff > 65 && diff <= 135) return 'turn_right';
  if (diff < -22 && diff >= -65) return 'slight_left';
  if (diff < -65 && diff >= -135) return 'turn_left';
  return 'u_turn';
}

/**
 * Projects a geographical point (P) onto a line segment between A and B
 * Returns the projected coordinate clamped to segment [A, B]
 */
export function projectPointOntoSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): [number, number] {
  // Approximate projection in local planar coordinate space around campus latitude
  const latFactor = 111320; // meters per degree latitude
  const lngFactor = 111320 * Math.cos((p[0] * Math.PI) / 180); // meters per degree longitude

  const ax = a[1] * lngFactor;
  const ay = a[0] * latFactor;
  const bx = b[1] * lngFactor;
  const by = b[0] * latFactor;
  const px = p[1] * lngFactor;
  const py = p[0] * latFactor;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return [a[0], a[1]];

  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = ax + t * dx;
  const projY = ay + t * dy;

  return [projY / latFactor, projX / lngFactor];
}

export interface RouteProjectionResult {
  projectedPoint: [number, number];
  segmentIndex: number;
  crossTrackDistance: number; // in meters
  distanceAlongRoute: number; // in meters from route start
}

/**
 * Finds the nearest point along a multi-vertex route polyline
 */
export function projectPointOntoPolyline(
  point: [number, number],
  polyline: [number, number][]
): RouteProjectionResult {
  if (polyline.length < 2) {
    return {
      projectedPoint: polyline[0] || point,
      segmentIndex: 0,
      crossTrackDistance: polyline[0] ? calculateGeodesicDistanceMeters(point[0], point[1], polyline[0][0], polyline[0][1]) : 0,
      distanceAlongRoute: 0,
    };
  }

  let minCrossTrack = Infinity;
  let bestProj: [number, number] = polyline[0];
  let bestSegIndex = 0;
  let distToBestSegStart = 0;
  let cumulativeDist = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const segA = polyline[i];
    const segB = polyline[i + 1];
    const segLength = calculateGeodesicDistanceMeters(segA[0], segA[1], segB[0], segB[1]);

    const proj = projectPointOntoSegment(point, segA, segB);
    const distToProj = calculateGeodesicDistanceMeters(point[0], point[1], proj[0], proj[1]);

    if (distToProj < minCrossTrack) {
      minCrossTrack = distToProj;
      bestProj = proj;
      bestSegIndex = i;
      distToBestSegStart = cumulativeDist;
    }

    cumulativeDist += segLength;
  }

  // Calculate distance along the route up to bestProj
  const segStartPoint = polyline[bestSegIndex];
  const distAlongBestSeg = calculateGeodesicDistanceMeters(
    segStartPoint[0],
    segStartPoint[1],
    bestProj[0],
    bestProj[1]
  );
  const totalDistanceAlongRoute = Math.round(distToBestSegStart + distAlongBestSeg);

  return {
    projectedPoint: bestProj,
    segmentIndex: bestSegIndex,
    crossTrackDistance: Math.round(minCrossTrack),
    distanceAlongRoute: totalDistanceAlongRoute,
  };
}

/**
 * Computes remaining walking distance along route from projected point
 */
export function computeRemainingDistance(
  polyline: [number, number][],
  segmentIndex: number,
  projectedPoint: [number, number]
): number {
  if (polyline.length < 2) return 0;
  if (segmentIndex >= polyline.length - 1) return 0;

  // From projected point to end of current segment
  const nextVertex = polyline[segmentIndex + 1];
  let remaining = calculateGeodesicDistanceMeters(
    projectedPoint[0],
    projectedPoint[1],
    nextVertex[0],
    nextVertex[1]
  );

  // Sum all subsequent segments
  for (let i = segmentIndex + 1; i < polyline.length - 1; i++) {
    remaining += calculateGeodesicDistanceMeters(
      polyline[i][0],
      polyline[i][1],
      polyline[i + 1][0],
      polyline[i + 1][1]
    );
  }

  return Math.max(0, Math.round(remaining));
}

/**
 * Evaluates real-time walking progress along active route
 */
export function calculateLiveNavigationProgress(
  userPosition: [number, number],
  userAccuracy: number,
  userHeading: number | null | undefined,
  route: RouteInfo,
  prevProgress: LiveNavigationProgress | null
): LiveNavigationProgress {
  const totalRouteDistance = route.distance;
  const polyline = route.coordinates;

  // 1. Project user position onto route geometry
  const projection = projectPointOntoPolyline(userPosition, polyline);
  const crossTrackDistance = projection.crossTrackDistance;

  // 2. Dynamic deviation threshold based on GPS uncertainty (e.g. ±5m accuracy -> 25m threshold)
  const deviationThreshold = Math.max(25, (userAccuracy || 10) + 12);
  const isOffRoute = crossTrackDistance > deviationThreshold;

  // 3. Monotonic progress dampening (prevent GPS noise jitter from bouncing progress back)
  let distanceTraveled = projection.distanceAlongRoute;
  if (prevProgress && !isOffRoute) {
    const drop = prevProgress.distanceTraveled - distanceTraveled;
    // If progress decreased by a noise margin (up to 18 meters), hold peak progress
    if (drop > 0 && drop <= 18) {
      distanceTraveled = prevProgress.distanceTraveled;
    }
  }

  // 4. Remaining distance
  const distanceRemaining = Math.max(0, totalRouteDistance - distanceTraveled);
  const walkingSpeedMps = 1.3; // standard ~4.7 km/h walking speed
  const estimatedTimeRemaining = Math.ceil(distanceRemaining / walkingSpeedMps);

  // 5. Percent complete
  const percentComplete = totalRouteDistance > 0
    ? Math.min(100, Math.max(0, Math.round((distanceTraveled / totalRouteDistance) * 100)))
    : 100;

  // 6. Arrival check: user must be genuinely near the end of the route
  const destCoord = polyline[polyline.length - 1];
  const directDistToDest = destCoord
    ? calculateGeodesicDistanceMeters(userPosition[0], userPosition[1], destCoord[0], destCoord[1])
    : Infinity;

  // Prevent false arrival if user is near destination building perimeter but route still requires walking around
  const isTrulyNearDestination =
    distanceRemaining <= 18 ||
    (directDistToDest <= 18 && (distanceRemaining <= 25 || totalRouteDistance <= 30));

  const hasArrived = isTrulyNearDestination;

  // 7. Find active step and upcoming turn
  let activeStepIndex = 0;
  let cumulativeStepDistance = 0;
  let currentStepInstruction = route.steps[0]?.instruction || 'Follow campus walkway';
  let distanceToNextTurn = 0;
  let nextManeuver: ManeuverType = 'straight';

  if (route.steps.length > 0) {
    for (let i = 0; i < route.steps.length; i++) {
      const step = route.steps[i];
      const stepEndDist = cumulativeStepDistance + step.distance;

      if (distanceTraveled <= stepEndDist || i === route.steps.length - 1) {
        activeStepIndex = i;
        currentStepInstruction = step.instruction;
        distanceToNextTurn = Math.max(0, stepEndDist - distanceTraveled);

        // Derive next maneuver from step angle or next step
        if (i < route.steps.length - 1) {
          const nextStep = route.steps[i + 1];
          const currLoc = step.location;
          const nextLoc = nextStep.location;
          const entryBearing = calculateBearing(polyline[Math.max(0, projection.segmentIndex - 1)][0], polyline[Math.max(0, projection.segmentIndex - 1)][1], polyline[projection.segmentIndex][0], polyline[projection.segmentIndex][1]);
          const exitBearing = calculateBearing(currLoc[0], currLoc[1], nextLoc[0], nextLoc[1]);
          nextManeuver = deriveManeuver(entryBearing, exitBearing);
        } else {
          nextManeuver = 'arrive';
        }
        break;
      }
      cumulativeStepDistance += step.distance;
    }
  }

  if (hasArrived) {
    currentStepInstruction = `You have arrived at ${route.endPoint.name}`;
    nextManeuver = 'arrive';
    distanceToNextTurn = 0;
  }

  // 8. Split polyline into completed and remaining segments for high-contrast rendering
  const completedCoords: [number, number][] = [];
  for (let i = 0; i <= projection.segmentIndex; i++) {
    completedCoords.push(polyline[i]);
  }
  completedCoords.push(projection.projectedPoint);

  const remainingCoords: [number, number][] = [projection.projectedPoint];
  for (let i = projection.segmentIndex + 1; i < polyline.length; i++) {
    remainingCoords.push(polyline[i]);
  }

  // 9. Overall navigation status
  let status: NavigationStatus = 'on_route';
  if (hasArrived) {
    status = 'arrived';
  } else if (isOffRoute) {
    status = 'off_route';
  }

  return {
    status,
    userPosition,
    userAccuracy,
    userHeading: typeof userHeading === 'number' && !isNaN(userHeading) ? userHeading : null,
    distanceTraveled,
    distanceRemaining,
    estimatedTimeRemaining,
    percentComplete,
    activeStepIndex,
    currentInstruction: currentStepInstruction,
    nextManeuver,
    distanceToNextTurn,
    crossTrackDistance,
    isOffRoute,
    hasArrived,
    completedCoordinates: completedCoords,
    remainingCoordinates: remainingCoords,
  };
}

/**
 * Robust Location Watch Subscription Manager
 */
export class GeolocationWatchManager {
  private watchId: number | null = null;
  private isTracking = false;
  private lastKnownCoords: [number, number] | null = null;
  private lastHeading: number | null = null;

  start(
    onLocationUpdate: (coords: [number, number], accuracy: number, heading?: number | null) => void,
    onError: (errorMessage: string, code?: number) => void
  ): boolean {
    if (!('geolocation' in navigator)) {
      onError('Geolocation is not supported by your browser.');
      return false;
    }

    this.stop();

    try {
      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = Math.round(position.coords.accuracy || 15);
          let heading = position.coords.heading;

          // Filter completely invalid coordinates
          if (isNaN(lat) || isNaN(lng) || !isCoordinateWithinCampus(lat, lng)) {
            // Check if coordinates are near campus boundary, handle gracefully
            if (!isCoordinateWithinCampus(lat, lng)) {
              onError('GPS reading is outside the UENR campus boundary.', 2);
              return;
            }
          }

          // Compute moving heading if browser heading is not provided or null
          if ((heading === null || isNaN(heading)) && this.lastKnownCoords) {
            const movementDist = calculateGeodesicDistanceMeters(
              this.lastKnownCoords[0],
              this.lastKnownCoords[1],
              lat,
              lng
            );
            if (movementDist >= 2) {
              heading = calculateBearing(
                this.lastKnownCoords[0],
                this.lastKnownCoords[1],
                lat,
                lng
              );
              this.lastHeading = heading;
            } else {
              heading = this.lastHeading;
            }
          } else if (typeof heading === 'number') {
            this.lastHeading = heading;
          }

          this.lastKnownCoords = [lat, lng];
          this.isTracking = true;
          onLocationUpdate([lat, lng], accuracy, heading);
        },
        (error) => {
          let userMsg = 'Unable to acquire GPS position.';
          if (error.code === 1) {
            userMsg = 'Location permission was denied. Tap "Use My GPS" and allow location access in your browser.';
          } else if (error.code === 2) {
            userMsg = 'GPS signal is currently unavailable. Move outdoors for a clearer satellite view.';
          } else if (error.code === 3) {
            userMsg = 'GPS acquisition timed out. Retrying satellite fix...';
          }
          onError(userMsg, error.code);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 4000,
        }
      );
      this.isTracking = true;
      return true;
    } catch (err: any) {
      onError(`Failed to start GPS tracking: ${err?.message || 'Unknown error'}`);
      return false;
    }
  }

  stop(): void {
    if (this.watchId !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
  }

  get isActive(): boolean {
    return this.isTracking;
  }
}
