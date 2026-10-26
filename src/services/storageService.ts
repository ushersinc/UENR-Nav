import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { CampusLocation, CampusNotice, CampusReport } from '../types/campus';
import { INITIAL_CAMPUS_LOCATIONS } from '../data/campusLocations';

const KEYS = {
  FAVORITES: 'uenr_nav_favorites',
  RECENTS: 'uenr_nav_recent_searches',
  CUSTOM_LOCATIONS: 'uenr_nav_custom_locations_v2',
  REPORTS: 'uenr_nav_reports',
  NOTICES: 'uenr_nav_notices',
};

/* ==========================================================================
   FAVORITES (Cloud Firestore subcollection users/{uid}/favorites + Local Cache)
   ========================================================================== */

export async function fetchUserFavorites(userId?: string): Promise<string[]> {
  const uid = userId || auth.currentUser?.uid;
  if (!uid) return getStoredFavorites();

  try {
    const favsRef = collection(db, 'users', uid, 'favorites');
    const snap = await getDocs(favsRef);
    const placeIds: string[] = [];
    snap.forEach((d) => {
      placeIds.push(d.id);
    });

    if (placeIds.length > 0) {
      localStorage.setItem(KEYS.FAVORITES, JSON.stringify(placeIds));
      return placeIds;
    }
  } catch (err) {
    console.warn('Offline or fallback reading favorites:', err);
  }

  return getStoredFavorites();
}

export function getStoredFavorites(): string[] {
  try {
    const raw = localStorage.getItem(KEYS.FAVORITES);
    return raw ? JSON.parse(raw) : ['bog-auditorium', 'cafeteria', 'lt-block'];
  } catch {
    return ['bog-auditorium', 'cafeteria', 'lt-block'];
  }
}

export const getFavorites = getStoredFavorites;

