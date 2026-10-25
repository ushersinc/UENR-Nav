import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Compass,
  Bookmark,
  MapPin,
  FileText,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { signInWithGoogle, currentUser, userProfile, logout } = useAuth();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [useRedirectFallback, setUseRedirectFallback] = useState(false);

  if (!isOpen) return null;

  const handleGoogleSignIn = async (forceRedirect: boolean = false) => {
    setErrorMsg('');
    setLoading(true);

    try {
      await signInWithGoogle(forceRedirect || useRedirectFallback);
      // Popup flow resolves successfully; redirect flow navigates away
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not complete Google sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-black/10 w-full max-w-md overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header with UENR green branding */}
        <div className="bg-[#176B45] text-white p-5 sm:p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-[#D7F36A] text-[#176B45] flex items-center justify-center shadow-inner shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg leading-tight">
                {currentUser ? 'UENR Account Profile' : 'Sign in to UENR Nav'}
              </h2>
              <span className="text-[11px] text-white/80 font-normal">
                University of Energy and Natural Resources
              </span>
            </div>
          </div>

          <p className="text-xs text-white/90 leading-relaxed mt-1">
            {currentUser
              ? 'Your Google Account is active. Your saved lecture halls and preferences are synchronized.'
              : 'Sign in with your university (@uenr.edu.gh) or personal Google Account to sync saved lecture halls, bookmark routes, and submit campus reports.'}
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block mb-0.5">Authentication Notice</span>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {currentUser ? (
            /* Logged In State */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                {userProfile?.photoURL || currentUser.photoURL ? (
                  <img
                    src={userProfile?.photoURL || currentUser.photoURL || ''}
                    alt={currentUser.displayName || 'Profile'}
                    className="w-10 h-10 rounded-full object-cover border-2 border-emerald-400 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#176B45] text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 truncate">
                      {currentUser.displayName || 'UENR Member'}
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-[#176B45] shrink-0" />
                  </div>
                  <div className="text-slate-600 text-xs truncate">{currentUser.email}</div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-emerald-200/60 text-emerald-900">
                      {userProfile?.role || 'Student'}
                    </span>
                    {userProfile?.isAdmin && (
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                        Admin Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl bg-[#176B45] text-white hover:bg-[#125537] font-semibold text-xs transition-colors shadow-sm"
                >
                  Return to Campus Map
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    onClose();
                  }}
                  className="w-full py-2 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 font-semibold text-xs transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            /* Sign In Flow */
            <div className="space-y-4">
              {/* Feature Highlights */}
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
                  <Bookmark className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Bookmark lecture halls</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-[#176B45] shrink-0" />
                  <span>Offline GPS guidance</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Submit issue reports</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Secure Google SSO</span>
                </div>
              </div>

              {/* Primary Google Sign-In Button */}
              <button
                type="button"
                onClick={() => handleGoogleSignIn(false)}
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs sm:text-sm transition-all shadow-sm flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.99] cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 text-[#176B45] animate-spin" />
                    <span>Connecting to Google...</span>
                  </>
                ) : (
                  <>
                    {/* Official Multi-Color Google G SVG Icon */}
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
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              {/* Mobile / Popup-blocked Fallback Option */}
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => handleGoogleSignIn(true)}
                  disabled={loading}
                  className="text-[11px] text-slate-500 hover:text-[#176B45] underline flex items-center justify-center gap-1.5 mx-auto"
                >
                  <Smartphone className="w-3 h-3" />
                  <span>On mobile or popup blocked? Use Full-Page Redirect</span>
                </button>
              </div>

              {/* Institutional Notice */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 leading-relaxed text-center">
                <span className="font-semibold text-slate-700 block mb-0.5">
                  Official UENR Authentication
                </span>
                We use Firebase Authentication with official Google Single Sign-On. Existing account bookmarks and saved preferences are preserved automatically.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
