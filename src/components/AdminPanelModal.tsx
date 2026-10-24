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
} from 'lucide-react';
import { CampusCategory, CampusLocation, CampusNotice, CampusReport } from '../types/campus';
import { CATEGORY_METAS } from '../data/campusLocations';
import { useAuth } from '../context/AuthContext';
import {
  saveLocationToServer,
  deleteLocationOnServer,
  updateReportStatus,
  createNoticeOnServer,
  toggleNoticeOnServer,
  deleteNoticeOnServer,
  resetLocationsToDefault,
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
    login,
    logout,
    loading: authLoading,
    getIdToken,
    refreshAuthToken,
  } = useAuth();
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'locations' | 'reports' | 'notices' | 'import_export'>('locations');
  const [editingLocation, setEditingLocation] = useState<CampusLocation | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // New location form state
  const [formName, setFormName] = useState('');
  const [formShortCode, setFormShortCode] = useState('');
  const [formAliases, setFormAliases] = useState('');
  const [formCategory, setFormCategory] = useState<CampusCategory>('lecture_hall');
  const [formLat, setFormLat] = useState('7.3495');
  const [formLng, setFormLng] = useState('-2.3435');
  const [formDescription, setFormDescription] = useState('');
  const [formHours, setFormHours] = useState('Mon - Fri: 8:00 AM - 5:00 PM');
  const [formAccessibility, setFormAccessibility] = useState('Wheelchair accessible entrance');
  const [formVerified, setFormVerified] = useState(true);

  // Notice form state
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [noticeType, setNoticeType] = useState<CampusNotice['type']>('warning');

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoggingIn(true);

    try {
      await login(adminEmail, adminPassword);
      setAdminPassword('');
      const token = await getIdToken();
      if (token) {
        try {
          await fetch('/api/admin/bootstrap-admin', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          await refreshAuthToken();
        } catch {
          // ignore if user is already established or not bootstrap target
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Invalid administrator credentials.');
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
    setFormVerified(loc.verificationStatus === 'verified');
  };

  const handleNewClick = () => {
    setIsAddingNew(true);
    setEditingLocation(null);
    setFormName('');
    setFormShortCode('');
    setFormAliases('');
    setFormCategory('lecture_hall');
    setFormLat('7.3495');
    setFormLng('-2.3435');
    setFormDescription('');
    setFormHours('Mon - Fri: 8:00 AM - 5:00 PM');
    setFormAccessibility('Step-free ground level access');
    setFormVerified(true);
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const latNum = parseFloat(formLat);
    const lngNum = parseFloat(formLng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      alert('Coordinates must be valid decimal numbers (e.g. 7.3495 and -2.3435)');
      return;
    }

    if (latNum < 7.33 || latNum > 7.37 || lngNum < -2.36 || lngNum > -2.32) {
      alert('Coordinates are outside UENR Sunyani campus boundary (7.33 - 7.37 N, -2.36 - -2.32 W).');
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
        verificationStatus: formVerified ? 'verified' : 'pending_verification',
      };

      const saved = await saveLocationToServer(payload);

      if (isAddingNew) {
        onUpdateLocations([saved, ...locations]);
        setIsAddingNew(false);
        onFocusLocation(saved);
      } else {
        const updated = locations.map((l) => (l.id === saved.id ? saved : l));
        onUpdateLocations(updated);
        setEditingLocation(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save location.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteLocation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campus location?')) return;

    setActionLoading(true);
    try {
      await deleteLocationOnServer(id);
      const updated = locations.filter((l) => l.id !== id);
      onUpdateLocations(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to delete location.');
    } finally {
      setActionLoading(false);
    }
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

  const handlePostNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeMessage.trim()) return;

    setActionLoading(true);
    try {
      const created = await createNoticeOnServer({
        title: noticeTitle.trim(),
        message: noticeMessage.trim(),
        type: noticeType,
      });

      onUpdateNotices([created, ...notices]);
      setNoticeTitle('');
      setNoticeMessage('');
    } catch (err: any) {
      alert(err.message || 'Failed to post notice.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleNotice = async (n: CampusNotice) => {
    try {
      const updated = await toggleNoticeOnServer(n.id, !n.active);
      onUpdateNotices(notices.map((item) => (item.id === n.id ? updated : item)));
    } catch (err: any) {
      alert(err.message || 'Failed to toggle notice.');
    }
  };

  const handleDeleteNotice = async (id: string) => {
    try {
      await deleteNoticeOnServer(id);
      onUpdateNotices(notices.filter((n) => n.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete notice.');
    }
  };

  const handleUpdateReport = async (repId: string, status: CampusReport['status']) => {
    try {
      const updated = await updateReportStatus(repId, status);
      onUpdateReports(reports.map((r) => (r.id === repId ? updated : r)));
    } catch (err: any) {
      alert(err.message || 'Failed to update report.');
    }
  };

  const handleResetDefaults = () => {
    if (confirm('Reset all locations to the verified UENR official defaults? Custom edits will be cleared.')) {
      const reset = resetLocationsToDefault();
      onUpdateLocations(reset);
      setEditingLocation(null);
      setIsAddingNew(false);
    }
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
          /* Authentication Form */
          <div className="p-8 sm:p-12 max-w-md mx-auto w-full space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-[#176B45]/10 text-[#176B45] flex items-center justify-center mx-auto mb-2">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Protected Administrator Access</h3>
              <p className="text-xs text-slate-500">
                Please sign in with verified UENR administrator credentials.
              </p>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Institutional Admin Email
                </label>
                <input
                  type="text"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@uenr.edu.gh"
                  className="w-full px-3 py-2 bg-[#F5F7F4] border border-black/10 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#176B45]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Admin Passcode
                </label>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-[#F5F7F4] border border-black/10 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#176B45]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-2.5 rounded-xl bg-[#176B45] text-white hover:bg-[#125537] font-semibold text-xs transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying with Server...</span>
                    </>
                  ) : (
                    <span>Sign In to Admin Console</span>
                  )}
                </button>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-100 text-[11px] text-slate-500 text-center">
                Default configured credentials: <strong className="text-slate-700">admin@uenr.edu.gh</strong> (env: ADMIN_EMAIL)
              </div>
            </form>
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
                          placeholder="7.3495"
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
                          placeholder="-2.3435"
                          className="w-full px-3 py-2 bg-[#F5F7F4] border border-black/10 rounded-xl font-mono"
                        />
                      </div>
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

                    <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-black/5">
                      <input
                        type="checkbox"
                        id="verifyCheckbox"
                        checked={formVerified}
                        onChange={(e) => setFormVerified(e.target.checked)}
                        className="w-4 h-4 rounded text-[#176B45] focus:ring-[#176B45]"
                      />
                      <label htmlFor="verifyCheckbox" className="text-xs font-medium text-slate-700 cursor-pointer">
                        Mark location coordinates as field-verified by UENR GIS team
                      </label>
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
                  <div className="space-y-2">
                    <div className="text-xs text-slate-500 flex items-center justify-between">
                      <span>Total {locations.length} campus facilities configured</span>
                      <button
                        onClick={handleResetDefaults}
                        className="text-[11px] text-red-600 hover:underline flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> Reset to UENR Defaults
                      </button>
                    </div>

                    <div className="divide-y divide-black/5 border border-black/10 rounded-2xl overflow-hidden bg-white">
                      {locations.map((loc) => {
                        const meta = CATEGORY_METAS[loc.category];
                        return (
                          <div
                            key={loc.id}
                            className="p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
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
                                ) : (
                                  <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                                    <AlertCircle className="w-3 h-3" /> Pending Calibration
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                                <span>{meta?.label || loc.category}</span>
                                <span>·</span>
                                <span className="font-mono">
                                  {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleEditClick(loc)}
                                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition-colors"
                                title="Edit building"
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

            {/* Notices Tab */}
            {activeTab === 'notices' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                <form onSubmit={handlePostNotice} className="p-4 rounded-2xl bg-[#F5F7F4] border border-black/5 space-y-3 text-xs">
                  <div className="font-bold text-slate-800 text-sm">Broadcast Campus Notice</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">Headline</label>
                      <input
                        type="text"
                        required
                        value={noticeTitle}
                        onChange={(e) => setNoticeTitle(e.target.value)}
                        placeholder="e.g. Pathway Paving Near Odum Block"
                        className="w-full px-3 py-1.5 bg-white border border-black/10 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Notice Type</label>
                      <select
                        value={noticeType}
                        onChange={(e) => setNoticeType(e.target.value as any)}
                        className="w-full px-3 py-1.5 bg-white border border-black/10 rounded-xl"
                      >
                        <option value="warning">Warning / Detour</option>
                        <option value="event">Campus Event</option>
                        <option value="info">General Info</option>
                        <option value="critical">Critical Alert</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Detailed Message</label>
                    <textarea
                      rows={2}
                      required
                      value={noticeMessage}
                      onChange={(e) => setNoticeMessage(e.target.value)}
                      placeholder="Instructions for students and visitors..."
                      className="w-full px-3 py-1.5 bg-white border border-black/10 rounded-xl text-xs resize-none"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-4 py-1.5 rounded-xl bg-[#176B45] text-white hover:bg-[#125537] text-xs font-semibold shadow-xs disabled:opacity-50"
                    >
                      Publish Notice
                    </button>
                  </div>
                </form>

                <div className="space-y-2">
                  <div className="font-semibold text-xs text-slate-700">Active Notices:</div>
                  {notices.map((n) => (
                    <div
                      key={n.id}
                      className="p-3 rounded-xl bg-white border border-black/10 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{n.title}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 uppercase font-semibold">
                            {n.type}
                          </span>
                        </div>
                        <p className="text-slate-600 text-xs mt-0.5">{n.message}</p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleToggleNotice(n)}
                          className={`px-2 py-1 rounded text-[11px] font-semibold ${
                            n.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {n.active ? 'Active' : 'Archived'}
                        </button>
                        <button
                          onClick={() => handleDeleteNotice(n.id)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
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
                                      verificationStatus: 'verified',
                                      lastVerified: new Date().toISOString().split('T')[0],
                                      facilities: ['Standard Facilities'],
                                    });
                                  } else {
                                    rejectedCount++;
                                  }
                                }

                                if (validNewLocs.length > 0) {
                                  onUpdateLocations([...validNewLocs, ...locations]);
                                  alert(
                                    `Successfully imported ${validNewLocs.length} verified campus locations!${
                                      rejectedCount > 0
                                        ? ` (${rejectedCount} outside UENR campus boundary were rejected)`
                                        : ''
                                    }`
                                  );
                                } else {
                                  alert('No features inside UENR Sunyani boundary were found in this file.');
                                }
                              } else {
                                alert('Invalid GeoJSON format. Must be a FeatureCollection.');
                              }
                            } catch {
                              alert('Failed to parse GeoJSON file.');
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
          </div>
        )}
      </div>
    </div>
  );
};
