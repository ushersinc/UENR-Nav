import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { INITIAL_CAMPUS_LOCATIONS } from './src/data/campusLocations';
import {
  CampusLocation,
  CampusNotice,
  CampusReport,
  PedestrianNode,
  PedestrianEdge,
} from './src/types/campus';
import {
  VERIFIED_CAMPUS_NODES,
  VERIFIED_CAMPUS_EDGES,
  calculateGeodesicDistanceMeters,
} from './src/data/pedestrianGraphData';
import configJson from './firebase-applet-config.json';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Initialize Firebase Admin SDK
if (!getApps().length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      initializeApp({
        credential: cert(serviceAccount),
        projectId: configJson.projectId,
      });
    } else {
      initializeApp({
        projectId: configJson.projectId,
      });
    }
    console.log(`Firebase Admin initialized for project: ${configJson.projectId}`);
  } catch (err) {
    console.warn('Firebase Admin SDK initialization notice:', err);
  }
}

// Cryptographic Secret for Admin Session Signing
const SESSION_SECRET = process.env.SESSION_SECRET || 'uenr-nav-secure-session-key-2026-prod';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@uenr.edu.gh';
const RUNTIME_ADMIN_EMAIL = 'ushersincoperated@gmail.com';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH
  ? process.env.ADMIN_PASSWORD_HASH
  : process.env.ADMIN_PASSWORD
  ? crypto.createHash('sha256').update(process.env.ADMIN_PASSWORD).digest('hex')
  : null;

// In-Memory Data Stores
let campusLocations: CampusLocation[] = [...INITIAL_CAMPUS_LOCATIONS];
let campusNodes: Record<string, PedestrianNode> = { ...VERIFIED_CAMPUS_NODES };
let campusEdges: PedestrianEdge[] = [...VERIFIED_CAMPUS_EDGES];

let campusReports: CampusReport[] = [
  {
    id: 'rep-1',
    locationName: 'GETFund Hostel',
    issueType: 'wrong_pin',
    description: 'Hostel entrance pin is 20 meters west of actual security booth.',
    reporterRole: 'student',
    date: '2026-10-20',
    status: 'pending',
  },
  {
    id: 'rep-2',
    locationName: 'Odum Block',
    issueType: 'blocked_path',
    description: 'Construction equipment blocking the southern wheelchair ramp.',
    reporterRole: 'student',
    date: '2026-10-22',
    status: 'resolved',
  },
];

let campusNotices: CampusNotice[] = [
  {
    id: 'notice-1',
    title: 'Matriculation Ceremony at BoG Auditorium',
    message:
      'Bank of Ghana Auditorium is reserved today for the 2026 Matriculation Ceremony. Please use the West walkway and follow security instructions.',
    category: 'Events',
    priority: 'Important',
    status: 'published',
    type: 'event',
    postedDate: 'Today, 8:00 AM',
    publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    affectedLocationId: 'bog-auditorium',
    locationName: 'Bank of Ghana Auditorium',
    active: true,
    authorUid: 'admin-uenr-sys',
  },
  {
    id: 'notice-2',
    title: 'Pedestrian Walkway Paving near Odum Block',
    message:
      'Pathway renovation in progress between Odum Block and LT Block. Caution advised; detour available via School Field avenue. Step-free wheelchair access maintained along Administration West Avenue.',
    category: 'Maintenance',
    priority: 'Normal',
    status: 'published',
    type: 'warning',
    postedDate: 'Yesterday',
    publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    affectedLocationId: 'odum-block',
    locationName: 'Odum Block',
    active: true,
    authorUid: 'admin-uenr-sys',
  },
  {
    id: 'notice-3',
    title: 'Free Health Screening at UENR Clinic',
    message:
      'Annual health and wellness checkups for all freshers and continuing students at the UENR Health Clinic. 24/7 outpatient services remain open.',
    category: 'Safety',
    priority: 'Normal',
    status: 'published',
    type: 'info',
    postedDate: '2 days ago',
    publishedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    affectedLocationId: 'school-clinic',
    locationName: 'School Clinic',
    active: true,
    authorUid: 'admin-uenr-sys',
  },
];

// Security & Parsing Middlewares
app.use(express.json({ limit: '1mb' }));

// Custom Rate Limiting in memory
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const rateLimitStore = new Map<string, RateLimitBucket>();

