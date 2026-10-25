import React, { useState } from 'react';
import {
  X,
  Navigation,
  Bookmark,
  Share2,
  Clock,
  Accessibility,
  CheckCircle2,
  AlertCircle,
  Phone,
  Flag,
  Sparkles,
  Layers,
  MapPin,
  Check,
} from 'lucide-react';
import { CampusLocation } from '../types/campus';
import { CATEGORY_METAS } from '../data/campusLocations';

interface LocationDetailCardProps {
  location: CampusLocation;
  isSaved: boolean;
  onToggleSave: (locationId: string) => void;
  onGetDirections: (location: CampusLocation) => void;
  onClose: () => void;
  onReportIssue: (location: CampusLocation) => void;
}

export const LocationDetailCard: React.FC<LocationDetailCardProps> = ({
  location,
  isSaved,
  onToggleSave,
  onGetDirections,
  onClose,
  onReportIssue,
}) => {
  const [copied, setCopied] = useState(false);
  const categoryMeta = CATEGORY_METAS[location.category];

  const handleShare = () => {
    const url = `${window.location.origin}/?place=${encodeURIComponent(location.id)}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-black/10 overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[600px] w-full text-[#263238] transition-all">
      {/* Top Banner & Image/Illustration */}
      <div className="relative h-32 sm:h-36 bg-gradient-to-br from-[#176B45] to-[#0d4029] p-4 flex flex-col justify-between text-white overflow-hidden">
        {/* Subtle geometric pattern */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#D7F36A_1px,transparent_1px)] [background-size:16px_16px]" />

        {/* Top actions */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className="px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1.5 shadow-sm"
              style={{
                backgroundColor: categoryMeta ? categoryMeta.bgColor : '#FFFFFF',
                color: categoryMeta ? categoryMeta.color : '#176B45',
              }}
            >
              <MapPin className="w-3 h-3" />
              {categoryMeta?.label || location.category}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Share button */}
            <button
              onClick={handleShare}
              className="p-1.5 rounded-full bg-black/20 hover:bg-black/35 text-white transition-colors"
              title="Copy link to location"
            >
              {copied ? <Check className="w-4 h-4 text-[#D7F36A]" /> : <Share2 className="w-4 h-4" />}
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-black/20 hover:bg-black/35 text-white transition-colors"
              title="Close details"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bottom Banner Title */}
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold font-display leading-tight truncate">
              {location.name}
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/80 mt-0.5">
            <span className="font-medium text-[#D7F36A]">Code: {location.shortCode}</span>
            {location.floorCount && (
              <>
                <span aria-hidden="true">·</span>
                <span>{location.floorCount} {location.floorCount === 1 ? 'Floor' : 'Floors'}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
        {/* Verification Status, Coordinates & Source */}
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {location.verificationStatus === 'verified' ? (
                <div className="flex items-center gap-1 text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Verified Coordinates</span>
                </div>
              ) : location.verificationStatus === 'needs_review' ? (
                <div className="flex items-center gap-1 text-amber-600 font-semibold">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span>Needs Field Review</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-slate-500 font-semibold">
                  <AlertCircle className="w-4 h-4 text-slate-400" />
                  <span>Unverified Pin</span>
                </div>
              )}
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              {location.lat.toFixed(5)}° N, {Math.abs(location.lng).toFixed(5)}° W
            </span>
          </div>
          {location.source && (
            <div className="text-[11px] text-slate-600 flex items-center gap-1 pt-1 border-t border-slate-200/60">
              <span className="font-semibold text-slate-700">Source:</span>
              <span className="truncate">{location.source}</span>
            </div>
          )}
        </div>

        {/* Also Known As */}
        {location.aliases.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Also known as
            </div>
            <div className="flex flex-wrap gap-1.5">
              {location.aliases.map((alias, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded bg-[#F5F7F4] text-slate-700 text-xs font-medium border border-black/5"
                >
                  {alias}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        <div>
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            About this building
          </div>
          <p className="text-slate-700 leading-relaxed text-xs sm:text-sm">
            {location.description}
          </p>
        </div>

        {/* Opening Hours */}
        {location.openingHours && (
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-xs text-slate-800">Hours of Access</div>
              <div className="text-xs text-slate-600 mt-0.5">{location.openingHours}</div>
            </div>
          </div>
        )}

        {/* Accessibility Information */}
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-start gap-2.5">
          <Accessibility className="w-4 h-4 text-[#176B45] shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-xs text-slate-800">Accessibility & Access</div>
            <div className="text-xs text-slate-600 mt-0.5">{location.accessibility}</div>
          </div>
        </div>

        {/* Facilities / Amenities Available */}
        {location.facilities.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Available Facilities
            </div>
            <div className="flex flex-wrap gap-1.5">
              {location.facilities.map((fac, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-800 text-[11px] font-medium border border-emerald-100 flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  {fac}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Contact Phone (if available) */}
        {location.contactPhone && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#176B45]" />
              <div className="text-xs">
                <span className="font-semibold text-emerald-950">Campus Office Hotline:</span>{' '}
                <span className="text-emerald-800 font-mono">{location.contactPhone}</span>
              </div>
            </div>
            <a
              href={`tel:${location.contactPhone}`}
              className="px-2.5 py-1 rounded bg-[#176B45] text-white text-xs font-semibold hover:bg-[#125537]"
            >
              Call
            </a>
          </div>
        )}

        {/* Report link */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={() => onReportIssue(location)}
            className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1 transition-colors"
          >
            <Flag className="w-3.5 h-3.5" />
            <span>Report incorrect building information</span>
          </button>
        </div>
      </div>

      {/* Primary Action Buttons (Fixed Bottom) */}
      <div className="p-3.5 bg-slate-50 border-t border-black/10 flex items-center gap-2">
        <button
          onClick={() => onGetDirections(location)}
          className="flex-1 py-2.5 px-4 rounded-xl bg-[#176B45] text-[#D7F36A] hover:bg-[#125537] font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm active:scale-98"
        >
          <Navigation className="w-4 h-4" />
          <span>Get Walking Directions</span>
        </button>

        <button
          onClick={() => onToggleSave(location.id)}
          className={`p-2.5 rounded-xl border transition-all flex items-center justify-center shrink-0 ${
            isSaved
              ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
              : 'bg-white text-slate-600 border-black/15 hover:bg-slate-100'
          }`}
          title={isSaved ? 'Remove from saved places' : 'Save this place'}
        >
          <Bookmark className="w-5 h-5" fill={isSaved ? 'currentColor' : 'none'} />
        </button>
      </div>
    </div>
  );
};
