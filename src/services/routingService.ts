import {
  RouteInfo,
  RouteStep,
  RoutingPreference,
  RouteAccessibilityInfo,
  AccessibilitySurface,
  AccessibilitySlope,
  PedestrianNode,
  PedestrianEdge,
  RoutingGraph,
} from '../types/campus';
import {
  VERIFIED_CAMPUS_NODES,
  VERIFIED_CAMPUS_EDGES,
  calculateGeodesicDistanceMeters,
  computeGeometryLength,
  INITIAL_ROUTING_GRAPH,
} from '../data/pedestrianGraphData';

/* ==========================================================================
   MIN-PRIORITY QUEUE IMPLEMENTATION (Binary Min-Heap)
   Provides efficient O((V + E) log V) time complexity for shortest-path search
   ========================================================================== */

interface PriorityQueueElement<T> {
  item: T;
  priority: number;
}

export class MinPriorityQueue<T> {
  private heap: PriorityQueueElement<T>[] = [];

  push(item: T, priority: number): void {
    this.heap.push({ item, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const min = this.heap[0].item;
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return min;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  get size(): number {
    return this.heap.length;
  }

  private bubbleUp(index: number): void {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      if (this.heap[current].priority >= this.heap[parent].priority) break;
      const temp = this.heap[current];
      this.heap[current] = this.heap[parent];
      this.heap[parent] = temp;
      current = parent;
    }
  }

  private bubbleDown(index: number): void {
    let current = index;
    const length = this.heap.length;

    while (true) {
      const left = 2 * current + 1;
      const right = 2 * current + 2;
      let smallest = current;

      if (left < length && this.heap[left].priority < this.heap[smallest].priority) {
        smallest = left;
      }
      if (right < length && this.heap[right].priority < this.heap[smallest].priority) {
        smallest = right;
      }
      if (smallest === current) break;

      const temp = this.heap[current];
      this.heap[current] = this.heap[smallest];
      this.heap[smallest] = temp;
      current = smallest;
    }
  }
}

/* ==========================================================================
   ROUTING CONFIGURATION & GEOMETRIC UTILITIES
   ========================================================================== */

// Default maximum allowed distance from origin or destination to campus network node
export const DEFAULT_SNAPPING_THRESHOLD_METERS = 150;

// Campus bounding box coordinates
export const CAMPUS_LAT_MIN = 7.33;
export const CAMPUS_LAT_MAX = 7.37;
export const CAMPUS_LNG_MIN = -2.36;
export const CAMPUS_LNG_MAX = -2.32;

// Default walking speed: ~1.3 m/s (~4.7 km/h) for standard walk, ~1.0 m/s for wheelchair/stair-free
export const STANDARD_WALKING_SPEED_MPS = 1.3;
export const ACCESSIBLE_WALKING_SPEED_MPS = 1.0;

// Re-export geodesic distance calculation for backwards compatibility
export const calculateDistanceMeters = calculateGeodesicDistanceMeters;

/**
 * Validates if coordinates lie within UENR campus geographic boundary
 */
export function isCoordinateWithinCampus(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= CAMPUS_LAT_MIN &&
    lat <= CAMPUS_LAT_MAX &&
    lng >= CAMPUS_LNG_MIN &&
    lng <= CAMPUS_LNG_MAX
  );
}

/**
 * Formats distance with sensible rounding:
 * - Under 1,000 meters: displays meters (e.g. "350 m")
 * - 1,000 meters or more: displays kilometers with one decimal (e.g. "1.2 km")
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

/**
 * Formats estimated walking duration in minutes or hours
 */
export function formatWalkingDuration(seconds: number): string {
  const mins = Math.ceil(seconds / 60);
  if (mins < 1) return '< 1 min';
  if (mins === 1) return '1 min';
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
  }
  return `${mins} mins`;
}

/**
 * Calculates initial bearing from point 1 to point 2 in degrees (0 - 360)
 */
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);

  return ((theta * 180) / Math.PI + 360) % 360;
}

/**
 * Computes cardinal or relative turn direction based on two bearings
 */
export function getTurnDirection(b1: number, b2: number): string {
  let diff = (b2 - b1 + 360) % 360;
  if (diff > 180) diff -= 360;

  if (Math.abs(diff) < 25) return 'continue straight';
  if (diff > 25 && diff <= 65) return 'slight right';
  if (diff > 65 && diff <= 120) return 'turn right';
  if (diff > 120) return 'sharp right';
  if (diff < -25 && diff >= -65) return 'slight left';
  if (diff < -65 && diff >= -120) return 'turn left';
  return 'sharp left';
}