function rateLimiter(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let bucket = rateLimitStore.get(ip);

    if (!bucket || bucket.resetAt < now) {
      bucket = { count: 1, resetAt: now + windowMs };
      rateLimitStore.set(ip, bucket);
      return next();
    }

    bucket.count++;
    if (bucket.count > maxRequests) {
      const waitSec = Math.ceil((bucket.resetAt - now) / 1000);
      return res.status(429).json({
        error: `Rate limit exceeded. Please wait ${waitSec} seconds before retrying.`,
      });
    }

    next();
  };
}

// Security Headers Middleware
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Cryptographic Token Generation & Verification
function generateAdminToken(email: string): string {
  const payload = JSON.stringify({ email, timestamp: Date.now() });
  const b64 = Buffer.from(payload).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(b64).digest('base64url');
  return `${b64}.${signature}`;
}

function verifyAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [b64, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(b64).digest('base64url');
  if (signature !== expectedSig) return false;

  try {
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    // Token valid for 24 hours
    if (Date.now() - payload.timestamp > 24 * 60 * 60 * 1000) {
      return false;
    }
    return payload.email === ADMIN_EMAIL;
  } catch {
    return false;
  }
}

// Authentication Guard Middleware (Requires Server-Provisioned Admin Custom Claims)
async function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized. Admin ID token required.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const auth = getAuth();
    const decoded = await auth.verifyIdToken(token);

    // Explicit admin custom claim or authorized runtime administrator
    const isRuntimeAdmin =
      decoded.email?.toLowerCase() === RUNTIME_ADMIN_EMAIL.toLowerCase() ||
      decoded.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    if (isRuntimeAdmin && !decoded.admin) {
      try {
        await auth.setCustomUserClaims(decoded.uid, { admin: true, role: 'admin' });
      } catch (claimErr) {
        console.warn('Set claims notice:', claimErr);
      }
    }

    const hasAdminCustomClaim = decoded.admin === true || decoded.role === 'admin' || isRuntimeAdmin;

    if (hasAdminCustomClaim) {
      (req as any).user = decoded;
      return next();
    }

    return res.status(403).json({
      error: 'Forbidden. Verified administrator custom claim required on your account.',
    });
  } catch (err: any) {
    return res.status(401).json({ error: 'Invalid, expired, or malformed authentication token.' });
  }
}

// Input Sanitization Helper
function sanitizeString(str: any): string {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim();
}

// Coordinate Bounds Validation for UENR Campus
function isValidCampusCoordinate(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= 7.33 &&
    lat <= 7.37 &&
    lng >= -2.36 &&
    lng <= -2.32
  );
}

/* ==========================================================================
   API ROUTES
   ========================================================================== */

// 1. Health & Status
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'UENR Nav Core API',
    campus: 'University of Energy and Natural Resources (Sunyani)',
    timestamp: new Date().toISOString(),
  });
});

// 2. Authentication Login (Rate Limited: max 5 tries per 10 mins)
app.post('/api/auth/login', rateLimiter(5, 10 * 60 * 1000), (req, res) => {
  if (!ADMIN_PASSWORD_HASH) {
    return res.status(403).json({
      error: 'Legacy password login is disabled. Please authenticate using Firebase Authentication.',
    });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const incomingHash = crypto.createHash('sha256').update(String(password)).digest('hex');

  // Timing-safe comparison to prevent side-channel timing attacks
  const isEmailMatch = email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const isPassMatch =
    incomingHash.length === ADMIN_PASSWORD_HASH.length &&
    crypto.timingSafeEqual(Buffer.from(incomingHash), Buffer.from(ADMIN_PASSWORD_HASH));

  if (!isEmailMatch || !isPassMatch) {
    return res.status(401).json({ error: 'Invalid administrator credentials.' });
  }

  const token = generateAdminToken(email);
  return res.json({
    token,
    user: {
      email: ADMIN_EMAIL,
      role: 'campus_admin',
    },
  });
});

// 3. Verify Token
app.get('/api/auth/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
  const isValid = verifyAdminToken(token);
  res.json({ valid: isValid, email: isValid ? ADMIN_EMAIL : null });
});

// 4. Locations Endpoints
app.get('/api/locations', (_req, res) => {
  res.json(campusLocations);
});

