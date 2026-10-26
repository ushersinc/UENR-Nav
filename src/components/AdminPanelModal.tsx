import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  Plus,
  Edit2,
  Trash2,
  FileDown,
  FileUp,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Flag,
  Bell,
  Lock,
  LogOut,
  MapPin,
  Save,
  Loader2,
  Search,
  Filter,
  Calendar,
  Clock,
  Eye,
  EyeOff,
  Flame,
  AlertTriangle,
  Info,
  CheckCheck,
  Footprints,
} from 'lucide-react';
import {
  CampusCategory,
  CampusLocation,
  CampusNotice,
  CampusReport,
  NoticeCategory,
  NoticePriority,
  NoticeStatus,
  PedestrianEdge,
  PedestrianNode,
} from '../types/campus';
import { CATEGORY_METAS } from '../data/campusLocations';
import { useAuth } from '../context/AuthContext';
import {
  calculateDistanceMeters,
  validateGraphConnectivity,
  GraphConnectivityReport,
  setActiveCampusGraph,
  getActiveCampusGraph,
} from '../services/routingService';
import {
  VERIFIED_CAMPUS_NODES,
  VERIFIED_CAMPUS_EDGES,
} from '../data/pedestrianGraphData';
import {
  saveLocationToServer,
  deleteLocationOnServer,
  updateReportStatus,
  createNoticeOnServer,
  updateNoticeOnServer,
  toggleNoticeOnServer,
  deleteNoticeOnServer,
  resetLocationsToDefault,
  fetchPedestrianGraph,
  updatePedestrianEdgeOnServer,
  resetPedestrianGraphOnServer,
} from '../services/storageService';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: CampusLocation[];
  onUpdateLocations: (locations: CampusLocation[]) => void;
  reports: CampusReport[];
  onUpdateReports: (reports: CampusReport[]) => void;
  notices: CampusNotice[];
  onUpdateNotices: (notices: CampusNotice[]) => void;
  onFocusLocation: (loc: CampusLocation) => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  locations,
  onUpdateLocations,
  reports,
  onUpdateReports,
  notices,
  onUpdateNotices,
  onFocusLocation,
}) => {
  const {
    currentUser,
    userProfile,
    isAdmin,
    signInWithGoogle,
    logout,
    loading: authLoading,
    getIdToken,
    refreshAuthToken,
  } = useAuth();
  const [authError, setAuthError] = useState('');
  const [bootstrapSuccess, setBootstrapSuccess] = useState('');
  const [bootstrapSecret, setBootstrapSecret] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<
    'locations' | 'reports' | 'notices' | 'walkways' | 'import_export'
  >('locations');
  const [editingLocation, setEditingLocation] = useState<CampusLocation | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'needs_review' | 'unverified'>('all');

  // In-modal dialog & notification states (eliminating native browser alert & confirm)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    isDestructive?: boolean;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    onConfirm: () => {},
  });
  const [bannerMessage, setBannerMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Walkways & Pedestrian Graph State
  const [walkwayEdges, setWalkwayEdges] = useState<PedestrianEdge[]>(() => [...VERIFIED_CAMPUS_EDGES]);
  const [graphConnectivity, setGraphConnectivity] = useState<GraphConnectivityReport | null>(null);
  const [edgeSearchFilter, setEdgeSearchFilter] = useState('');

  // Sync pedestrian graph from server on mount
  useEffect(() => {
    fetchPedestrianGraph().then((data) => {
      if (data && data.edges && data.edges.length > 0) {
        setWalkwayEdges(data.edges);
        setActiveCampusGraph({
          nodes: data.nodes || VERIFIED_CAMPUS_NODES,
          edges: data.edges,
          version: '2.0.0-synced',
          lastUpdated: new Date().toISOString(),
        });
      }
    });
  }, []);

  const handleToggleEdgeClosure = async (edgeId: string) => {
    const target = walkwayEdges.find((e) => e.id === edgeId);
    if (!target) return;
    const newClosed = !target.isTemporarilyClosed;
    const reason = newClosed ? 'Campus pathway maintenance / temporary closure' : undefined;

    const updatedList = walkwayEdges.map((e) =>
      e.id === edgeId ? { ...e, isTemporarilyClosed: newClosed, closureReason: reason } : e
    );
    setWalkwayEdges(updatedList);
    setActiveCampusGraph({
      nodes: VERIFIED_CAMPUS_NODES,
      edges: updatedList,
      version: '2.0.0-updated',
      lastUpdated: new Date().toISOString(),
    });

    try {
      const token = await getIdToken();
      await updatePedestrianEdgeOnServer(
        edgeId,
        { isTemporarilyClosed: newClosed, closureReason: reason },
        token || undefined
      );
    } catch (e) {
      console.warn('Could not sync closure to server:', e);
    }
  };

  const handleValidateGraph = () => {
    const report = validateGraphConnectivity(VERIFIED_CAMPUS_NODES, walkwayEdges);
    setGraphConnectivity(report);
  };

  const handleResetWalkways = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Reset Pedestrian Graph',
      message: 'Are you sure you want to reset the campus pedestrian graph to the verified official OpenStreetMap baseline? Custom closures will be cleared.',
      confirmLabel: 'Reset Graph',
      isDestructive: true,
      onConfirm: async () => {
        setWalkwayEdges([...VERIFIED_CAMPUS_EDGES]);
        setActiveCampusGraph({
          nodes: VERIFIED_CAMPUS_NODES,
          edges: [...VERIFIED_CAMPUS_EDGES],
          version: '2.0.0-verified',
          lastUpdated: new Date().toISOString(),
        });
        setGraphConnectivity(null);
        try {
          const token = await getIdToken();
          await resetPedestrianGraphOnServer(token || undefined);
          setBannerMessage({ type: 'success', text: 'Pedestrian graph successfully reset to verified OpenStreetMap baseline.' });
        } catch (e) {
          console.warn('Could not sync reset to server:', e);
        }
      },
    });
  };

  // Location form state
  const [formName, setFormName] = useState('');
  const [formShortCode, setFormShortCode] = useState('');
  const [formAliases, setFormAliases] = useState('');
  const [formCategory, setFormCategory] = useState<CampusCategory>('lecture_hall');
  const [formLat, setFormLat] = useState('7.3502');
  const [formLng, setFormLng] = useState('-2.3425');
  const [formDescription, setFormDescription] = useState('');
  const [formHours, setFormHours] = useState('Mon - Fri: 8:00 AM - 5:00 PM');
  const [formAccessibility, setFormAccessibility] = useState('Wheelchair accessible entrance');
  const [formVerificationStatus, setFormVerificationStatus] = useState<CampusLocation['verificationStatus']>('verified');
  const [formSource, setFormSource] = useState('OpenStreetMap Verified Node/Way');

  // Announcement form & filter state
  const [editingNotice, setEditingNotice] = useState<CampusNotice | null>(null);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [noticeCategory, setNoticeCategory] = useState<NoticeCategory>('General');
  const [noticePriority, setNoticePriority] = useState<NoticePriority>('Normal');
  const [noticeStatus, setNoticeStatus] = useState<NoticeStatus>('published');
  const [noticeLocationId, setNoticeLocationId] = useState('');
  const [noticeScheduledAt, setNoticeScheduledAt] = useState('');
  const [noticeExpiresAt, setNoticeExpiresAt] = useState('');
  const [noticeStartTime, setNoticeStartTime] = useState('');
  const [noticeEndTime, setNoticeEndTime] = useState('');
  const [isPreviewingNotice, setIsPreviewingNotice] = useState(false);
  const [noticeFilterStatus, setNoticeFilterStatus] = useState<'all' | 'published' | 'scheduled' | 'draft' | 'archived'>('all');

  if (!isOpen) return null;

  const handleGoogleAdminSignIn = async () => {
    setAuthError('');
    setBootstrapSuccess('');
    setIsLoggingIn(true);

    try {
      await signInWithGoogle();
      const token = await getIdToken();
      if (token) {
        try {
          const res = await fetch('/api/admin/bootstrap-admin', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });
          if (res.ok) {
            await refreshAuthToken();
          }
        } catch {
          // Non-blocking if already set or not allowlisted
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Google authentication failed.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleBootstrapAdmin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError('');
    setBootstrapSuccess('');
    setIsLoggingIn(true);

    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error('Please sign in with Google first.');
      }

      const res = await fetch('/api/admin/bootstrap-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bootstrapSecret: bootstrapSecret.trim() || undefined }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to grant administrator privileges.');
      }

      setBootstrapSuccess(data.message || 'Administrator privileges verified.');
      await refreshAuthToken();
    } catch (err: any) {
      setAuthError(err.message || 'Administrator authorization error.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleEditClick = (loc: CampusLocation) => {
    setEditingLocation(loc);
    setIsAddingNew(false);
    setFormName(loc.name);
    setFormShortCode(loc.shortCode);
    setFormAliases(loc.aliases.join(', '));
    setFormCategory(loc.category);
    setFormLat(loc.lat.toString());
    setFormLng(loc.lng.toString());
    setFormDescription(loc.description);
    setFormHours(loc.openingHours || '');
    setFormAccessibility(loc.accessibility);
    setFormVerificationStatus(loc.verificationStatus || 'verified');
    setFormSource(loc.source || 'OpenStreetMap Verified');
  };

  const handleNewClick = () => {
    setIsAddingNew(true);
    setEditingLocation(null);
    setFormName('');
    setFormShortCode('');
    setFormAliases('');
    setFormCategory('lecture_hall');
    setFormLat('7.3502');
    setFormLng('-2.3425');
    setFormDescription('');
    setFormHours('Mon - Fri: 8:00 AM - 5:00 PM');
    setFormAccessibility('Step-free ground level access');
    setFormVerificationStatus('verified');
    setFormSource('OpenStreetMap Verified Node/Way');
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const latNum = parseFloat(formLat);
    const lngNum = parseFloat(formLng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      setBannerMessage({ type: 'error', text: 'Coordinates must be valid decimal numbers (e.g. 7.3502 and -2.3425).' });
      return;
    }

    if (latNum < 7.33 || latNum > 7.37 || lngNum < -2.36 || lngNum > -2.32) {
      setBannerMessage({ type: 'error', text: 'Coordinates are outside UENR Sunyani campus boundary (7.33 - 7.37 N, -2.36 - -2.32 W).' });
      return;
    }

    const aliasesArr = formAliases
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setActionLoading(true);

    try {
      const payload: Partial<CampusLocation> = {
        id: editingLocation ? editingLocation.id : undefined,
        name: formName.trim(),
        shortCode: formShortCode.trim() || formName.trim().slice(0, 4).toUpperCase(),
        aliases: aliasesArr,
        category: formCategory,
        lat: latNum,
        lng: lngNum,
        description: formDescription.trim(),
        openingHours: formHours.trim(),
        accessibility: formAccessibility.trim(),
        verificationStatus: formVerificationStatus,
        source: formSource.trim() || 'Admin Field Inspection',
        lastVerified: new Date().toISOString().split('T')[0],
      };

      const saved = await saveLocationToServer(payload);

      if (isAddingNew) {
        onUpdateLocations([saved, ...locations]);
        setIsAddingNew(false);
        onFocusLocation(saved);
        setBannerMessage({ type: 'success', text: `Added new verified campus location: "${saved.name}"` });
      } else {
        const updated = locations.map((l) => (l.id === saved.id ? saved : l));
        onUpdateLocations(updated);
        setEditingLocation(null);
        setBannerMessage({ type: 'success', text: `Updated details for "${saved.name}"` });
      }
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err.message || 'Failed to save location.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteLocation = (id: string) => {
    const targetLoc = locations.find((l) => l.id === id);
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Campus Location',
      message: `Are you sure you want to delete ${targetLoc ? `"${targetLoc.name}"` : 'this location'}? This will remove the map pin and routing access point.`,
      confirmLabel: 'Delete Location',
      isDestructive: true,
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await deleteLocationOnServer(id);
          const updated = locations.filter((l) => l.id !== id);
          onUpdateLocations(updated);
          setBannerMessage({ type: 'success', text: 'Campus location deleted successfully.' });
        } catch (err: any) {
          setBannerMessage({ type: 'error', text: err.message || 'Failed to delete location.' });
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleExportGeoJSON = () => {
    const geojson = {
      type: 'FeatureCollection',
      name: 'UENR_Campus_Locations',
      features: locations.map((loc) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [loc.lng, loc.lat],
        },
        properties: {
          id: loc.id,
          name: loc.name,
          shortCode: loc.shortCode,
          category: loc.category,
          aliases: loc.aliases.join('; '),
          description: loc.description,
          verificationStatus: loc.verificationStatus,
          accessibility: loc.accessibility,
        },
      })),
    };

    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uenr_campus_locations_${new Date().toISOString().split('T')[0]}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const headers = [
      'id',
      'name',
      'shortCode',
      'category',
      'latitude',
      'longitude',
      'verificationStatus',
      'description',
      'accessibility',
      'aliases',
    ];

    const rows = locations.map((loc) => [
      `"${loc.id}"`,
      `"${loc.name.replace(/"/g, '""')}"`,
      `"${loc.shortCode}"`,
      `"${loc.category}"`,
      loc.lat,
      loc.lng,
      `"${loc.verificationStatus}"`,
      `"${(loc.description || '').replace(/"/g, '""')}"`,
      `"${(loc.accessibility || '').replace(/"/g, '""')}"`,
      `"${loc.aliases.join(';')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uenr_campus_locations_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveNotice = async (overrideStatus?: NoticeStatus) => {
    if (!noticeTitle.trim()) {
      setBannerMessage({ type: 'error', text: 'Announcement title is required.' });
      return;
    }
    if (!noticeMessage.trim()) {
      setBannerMessage({ type: 'error', text: 'Announcement message is required.' });
      return;
    }

    const finalStatus: NoticeStatus = overrideStatus || noticeStatus;
    const loc = locations.find((l) => l.id === noticeLocationId);

    setActionLoading(true);
    try {
      if (editingNotice) {
        // Update existing announcement
        const updated = await updateNoticeOnServer(editingNotice.id, {
          title: noticeTitle.trim(),
          message: noticeMessage.trim(),
          category: noticeCategory,
          priority: noticePriority,
          status: finalStatus,
          affectedLocationId: noticeLocationId || undefined,
          locationName: loc ? loc.name : undefined,
          scheduledAt: finalStatus === 'scheduled' ? noticeScheduledAt || undefined : undefined,
          expiresAt: noticeExpiresAt || undefined,
          startTime: noticeStartTime || undefined,
          endTime: noticeEndTime || undefined,
          active: finalStatus !== 'archived',
        });
        onUpdateNotices(notices.map((n) => (n.id === editingNotice.id ? updated : n)));
        setBannerMessage({ type: 'success', text: `Updated announcement "${updated.title}"` });
      } else {
        // Create new announcement
        const created = await createNoticeOnServer({
          title: noticeTitle.trim(),
          message: noticeMessage.trim(),
          category: noticeCategory,
          priority: noticePriority,
          status: finalStatus,
          affectedLocationId: noticeLocationId || undefined,
          locationName: loc ? loc.name : undefined,
          scheduledAt: finalStatus === 'scheduled' ? noticeScheduledAt || undefined : undefined,
          expiresAt: noticeExpiresAt || undefined,
          startTime: noticeStartTime || undefined,
          endTime: noticeEndTime || undefined,
          active: finalStatus !== 'archived',
        });
        onUpdateNotices([created, ...notices]);
        setBannerMessage({ type: 'success', text: `Published announcement "${created.title}"` });
      }

      // Reset form
      setEditingNotice(null);
      setNoticeTitle('');
      setNoticeMessage('');
      setNoticeCategory('General');
      setNoticePriority('Normal');
      setNoticeStatus('published');
      setNoticeLocationId('');
      setNoticeScheduledAt('');
      setNoticeExpiresAt('');
      setNoticeStartTime('');
      setNoticeEndTime('');
      setIsPreviewingNotice(false);
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err.message || 'Failed to save announcement.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditNotice = (n: CampusNotice) => {
    setEditingNotice(n);
    setNoticeTitle(n.title);
    setNoticeMessage(n.message);
    setNoticeCategory(n.category || 'General');
    setNoticePriority(n.priority || 'Normal');
    setNoticeStatus(n.status || 'published');
    setNoticeLocationId(n.affectedLocationId || '');
    setNoticeScheduledAt(n.scheduledAt || '');
    setNoticeExpiresAt(n.expiresAt || '');
    setNoticeStartTime(n.startTime || '');
    setNoticeEndTime(n.endTime || '');
    setIsPreviewingNotice(false);
  };

  const handleCancelNoticeEdit = () => {
    setEditingNotice(null);
    setNoticeTitle('');
    setNoticeMessage('');
    setNoticeCategory('General');
    setNoticePriority('Normal');
    setNoticeStatus('published');
    setNoticeLocationId('');
    setNoticeScheduledAt('');
    setNoticeExpiresAt('');
    setNoticeStartTime('');
    setNoticeEndTime('');
    setIsPreviewingNotice(false);
  };

  const handleToggleNotice = async (n: CampusNotice) => {
    try {
      const updated = await toggleNoticeOnServer(n.id, !n.active);
      onUpdateNotices(notices.map((item) => (item.id === n.id ? updated : item)));
      setBannerMessage({
        type: 'info',
        text: `Announcement "${n.title}" is now ${updated.active ? 'active' : 'hidden'}.`,
      });
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err.message || 'Failed to toggle notice.' });
    }
  };

  const handleDeleteNotice = (id: string) => {
    const target = notices.find((n) => n.id === id);
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Campus Announcement',
      message: `Are you sure you want to permanently delete "${target?.title || 'this announcement'}"? This action cannot be undone.`,
      confirmLabel: 'Delete Notice',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteNoticeOnServer(id);
          onUpdateNotices(notices.filter((n) => n.id !== id));
          if (editingNotice?.id === id) {
            handleCancelNoticeEdit();
          }
          setBannerMessage({ type: 'success', text: 'Announcement deleted.' });
        } catch (err: any) {
          setBannerMessage({ type: 'error', text: err.message || 'Failed to delete notice.' });
        }
      },
    });
  };

  const handleUpdateReport = async (repId: string, status: CampusReport['status']) => {
    try {
      const updated = await updateReportStatus(repId, status);
      onUpdateReports(reports.map((r) => (r.id === repId ? updated : r)));
      setBannerMessage({ type: 'success', text: `Report marked as ${status}.` });
    } catch (err: any) {
      setBannerMessage({ type: 'error', text: err.message || 'Failed to update report status.' });
    }
  };

  const handleResetDefaults = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Reset Campus Locations to Baseline',
      message: 'Are you sure you want to reset all campus locations to the verified UENR official defaults? Custom edits will be cleared.',
      confirmLabel: 'Reset to Defaults',
      isDestructive: true,
      onConfirm: () => {
        const reset = resetLocationsToDefault();
        onUpdateLocations(reset);
        setEditingLocation(null);
        setIsAddingNew(false);
        setBannerMessage({ type: 'success', text: 'All campus locations restored to verified UENR defaults.' });
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-black/10 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="bg-[#263238] text-white p-4 sm:p-5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#176B45] text-[#D7F36A] flex items-center justify-center font-bold">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold font-display">Campus Admin Console</h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#176B45] text-[#D7F36A] font-semibold uppercase">
                  Server Authenticated
                </span>
              </div>
              <p className="text-xs text-white/70">
                Server-protected management of UENR campus coordinates, student reports, and alerts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
                title="Log out of admin session"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {authLoading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-8 h-8 text-[#176B45] animate-spin" />
            <span className="text-xs text-slate-500">Verifying administrator authorization...</span>
          </div>
        ) : !isAdmin ? (
          /* Google Administrator Authentication & Bootstrap View */
          <div className="p-8 sm:p-12 max-w-md mx-auto w-full space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-[#176B45]/10 text-[#176B45] flex items-center justify-center mx-auto mb-2">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Campus Administrator Portal</h3>
              <p className="text-xs text-slate-500">
                Restricted to authorized UENR Campus Administrators with verified custom claims.
              </p>
            </div>

            {authError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span className="flex-1">{authError}</span>
              </div>
            )}

            {bootstrapSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="flex-1">{bootstrapSuccess}</span>
              </div>
            )}

            {currentUser ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="text-xs text-slate-500 font-medium">Currently Authenticated Account:</div>
                  <div className="flex items-center gap-2">
                    {userProfile?.photoURL || currentUser.photoURL ? (
                      <img
                        src={userProfile?.photoURL || currentUser.photoURL || ''}
                        alt="User"
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#176B45] text-white flex items-center justify-center font-bold text-xs">
                        {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs text-slate-800 truncate">
                        {currentUser.displayName || 'Google User'}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{currentUser.email}</div>
                    </div>
                  </div>
                  <div className="pt-1">
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                      Standard User ({userProfile?.role || 'student'}) — No Admin Claim
                    </span>
                  </div>
                </div>

                <form onSubmit={handleBootstrapAdmin} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Server Bootstrap Secret (Optional)
                    </label>
                    <input
                      type="password"
                      value={bootstrapSecret}
                      onChange={(e) => setBootstrapSecret(e.target.value)}
                      placeholder="Only needed if bootstrapping via server secret"
                      className="w-full px-3 py-2 bg-[#F5F7F4] border border-black/10 rounded-xl text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-[#176B45]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full py-2.5 rounded-xl bg-[#176B45] text-white hover:bg-[#125537] font-semibold text-xs transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isLoggingIn ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying Administrator Claim...</span>
                      </>
                    ) : (
                      <span>Verify & Bootstrap Administrator Rights</span>
                    )}
                  </button>
                </form>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={async () => {
                      await logout();
                      setAuthError('');
                    }}
                    className="text-xs text-slate-500 hover:text-red-600 underline"
                  >
                    Switch to a different Google Account
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={handleGoogleAdminSignIn}
                  disabled={isLoggingIn}
                  className="w-full py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-2.5 disabled:opacity-50"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="w-4 h-4 text-[#176B45] animate-spin" />
                      <span>Authenticating with Google...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                        />
                      </svg>
                      <span>Continue with Google as Administrator</span>
                    </>
                  )}
                </button>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 leading-relaxed text-center">
                  Administrator access is restricted to verified campus admins. Standard accounts cannot perform admin actions.
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Authenticated Workspace */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tabs Bar */}
            <div className="flex items-center justify-between border-b border-black/5 bg-slate-50 px-4 py-2">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {[
                  { id: 'locations', label: `Locations (${locations.length})`, icon: MapPin },
                  { id: 'reports', label: `Student Reports (${reports.length})`, icon: Flag },
                  { id: 'notices', label: `Campus Notices (${notices.length})`, icon: Bell },
                  { id: 'walkways', label: `Walkways (${walkwayEdges.length})`, icon: Footprints },
                  { id: 'import_export', label: 'Import & Export', icon: FileDown },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                        activeTab === tab.id
                          ? 'bg-[#176B45] text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-200/80'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {activeTab === 'locations' && !isAddingNew && !editingLocation && (
                <button
                  onClick={handleNewClick}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#176B45] text-[#D7F36A] hover:bg-[#125537] text-xs font-semibold transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Building</span>
                </button>
              )}
            </div>

            {/* Action Feedback Banner */}
            {bannerMessage && (
              <div
                className={`px-4 py-2.5 flex items-center justify-between text-xs font-semibold animate-in fade-in duration-150 shrink-0 ${
                  bannerMessage.type === 'error'
                    ? 'bg-red-50 text-red-800 border-b border-red-200'
                    : bannerMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                    : 'bg-blue-50 text-blue-800 border-b border-blue-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {bannerMessage.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  ) : bannerMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Info className="w-4 h-4 text-blue-600 shrink-0" />
                  )}
                  <span>{bannerMessage.text}</span>
                </div>
                <button
                  onClick={() => setBannerMessage(null)}
                  className="p-1 hover:bg-black/5 rounded text-current opacity-70 hover:opacity-100"
                  title="Dismiss notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Location Manager Tab */}
            {activeTab === 'locations' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {isAddingNew || editingLocation ? (
                  <form onSubmit={handleSaveLocation} className="space-y-4 max-w-2xl mx-auto">
                    <div className="flex items-center justify-between pb-2 border-b border-black/10">
                      <h3 className="font-bold text-sm sm:text-base text-slate-800">
                        {isAddingNew ? 'Add New Campus Building' : `Edit: ${editingLocation?.name}`}
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingNew(false);
                          setEditingLocation(null);
                        }}
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Official Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          placeholder="e.g. Modern Chemistry Block"
                          className="w-full px-3 py-2 bg-[#F5F7F4] border border-black/10 rounded-xl"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Short Code *
                        </label>
                        <input
                          type="text"
                          required
                          value={formShortCode}
                          onChange={(e) => setFormShortCode(e.target.value)}
                          placeholder="e.g. MCB"
                          className="w-full px-3 py-2 bg-[#F5F7F4] border border-black/10 rounded-xl"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Category *</label>
                        <select
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value as any)}
                          className="w-full px-3 py-2 bg-[#F5F7F4] border border-black/10 rounded-xl"
                        >
                          {Object.values(CATEGORY_METAS).map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Aliases (comma-separated)
                        </label>
                        <input
                          type="text"
                          value={formAliases}
                          onChange={(e) => setFormAliases(e.target.value)}
                          placeholder="e.g. New Chem, Chem Annex"
                          className="w-full px-3 py-2 bg-[#F5F7F4] border border-black/10 rounded-xl"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Latitude (WGS84 decimal) *
                        </label>
                        <input
                          type="text"
                          required
                          value={formLat}
                          onChange={(e) => setFormLat(e.target.value)}
                          placeholder="7.3502"
                          className="w-full px-3 py-2 bg-[#F5F7F4] border border-black/10 rounded-xl font-mono"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Longitude (WGS84 decimal) *
                        </label>
                        <input
                          type="text"
                          required
                          value={formLng}
                          onChange={(e) => setFormLng(e.target.value)}
                          placeholder="-2.3425"
                          className="w-full px-3 py-2 bg-[#F5F7F4] border border-black/10 rounded-xl font-mono"
                        />
                      </div>

                      {/* Live distance from campus center offset */}
                      {(() => {
                        const latNum = parseFloat(formLat);
                        const lngNum = parseFloat(formLng);
                        if (!isNaN(latNum) && !isNaN(lngNum)) {
                          const dist = calculateDistanceMeters(latNum, lngNum, 7.3502, -2.3425);
                          const isWarning = dist > 900;
                          return (
                            <div
                              className={`col-span-full p-2.5 rounded-xl text-xs flex items-center justify-between border ${
                                isWarning
                                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                              }`}
                            >
                              <span className="font-medium">
                                Distance from Campus Core:{' '}
                                <strong className="font-mono">{dist} meters</strong>
                              </span>
                              {isWarning ? (
                                <span className="text-[11px] font-bold text-amber-700">
                                  Warning: Outside typical academic core
                                </span>
                              ) : (
                                <span className="text-[11px] font-semibold text-emerald-700">
                                  Within Central UENR Perimeter
                                </span>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Building Description
                      </label>
                      <textarea
                        rows={2}
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        placeholder="Faculties housed, lecture rooms inside, purpose..."
                        className="w-full px-3 py-2 bg-[#F5F7F4] border border-black/10 rounded-xl text-xs resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Opening Hours
                        </label>
                        <input
                          type="text"
                          value={formHours}
                          onChange={(e) => setFormHours(e.target.value)}
                          placeholder="Mon - Fri: 8:00 AM - 5:00 PM"
                          className="w-full px-3 py-2 bg-[#F5F7F4] border border-black/10 rounded-xl"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Accessibility
                        </label>
                        <input
                          type="text"
                          value={formAccessibility}
                          onChange={(e) => setFormAccessibility(e.target.value)}
                          placeholder="Wheelchair ramp, ground floor access"
                          className="w-full px-3 py-2 bg-[#F5F7F4] border border-black/10 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Geospatial Verification Status *
                        </label>
                        <select
                          value={formVerificationStatus}
                          onChange={(e) => setFormVerificationStatus(e.target.value as any)}
                          className="w-full px-3 py-2 bg-[#F5F7F4] border border-black/10 rounded-xl font-medium"
                        >
                          <option value="verified">Verified (OSM Ground Truth / Survey)</option>
                          <option value="needs_review">Needs Review (Unconfirmed Position)</option>
                          <option value="unverified">Unverified (Pending Inspection)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Data Source / Reference *
                        </label>
                        <input
                          type="text"
                          required
                          value={formSource}
                          onChange={(e) => setFormSource(e.target.value)}
                          placeholder="e.g. OpenStreetMap Way 1251966523 or GPS Survey"
                          className="w-full px-3 py-2 bg-[#F5F7F4] border border-black/10 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingNew(false);
                          setEditingLocation(null);
                        }}
                        className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="px-5 py-2 rounded-xl bg-[#176B45] text-white hover:bg-[#125537] text-xs font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                      >
                        {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span>Save to Server</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-3">
                    {/* Search & Filter Toolbar */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={searchFilter}
                          onChange={(e) => setSearchFilter(e.target.value)}
                          placeholder="Search campus facilities by name, code, or alias..."
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-black/10 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#176B45]"
                        />
                      </div>

                      {/* Status Filter Tabs */}
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                        {[
                          { id: 'all', label: `All (${locations.length})` },
                          {
                            id: 'verified',
                            label: `Verified (${locations.filter((l) => l.verificationStatus === 'verified').length})`,
                          },
                          {
                            id: 'needs_review',
                            label: `Review (${
                              locations.filter(
                                (l) =>
                                  l.verificationStatus === 'needs_review' ||
                                  l.verificationStatus === 'pending_verification'
                              ).length
                            })`,
                          },
                          {
                            id: 'unverified',
                            label: `Unverified (${
                              locations.filter((l) => l.verificationStatus === 'unverified').length
                            })`,
                          },
                        ].map((btn) => (
                          <button
                            key={btn.id}
                            type="button"
                            onClick={() => setStatusFilter(btn.id as any)}
                            className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                              statusFilter === btn.id
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 flex items-center justify-between">
                      <span>
                        Showing {
                          locations.filter((loc) => {
                            const matchText =
                              !searchFilter ||
                              loc.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                              loc.shortCode.toLowerCase().includes(searchFilter.toLowerCase()) ||
                              loc.aliases.some((a) => a.toLowerCase().includes(searchFilter.toLowerCase()));
                            const matchStat =
                              statusFilter === 'all' ||
                              (statusFilter === 'verified' && loc.verificationStatus === 'verified') ||
                              (statusFilter === 'needs_review' &&
                                (loc.verificationStatus === 'needs_review' ||
                                  loc.verificationStatus === 'pending_verification')) ||
                              (statusFilter === 'unverified' && loc.verificationStatus === 'unverified');
                            return matchText && matchStat;
                          }).length
                        } of {locations.length} campus facilities
                      </span>
                      <button
                        onClick={handleResetDefaults}
                        className="text-[11px] text-red-600 hover:underline flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> Reset to Verified Defaults
                      </button>
                    </div>

                    <div className="divide-y divide-black/5 border border-black/10 rounded-2xl overflow-hidden bg-white">
                      {locations
                        .filter((loc) => {
                          const matchText =
                            !searchFilter ||
                            loc.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                            loc.shortCode.toLowerCase().includes(searchFilter.toLowerCase()) ||
                            loc.aliases.some((a) => a.toLowerCase().includes(searchFilter.toLowerCase()));
                          const matchStat =
                            statusFilter === 'all' ||
                            (statusFilter === 'verified' && loc.verificationStatus === 'verified') ||
                            (statusFilter === 'needs_review' &&
                              (loc.verificationStatus === 'needs_review' ||
                                loc.verificationStatus === 'pending_verification')) ||
                            (statusFilter === 'unverified' && loc.verificationStatus === 'unverified');
                          return matchText && matchStat;
                        })
                        .map((loc) => {
                          const meta = CATEGORY_METAS[loc.category];
                          return (
                            <div
                              key={loc.id}
                              className="p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-xs sm:text-sm text-slate-900 truncate">
                                    {loc.name}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {loc.shortCode}
                                  </span>
                                  {loc.verificationStatus === 'verified' ? (
                                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                                      <CheckCircle2 className="w-3 h-3" /> Verified
                                    </span>
                                  ) : loc.verificationStatus === 'needs_review' ||
                                    loc.verificationStatus === 'pending_verification' ? (
                                    <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                                      <AlertCircle className="w-3 h-3" /> Needs Review
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                                      <AlertCircle className="w-3 h-3" /> Unverified
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                                  <span>{meta?.label || loc.category}</span>
                                  <span>·</span>
                                  <span className="font-mono text-slate-700 font-medium">
                                    {loc.lat.toFixed(5)}° N, {Math.abs(loc.lng).toFixed(5)}° W
                                  </span>
                                  {loc.source && (
                                    <>
                                      <span>·</span>
                                      <span className="text-slate-500 truncate max-w-[260px]">
                                        Src: {loc.source}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => onFocusLocation(loc)}
                                  className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors"
                                  title="View pin on map"
                                >
                                  <MapPin className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleEditClick(loc)}
                                  className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition-colors"
                                  title="Edit coordinates & details"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteLocation(loc.id)}
                                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                                  title="Delete location"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Reports Tab */}
            {activeTab === 'reports' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
                <div className="text-xs text-slate-500">
                  Issues submitted by students and campus visitors:
                </div>

                {reports.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No student reports filed yet. All campus coordinates reported operational.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {reports.map((rep) => (
                      <div
                        key={rep.id}
                        className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{rep.locationName}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-red-100 text-red-700">
                              {rep.issueType.replace('_', ' ')}
                            </span>
                            <span className="text-slate-400">by {rep.reporterRole}</span>
                          </div>
                          <p className="text-slate-700 text-xs">{rep.description}</p>
                          <div className="text-[10px] text-slate-400">Submitted on {rep.date}</div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {rep.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => handleUpdateReport(rep.id, 'resolved')}
                                className="px-2.5 py-1 rounded bg-[#176B45] text-white text-[11px] font-semibold hover:bg-[#125537]"
                              >
                                Mark Resolved
                              </button>
                              <button
                                onClick={() => handleUpdateReport(rep.id, 'dismissed')}
                                className="px-2.5 py-1 rounded bg-slate-200 text-slate-700 text-[11px] font-semibold hover:bg-slate-300"
                              >
                                Dismiss
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] font-bold text-slate-400 capitalize">
                              Status: {rep.status}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Campus Announcements & Notices Suite */}
            {activeTab === 'notices' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                {/* Announcement Creation / Editing Form */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#F5F7F4] border border-black/10 space-y-4 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#176B45] text-white flex items-center justify-center font-bold">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm">
                          {editingNotice ? `Edit Announcement: "${editingNotice.title}"` : 'Compose Campus Announcement'}
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Broadcast official university announcements, schedule advisories, or save drafts
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsPreviewingNotice(!isPreviewingNotice)}
                        className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-colors ${
                          isPreviewingNotice
                            ? 'bg-[#176B45] text-white'
                            : 'bg-white text-slate-700 border border-black/10 hover:bg-slate-50'
                        }`}
                      >
                        {isPreviewingNotice ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{isPreviewingNotice ? 'Hide Preview' : 'Live Preview'}</span>
                      </button>

                      {editingNotice && (
                        <button
                          type="button"
                          onClick={handleCancelNoticeEdit}
                          className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-700 hover:bg-slate-300 font-semibold"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Live Student Preview Box */}
                  {isPreviewingNotice && (
                    <div className="p-4 rounded-2xl bg-white border-2 border-emerald-500/40 shadow-sm space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        <span>Student View Preview</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                          {noticeCategory}
                        </span>
                        {noticePriority === 'Urgent' && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-red-100 text-red-700">
                            Urgent
                          </span>
                        )}
                        {noticePriority === 'Important' && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                            Important
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">Scheduled: {noticeScheduledAt || 'Immediately'}</span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        {noticeTitle || 'Untitled Announcement'}
                      </h4>
                      <p className="text-slate-600 leading-relaxed text-xs">
                        {noticeMessage || 'Announcement message preview will appear here.'}
                      </p>
                      {noticeLocationId && (
                        <div className="text-[11px] font-semibold text-[#176B45] flex items-center gap-1 pt-1">
                          <MapPin className="w-3 h-3" />
                          <span>Linked venue: {locations.find((l) => l.id === noticeLocationId)?.name}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Form Input Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">Headline / Title *</label>
                      <input
                        type="text"
                        required
                        value={noticeTitle}
                        onChange={(e) => setNoticeTitle(e.target.value)}
                        placeholder="e.g. Matriculation Ceremony at Bank of Ghana Auditorium"
                        className="w-full px-3 py-2 bg-white border border-black/10 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#176B45]"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Category *</label>
                      <select
                        value={noticeCategory}
                        onChange={(e) => setNoticeCategory(e.target.value as any)}
                        className="w-full px-3 py-2 bg-white border border-black/10 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#176B45]"
                      >
                        <option value="General">General Notice</option>
                        <option value="Academic">Academic Notice</option>
                        <option value="Events">Campus Event</option>
                        <option value="Maintenance">Maintenance & Detours</option>
                        <option value="Safety">Campus Safety</option>
                        <option value="Emergency">Emergency Alert</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Priority Level *</label>
                      <select
                        value={noticePriority}
                        onChange={(e) => setNoticePriority(e.target.value as any)}
                        className="w-full px-3 py-2 bg-white border border-black/10 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#176B45]"
                      >
                        <option value="Normal">Normal Priority</option>
                        <option value="Important">Important (Amber Badge)</option>
                        <option value="Urgent">Urgent (Red Alert Badge)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Linked Campus Location</label>
                      <select
                        value={noticeLocationId}
                        onChange={(e) => setNoticeLocationId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-black/10 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#176B45]"
                      >
                        <option value="">None (Campus-wide notice)</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name} ({loc.shortCode})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Publication Mode</label>
                      <select
                        value={noticeStatus}
                        onChange={(e) => setNoticeStatus(e.target.value as any)}
                        className="w-full px-3 py-2 bg-white border border-black/10 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#176B45]"
                      >
                        <option value="published">Publish Immediately</option>
                        <option value="scheduled">Schedule for Future Date/Time</option>
                        <option value="draft">Save as Internal Draft</option>
                      </select>
                    </div>

                    {/* Schedule Date-Time (if scheduled) */}
                    {noticeStatus === 'scheduled' && (
                      <div className="sm:col-span-2">
                        <label className="block font-semibold text-slate-700 mb-1">
                          Scheduled Release Date & Time *
                        </label>
                        <input
                          type="datetime-local"
                          value={noticeScheduledAt}
                          onChange={(e) => setNoticeScheduledAt(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-black/10 rounded-xl text-slate-800"
                        />
                      </div>
                    )}

                    {/* Optional Expiry Date-Time */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Expiration Date (Optional)</label>
                      <input
                        type="date"
                        value={noticeExpiresAt ? noticeExpiresAt.split('T')[0] : ''}
                        onChange={(e) => setNoticeExpiresAt(e.target.value ? `${e.target.value}T23:59:59Z` : '')}
                        className="w-full px-3 py-2 bg-white border border-black/10 rounded-xl text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Full Announcement Message *</label>
                    <textarea
                      rows={3}
                      required
                      value={noticeMessage}
                      onChange={(e) => setNoticeMessage(e.target.value)}
                      placeholder="Detailed instructions, detour advisories, event timing, or safety steps for students and staff..."
                      className="w-full px-3 py-2 bg-white border border-black/10 rounded-xl text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-[#176B45]"
                    />
                  </div>

                  {/* Submission Buttons */}
                  <div className="flex items-center justify-between pt-1 border-t border-black/5 flex-wrap gap-2">
                    <span className="text-[11px] text-slate-400">
                      Author UID audit stamp: <span className="font-mono text-slate-600">{currentUser?.uid || 'admin'}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveNotice('draft')}
                        disabled={actionLoading}
                        className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold transition-colors disabled:opacity-50"
                      >
                        Save Draft
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSaveNotice(noticeStatus === 'scheduled' ? 'scheduled' : 'published')}
                        disabled={actionLoading}
                        className="px-5 py-2 rounded-xl bg-[#176B45] text-white hover:bg-[#125537] font-semibold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {actionLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 text-[#D7F36A]" />
                        )}
                        <span>
                          {editingNotice
                            ? 'Update Announcement'
                            : noticeStatus === 'scheduled'
                            ? 'Schedule Announcement'
                            : 'Publish Immediately'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Notices Management List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="font-bold text-sm text-slate-800">
                      Campus Announcements Archive ({notices.length})
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium">
                      {(['all', 'published', 'scheduled', 'draft', 'archived'] as const).map((st) => (
                        <button
                          key={st}
                          onClick={() => setNoticeFilterStatus(st)}
                          className={`px-2.5 py-1 rounded-lg capitalize transition-all ${
                            noticeFilterStatus === st
                              ? 'bg-white text-[#176B45] font-bold shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  {notices
                    .filter((n) => {
                      if (noticeFilterStatus === 'all') return true;
                      if (noticeFilterStatus === 'archived') return !n.active || n.status === 'archived';
                      return n.status === noticeFilterStatus;
                    })
                    .map((n) => (
                      <div
                        key={n.id}
                        className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                          editingNotice?.id === n.id
                            ? 'bg-emerald-50 border-emerald-400'
                            : !n.active || n.status === 'archived'
                            ? 'bg-slate-50 border-slate-200 opacity-75'
                            : 'bg-white border-black/10 hover:border-black/20'
                        }`}
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm">{n.title}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase bg-slate-100 text-slate-700">
                              {n.category || 'General'}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                                n.priority === 'Urgent'
                                  ? 'bg-red-100 text-red-700'
                                  : n.priority === 'Important'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {n.priority || 'Normal'}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                n.status === 'published'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : n.status === 'scheduled'
                                  ? 'bg-blue-100 text-blue-800'
                                  : n.status === 'draft'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {n.status || 'published'}
                            </span>
                          </div>

                          <p className="text-slate-600 line-clamp-2 leading-relaxed">{n.message}</p>

                          <div className="flex items-center gap-3 text-[10px] text-slate-400 flex-wrap pt-0.5">
                            {n.locationName && (
                              <span className="text-[#176B45] font-semibold flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {n.locationName}
                              </span>
                            )}
                            {n.scheduledAt && <span>Scheduled: {new Date(n.scheduledAt).toLocaleString()}</span>}
                            {n.expiresAt && <span>Expires: {new Date(n.expiresAt).toLocaleDateString()}</span>}
                            <span>Audited: {n.authorUid || 'admin'}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-black/5">
                          <button
                            onClick={() => handleEditNotice(n)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] flex items-center gap-1"
                            title="Edit announcement"
                          >
                            <Edit2 className="w-3 h-3 text-[#176B45]" />
                            <span>Edit</span>
                          </button>

                          <button
                            onClick={() => handleToggleNotice(n)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                              n.active ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-slate-200 text-slate-600'
                            }`}
                            title="Toggle active status"
                          >
                            {n.active ? 'Published' : 'Archived'}
                          </button>

                          <button
                            onClick={() => handleDeleteNotice(n.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete announcement"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Import & Export Tab */}
            {activeTab === 'import_export' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                <div className="space-y-2">
                  <h3 className="font-bold text-sm text-slate-800">Export Campus Geographic Data</h3>
                  <p className="text-xs text-slate-600">
                    Download the verified UENR dataset for GIS analysis in QGIS / ArcGIS, backup, or OpenStreetMap contribution:
                  </p>
                  <div className="flex flex-wrap gap-3 pt-1">
                    <button
                      onClick={handleExportGeoJSON}
                      className="px-4 py-2.5 rounded-xl bg-[#176B45] text-white hover:bg-[#125537] text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
                    >
                      <FileDown className="w-4 h-4 text-[#D7F36A]" />
                      <span>Export as GeoJSON (.geojson)</span>
                    </button>
                    <button
                      onClick={handleExportCSV}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 text-white hover:bg-slate-900 text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
                    >
                      <FileDown className="w-4 h-4 text-emerald-400" />
                      <span>Export as CSV Spreadsheet (.csv)</span>
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-black/10 space-y-2">
                  <h3 className="font-bold text-sm text-slate-800">Import GeoJSON Data with Bounds Check</h3>
                  <p className="text-xs text-slate-600">
                    Upload a GeoJSON file to bulk-import verified campus coordinates (Strictly bounds-checked to UENR Sunyani):
                  </p>
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-400 bg-slate-50 hover:bg-slate-100 cursor-pointer text-xs font-semibold text-slate-700 transition-colors">
                    <FileUp className="w-4 h-4 text-[#176B45]" />
                    <span>Choose GeoJSON File</span>
                    <input
                      type="file"
                      accept=".geojson,.json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = async (event) => {
                            try {
                              const json = JSON.parse(event.target?.result as string);
                              if (json.type === 'FeatureCollection' && Array.isArray(json.features)) {
                                const validNewLocs: CampusLocation[] = [];
                                let rejectedCount = 0;

                                for (const f of json.features) {
                                  const lng = f.geometry?.coordinates?.[0];
                                  const lat = f.geometry?.coordinates?.[1];

                                  if (
                                    typeof lat === 'number' &&
                                    typeof lng === 'number' &&
                                    lat >= 7.33 &&
                                    lat <= 7.37 &&
                                    lng >= -2.36 &&
                                    lng <= -2.32
                                  ) {
                                    validNewLocs.push({
                                      id: f.properties?.id || `import-${Date.now()}-${validNewLocs.length}`,
                                      name: String(f.properties?.name || 'Imported Campus Point').replace(/[<>]/g, ''),
                                      shortCode: String(f.properties?.shortCode || 'IMP').slice(0, 8),
                                      aliases: f.properties?.aliases ? String(f.properties.aliases).split(';') : [],
                                      category: f.properties?.category || 'lecture_hall',
                                      lat,
                                      lng,
                                      description: String(f.properties?.description || '').replace(/[<>]/g, ''),
                                      accessibility: String(f.properties?.accessibility || 'Standard access'),
                                      verificationStatus:
                                        f.properties?.verificationStatus === 'needs_review' ||
                                        f.properties?.verificationStatus === 'unverified'
                                          ? f.properties.verificationStatus
                                          : 'verified',
                                      source: String(f.properties?.source || 'Imported GeoJSON Dataset'),
                                      lastVerified: new Date().toISOString().split('T')[0],
                                      facilities: ['Standard Facilities'],
                                    });
                                  } else {
                                    rejectedCount++;
                                  }
                                }

                                if (validNewLocs.length > 0) {
                                  onUpdateLocations([...validNewLocs, ...locations]);
                                  setBannerMessage({
                                    type: 'success',
                                    text: `Successfully imported ${validNewLocs.length} verified campus locations!${
                                      rejectedCount > 0 ? ` (${rejectedCount} outside UENR boundary were skipped)` : ''
                                    }`,
                                  });
                                } else {
                                  setBannerMessage({
                                    type: 'error',
                                    text: 'No features inside UENR Sunyani boundary were found in this file.',
                                  });
                                }
                              } else {
                                setBannerMessage({
                                  type: 'error',
                                  text: 'Invalid GeoJSON format. Must be a FeatureCollection.',
                                });
                              }
                            } catch {
                              setBannerMessage({
                                type: 'error',
                                text: 'Failed to parse GeoJSON file. Please check syntax.',
                              });
                            }
                          };
                          reader.readAsText(file);
                        }
                      }}
                    />
                  </label>
                </div>

                {/* CSV Import */}
                <div className="pt-4 border-t border-black/10 space-y-2">
                  <h3 className="font-bold text-sm text-slate-800">Import CSV Spreadsheet</h3>
                  <p className="text-xs text-slate-600">
                    Upload a CSV spreadsheet with headers (name, latitude, longitude, category, source):
                  </p>
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-400 bg-slate-50 hover:bg-slate-100 cursor-pointer text-xs font-semibold text-slate-700 transition-colors">
                    <FileUp className="w-4 h-4 text-emerald-700" />
                    <span>Choose CSV File</span>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = async (event) => {
                            try {
                              const text = event.target?.result as string;
                              const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
                              if (lines.length < 2) {
                                setBannerMessage({ type: 'error', text: 'CSV file is empty or missing data rows.' });
                                return;
                              }

                              const headerCols = lines[0].split(',').map((h) => h.replace(/["\r]/g, '').trim().toLowerCase());
                              const latIdx = headerCols.findIndex((c) => c === 'latitude' || c === 'lat');
                              const lngIdx = headerCols.findIndex((c) => c === 'longitude' || c === 'lng' || c === 'lon');
                              const nameIdx = headerCols.findIndex((c) => c === 'name');
                              const catIdx = headerCols.findIndex((c) => c === 'category');
                              const srcIdx = headerCols.findIndex((c) => c === 'source');
                              const statIdx = headerCols.findIndex((c) => c === 'verificationstatus' || c === 'status');

                              if (latIdx === -1 || lngIdx === -1 || nameIdx === -1) {
                                setBannerMessage({
                                  type: 'error',
                                  text: 'CSV must include "name", "latitude", and "longitude" columns.',
                                });
                                return;
                              }

                              const imported: CampusLocation[] = [];
                              let rejected = 0;

                              for (let i = 1; i < lines.length; i++) {
                                const row = lines[i].split(',').map((val) => val.replace(/^["']|["']$/g, '').trim());
                                const lat = parseFloat(row[latIdx]);
                                const lng = parseFloat(row[lngIdx]);
                                const name = row[nameIdx];

                                if (
                                  name &&
                                  !isNaN(lat) &&
                                  !isNaN(lng) &&
                                  lat >= 7.33 &&
                                  lat <= 7.37 &&
                                  lng >= -2.36 &&
                                  lng <= -2.32
                                ) {
                                  imported.push({
                                    id: `csv-${Date.now()}-${imported.length}`,
                                    name,
                                    shortCode: name.slice(0, 4).toUpperCase(),
                                    aliases: [],
                                    category: (catIdx !== -1 && row[catIdx] ? row[catIdx] : 'lecture_hall') as CampusCategory,
                                    lat,
                                    lng,
                                    description: `Imported coordinate for ${name}`,
                                    accessibility: 'Standard access',
                                    verificationStatus:
                                      statIdx !== -1 && row[statIdx] === 'needs_review'
                                        ? 'needs_review'
                                        : 'verified',
                                    source: srcIdx !== -1 && row[srcIdx] ? row[srcIdx] : 'CSV Spreadsheet Import',
                                    lastVerified: new Date().toISOString().split('T')[0],
                                    facilities: ['Standard Facilities'],
                                  });
                                } else {
                                  rejected++;
                                }
                              }

                              if (imported.length > 0) {
                                onUpdateLocations([...imported, ...locations]);
                                setBannerMessage({
                                  type: 'success',
                                  text: `Successfully imported ${imported.length} facilities from CSV! (${rejected} skipped outside campus bounds)`,
                                });
                              } else {
                                setBannerMessage({
                                  type: 'error',
                                  text: 'No valid UENR coordinates found in CSV.',
                                });
                              }
                            } catch {
                              setBannerMessage({ type: 'error', text: 'Failed to parse CSV spreadsheet file.' });
                            }
                          };
                          reader.readAsText(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Walkways & Routing Network Tab */}
            {activeTab === 'walkways' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/10">
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-slate-800 flex items-center gap-2">
                      <Footprints className="w-4 h-4 text-[#176B45]" />
                      <span>Verified Pedestrian Pathway Network</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Manage real campus walkways, temporary path closures, and ground accessibility attributes
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleValidateGraph}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Test graph for isolated nodes or disconnected pathway components"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Validate Connectivity</span>
                    </button>
                    <button
                      onClick={handleResetWalkways}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Reset graph to verified official OpenStreetMap baseline"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                      <span>Reset to Baseline</span>
                    </button>
                  </div>
                </div>

                {/* Graph Connectivity Report Banner */}
                {graphConnectivity && (
                  <div
                    className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${
                      graphConnectivity.isValid
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    {graphConnectivity.isValid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 space-y-1">
                      <div className="font-bold">
                        {graphConnectivity.isValid
                          ? 'Graph Topology Valid & Fully Connected'
                          : 'Network Topology Advisory'}
                      </div>
                      <p className="text-[11px] leading-relaxed">{graphConnectivity.summary}</p>
                    </div>
                  </div>
                )}

                {/* Search / Filter bar for walkways */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search verified pathways by name or connected nodes..."
                      value={edgeSearchFilter}
                      onChange={(e) => setEdgeSearchFilter(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-black/10 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#176B45]"
                    />
                  </div>
                </div>

                {/* Edges List */}
                <div className="space-y-2.5">
                  {walkwayEdges
                    .filter((edge) => {
                      if (!edgeSearchFilter.trim()) return true;
                      const term = edgeSearchFilter.toLowerCase();
                      const fromName = VERIFIED_CAMPUS_NODES[edge.from]?.name.toLowerCase() || '';
                      const toName = VERIFIED_CAMPUS_NODES[edge.to]?.name.toLowerCase() || '';
                      return (
                        edge.pathwayName.toLowerCase().includes(term) ||
                        fromName.includes(term) ||
                        toName.includes(term)
                      );
                    })
                    .map((edge) => {
                      const fromNode = VERIFIED_CAMPUS_NODES[edge.from];
                      const toNode = VERIFIED_CAMPUS_NODES[edge.to];
                      return (
                        <div
                          key={edge.id}
                          className={`p-3.5 rounded-2xl border transition-all ${
                            edge.isTemporarilyClosed
                              ? 'bg-amber-50/60 border-amber-200'
                              : 'bg-white border-black/10 hover:border-black/20 shadow-xs'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-xs text-slate-800">
                                  {edge.pathwayName}
                                </span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                  {edge.distance} m
                                </span>
                                {edge.isTemporarilyClosed ? (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500 text-white">
                                    Temporarily Closed
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                    Open
                                  </span>
                                )}
                              </div>

                              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                                <span>{fromNode?.name || edge.from}</span>
                                <span className="text-slate-300">↔</span>
                                <span>{toNode?.name || edge.to}</span>
                              </div>

                              <div className="flex items-center gap-1.5 pt-1 flex-wrap text-[10px]">
                                {edge.hasStairs ? (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                                    Stairs ({edge.stairsCount || 10}+ steps)
                                  </span>
                                ) : edge.isStepFree ? (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                                    Step-Free
                                  </span>
                                ) : null}

                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 capitalize">
                                  Surface: {edge.surface}
                                </span>

                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 capitalize">
                                  Slope: {edge.slope}
                                </span>

                                {edge.notes && (
                                  <span className="text-slate-500 italic">
                                    Note: {edge.notes}
                                  </span>
                                )}
                              </div>
                            </div>

                            <button
                              onClick={() => handleToggleEdgeClosure(edge.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                                edge.isTemporarilyClosed
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                  : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                              }`}
                            >
                              {edge.isTemporarilyClosed ? 'Reopen Pathway' : 'Mark Closed'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* In-Modal Confirmation Dialog (replaces browser confirm dialog) */}
        {confirmDialog.isOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl border border-black/15 max-w-md w-full p-5 space-y-4 animate-in zoom-in-95 duration-150 text-[#263238]">
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    confirmDialog.isDestructive
                      ? 'bg-red-100 text-red-600'
                      : 'bg-[#176B45]/15 text-[#176B45]'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-sm text-slate-900 leading-snug">
                    {confirmDialog.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {confirmDialog.message}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/5">
                <button
                  type="button"
                  onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const action = confirmDialog.onConfirm;
                    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                    await action();
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition-colors shadow-sm ${
                    confirmDialog.isDestructive
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-[#176B45] hover:bg-[#125537]'
                  }`}
                >
                  {confirmDialog.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
