export type CampusCategory =
  | 'lecture_hall'
  | 'laboratory'
  | 'hostel'
  | 'faculty_dept'
  | 'library'
  | 'cafeteria'
  | 'admin'
  | 'student_services'
  | 'health'
  | 'entrance'
  | 'sports_recreation'
  | 'auditorium';

export type VerificationStatus = 'verified' | 'unverified' | 'needs_review' | 'pending_verification';

export interface CampusLocation {
  id: string;
  name: string;
  shortCode: string;
  aliases: string[];
  category: CampusCategory;
  lat: number;
  lng: number;
  description: string;
  image?: string;
  openingHours?: string;
  accessibility: string;
  verificationStatus: VerificationStatus;
  lastVerified: string;
  facilities: string[];
  floorCount?: number;
  contactPhone?: string;
  isCustomAdded?: boolean;
  source?: string;
  osmId?: string;
  verifiedBy?: string;
  pedestrianAccessNodeId?: string;
}

export type NavigationStatus =
  | 'idle'
  | 'tracking'
  | 'on_route'
  | 'off_route'
  | 'recalculating'
  | 'arrived'
  | 'paused'
  | 'error';

export type ManeuverType =
  | 'depart'
  | 'straight'
  | 'slight_left'
  | 'turn_left'
  | 'slight_right'
  | 'turn_right'
  | 'u_turn'
  | 'arrive';

export interface LiveNavigationProgress {
  status: NavigationStatus;
  userPosition: [number, number];
  userAccuracy: number;
  userHeading?: number | null;
  distanceTraveled: number; // in meters
  distanceRemaining: number; // in meters
  estimatedTimeRemaining: number; // in seconds
  percentComplete: number; // 0 - 100
  activeStepIndex: number;
  currentInstruction: string;
  nextManeuver: ManeuverType;
  distanceToNextTurn: number; // in meters
  crossTrackDistance: number; // in meters
  isOffRoute: boolean;
  hasArrived: boolean;
  completedCoordinates: [number, number][];
  remainingCoordinates: [number, number][];
}


export interface CampusReport {
  id: string;
  locationId?: string;
  locationName: string;
  issueType:
    | 'missing_location'
    | 'wrong_pin'
    | 'wrong_name'
    | 'blocked_path'
    | 'incorrect_directions'
    | 'other';
  description: string;
  reporterRole: 'student' | 'lecturer' | 'staff' | 'visitor';
  date: string;
  status: 'pending' | 'resolved' | 'dismissed';
}

export type NoticeCategory =
  | 'General'
  | 'Academic'
  | 'Events'
  | 'Maintenance'
  | 'Safety'
  | 'Emergency';

export type NoticePriority = 'Normal' | 'Important' | 'Urgent';

export type NoticeStatus = 'draft' | 'scheduled' | 'published' | 'archived';

export interface CampusNotice {
  id: string;
  title: string;
  message: string;
  category: NoticeCategory;
  priority: NoticePriority;
  status: NoticeStatus;
  type?: 'warning' | 'info' | 'critical' | 'event'; // Legacy compatibility
  affectedLocationId?: string;
  locationName?: string;
  postedDate: string;
  publishedAt?: string;
  scheduledAt?: string;
  expiresAt?: string;
  startTime?: string;
  endTime?: string;
  authorUid?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type AccessibilitySurface = 'paved' | 'asphalt' | 'concrete' | 'tiles' | 'dirt' | 'gravel' | 'unknown';
export type AccessibilitySlope = 'flat' | 'gentle' | 'moderate' | 'steep' | 'unknown';
export type RoutingPreference = 'all' | 'step_free' | 'wheelchair' | 'avoid_stairs';

export interface PedestrianNode {
  id: string;
  name: string;
  coordinates: [number, number]; // [lat, lng]
  category?: 'entrance' | 'junction' | 'building_access' | 'landmark';
  elevation?: number;
  source?: string;
  verificationStatus?: 'verified' | 'unverified' | 'needs_review';
  lastVerified?: string;
}

export interface PedestrianEdge {
  id: string;
  from: string;
  to: string;
  pathwayName: string;
  distance: number; // in meters (sum of geodesic distances between geometry vertices)
  geometry: [number, number][]; // actual vertices along the path curve
  isStepFree: boolean;
  hasStairs: boolean;
  stairsCount?: number;
  hasRamp?: boolean;
  surface: AccessibilitySurface;
  slope: AccessibilitySlope;
  isTemporarilyClosed?: boolean;
  closureReason?: string;
  source?: string;
  verificationStatus: 'verified' | 'unverified' | 'needs_review';
  lastVerified?: string;
  notes?: string;
}

export interface RoutingGraph {
  nodes: Record<string, PedestrianNode>;
  edges: PedestrianEdge[];
  version: string;
  lastUpdated: string;
}

export interface RouteAccessibilityInfo {
  isStepFree: boolean;
  hasStairs: boolean;
  stairsFlightCount?: number;
  maxSlope: AccessibilitySlope;
  hasUnpavedSegments: boolean;
  isVerifiedAccessible: boolean;
  accessibilityWarnings: string[];
  routeNotice?: string;
  surfaceSummary: string;
}

export interface RouteStep {
  instruction: string;
  distance: number; // in meters
  duration: number; // in seconds
  location: [number, number]; // [lat, lng]
  modifier?: string;
  type?: string;
  accessibilityNote?: string;
  pathwayName?: string;
}

export interface RouteCalculationError {
  type: 'out_of_bounds' | 'outside_snapping_threshold' | 'no_path_found' | 'inaccessible' | 'invalid_coordinates';
  message: string;
  details?: string;
}

export interface RouteInfo {
  coordinates: [number, number][]; // [lat, lng]
  distance: number; // in meters
  duration: number; // in seconds
  steps: RouteStep[];
  isEstimatedRoute?: boolean;
  routeNotice?: string;
  accessibility?: RouteAccessibilityInfo;
  preferenceUsed?: RoutingPreference;
  algorithmUsed?: 'astar' | 'dijkstra';
  noAccessibleRouteFound?: boolean;
  error?: RouteCalculationError;
  startPoint: {
    name: string;
    coordinates: [number, number];
  };
  endPoint: {
    name: string;
    coordinates: [number, number];
  };
}

export interface CategoryMeta {
  id: CampusCategory;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  iconName: string;
}

