import React, { useState, useMemo } from 'react';
import {
  X,
  Bell,
  Search,
  CheckCheck,
  Calendar,
  Clock,
  MapPin,
  AlertTriangle,
  Flame,
  Info,
  Wrench,
  BookOpen,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { CampusNotice, CampusLocation, NoticeCategory, NoticePriority } from '../types/campus';
import { filterVisibleNotices, markNoticeAsRead, markAllNoticesAsRead } from '../services/storageService';
import { useAuth } from '../context/AuthContext';

interface AnnouncementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notices: CampusNotice[];
  readNoticeIds: string[];
  onUpdateReadNoticeIds: (ids: string[]) => void;
  locations: CampusLocation[];
  onSelectLocationOnMap?: (loc: CampusLocation) => void;
  onGetDirectionsToLocation?: (loc: CampusLocation) => void;
}

const CATEGORIES: { id: NoticeCategory | 'all'; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'all', label: 'All Notices', icon: Bell },
  { id: 'Emergency', label: 'Emergency', icon: Flame },
  { id: 'Safety', label: 'Safety', icon: ShieldAlert },
  { id: 'Maintenance', label: 'Maintenance', icon: Wrench },
  { id: 'Academic', label: 'Academic', icon: BookOpen },
  { id: 'Events', label: 'Events', icon: Calendar },
  { id: 'General', label: 'General', icon: Info },
];

