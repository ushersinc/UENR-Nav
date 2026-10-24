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
  CUSTOM_LOCATIONS: 'uenr_nav_custom_locations',
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
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_CAMPUS_LOCATIONS;
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
    lat: location.lat || 7.3495,
    lng: location.lng || -2.3435,
    description: location.description || '',
    openingHours: location.openingHours || '',
    accessibility: location.accessibility || 'Standard access',
    verificationStatus: location.verificationStatus || 'pending_verification',
    lastVerified: new Date().toISOString().split('T')[0],
    facilities: location.facilities || ['Standard Facilities'],
    floorCount: location.floorCount,
    contactPhone: location.contactPhone,
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

export async function createNoticeOnServer(
  notice: Omit<CampusNotice, 'id' | 'postedDate' | 'active'>
): Promise<CampusNotice> {
  const id = `notice-${Date.now()}`;
  const newNotice: CampusNotice = {
    ...notice,
    id,
    postedDate: 'Just now',
    active: true,
  };

  const user = auth.currentUser;
  const docPayload = {
    ...newNotice,
    authorUid: user ? user.uid : 'admin',
    createdAt: new Date().toISOString(),
  };

  const docRef = doc(db, 'notices', id);
  await setDoc(docRef, docPayload);

  const current = await fetchNotices();
  localStorage.setItem(KEYS.NOTICES, JSON.stringify([newNotice, ...current]));
  return newNotice;
}

export async function toggleNoticeOnServer(id: string, active: boolean): Promise<CampusNotice> {
  const docRef = doc(db, 'notices', id);
  await updateDoc(docRef, { active });

  const current = (await fetchNotices()).map((n) => (n.id === id ? { ...n, active } : n));
  localStorage.setItem(KEYS.NOTICES, JSON.stringify(current));
  return current.find((n) => n.id === id)!;
}

export async function deleteNoticeOnServer(id: string): Promise<void> {
  const docRef = doc(db, 'notices', id);
  await deleteDoc(docRef);

  const current = (await fetchNotices()).filter((n) => n.id !== id);
  localStorage.setItem(KEYS.NOTICES, JSON.stringify(current));
}