app.post('/api/locations', requireAdminAuth, (req, res) => {
  const {
    name,
    shortCode,
    aliases,
    category,
    lat,
    lng,
    description,
    openingHours,
    accessibility,
    verificationStatus,
    facilities,
  } = req.body;

  if (!name || typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'Name, valid latitude, and longitude are required.' });
  }

  if (!isValidCampusCoordinate(lat, lng)) {
    return res.status(400).json({
      error:
        'Coordinates are outside the UENR campus boundary (Latitude: 7.33 - 7.37, Longitude: -2.36 - -2.32).',
    });
  }

  const newLocation: CampusLocation = {
    id: `loc-${Date.now()}`,
    name: sanitizeString(name),
    shortCode: sanitizeString(shortCode) || 'CAMP',
    aliases: Array.isArray(aliases) ? aliases.map(sanitizeString) : [],
    category: category || 'lecture_hall',
    lat,
    lng,
    description: sanitizeString(description),
    openingHours: sanitizeString(openingHours),
    accessibility: sanitizeString(accessibility) || 'Standard campus access',
    verificationStatus:
      verificationStatus === 'needs_review' ||
      verificationStatus === 'unverified' ||
      verificationStatus === 'pending_verification'
        ? verificationStatus
        : 'verified',
    source: sanitizeString(req.body.source) || 'Admin Entry',
    osmId: sanitizeString(req.body.osmId) || undefined,
    lastVerified: new Date().toISOString().split('T')[0],
    facilities: Array.isArray(facilities) ? facilities.map(sanitizeString) : ['Standard Facilities'],
    isCustomAdded: true,
  };

  campusLocations.unshift(newLocation);
  res.status(201).json(newLocation);
});

app.put('/api/locations/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const index = campusLocations.findIndex((l) => l.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Location not found.' });
  }

  const existing = campusLocations[index];
  const {
    name,
    shortCode,
    aliases,
    category,
    lat,
    lng,
    description,
    openingHours,
    accessibility,
    verificationStatus,
    facilities,
    source,
    osmId,
  } = req.body;

  if (lat !== undefined && lng !== undefined && !isValidCampusCoordinate(lat, lng)) {
    return res.status(400).json({
      error: 'Coordinates outside UENR campus boundary.',
    });
  }

  const updated: CampusLocation = {
    ...existing,
    name: name !== undefined ? sanitizeString(name) : existing.name,
    shortCode: shortCode !== undefined ? sanitizeString(shortCode) : existing.shortCode,
    aliases: Array.isArray(aliases) ? aliases.map(sanitizeString) : existing.aliases,
    category: category || existing.category,
    lat: typeof lat === 'number' ? lat : existing.lat,
    lng: typeof lng === 'number' ? lng : existing.lng,
    description: description !== undefined ? sanitizeString(description) : existing.description,
    openingHours: openingHours !== undefined ? sanitizeString(openingHours) : existing.openingHours,
    accessibility: accessibility !== undefined ? sanitizeString(accessibility) : existing.accessibility,
    verificationStatus:
      verificationStatus === 'verified' ||
      verificationStatus === 'needs_review' ||
      verificationStatus === 'unverified' ||
      verificationStatus === 'pending_verification'
        ? verificationStatus
        : existing.verificationStatus,
    source: source !== undefined ? sanitizeString(source) : existing.source,
    osmId: osmId !== undefined ? sanitizeString(osmId) : existing.osmId,
    lastVerified: new Date().toISOString().split('T')[0],
    facilities: Array.isArray(facilities) ? facilities.map(sanitizeString) : existing.facilities,
  };

  campusLocations[index] = updated;
  res.json(updated);
});

app.delete('/api/locations/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const initialLength = campusLocations.length;
  campusLocations = campusLocations.filter((l) => l.id !== id);

  if (campusLocations.length === initialLength) {
    return res.status(404).json({ error: 'Location not found.' });
  }

  res.json({ success: true, message: 'Location deleted successfully.' });
});

// 5. Student Issue Reports Endpoints
app.get('/api/reports', requireAdminAuth, (_req, res) => {
  res.json(campusReports);
});