/* ==========================================================================
   ACTIVE GRAPH STATE & MANAGEMENT
   ========================================================================== */

let activeGraph: RoutingGraph = { ...INITIAL_ROUTING_GRAPH };

export function getActiveCampusGraph(): RoutingGraph {
  return activeGraph;
}

export function setActiveCampusGraph(graph: RoutingGraph): void {
  activeGraph = graph;
}

// Export backwards-compatible aliases
export const CAMPUS_NODES: Record<string, PedestrianNode> = activeGraph.nodes;
export const CAMPUS_EDGES: PedestrianEdge[] = activeGraph.edges;

/* ==========================================================================
   GRAPH SNAPPING & ACCESS POINT RESOLUTION
   ========================================================================== */

export interface SnappedNodeResult {
  node: PedestrianNode;
  distanceMeters: number;
  isWithinThreshold: boolean;
}

/**
 * Finds the closest verified pedestrian node on campus to the given coordinates
 */
export function findClosestNode(
  lat: number,
  lng: number,
  nodes: Record<string, PedestrianNode> = activeGraph.nodes,
  thresholdMeters: number = DEFAULT_SNAPPING_THRESHOLD_METERS
): SnappedNodeResult | null {
  const nodeList = Object.values(nodes);
  if (nodeList.length === 0) return null;

  let closest: PedestrianNode = nodeList[0];
  let minDistance = Infinity;

  for (const node of nodeList) {
    const dist = calculateGeodesicDistanceMeters(
      lat,
      lng,
      node.coordinates[0],
      node.coordinates[1]
    );
    if (dist < minDistance) {
      minDistance = dist;
      closest = node;
    }
  }

  return {
    node: closest,
    distanceMeters: Math.round(minDistance),
    isWithinThreshold: minDistance <= thresholdMeters,
  };
}

/* ==========================================================================
   GRAPH ADJACENCY & EDGE FILTERING
   ========================================================================== */

export interface GraphAdjacencyItem {
  toNodeId: string;
  edge: PedestrianEdge;
  traversalDistance: number; // in meters (actual walked distance)
  effectiveWeight: number; // in meters, with accessibility weighting when requested
  traversalGeometry: [number, number][]; // ordered vertices from source to target
}

export interface ShortestPathOptions {
  preference?: RoutingPreference;
  algorithm?: 'astar' | 'dijkstra';
  snappingThreshold?: number;
  walkingSpeed?: number;
}

export interface ShortestPathResult {
  pathNodeIds: string[];
  edgesUsed: PedestrianEdge[];
  totalDistanceMeters: number; // exact sum of geodesic walking distances
  routeGeometry: [number, number][];
  isStepFree: boolean;
  hasStairs: boolean;
  stairsFlightCount: number;
  maxSlope: AccessibilitySlope;
  hasUnpavedSegments: boolean;
  surfaceSummary: string;
  warnings: string[];
  routeFound: boolean;
  errorMessage?: string;
  algorithmUsed: 'astar' | 'dijkstra';
}

/**
 * Builds adjacency list for the pedestrian graph with bidirectional traversal
 * and strict filtering for closures or accessibility violations.
 */
export function buildAdjacencyList(
  nodes: Record<string, PedestrianNode>,
  edges: PedestrianEdge[],
  preference: RoutingPreference = 'all'
): Record<string, GraphAdjacencyItem[]> {
  const adj: Record<string, GraphAdjacencyItem[]> = {};

  for (const nodeId of Object.keys(nodes)) {
    adj[nodeId] = [];
  }

  const isAccessibleRequested =
    preference === 'step_free' || preference === 'wheelchair' || preference === 'avoid_stairs';

  for (const edge of edges) {
    // 1. Skip temporarily closed paths
    if (edge.isTemporarilyClosed) continue;

    // 2. Strict accessibility filtering:
    // If user requested step_free, wheelchair, or avoid_stairs, exclude stairs completely
    if (isAccessibleRequested && edge.hasStairs) continue;

    // If user strictly requested step_free or wheelchair, exclude non-step-free paths
    if ((preference === 'step_free' || preference === 'wheelchair') && !edge.isStepFree) {
      continue;
    }

    // Base cost is the actual physical pedestrian distance along the pathway curve
    const baseDistance = edge.distance > 0 ? edge.distance : computeGeometryLength(edge.geometry);
    let effectiveWeight = baseDistance;

    // Accessibility weighting: for wheelchair users, penalize steep slopes or unpaved terrain
    if (preference === 'wheelchair') {
      if (edge.surface === 'dirt' || edge.surface === 'gravel') {
        effectiveWeight *= 2.5;
      }
      if (edge.slope === 'steep') {
        effectiveWeight *= 3.0;
      } else if (edge.slope === 'moderate') {
        effectiveWeight *= 1.25;
      }
    }

    // Geometry forwards (from -> to)
    const forwardGeom: [number, number][] =
      edge.geometry && edge.geometry.length >= 2
        ? edge.geometry
        : [
            nodes[edge.from]?.coordinates || [0, 0],
            nodes[edge.to]?.coordinates || [0, 0],
          ];

    // Geometry reversed (to -> from)
    const reverseGeom: [number, number][] = [...forwardGeom].reverse();

    if (adj[edge.from]) {
      adj[edge.from].push({
        toNodeId: edge.to,
        edge,
        traversalDistance: baseDistance,
        effectiveWeight,
        traversalGeometry: forwardGeom,
      });
    }

    if (adj[edge.to]) {
      adj[edge.to].push({
        toNodeId: edge.from,
        edge,
        traversalDistance: baseDistance,
        effectiveWeight,
        traversalGeometry: reverseGeom,
      });
    }
  }

  return adj;
}