export async function toggleFavorite(locationId: string): Promise<string[]> {
  const current = getStoredFavorites();
  const exists = current.includes(locationId);
  const updated = exists ? current.filter((id) => id !== locationId) : [...current, locationId];

  // Update local cache
  try {
    localStorage.setItem(KEYS.FAVORITES, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save favorites locally', e);
  }

  // Sync with Firestore if logged in
  const user = auth.currentUser;
  if (user) {
    try {
      const favDocRef = doc(db, 'users', user.uid, 'favorites', locationId);
      if (exists) {
        await deleteDoc(favDocRef);
      } else {
        await setDoc(favDocRef, {
          placeId: locationId,
          addedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn('Could not sync favorite to Firestore (offline):', err);
    }
  }

  return updated;
}

/* ==========================================================================
   RECENT SEARCHES (Client-side user space)
   ========================================================================== */

export function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(KEYS.RECENTS);
    return raw ? JSON.parse(raw) : ['LT Block', 'Cafeteria', 'Clinic', 'Library'];
  } catch {
    return [];
  }
}

export function addRecentSearch(queryStr: string): string[] {
  if (!queryStr || !queryStr.trim()) return getRecentSearches();
  const trimmed = queryStr.trim();
  const recents = getRecentSearches().filter((q) => q.toLowerCase() !== trimmed.toLowerCase());
  const updated = [trimmed, ...recents].slice(0, 8);
  try {
    localStorage.setItem(KEYS.RECENTS, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save recent search', e);
  }
  return updated;
}

export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(KEYS.RECENTS);
  } catch (e) {
    console.error(e);
  }
}

/* ==========================================================================
   CAMPUS LOCATIONS (Cloud Firestore collection 'campusLocations')
   ========================================================================== */

export async function fetchLocations(): Promise<CampusLocation[]> {
  try {
    const colRef = collection(db, 'campusLocations');
    const snap = await getDocs(colRef);

    if (!snap.empty) {
      const list: CampusLocation[] = [];
      snap.forEach((d) => {
        list.push({ ...d.data(), id: d.id } as CampusLocation);
      });
      localStorage.setItem(KEYS.CUSTOM_LOCATIONS, JSON.stringify(list));
      return list;
    }
  } catch (err) {
    console.info('Offline/cached locations fallback:', err);
  }

  return getStoredLocations();
}

export function getStoredLocations(): CampusLocation[] {
  try {
    const raw = localStorage.getItem(KEYS.CUSTOM_LOCATIONS);
    if (!raw) return INITIAL_CAMPUS_LOCATIONS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_CAMPUS_LOCATIONS;

    // Purge any stale cache with outdated/inaccurate coordinates (e.g. main-campus-gate at -2.3496)
    const mainGate = parsed.find((l: CampusLocation) => l.id === 'main-campus-gate');
    if (mainGate && mainGate.lng < -2.346) {
      localStorage.setItem(KEYS.CUSTOM_LOCATIONS, JSON.stringify(INITIAL_CAMPUS_LOCATIONS));
      return INITIAL_CAMPUS_LOCATIONS;
    }

    return parsed;
  } catch {
    return INITIAL_CAMPUS_LOCATIONS;
  }
}

export function saveStoredLocations(locations: CampusLocation[]): void {
  try {
    localStorage.setItem(KEYS.CUSTOM_LOCATIONS, JSON.stringify(locations));
  } catch (e) {
    console.error('Failed to save locations locally', e);
  }
}

export async function saveLocationToServer(
  location: Partial<CampusLocation>
): Promise<CampusLocation> {
  const id = location.id || `loc-${Date.now()}`;
  const docData: CampusLocation = {
    id,
    name: location.name || 'Unnamed Building',
    shortCode: location.shortCode || 'CAMP',
    aliases: location.aliases || [],
    category: location.category || 'lecture_hall',
    lat: location.lat || 7.3502,
    lng: location.lng || -2.3425,
    description: location.description || '',
    openingHours: location.openingHours || '',
    accessibility: location.accessibility || 'Standard access',
    verificationStatus: location.verificationStatus || 'needs_review',
    lastVerified: new Date().toISOString().split('T')[0],
    facilities: location.facilities || ['Standard Facilities'],
    floorCount: location.floorCount,
    contactPhone: location.contactPhone,
    source: location.source || 'Admin Entry',
    osmId: location.osmId,
    verifiedBy: location.verifiedBy,
  };

  // Persist to Cloud Firestore
  const docRef = doc(db, 'campusLocations', id);
  await setDoc(docRef, docData, { merge: true });

  // Update local cache
  const current = getStoredLocations();
  const exists = current.some((l) => l.id === id);
  const updated = exists ? current.map((l) => (l.id === id ? docData : l)) : [docData, ...current];
  saveStoredLocations(updated);

  return docData;
}

export async function deleteLocationOnServer(id: string): Promise<void> {
  const docRef = doc(db, 'campusLocations', id);
  await deleteDoc(docRef);

  const current = getStoredLocations().filter((l) => l.id !== id);
  saveStoredLocations(current);
}

export function resetLocationsToDefault(): CampusLocation[] {
  try {
    localStorage.removeItem(KEYS.CUSTOM_LOCATIONS);
  } catch (e) {
    console.error(e);
  }
  return INITIAL_CAMPUS_LOCATIONS;
}

/* ==========================================================================
   STUDENT ISSUE REPORTS (Cloud Firestore collection 'reports')
   ========================================================================== */

export async function fetchReports(): Promise<CampusReport[]> {
  try {
    const colRef = collection(db, 'reports');
    const snap = await getDocs(colRef);

    if (!snap.empty) {
      const reports: CampusReport[] = [];
      snap.forEach((d) => {
        reports.push({ ...d.data(), id: d.id } as CampusReport);
      });
      // Sort newest first
      reports.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      localStorage.setItem(KEYS.REPORTS, JSON.stringify(reports));
      return reports;
    }
  } catch (err) {
    console.warn('Reports retrieval error (using cache):', err);
  }

  return getStoredReports();
}

export function getStoredReports(): CampusReport[] {
  try {
    const raw = localStorage.getItem(KEYS.REPORTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function submitReport(
  report: Omit<CampusReport, 'id' | 'date' | 'status'>
): Promise<CampusReport> {
  const id = `rep-${Date.now()}`;
  const newReport: CampusReport = {
    ...report,
    id,
    date: new Date().toISOString().split('T')[0],
    status: 'pending',
  };

  const user = auth.currentUser;
  const docPayload = {
    ...newReport,
    reporterUid: user ? user.uid : 'anonymous',
    createdAt: new Date().toISOString(),
  };

  try {
    const docRef = doc(db, 'reports', id);
    await setDoc(docRef, docPayload);
  } catch (err) {
    console.warn('Firestore report write queued/offline:', err);
  }

  const current = getStoredReports();
  localStorage.setItem(KEYS.REPORTS, JSON.stringify([newReport, ...current]));
  return newReport;
}

export async function updateReportStatus(
  reportId: string,
  status: CampusReport['status']
): Promise<CampusReport> {
  const docRef = doc(db, 'reports', reportId);
  await updateDoc(docRef, { status, updatedAt: new Date().toISOString() });

  const current = getStoredReports().map((r) => (r.id === reportId ? { ...r, status } : r));
  localStorage.setItem(KEYS.REPORTS, JSON.stringify(current));

  const found = current.find((r) => r.id === reportId);
  return found || { id: reportId, locationName: 'Report', issueType: 'other', description: '', reporterRole: 'student', date: '', status };
}

/* ==========================================================================
   CAMPUS NOTICES (Cloud Firestore collection 'notices')
   ========================================================================== */

export const KEYS_STORAGE = {
  ...KEYS,
  READ_NOTICES: 'uenr_nav_read_notices',
};

export async function fetchNotices(): Promise<CampusNotice[]> {
  try {
    const colRef = collection(db, 'notices');
    const snap = await getDocs(colRef);

    if (!snap.empty) {
      const list: CampusNotice[] = [];
      snap.forEach((d) => {
        list.push({ ...d.data(), id: d.id } as CampusNotice);
      });
      localStorage.setItem(KEYS.NOTICES, JSON.stringify(list));
      return list;
    }
  } catch (err) {
    console.info('Notices retrieval error (using cache):', err);
  }

  try {
    const raw = localStorage.getItem(KEYS.NOTICES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Filters announcements for student/public view vs administrator view:
 * Ordinary users only see published, active, non-expired notices whose scheduled date has arrived.
 */
export function filterVisibleNotices(notices: CampusNotice[], isAdminUser = false): CampusNotice[] {
  if (isAdminUser) return notices;

  const now = new Date();
  return notices.filter((n) => {
    // Must be active and published
    if (!n.active) return false;
    if (n.status && n.status !== 'published') return false;

    // Check future schedule
    if (n.scheduledAt) {
      const sched = new Date(n.scheduledAt);
      if (sched > now) return false;
    }

    // Check expiration
    if (n.expiresAt) {
      const exp = new Date(n.expiresAt);
      if (exp <= now) return false;
    }

    return true;
  });
}

export async function createNoticeOnServer(
  notice: Partial<CampusNotice>
): Promise<CampusNotice> {
  const id = notice.id || `notice-${Date.now()}`;
  const now = new Date().toISOString();
  const user = auth.currentUser;

  const newNotice: CampusNotice = {
    id,
    title: notice.title || 'Campus Announcement',
    message: notice.message || '',
    category: notice.category || 'General',
    priority: notice.priority || 'Normal',
    status: notice.status || 'published',
    type: notice.type || 'info',
    affectedLocationId: notice.affectedLocationId,
    locationName: notice.locationName,
    postedDate: 'Just now',
    publishedAt: notice.status === 'published' ? (notice.publishedAt || now) : undefined,
    scheduledAt: notice.scheduledAt,
    expiresAt: notice.expiresAt,
    startTime: notice.startTime,
    endTime: notice.endTime,
    authorUid: user ? user.uid : 'admin',
    active: notice.active !== undefined ? notice.active : true,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const docRef = doc(db, 'notices', id);
    await setDoc(docRef, newNotice);
  } catch (err) {
    console.warn('Firestore notice write (offline fallback):', err);
  }

  const current = await fetchNotices();
  const updated = [newNotice, ...current.filter((n) => n.id !== id)];
  localStorage.setItem(KEYS.NOTICES, JSON.stringify(updated));
  return newNotice;
}

export async function updateNoticeOnServer(
  id: string,
  updates: Partial<CampusNotice>
): Promise<CampusNotice> {
  const now = new Date().toISOString();
  const user = auth.currentUser;

  const payload: Partial<CampusNotice> = {
    ...updates,
    updatedAt: now,
    authorUid: user ? user.uid : updates.authorUid,
  };

  if (updates.status === 'published' && !updates.publishedAt) {
    payload.publishedAt = now;
  }

  try {
    const docRef = doc(db, 'notices', id);
    await updateDoc(docRef, payload);
  } catch (err) {
    console.warn('Firestore notice update (offline fallback):', err);
  }

  const current = await fetchNotices();
  const updated = current.map((n) => (n.id === id ? { ...n, ...payload } : n));
  localStorage.setItem(KEYS.NOTICES, JSON.stringify(updated));
  return updated.find((n) => n.id === id)!;
}

export async function toggleNoticeOnServer(id: string, active: boolean): Promise<CampusNotice> {
  return updateNoticeOnServer(id, { active });
}

export async function deleteNoticeOnServer(id: string): Promise<void> {
  try {
    const docRef = doc(db, 'notices', id);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Firestore notice delete (offline fallback):', err);
  }

  const current = (await fetchNotices()).filter((n) => n.id !== id);
  localStorage.setItem(KEYS.NOTICES, JSON.stringify(current));
}

/* ==========================================================================
   PER-USER UNREAD ANNOUNCEMENT TRACKING
   ========================================================================== */

function getReadStorageKey(userId?: string): string {
  const uid = userId || auth.currentUser?.uid || 'guest';
  return `uenr_nav_read_notices_${uid}`;
}

export function getReadNoticeIds(userId?: string): string[] {
  try {
    const key = getReadStorageKey(userId);
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function markNoticeAsRead(noticeId: string, userId?: string): string[] {
  const current = getReadNoticeIds(userId);
  if (current.includes(noticeId)) return current;
  const updated = [...current, noticeId];
  try {
    localStorage.setItem(getReadStorageKey(userId), JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to store read status', e);
  }
  return updated;
}

export function markAllNoticesAsRead(noticeIds: string[], userId?: string): string[] {
  const current = new Set(getReadNoticeIds(userId));
  noticeIds.forEach((id) => current.add(id));
  const updated = Array.from(current);
  try {
    localStorage.setItem(getReadStorageKey(userId), JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to store mark all read', e);
  }
  return updated;
}

/* ==========================================================================
   PEDESTRIAN GRAPH MANAGEMENT (Server API Sync)
   ========================================================================== */

export async function fetchPedestrianGraph(): Promise<{
  nodes: Record<string, any>;
  edges: any[];
} | null> {
  try {
    const res = await fetch('/api/pedestrian-graph');
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Could not fetch remote pedestrian graph, using local verified baseline:', e);
  }
  return null;
}

export async function savePedestrianEdgeOnServer(
  edgeData: any,
  idToken?: string
): Promise<any | null> {
  try {
    const token = idToken || (await auth.currentUser?.getIdToken());
    const res = await fetch('/api/admin/pedestrian-graph/edges', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(edgeData),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error('Failed to create edge on server:', e);
  }
  return null;
}

export async function updatePedestrianEdgeOnServer(
  id: string,
  updates: any,
  idToken?: string
): Promise<any | null> {
  try {
    const token = idToken || (await auth.currentUser?.getIdToken());
    const res = await fetch(`/api/admin/pedestrian-graph/edges/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error('Failed to update edge on server:', e);
  }
  return null;
}

export async function deletePedestrianEdgeOnServer(
  id: string,
  idToken?: string
): Promise<boolean> {
  try {
    const token = idToken || (await auth.currentUser?.getIdToken());
    const res = await fetch(`/api/admin/pedestrian-graph/edges/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.ok;
  } catch (e) {
    console.error('Failed to delete edge on server:', e);
    return false;
  }
}

export async function resetPedestrianGraphOnServer(idToken?: string): Promise<boolean> {
  try {
    const token = idToken || (await auth.currentUser?.getIdToken());
    const res = await fetch('/api/admin/pedestrian-graph/reset', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.ok;
  } catch (e) {
    console.error('Failed to reset graph on server:', e);
    return false;
  }
}