export const AnnouncementsModal: React.FC<AnnouncementsModalProps> = ({
  isOpen,
  onClose,
  notices,
  readNoticeIds,
  onUpdateReadNoticeIds,
  locations,
  onSelectLocationOnMap,
  onGetDirectionsToLocation,
}) => {
  const { currentUser, isAdmin } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<NoticeCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNoticeDetail, setSelectedNoticeDetail] = useState<CampusNotice | null>(null);

  // Filter only visible active published announcements for students
  const visibleNotices = useMemo(() => {
    return filterVisibleNotices(notices, isAdmin);
  }, [notices, isAdmin]);

  // Apply search query and category filters
  const filteredNotices = useMemo(() => {
    return visibleNotices.filter((n) => {
      if (selectedCategory !== 'all' && n.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = n.title.toLowerCase().includes(q);
        const matchesMessage = n.message.toLowerCase().includes(q);
        const matchesLocation = n.locationName?.toLowerCase().includes(q) || false;
        if (!matchesTitle && !matchesMessage && !matchesLocation) {
          return false;
        }
      }
      return true;
    });
  }, [visibleNotices, selectedCategory, searchQuery]);

  const unreadCount = useMemo(() => {
    return visibleNotices.filter((n) => !readNoticeIds.includes(n.id)).length;
  }, [visibleNotices, readNoticeIds]);

  if (!isOpen) return null;

  const handleOpenNoticeDetail = (notice: CampusNotice) => {
    setSelectedNoticeDetail(notice);
    if (!readNoticeIds.includes(notice.id)) {
      const updated = markNoticeAsRead(notice.id, currentUser?.uid);
      onUpdateReadNoticeIds(updated);
    }
  };

  const handleMarkAllRead = () => {
    const allIds = visibleNotices.map((n) => n.id);
    const updated = markAllNoticesAsRead(allIds, currentUser?.uid);
    onUpdateReadNoticeIds(updated);
  };

  const getPriorityBadge = (priority?: NoticePriority) => {
    switch (priority) {
      case 'Urgent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 animate-pulse border border-red-200">
            <Flame className="w-3 h-3" /> Urgent
          </span>
        );
      case 'Important':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3" /> Important
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
            Normal
          </span>
        );
    }
  };

  const getCategoryColor = (category?: NoticeCategory) => {
    switch (category) {
      case 'Emergency':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'Safety':
        return 'text-amber-800 bg-amber-50 border-amber-200';
      case 'Maintenance':
        return 'text-blue-800 bg-blue-50 border-blue-200';
      case 'Academic':
        return 'text-purple-800 bg-purple-50 border-purple-200';
      case 'Events':
        return 'text-emerald-800 bg-emerald-50 border-emerald-200';
      default:
        return 'text-slate-800 bg-slate-100 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-black/10 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="bg-[#176B45] text-white p-4 sm:p-5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D7F36A] text-[#176B45] flex items-center justify-center font-bold shadow-inner">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold font-display">Campus Announcements</h2>
                {unreadCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D7F36A] text-[#176B45] font-bold">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-xs text-white/80">
                Official notices, event updates, safety advisories, and pathway maintenance for UENR
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors"
                title="Mark all announcements as read"
              >
                <CheckCheck className="w-3.5 h-3.5 text-[#D7F36A]" />
                <span>Mark All as Read</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Close announcements"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-3 sm:p-4 bg-[#F5F7F4] border-b border-black/5 space-y-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search announcements by title, keyword, or campus location..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-black/10 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#176B45]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs font-medium">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl shrink-0 transition-all ${
                    isSelected
                      ? 'bg-[#176B45] text-white font-bold shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-black/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Notices Feed List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3">
          {filteredNotices.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Bell className="w-10 h-10 mx-auto text-slate-300" />
              <div className="text-sm font-semibold text-slate-700">No announcements match your filter</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                There are no active notices under this category or search term at this moment. All campus pathways and services are operating normally.
              </p>
            </div>
          ) : (
            filteredNotices.map((notice) => {
              const isUnread = !readNoticeIds.includes(notice.id);
              const relatedLoc = notice.affectedLocationId
                ? locations.find((l) => l.id === notice.affectedLocationId)
                : null;

              return (
                <div
                  key={notice.id}
                  onClick={() => handleOpenNoticeDetail(notice)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col gap-2.5 ${
                    isUnread
                      ? 'bg-emerald-50/40 border-emerald-300 shadow-xs hover:border-[#176B45]'
                      : 'bg-white border-black/10 hover:border-black/20 hover:shadow-xs'
                  }`}
                >
                  {/* Top Metadata Row */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      {isUnread && (
                        <span className="w-2.5 h-2.5 rounded-full bg-[#176B45] shrink-0" title="Unread" />
                      )}
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${getCategoryColor(
                          notice.category
                        )}`}
                      >
                        {notice.category || 'General'}
                      </span>
                      {getPriorityBadge(notice.priority)}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{notice.postedDate || 'Recent'}</span>
                    </div>
                  </div>

                  {/* Title & Excerpt */}
                  <div>
                    <h3 className="font-display font-bold text-sm sm:text-base text-slate-900 leading-snug">
                      {notice.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 mt-1 leading-relaxed">
                      {notice.message}
                    </p>
                  </div>

                  {/* Bottom Location & Action Row */}
                  <div className="flex items-center justify-between pt-1 border-t border-black/5 text-xs text-slate-500">
                    {notice.locationName || relatedLoc ? (
                      <div className="flex items-center gap-1 text-[#176B45] font-semibold text-[11px]">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate max-w-[220px]">
                          {notice.locationName || relatedLoc?.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400">Campus-wide notice</span>
                    )}

                    <div className="flex items-center gap-1 text-[#176B45] font-semibold text-[11px]">
                      <span>Read Full Notice</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Notice Details View if selected */}
        {selectedNoticeDetail && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl shadow-2xl border border-black/10 w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh]">
              {/* Detail Header */}
              <div className="bg-[#176B45] text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white text-[#176B45]`}
                  >
                    {selectedNoticeDetail.category || 'General'}
                  </span>
                  {getPriorityBadge(selectedNoticeDetail.priority)}
                </div>
                <button
                  onClick={() => setSelectedNoticeDetail(null)}
                  className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Detail Body */}
              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
                <h2 className="text-lg sm:text-xl font-bold font-display text-slate-900 leading-snug">
                  {selectedNoticeDetail.title}
                </h2>

                <div className="flex items-center gap-3 text-xs text-slate-500 pb-3 border-b border-black/5 flex-wrap">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#176B45]" />
                    <span>Published: {selectedNoticeDetail.postedDate}</span>
                  </div>
                  {selectedNoticeDetail.expiresAt && (
                    <div className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Valid until: {new Date(selectedNoticeDetail.expiresAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {selectedNoticeDetail.message}
                </div>

                {/* Linked Location Card if linked */}
                {selectedNoticeDetail.affectedLocationId && (
                  <div className="p-3.5 rounded-2xl bg-[#F5F7F4] border border-black/5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#176B45] text-[#D7F36A] flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Affected Campus Venue</div>
                        <div className="font-bold text-xs sm:text-sm text-slate-800">
                          {selectedNoticeDetail.locationName || 'Campus Location'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onSelectLocationOnMap && (
                        <button
                          onClick={() => {
                            const target = locations.find((l) => l.id === selectedNoticeDetail.affectedLocationId);
                            if (target) {
                              onSelectLocationOnMap(target);
                              setSelectedNoticeDetail(null);
                              onClose();
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[#176B45] text-white hover:bg-[#125537] text-xs font-semibold flex items-center gap-1"
                        >
                          <span>View on Map</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                      {onGetDirectionsToLocation && (
                        <button
                          onClick={() => {
                            const target = locations.find((l) => l.id === selectedNoticeDetail.affectedLocationId);
                            if (target) {
                              onGetDirectionsToLocation(target);
                              setSelectedNoticeDetail(null);
                              onClose();
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[#D7F36A] text-[#176B45] hover:bg-[#c9e855] text-xs font-semibold"
                        >
                          Directions
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Detail Footer */}
              <div className="p-3.5 bg-slate-50 border-t border-black/10 flex justify-end">
                <button
                  onClick={() => setSelectedNoticeDetail(null)}
                  className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-xs font-semibold text-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-black/10 flex items-center justify-between text-xs text-slate-500">
          <span>Official announcements issued by UENR Directorate of Communications & Security.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold"
          >
            Close Feed
          </button>
        </div>
      </div>
    </div>
  );
};