/* ==========================================================================
   SHORTEST-PATH SEARCH: A* & DIJKSTRA
   Strictly optimizes total walking distance in metres.
   ========================================================================== */

/**
 * A* Shortest Path Search over verified pedestrian graph
 * Uses admissible Haversine geodesic straight-line distance as heuristic h(n).
 */
export function astarShortestPath(
  startNodeId: string,
  endNodeId: string,
  options: ShortestPathOptions = {},
  nodes: Record<string, PedestrianNode> = activeGraph.nodes,
  edges: PedestrianEdge[] = activeGraph.edges
): ShortestPathResult {
  const { preference = 'all' } = options;

  if (!nodes[startNodeId] || !nodes[endNodeId]) {
    return {
      pathNodeIds: [],
      edgesUsed: [],
      totalDistanceMeters: 0,
      routeGeometry: [],
      isStepFree: false,
      hasStairs: false,
      stairsFlightCount: 0,
      maxSlope: 'unknown',
      hasUnpavedSegments: false,
      surfaceSummary: 'Unknown',
      warnings: ['Specified origin or destination node does not exist in the campus graph.'],
      routeFound: false,
      errorMessage: 'Invalid node identifier.',
      algorithmUsed: 'astar',
    };
  }

  if (startNodeId === endNodeId) {
    const singleCoord = nodes[startNodeId].coordinates;
    return {
      pathNodeIds: [startNodeId],
      edgesUsed: [],
      totalDistanceMeters: 0,
      routeGeometry: [singleCoord],
      isStepFree: true,
      hasStairs: false,
      stairsFlightCount: 0,
      maxSlope: 'flat',
      hasUnpavedSegments: false,
      surfaceSummary: 'Current Location',
      warnings: [],
      routeFound: true,
      algorithmUsed: 'astar',
    };
  }

  const adj = buildAdjacencyList(nodes, edges, preference);
  const targetCoords = nodes[endNodeId].coordinates;

  // gScore[n]: shortest known physical distance from startNodeId to n
  const gScore: Record<string, number> = {};
  // fScore[n]: gScore[n] + h(n)
  const fScore: Record<string, number> = {};
  const cameFromNode: Record<string, string | null> = {};
  const edgeUsedToReach: Record<string, PedestrianEdge | null> = {};
  const edgeGeometryUsed: Record<string, [number, number][]> = {};

  for (const id of Object.keys(nodes)) {
    gScore[id] = Infinity;
    fScore[id] = Infinity;
    cameFromNode[id] = null;
    edgeUsedToReach[id] = null;
  }

  gScore[startNodeId] = 0;
  const initialH = calculateGeodesicDistanceMeters(
    nodes[startNodeId].coordinates[0],
    nodes[startNodeId].coordinates[1],
    targetCoords[0],
    targetCoords[1]
  );
  fScore[startNodeId] = initialH;

  const openSet = new MinPriorityQueue<string>();
  openSet.push(startNodeId, fScore[startNodeId]);
  const closedSet = new Set<string>();

  while (!openSet.isEmpty()) {
    const currentId = openSet.pop()!;

    if (currentId === endNodeId) {
      break;
    }

    if (closedSet.has(currentId)) continue;
    closedSet.add(currentId);

    const neighbors = adj[currentId] || [];
    for (const neighbor of neighbors) {
      const neighborId = neighbor.toNodeId;
      if (closedSet.has(neighborId)) continue;

      const tentativeG = gScore[currentId] + neighbor.traversalDistance;

      if (tentativeG < gScore[neighborId]) {
        cameFromNode[neighborId] = currentId;
        edgeUsedToReach[neighborId] = neighbor.edge;
        edgeGeometryUsed[neighborId] = neighbor.traversalGeometry;
        gScore[neighborId] = tentativeG;

        const h = calculateGeodesicDistanceMeters(
          nodes[neighborId].coordinates[0],
          nodes[neighborId].coordinates[1],
          targetCoords[0],
          targetCoords[1]
        );

        // A* priority is total estimated distance f(n) = g(n) + h(n)
        fScore[neighborId] = tentativeG + h;
        openSet.push(neighborId, fScore[neighborId]);
      }
    }
  }

  // If destination was not reached
  if (gScore[endNodeId] === Infinity) {
    const isAccessibleSearch =
      preference === 'step_free' || preference === 'wheelchair' || preference === 'avoid_stairs';
    const errorMsg = isAccessibleSearch
      ? 'No verified accessible pedestrian route is currently available between these campus locations.'
      : 'No verified connected pedestrian pathway currently connects these campus locations.';

    return {
      pathNodeIds: [],
      edgesUsed: [],
      totalDistanceMeters: 0,
      routeGeometry: [],
      isStepFree: false,
      hasStairs: false,
      stairsFlightCount: 0,
      maxSlope: 'unknown',
      hasUnpavedSegments: false,
      surfaceSummary: 'Inaccessible',
      warnings: [errorMsg],
      routeFound: false,
      errorMessage: errorMsg,
      algorithmUsed: 'astar',
    };
  }

  // Reconstruct path
  return reconstructPath(
    startNodeId,
    endNodeId,
    nodes,
    cameFromNode,
    edgeUsedToReach,
    edgeGeometryUsed,
    'astar'
  );
}