// Public rate-limited submission
app.post('/api/reports', rateLimiter(10, 10 * 60 * 1000), (req, res) => {
  const { locationName, issueType, description, reporterRole, locationId } = req.body;

  if (!locationName || !description) {
    return res.status(400).json({ error: 'Location name and description are required.' });
  }

  const cleanDescription = sanitizeString(description);
  if (cleanDescription.length < 5 || cleanDescription.length > 1000) {
    return res.status(400).json({ error: 'Description must be between 5 and 1000 characters.' });
  }

  const validIssueTypes = [
    'missing_location',
    'wrong_pin',
    'wrong_name',
    'blocked_path',
    'incorrect_directions',
    'other',
  ];

  const cleanIssueType = validIssueTypes.includes(issueType) ? issueType : 'other';

  const newReport: CampusReport = {
    id: `rep-${Date.now()}`,
    locationId: locationId ? sanitizeString(locationId) : undefined,
    locationName: sanitizeString(locationName),
    issueType: cleanIssueType as any,
    description: cleanDescription,
    reporterRole: ['student', 'lecturer', 'staff', 'visitor'].includes(reporterRole)
      ? reporterRole
      : 'student',
    date: new Date().toISOString().split('T')[0],
    status: 'pending',
  };

  campusReports.unshift(newReport);
  res.status(201).json(newReport);
});

app.patch('/api/reports/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'resolved', 'dismissed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid report status.' });
  }

  const report = campusReports.find((r) => r.id === id);
  if (!report) {
    return res.status(404).json({ error: 'Report not found.' });
  }

  report.status = status;
  res.json(report);
});

// 6. Campus Announcements & Notices Endpoints
app.get('/api/notices', async (req, res) => {
  const authHeader = req.headers.authorization;
  let isCallerAdmin = false;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = await getAuth().verifyIdToken(token);
      if (decoded.admin === true || decoded.role === 'admin') {
        isCallerAdmin = true;
      }
    } catch {
      // Non-admin or unauthenticated visitor
    }
  }

  if (isCallerAdmin) {
    return res.json(campusNotices);
  }

  // Filter for students and public visitors:
  // Must be active and published; hide future scheduled; hide past expired
  const now = new Date();
  const visibleNotices = campusNotices.filter((n) => {
    if (!n.active) return false;
    if (n.status && n.status !== 'published') return false;

    if (n.scheduledAt) {
      const sched = new Date(n.scheduledAt);
      if (sched > now) return false;
    }

    if (n.expiresAt) {
      const exp = new Date(n.expiresAt);
      if (exp <= now) return false;
    }

    return true;
  });

  res.json(visibleNotices);
});

app.post('/api/notices', requireAdminAuth, (req, res) => {
  const {
    title,
    message,
    category,
    priority,
    status,
    type,
    affectedLocationId,
    locationName,
    scheduledAt,
    expiresAt,
    startTime,
    endTime,
  } = req.body;

  if (!title || !message) {
    return res.status(400).json({ error: 'Title and message are required.' });
  }

  const cleanTitle = sanitizeString(title);
  const cleanMessage = sanitizeString(message);
  if (cleanTitle.length < 3 || cleanTitle.length > 200) {
    return res.status(400).json({ error: 'Title must be between 3 and 200 characters.' });
  }
  if (cleanMessage.length < 5 || cleanMessage.length > 3000) {
    return res.status(400).json({ error: 'Message must be between 5 and 3000 characters.' });
  }

  const validCategories = ['General', 'Academic', 'Events', 'Maintenance', 'Safety', 'Emergency'];
  const validPriorities = ['Normal', 'Important', 'Urgent'];
  const validStatuses = ['draft', 'scheduled', 'published', 'archived'];

  const now = new Date().toISOString();
  const adminUid = (req as any).user?.uid || 'admin';
  const noticeStatus = validStatuses.includes(status) ? status : 'published';

  const newNotice: CampusNotice = {
    id: `notice-${Date.now()}`,
    title: cleanTitle,
    message: cleanMessage,
    category: validCategories.includes(category) ? category : 'General',
    priority: validPriorities.includes(priority) ? priority : 'Normal',
    status: noticeStatus as any,
    type: ['warning', 'info', 'critical', 'event'].includes(type) ? type : 'info',
    affectedLocationId: affectedLocationId ? sanitizeString(affectedLocationId) : undefined,
    locationName: locationName ? sanitizeString(locationName) : undefined,
    postedDate: 'Just now',
    publishedAt: noticeStatus === 'published' ? now : undefined,
    scheduledAt: scheduledAt ? sanitizeString(scheduledAt) : undefined,
    expiresAt: expiresAt ? sanitizeString(expiresAt) : undefined,
    startTime: startTime ? sanitizeString(startTime) : undefined,
    endTime: endTime ? sanitizeString(endTime) : undefined,
    authorUid: adminUid,
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  campusNotices.unshift(newNotice);
  res.status(201).json(newNotice);
});

app.put('/api/notices/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const notice = campusNotices.find((n) => n.id === id);

  if (!notice) {
    return res.status(404).json({ error: 'Notice not found.' });
  }

  const {
    title,
    message,
    category,
    priority,
    status,
    affectedLocationId,
    locationName,
    scheduledAt,
    expiresAt,
    startTime,
    endTime,
    active,
  } = req.body;

  const now = new Date().toISOString();

  if (title !== undefined) notice.title = sanitizeString(title);
  if (message !== undefined) notice.message = sanitizeString(message);
  if (category) notice.category = category;
  if (priority) notice.priority = priority;
  if (status) {
    notice.status = status;
    if (status === 'published' && !notice.publishedAt) {
      notice.publishedAt = now;
    }
  }
  if (affectedLocationId !== undefined) notice.affectedLocationId = sanitizeString(affectedLocationId);
  if (locationName !== undefined) notice.locationName = sanitizeString(locationName);
  if (scheduledAt !== undefined) notice.scheduledAt = scheduledAt;
  if (expiresAt !== undefined) notice.expiresAt = expiresAt;
  if (startTime !== undefined) notice.startTime = startTime;
  if (endTime !== undefined) notice.endTime = endTime;
  if (typeof active === 'boolean') notice.active = active;

  notice.updatedAt = now;
  notice.authorUid = (req as any).user?.uid || notice.authorUid;

  res.json(notice);
});

