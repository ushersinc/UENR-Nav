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

export type VerificationStatus = 'verified' | 'pending_verification';

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
}

export interface RouteStep {
  instruction: string;
  distance: number; // in meters
  duration: number; // in seconds
  location: [number, number]; // [lat, lng]
  modifier?: string;
  type?: string;
}

export interface RouteInfo {
  coordinates: [number, number][]; // [lat, lng]
  distance: number; // in meters
  duration: number; // in seconds
  steps: RouteStep[];
  startPoint: {
    name: string;
    coordinates: [number, number];
  };
  endPoint: {
    name: string;
    coordinates: [number, number];
  };
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

export interface CampusNotice {
  id: string;
  title: string;
  message: string;
  type: 'warning' | 'info' | 'critical' | 'event';
  affectedLocationId?: string;
  postedDate: string;
  active: boolean;
}

export interface CategoryMeta {
  id: CampusCategory;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  iconName: string;
}