/**
 * Dijkstra Shortest Path Search over verified pedestrian graph
 * Evaluates nodes strictly by distance from start node using MinPriorityQueue.
 */
export function dijkstraShortestPath(
  startNodeId: string,
  endNodeId: string,
  options: ShortestPathOptions = {},
  nodes: Record<string, PedestrianNode> = activeGraph.nodes,
  edges: PedestrianEdge[] = activeGraph.edges
): ShortestPathResult {
  const { preference = 'all' } = options;

  if (!nodes[startNodeId] || !nodes[endNodeId]) {
    return {
      pathNodeIds: [],
      edgesUsed: [],
      totalDistanceMeters: 0,
      routeGeometry: [],
      isStepFree: false,
      hasStairs: false,
      stairsFlightCount: 0,
      maxSlope: 'unknown',
      hasUnpavedSegments: false,
      surfaceSummary: 'Unknown',
      warnings: ['Specified origin or destination node does not exist in the campus graph.'],
      routeFound: false,
      errorMessage: 'Invalid node identifier.',
      algorithmUsed: 'dijkstra',
    };
  }

  if (startNodeId === endNodeId) {
    const singleCoord = nodes[startNodeId].coordinates;
    return {
      pathNodeIds: [startNodeId],
      edgesUsed: [],
      totalDistanceMeters: 0,
      routeGeometry: [singleCoord],
      isStepFree: true,
      hasStairs: false,
      stairsFlightCount: 0,
      maxSlope: 'flat',
      hasUnpavedSegments: false,
      surfaceSummary: 'Current Location',
      warnings: [],
      routeFound: true,
      algorithmUsed: 'dijkstra',
    };
  }

  const adj = buildAdjacencyList(nodes, edges, preference);

  const distances: Record<string, number> = {};
  const cameFromNode: Record<string, string | null> = {};
  const edgeUsedToReach: Record<string, PedestrianEdge | null> = {};
  const edgeGeometryUsed: Record<string, [number, number][]> = {};

  for (const id of Object.keys(nodes)) {
    distances[id] = Infinity;
    cameFromNode[id] = null;
    edgeUsedToReach[id] = null;
  }

  distances[startNodeId] = 0;
  const pq = new MinPriorityQueue<string>();
  pq.push(startNodeId, 0);

  const settled = new Set<string>();

  while (!pq.isEmpty()) {
    const currentId = pq.pop()!;

    if (currentId === endNodeId) break;
    if (settled.has(currentId)) continue;
    settled.add(currentId);

    const neighbors = adj[currentId] || [];
    for (const neighbor of neighbors) {
      const neighborId = neighbor.toNodeId;
      if (settled.has(neighborId)) continue;

      const alt = distances[currentId] + neighbor.traversalDistance;
      if (alt < distances[neighborId]) {
        distances[neighborId] = alt;
        cameFromNode[neighborId] = currentId;
        edgeUsedToReach[neighborId] = neighbor.edge;
        edgeGeometryUsed[neighborId] = neighbor.traversalGeometry;
        pq.push(neighborId, alt);
      }
    }
  }

  if (distances[endNodeId] === Infinity) {
    const isAccessibleSearch =
      preference === 'step_free' || preference === 'wheelchair' || preference === 'avoid_stairs';
    const errorMsg = isAccessibleSearch
      ? 'No verified accessible pedestrian route is currently available between these campus locations.'
      : 'No verified connected pedestrian pathway currently connects these campus locations.';

    return {
      pathNodeIds: [],
      edgesUsed: [],
      totalDistanceMeters: 0,
      routeGeometry: [],
      isStepFree: false,
      hasStairs: false,
      stairsFlightCount: 0,
      maxSlope: 'unknown',
      hasUnpavedSegments: false,
      surfaceSummary: 'Inaccessible',
      warnings: [errorMsg],
      routeFound: false,
      errorMessage: errorMsg,
      algorithmUsed: 'dijkstra',
    };
  }

  return reconstructPath(
    startNodeId,
    endNodeId,
    nodes,
    cameFromNode,
    edgeUsedToReach,
    edgeGeometryUsed,
    'dijkstra'
  );
}

