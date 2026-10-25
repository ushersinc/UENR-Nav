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

export type AccessibilitySurface = 'paved' | 'asphalt' | 'concrete' | 'dirt' | 'unknown';
export type AccessibilitySlope = 'flat' | 'moderate' | 'steep' | 'unknown';
export type RoutingPreference = 'all' | 'step_free' | 'wheelchair' | 'avoid_stairs';

export interface RouteAccessibilityInfo {
  isStepFree: boolean;
  hasStairs: boolean;
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
  noAccessibleRouteFound?: boolean;
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

