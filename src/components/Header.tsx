import React, { useState, useEffect } from 'react';
import {
  Compass,
  PhoneCall,
  Bell,
  GraduationCap,
  Shield,
  MapPin,
  ExternalLink,
  ChevronDown,
  X,
  FileSpreadsheet,
  WifiOff,
  CloudCheck,
  User,
  LogIn,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { CampusNotice } from '../types/campus';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  onOpenFreshersGuide: () => void;
  onOpenAdmin: () => void;
  onOpenSchematic: () => void;
  onOpenAuth: () => void;
  onOpenAnnouncements: () => void;
  unreadCount: number;
  notices: CampusNotice[];
  onSelectNotice?: (notice: CampusNotice) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenFreshersGuide,
  onOpenAdmin,
  onOpenSchematic,
  onOpenAuth,
  onOpenAnnouncements,
  unreadCount,
  notices,
  onSelectNotice,
}) => {
  const { currentUser, userProfile, logout, isAdmin } = useAuth();
  const [showEmergencyMenu, setShowEmergencyMenu] = useState(false);
  const [showNoticesMenu, setShowNoticesMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Monitor network status for offline caching indicator
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const activeNotices = notices.filter((n) => n.active);

  return (
    <header className="bg-[#176B45] text-white shadow-md relative z-30 select-none">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-15 flex items-center justify-between gap-2">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#D7F36A] flex items-center justify-center shadow-inner text-[#176B45] shrink-0">
            {/* Custom Original Brand Logo: Pin + Path + Compass */}
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-label="UENR Nav Logo"
            >
              <circle cx="12" cy="10" r="3" fill="#176B45" />
              <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
              <path d="M12 7l1.5 3-3-1.5z" fill="#D7F36A" />
            </svg>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-base sm:text-lg lg:text-xl tracking-tight text-white leading-none">
                UENR Nav
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-white/15 text-[#D7F36A] border border-white/10 hidden sm:inline-block">
                Sunyani Campus
              </span>
              {!isOnline && (
                <span className="flex items-center gap-1 text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-amber-400/90 text-slate-900 shadow-sm animate-pulse">
                  <WifiOff className="w-3 h-3" />
                  <span>Offline Mode</span>
                </span>
              )}
            </div>
            <span className="text-[11px] text-white/80 font-normal hidden md:inline-block">
              University of Energy and Natural Resources · Pedestrian Navigation
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Schematic Blueprint reference */}
          <button
            onClick={onOpenSchematic}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10"
            title="View original UENR campus map schematic"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#D7F36A]" />
            <span className="hidden lg:inline">Reference Map</span>
          </button>

          {/* Freshers Mode */}
          <button
            onClick={onOpenFreshersGuide}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#D7F36A] text-[#176B45] hover:bg-[#c9e855] transition-all shadow-sm active:scale-95"
            title="Campus orientation for freshers and new visitors"
          >
            <GraduationCap className="w-4 h-4" />
            <span className="hidden sm:inline">New to UENR?</span>
            <span className="sm:hidden">Freshers</span>
          </button>

          {/* Campus Announcements & Notices Button */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNoticesMenu(!showNoticesMenu);
                setShowEmergencyMenu(false);
              }}
              className="relative p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Campus announcements & notices"
              aria-label="Campus announcements"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 ? (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#D7F36A] text-[#176B45] text-[10px] font-bold rounded-full flex items-center justify-center shadow">
                  {unreadCount}
                </span>
              ) : activeNotices.length > 0 ? (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#D7F36A] rounded-full" />
              ) : null}
            </button>

            {showNoticesMenu && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white text-[#263238] rounded-2xl shadow-2xl border border-black/10 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between px-4 py-2 border-b border-black/5">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[#176B45]" />
                    <span className="font-semibold text-sm">Campus Notices</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setShowNoticesMenu(false);
                        onOpenAnnouncements();
                      }}
                      className="text-xs text-[#176B45] hover:underline font-semibold"
                    >
                      View All
                    </button>
                    <button
                      onClick={() => setShowNoticesMenu(false)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-black/5">
                  {activeNotices.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No active campus notices at this time. All walkways and pathways are open.
                    </div>
                  ) : (
                    activeNotices.slice(0, 4).map((notice) => (
                      <div
                        key={notice.id}
                        onClick={() => {
                          setShowNoticesMenu(false);
                          if (onSelectNotice) {
                            onSelectNotice(notice);
                          } else {
                            onOpenAnnouncements();
                          }
                        }}
                        className="p-3 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span
                            className={`font-semibold ${
                              notice.priority === 'Urgent' || notice.type === 'critical'
                                ? 'text-red-700'
                                : notice.priority === 'Important' || notice.type === 'warning'
                                ? 'text-amber-700'
                                : 'text-[#176B45]'
                            }`}
                          >
                            {notice.title}
                          </span>
                          <span className="text-[10px] text-slate-400">{notice.postedDate}</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{notice.message}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="px-3 pt-2 pb-1 border-t border-black/5">
                  <button
                    onClick={() => {
                      setShowNoticesMenu(false);
                      onOpenAnnouncements();
                    }}
                    className="w-full py-2 rounded-xl bg-[#176B45] text-white hover:bg-[#125537] text-xs font-semibold text-center transition-colors"
                  >
                    Open Announcements Center
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Emergency Hotline Button */}
          <div className="relative">
            <button
              onClick={() => {
                setShowEmergencyMenu(!showEmergencyMenu);
                setShowNoticesMenu(false);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-red-600/90 hover:bg-red-600 text-white transition-colors"
              title="UENR Emergency contacts"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Emergency</span>
            </button>

            {showEmergencyMenu && (
              <div className="absolute right-0 mt-2 w-72 bg-white text-[#263238] rounded-2xl shadow-2xl border border-black/10 p-3.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-black/5">
                  <span className="font-semibold text-xs text-red-600 flex items-center gap-1.5">
                    <PhoneCall className="w-3.5 h-3.5" /> UENR Emergency Hotlines
                  </span>
                  <button
                    onClick={() => setShowEmergencyMenu(false)}
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-red-50 border border-red-100 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-red-900">Campus Security Post 1</div>
                      <div className="text-red-700 font-mono text-[11px]">+233 59 657 4532</div>
                    </div>
                    <a
                      href="tel:+233596574532"
                      className="px-2.5 py-1 bg-red-600 text-white rounded-lg font-medium text-[11px] hover:bg-red-700 transition-colors"
                    >
                      Call
                    </a>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-amber-900">Campus Security Post 2</div>
                      <div className="text-amber-800 font-mono text-[11px]">+233 55 091 0106</div>
                    </div>
                    <a
                      href="tel:+233550910106"
                      className="px-2.5 py-1 bg-amber-600 text-white rounded-lg font-medium text-[11px] hover:bg-amber-700 transition-colors"
                    >
                      Call
                    </a>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-emerald-900">UENR Health Clinic</div>
                      <div className="text-emerald-800 font-mono text-[11px]">24/7 Outpatient & Triage</div>
                    </div>
                    <span className="text-[10px] text-emerald-700 font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100">
                      Open 24/7
                    </span>
                  </div>

                  {/* Pre-launch dispatch advisory notice */}
                  <div className="pt-2 border-t border-black/5 text-[10px] text-slate-500 space-y-1">
                    <div className="flex items-center gap-1 text-amber-700 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span>Pre-Launch Notice: Contact numbers pending UENR Security signoff.</span>
                    </div>
                    <div>
                      National Emergency Toll-Free: <a href="tel:112" className="text-[#176B45] font-bold underline">112</a> (Police / Ambulance)
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Account / Sign In */}
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => {
                  setShowUserMenu(!showUserMenu);
                  setShowNoticesMenu(false);
                  setShowEmergencyMenu(false);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10 text-xs font-semibold"
                title="Account profile"
              >
                {userProfile?.photoURL || currentUser.photoURL ? (
                  <img
                    src={userProfile?.photoURL || currentUser.photoURL || ''}
                    alt={userProfile?.displayName || 'User'}
                    className="w-5 h-5 rounded-full object-cover border border-white/30"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-[#D7F36A] text-[#176B45] flex items-center justify-center text-[10px] font-bold">
                    {(userProfile?.displayName || currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <span className="hidden sm:inline max-w-[90px] truncate">
                  {userProfile?.displayName || currentUser.displayName || 'My Account'}
                </span>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white text-[#263238] rounded-2xl shadow-2xl border border-black/10 p-3.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-xs">
                  <div className="pb-2.5 mb-2.5 border-b border-black/5">
                    <div className="font-bold text-slate-800 text-sm truncate">
                      {userProfile?.displayName || 'UENR Member'}
                    </div>
                    <div className="text-slate-500 text-[11px] truncate">{currentUser.email}</div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {userProfile?.role || 'Student'}
                      </span>
                      {isAdmin && (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[#D7F36A] text-[#176B45]">
                          Campus Admin
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      logout();
                      setShowUserMenu(false);
                    }}
                    className="w-full py-2 px-2.5 rounded-xl hover:bg-red-50 text-red-600 transition-colors flex items-center gap-2 font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10"
              title="Sign in with university Google account"
            >
              <LogIn className="w-3.5 h-3.5 text-[#D7F36A]" />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          )}

          {/* Admin portal launcher */}
          <button
            onClick={onOpenAdmin}
            className={`p-2 rounded-lg transition-colors ${
              isAdmin
                ? 'bg-[#D7F36A] text-[#176B45] hover:bg-[#c9e855] shadow-xs'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title="Campus Administrator Portal"
            aria-label="Campus Admin Portal"
          >
            <Shield className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