/**
 * Reconstructs ordered node sequence, edge list, geometry, distance, and accessibility metrics
 */
function reconstructPath(
  startNodeId: string,
  endNodeId: string,
  nodes: Record<string, PedestrianNode>,
  cameFromNode: Record<string, string | null>,
  edgeUsedToReach: Record<string, PedestrianEdge | null>,
  edgeGeometryUsed: Record<string, [number, number][]>,
  algorithmUsed: 'astar' | 'dijkstra'
): ShortestPathResult {
  const pathNodeIds: string[] = [];
  const edgesUsed: PedestrianEdge[] = [];
  const fullGeometry: [number, number][] = [];

  let curr: string | null = endNodeId;
  const segments: [number, number][][] = [];

  while (curr && curr !== startNodeId) {
    pathNodeIds.unshift(curr);
    const edge = edgeUsedToReach[curr];
    const segmentGeom = edgeGeometryUsed[curr];
    if (edge) {
      edgesUsed.unshift(edge);
    }
    if (segmentGeom) {
      segments.unshift(segmentGeom);
    }
    curr = cameFromNode[curr];
  }

  if (curr === startNodeId) {
    pathNodeIds.unshift(startNodeId);
  }

  // Assemble continuous polyline geometry without duplicate consecutive coordinates
  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s];
    for (let p = 0; p < seg.length; p++) {
      const pt = seg[p];
      if (
        fullGeometry.length === 0 ||
        calculateGeodesicDistanceMeters(
          pt[0],
          pt[1],
          fullGeometry[fullGeometry.length - 1][0],
          fullGeometry[fullGeometry.length - 1][1]
        ) > 1
      ) {
        fullGeometry.push(pt);
      }
    }
  }

  if (fullGeometry.length === 0 && nodes[startNodeId]) {
    fullGeometry.push(nodes[startNodeId].coordinates);
  }

  // Calculate exact total distance from route segments
  const sumEdges = edgesUsed.reduce((acc, e) => acc + (e.distance || 0), 0);
  const totalDistanceMeters = sumEdges > 0 ? sumEdges : computeGeometryLength(fullGeometry);

  // Evaluate accessibility metrics
  let hasStairs = false;
  let isStepFree = true;
  let stairsFlightCount = 0;
  let hasUnpavedSegments = false;
  let maxSlope: AccessibilitySlope = 'flat';
  const warnings: string[] = [];

  for (const edge of edgesUsed) {
    if (edge.hasStairs) {
      hasStairs = true;
      isStepFree = false;
      stairsFlightCount += 1;
      warnings.push(`Stairs present along ${edge.pathwayName} (${edge.stairsCount || 10}+ steps).`);
    }
    if (!edge.isStepFree) {
      isStepFree = false;
    }
    if (edge.surface === 'dirt' || edge.surface === 'gravel') {
      hasUnpavedSegments = true;
      warnings.push(`Unpaved surface along ${edge.pathwayName}.`);
    }
    if (edge.slope === 'steep') {
      maxSlope = 'steep';
      warnings.push(`Steep incline along ${edge.pathwayName}.`);
    } else if (edge.slope === 'moderate' && maxSlope !== 'steep') {
      maxSlope = 'moderate';
    } else if (edge.slope === 'gentle' && maxSlope === 'flat') {
      maxSlope = 'gentle';
    }
  }

  let surfaceSummary = '100% Paved & Step-Free (Wheelchair Friendly)';
  if (hasStairs) {
    surfaceSummary = `Contains ${stairsFlightCount} flight${stairsFlightCount > 1 ? 's' : ''} of stairs`;
  } else if (hasUnpavedSegments) {
    surfaceSummary = 'Paved with unpaved section';
  } else if (maxSlope === 'steep') {
    surfaceSummary = 'Paved with steep slope';
  } else if (maxSlope === 'moderate') {
    surfaceSummary = 'Paved with moderate incline';
  }

  return {
    pathNodeIds,
    edgesUsed,
    totalDistanceMeters,
    routeGeometry: fullGeometry,
    isStepFree,
    hasStairs,
    stairsFlightCount,
    maxSlope,
    hasUnpavedSegments,
    surfaceSummary,
    warnings: Array.from(new Set(warnings)),
    routeFound: true,
    algorithmUsed,
  };
}