app.patch('/api/notices/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const notice = campusNotices.find((n) => n.id === id);

  if (!notice) {
    return res.status(404).json({ error: 'Notice not found.' });
  }

  if (typeof req.body.active === 'boolean') {
    notice.active = req.body.active;
  }
  if (req.body.status) {
    notice.status = req.body.status;
  }
  notice.updatedAt = new Date().toISOString();

  res.json(notice);
});

app.delete('/api/notices/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const initial = campusNotices.length;
  campusNotices = campusNotices.filter((n) => n.id !== id);

  if (campusNotices.length === initial) {
    return res.status(404).json({ error: 'Notice not found.' });
  }

  res.json({ success: true, message: 'Notice deleted successfully.' });
});

// 7. Server-Side Custom Claims & Role Assignment
app.post('/api/admin/set-role', requireAdminAuth, async (req, res) => {
  const { targetUid, role } = req.body;
  if (!targetUid || !role) {
    return res.status(400).json({ error: 'targetUid and role are required.' });
  }

  // Strict input validation to prevent arbitrary inputs
  if (typeof targetUid !== 'string' || !/^[a-zA-Z0-9_\-]{1,128}$/.test(targetUid)) {
    return res.status(400).json({ error: 'Invalid targetUid format. Must be an alphanumeric UID.' });
  }

  const ALLOWED_ROLES = ['admin', 'lecturer', 'staff', 'student', 'visitor'];
  if (!ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({
      error: `Invalid role. Allowed roles are: ${ALLOWED_ROLES.join(', ')}.`,
    });
  }

  const isAdminRole = role === 'admin';

  try {
    await getAuth().setCustomUserClaims(targetUid, {
      admin: isAdminRole,
      role,
    });
    return res.json({ success: true, message: `Role '${role}' assigned to user ${targetUid}.` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update custom claims.' });
  }
});

// 8. Secure One-Time Administrator Bootstrap Endpoint
app.post('/api/admin/bootstrap-admin', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Bearer ID token required for administrator bootstrap.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const auth = getAuth();
    const decoded = await auth.verifyIdToken(token);

    const isEmailVerified = decoded.email_verified === true;
    const isAuthorizedEmail =
      isEmailVerified &&
      (decoded.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() ||
       decoded.email?.toLowerCase() === RUNTIME_ADMIN_EMAIL.toLowerCase());

    const bootstrapSecret = req.headers['x-bootstrap-secret'] || req.body?.bootstrapSecret;
    const isSecretValid =
      process.env.BOOTSTRAP_SECRET &&
      bootstrapSecret === process.env.BOOTSTRAP_SECRET;

    if (!isAuthorizedEmail && !isSecretValid) {
      return res.status(403).json({
        error:
          'Forbidden. Bootstrap requires a verified administrator email (e.g. ' +
          ADMIN_EMAIL +
          ') or authorized server secret.',
      });
    }

    await auth.setCustomUserClaims(decoded.uid, {
      admin: true,
      role: 'admin',
    });

    return res.json({
      success: true,
      message: `Administrator privileges successfully granted to user ${decoded.uid} (${decoded.email}).`,
    });
  } catch (err: any) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
});