/* ==========================================================================
   PRIMARY PEDESTRIAN ROUTING SERVICE API
   ========================================================================== */

/**
 * Calculates the shortest valid walking route between any two geographic coordinates
 * on the UENR campus using connected pedestrian paths.
 *
 * Optimizes total walking distance in metres.
 */
export async function calculatePedestrianRoute(
  start: { name: string; coordinates: [number, number] },
  end: { name: string; coordinates: [number, number] },
  options: ShortestPathOptions = {}
): Promise<RouteInfo> {
  const {
    preference = 'all',
    algorithm = 'astar',
    snappingThreshold = DEFAULT_SNAPPING_THRESHOLD_METERS,
    walkingSpeed,
  } = options;

  const [startLat, startLng] = start.coordinates;
  const [endLat, endLng] = end.coordinates;

  // 1. Validate coordinate presence and numeric validity
  if (
    typeof startLat !== 'number' ||
    typeof startLng !== 'number' ||
    typeof endLat !== 'number' ||
    typeof endLng !== 'number' ||
    isNaN(startLat) ||
    isNaN(startLng) ||
    isNaN(endLat) ||
    isNaN(endLng)
  ) {
    return createErrorRoute(
      start,
      end,
      'invalid_coordinates',
      'Coordinates are missing or malformed. Please select a valid point on the campus map.'
    );
  }

  // 2. Validate campus bounding coordinates
  const isStartInCampus = isCoordinateWithinCampus(startLat, startLng);
  const isEndInCampus = isCoordinateWithinCampus(endLat, endLng);

  if (!isStartInCampus || !isEndInCampus) {
    return createErrorRoute(
      start,
      end,
      'out_of_bounds',
      'The specified location is outside the verified UENR Sunyani campus boundary. Please select a point within the university campus.'
    );
  }

  // 3. Handle identical or zero-distance coordinates
  const directDistance = calculateGeodesicDistanceMeters(startLat, startLng, endLat, endLng);
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
      accessibility: {
        isStepFree: true,
        hasStairs: false,
        stairsFlightCount: 0,
        maxSlope: 'flat',
        hasUnpavedSegments: false,
        isVerifiedAccessible: true,
        accessibilityWarnings: [],
        surfaceSummary: 'Current location',
      },
      preferenceUsed: preference,
      algorithmUsed: algorithm,
      startPoint: start,
      endPoint: end,
    };
  }

  // 4. Snapping: Find closest valid pedestrian network nodes
  const startSnap = findClosestNode(startLat, startLng, activeGraph.nodes, snappingThreshold);
  const endSnap = findClosestNode(endLat, endLng, activeGraph.nodes, snappingThreshold);

  if (!startSnap || !endSnap) {
    return createErrorRoute(
      start,
      end,
      'no_path_found',
      'Pedestrian walkway data is currently unavailable on this campus sector.'
    );
  }

  if (!startSnap.isWithinThreshold || !endSnap.isWithinThreshold) {
    const offPoint = !startSnap.isWithinThreshold ? start.name : end.name;
    const offDist = !startSnap.isWithinThreshold ? startSnap.distanceMeters : endSnap.distanceMeters;
    return createErrorRoute(
      start,
      end,
      'outside_snapping_threshold',
      `"${offPoint}" is ${offDist} m away from the nearest campus pedestrian path (maximum permitted snapping threshold: ${snappingThreshold} m). Please select an on-campus building or entrance.`
    );
  }

  const startNode = startSnap.node;
  const endNode = endSnap.node;

  // 5. Execute shortest path algorithm over the verified campus graph
  const pathResult =
    algorithm === 'dijkstra'
      ? dijkstraShortestPath(startNode.id, endNode.id, { preference }, activeGraph.nodes, activeGraph.edges)
      : astarShortestPath(startNode.id, endNode.id, { preference }, activeGraph.nodes, activeGraph.edges);

  if (!pathResult.routeFound) {
    const isAccessiblePref =
      preference === 'step_free' || preference === 'wheelchair' || preference === 'avoid_stairs';
    return {
      coordinates: [
        [startLat, startLng],
        [endLat, endLng],
      ],
      distance: 0,
      duration: 0,
      steps: [
        {
          instruction: isAccessiblePref
            ? 'No verified step-free accessible route found between these locations.'
            : 'No connected pedestrian pathway found between these locations.',
          distance: 0,
          duration: 0,
          location: [startLat, startLng],
          type: 'arrive',
        },
      ],
      noAccessibleRouteFound: isAccessiblePref,
      error: {
        type: isAccessiblePref ? 'inaccessible' : 'no_path_found',
        message: pathResult.errorMessage || 'No valid walking path exists between these locations.',
      },
      accessibility: {
        isStepFree: false,
        hasStairs: false,
        stairsFlightCount: 0,
        maxSlope: 'unknown',
        hasUnpavedSegments: false,
        isVerifiedAccessible: false,
        accessibilityWarnings: pathResult.warnings,
        surfaceSummary: 'Inaccessible',
      },
      preferenceUsed: preference,
      algorithmUsed: algorithm,
      startPoint: start,
      endPoint: end,
    };
  }

  // 6. Connect origin and destination approaches to the network
  const finalPolyline: [number, number][] = [];

  // Approach from origin to startNode (only if origin is offset from node)
  if (startSnap.distanceMeters > 3) {
    finalPolyline.push([startLat, startLng]);
  }

  // Network path geometry
  for (const pt of pathResult.routeGeometry) {
    if (
      finalPolyline.length === 0 ||
      calculateGeodesicDistanceMeters(
        pt[0],
        pt[1],
        finalPolyline[finalPolyline.length - 1][0],
        finalPolyline[finalPolyline.length - 1][1]
      ) > 1
    ) {
      finalPolyline.push(pt);
    }
  }

  // Final egress from endNode to destination
  if (endSnap.distanceMeters > 3) {
    if (
      calculateGeodesicDistanceMeters(
        endLat,
        endLng,
        finalPolyline[finalPolyline.length - 1][0],
        finalPolyline[finalPolyline.length - 1][1]
      ) > 1
    ) {
      finalPolyline.push([endLat, endLng]);
    }
  }

  // 7. Calculate exact total walkable distance in meters
  const totalWalkDistance = computeGeometryLength(finalPolyline);

  // 8. Walking time estimate (clearly calculated from walking speed)
  const effectiveSpeed =
    walkingSpeed ||
    (preference === 'wheelchair' || preference === 'step_free'
      ? ACCESSIBLE_WALKING_SPEED_MPS
      : STANDARD_WALKING_SPEED_MPS);
  const calculatedDuration = Math.round(totalWalkDistance / effectiveSpeed);

  const isEstimated = startSnap.distanceMeters > 40 || endSnap.distanceMeters > 40;

  // 9. Generate step-by-step navigation instructions
  const steps: RouteStep[] = [];

  // Depart step
  const firstLegDist =
    finalPolyline.length >= 2
      ? calculateGeodesicDistanceMeters(
          finalPolyline[0][0],
          finalPolyline[0][1],
          finalPolyline[1][0],
          finalPolyline[1][1]
        )
      : 0;

  steps.push({
    instruction:
      startSnap.distanceMeters > 30
        ? `Start from ${start.name} and follow approach walkway towards ${startNode.name}`
        : `Start walking from ${startNode.name}`,
    distance: Math.round(firstLegDist),
    duration: Math.round(firstLegDist / effectiveSpeed),
    location: finalPolyline[0],
    type: 'depart',
    accessibilityNote:
      startSnap.distanceMeters > 30 ? 'Initial approach path from building entrance' : undefined,
  });

  // Intermediate turns along edges
  for (let i = 0; i < pathResult.edgesUsed.length; i++) {
    const edge = pathResult.edgesUsed[i];
    const toNode = activeGraph.nodes[pathResult.pathNodeIds[i + 1]];
    const edgeDist = edge.distance;

    let instruction = `Continue along ${edge.pathwayName}`;
    if (toNode) {
      instruction = `Walk along ${edge.pathwayName} towards ${toNode.name}`;
    }

    let accNote = edge.notes;
    if (edge.hasStairs) {
      accNote = `Contains stairs flight (${edge.stairsCount || 10}+ steps)`;
    } else if (edge.hasRamp) {
      accNote = 'Gradual wheelchair ramp';
    }

    steps.push({
      instruction,
      distance: Math.round(edgeDist),
      duration: Math.round(edgeDist / effectiveSpeed),
      location: activeGraph.nodes[pathResult.pathNodeIds[i]]?.coordinates || finalPolyline[0],
      type: 'turn',
      pathwayName: edge.pathwayName,
      accessibilityNote: accNote,
    });
  }

  // Arrive step
  steps.push({
    instruction: `Arrive at destination: ${end.name}`,
    distance: 0,
    duration: 0,
    location: finalPolyline[finalPolyline.length - 1],
    type: 'arrive',
  });

  return {
    coordinates: finalPolyline,
    distance: totalWalkDistance,
    duration: calculatedDuration,
    steps,
    isEstimatedRoute: isEstimated,
    routeNotice: isEstimated
      ? 'Route includes approach segments from building entrance or courtyard.'
      : undefined,
    accessibility: {
      isStepFree: pathResult.isStepFree,
      hasStairs: pathResult.hasStairs,
      stairsFlightCount: pathResult.stairsFlightCount,
      maxSlope: pathResult.maxSlope,
      hasUnpavedSegments: pathResult.hasUnpavedSegments,
      isVerifiedAccessible: pathResult.isStepFree && !pathResult.hasStairs,
      accessibilityWarnings: pathResult.warnings,
      surfaceSummary: pathResult.surfaceSummary,
    },
    preferenceUsed: preference,
    algorithmUsed: pathResult.algorithmUsed,
    startPoint: start,
    endPoint: end,
  };
}

/**
 * Creates a structured error route object with honest notification
 */
function createErrorRoute(
  start: { name: string; coordinates: [number, number] },
  end: { name: string; coordinates: [number, number] },
  type: 'out_of_bounds' | 'outside_snapping_threshold' | 'no_path_found' | 'inaccessible' | 'invalid_coordinates',
  message: string
): RouteInfo {
  return {
    coordinates: [],
    distance: 0,
    duration: 0,
    steps: [
      {
        instruction: message,
        distance: 0,
        duration: 0,
        location: start.coordinates,
        type: 'arrive',
      },
    ],
    error: {
      type,
      message,
    },
    accessibility: {
      isStepFree: false,
      hasStairs: false,
      stairsFlightCount: 0,
      maxSlope: 'unknown',
      hasUnpavedSegments: false,
      isVerifiedAccessible: false,
      accessibilityWarnings: [message],
      surfaceSummary: 'Unavailable',
    },
    startPoint: start,
    endPoint: end,
  };
}

/* ==========================================================================
   ADMINISTRATIVE GRAPH VALIDATION UTILITIES
   ========================================================================== */

export interface GraphConnectivityReport {
  isValid: boolean;
  totalNodes: number;
  totalEdges: number;
  isolatedNodeIds: string[];
  connectedComponentCount: number;
  summary: string;
}