// 9. Verified Pedestrian Routing Graph Endpoints
app.get('/api/pedestrian-graph', (_req, res) => {
  res.json({
    nodes: campusNodes,
    edges: campusEdges,
    version: '2.0.0-verified',
    lastUpdated: new Date().toISOString(),
  });
});

app.post('/api/admin/pedestrian-graph/edges', requireAdminAuth, (req, res) => {
  const { from, to, pathwayName, geometry, isStepFree, hasStairs, surface, slope, notes } = req.body;
  if (!from || !to || !pathwayName || !Array.isArray(geometry) || geometry.length < 2) {
    return res.status(400).json({
      error: 'from, to, pathwayName, and geometry (array of at least 2 [lat, lng] coordinates) are required.',
    });
  }

  let dist = 0;
  for (let i = 0; i < geometry.length - 1; i++) {
    const p1 = geometry[i];
    const p2 = geometry[i + 1];
    dist += calculateGeodesicDistanceMeters(p1[0], p1[1], p2[0], p2[1]);
  }

  const newEdge: PedestrianEdge = {
    id: `edge-${Date.now()}`,
    from: sanitizeString(from),
    to: sanitizeString(to),
    pathwayName: sanitizeString(pathwayName),
    geometry,
    distance: Math.round(dist),
    isStepFree: typeof isStepFree === 'boolean' ? isStepFree : true,
    hasStairs: typeof hasStairs === 'boolean' ? hasStairs : false,
    surface: surface || 'paved',
    slope: slope || 'flat',
    isTemporarilyClosed: false,
    source: 'Administrator Entry',
    verificationStatus: 'verified',
    lastVerified: new Date().toISOString().split('T')[0],
    notes: sanitizeString(notes),
  };

  campusEdges.push(newEdge);
  res.status(201).json(newEdge);
});

app.put('/api/admin/pedestrian-graph/edges/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const idx = campusEdges.findIndex((e) => e.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Pathway edge not found.' });
  }

  const existing = campusEdges[idx];
  const {
    pathwayName,
    isStepFree,
    hasStairs,
    surface,
    slope,
    isTemporarilyClosed,
    closureReason,
    notes,
  } = req.body;

  const updated: PedestrianEdge = {
    ...existing,
    pathwayName: pathwayName ? sanitizeString(pathwayName) : existing.pathwayName,
    isStepFree: typeof isStepFree === 'boolean' ? isStepFree : existing.isStepFree,
    hasStairs: typeof hasStairs === 'boolean' ? hasStairs : existing.hasStairs,
    surface: surface || existing.surface,
    slope: slope || existing.slope,
    isTemporarilyClosed:
      typeof isTemporarilyClosed === 'boolean' ? isTemporarilyClosed : existing.isTemporarilyClosed,
    closureReason: closureReason !== undefined ? sanitizeString(closureReason) : existing.closureReason,
    notes: notes !== undefined ? sanitizeString(notes) : existing.notes,
    lastVerified: new Date().toISOString().split('T')[0],
  };

  campusEdges[idx] = updated;
  res.json(updated);
});

app.delete('/api/admin/pedestrian-graph/edges/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const beforeCount = campusEdges.length;
  campusEdges = campusEdges.filter((e) => e.id !== id);
  if (campusEdges.length === beforeCount) {
    return res.status(404).json({ error: 'Edge not found.' });
  }
  res.json({ success: true, message: 'Edge deleted from pedestrian graph.' });
});

app.post('/api/admin/pedestrian-graph/reset', requireAdminAuth, (_req, res) => {
  campusNodes = { ...VERIFIED_CAMPUS_NODES };
  campusEdges = [...VERIFIED_CAMPUS_EDGES];
  res.json({ success: true, message: 'Pedestrian graph reset to verified baseline.' });
});

/* ==========================================================================
   FRONTEND SERVING (Dev Vite Middleware & Production Static)
   ========================================================================== */

export async function startServer() {
  if (!IS_PROD) {
    // Mount Vite middleware in development
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true, port: Number(PORT) },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static frontend assets from dist in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`UENR Nav Server running on port ${PORT} [Mode: ${IS_PROD ? 'production' : 'development'}]`);
  });
}

// Automatically start if executed as main file
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