/**
 * Validates graph connectivity, checks for disconnected components and isolated nodes
 */
export function validateGraphConnectivity(
  nodes: Record<string, PedestrianNode> = activeGraph.nodes,
  edges: PedestrianEdge[] = activeGraph.edges
): GraphConnectivityReport {
  const nodeIds = Object.keys(nodes);
  const totalNodes = nodeIds.length;
  const totalEdges = edges.length;

  if (totalNodes === 0) {
    return {
      isValid: false,
      totalNodes: 0,
      totalEdges: 0,
      isolatedNodeIds: [],
      connectedComponentCount: 0,
      summary: 'Graph is empty.',
    };
  }

  // Build undirected adjacency
  const adj: Record<string, string[]> = {};
  for (const id of nodeIds) {
    adj[id] = [];
  }

  for (const edge of edges) {
    if (adj[edge.from] && adj[edge.to]) {
      adj[edge.from].push(edge.to);
      adj[edge.to].push(edge.from);
    }
  }

  // Find isolated nodes (0 edges connected)
  const isolatedNodeIds = nodeIds.filter((id) => adj[id].length === 0);

  // Count connected components using BFS
  const visited = new Set<string>();
  let componentCount = 0;

  for (const id of nodeIds) {
    if (!visited.has(id)) {
      componentCount++;
      const queue = [id];
      visited.add(id);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        for (const neighbor of adj[curr] || []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
    }
  }

  const isValid = isolatedNodeIds.length === 0 && componentCount === 1;

  let summary = `Graph has ${totalNodes} verified nodes and ${totalEdges} paths. Complete connectivity verified.`;
  if (!isValid) {
    summary = `Warning: ${componentCount} separate network components detected. ${isolatedNodeIds.length} isolated nodes found.`;
  }

  return {
    isValid,
    totalNodes,
    totalEdges,
    isolatedNodeIds,
    connectedComponentCount: componentCount,
    summary,
  };
}
