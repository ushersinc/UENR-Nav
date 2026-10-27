import React from 'react';
import {
  ArrowUp,
  ArrowUpRight,
  ArrowUpLeft,
  ArrowRight,
  ArrowLeft,
  CornerUpRight,
  CornerUpLeft,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Locate,
  X,
  Compass,
  Footprints,
  Clock,
  Sparkles,
} from 'lucide-react';
import { LiveNavigationProgress, ManeuverType } from '../types/campus';
import { formatDistance, formatWalkingDuration } from '../services/routingService';

interface NavigationCompanionHUDProps {
  destinationName: string;
  progress: LiveNavigationProgress | null;
  isFollowingUser: boolean;
  onResumeFollowing: () => void;
  onEndNavigation: () => void;
  isRecalculating?: boolean;
}

export const NavigationCompanionHUD: React.FC<NavigationCompanionHUDProps> = ({
  destinationName,
  progress,
  isFollowingUser,
  onResumeFollowing,
  onEndNavigation,
  isRecalculating = false,
}) => {
  if (!progress) return null;

  const renderManeuverIcon = (maneuver: ManeuverType) => {
    const iconClass = 'w-6 h-6 sm:w-7 sm:h-7 text-[#D7F36A]';
    switch (maneuver) {
      case 'straight':
      case 'depart':
        return <ArrowUp className={iconClass} />;
      case 'slight_right':
        return <ArrowUpRight className={iconClass} />;
      case 'turn_right':
        return <CornerUpRight className={iconClass} />;
      case 'slight_left':
        return <ArrowUpLeft className={iconClass} />;
      case 'turn_left':
        return <CornerUpLeft className={iconClass} />;
      case 'u_turn':
        return <RotateCcw className={iconClass} />;
      case 'arrive':
        return <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-[#D7F36A]" />;
      default:
        return <ArrowUp className={iconClass} />;
    }
  };

  const isArrived = progress.hasArrived;
  const isOffRoute = progress.isOffRoute && !isArrived;
  const accuracy = progress.userAccuracy;

  return (
    <div className="absolute top-3 left-3 right-3 sm:left-4 sm:right-auto sm:w-[420px] z-30 pointer-events-auto">
      <div className="bg-[#176B45] text-white rounded-2xl shadow-2xl border-2 border-[#D7F36A]/50 overflow-hidden backdrop-blur-md transition-all">
        {/* Progress Bar along the very top edge */}
        <div className="w-full bg-black/25 h-1.5 overflow-hidden">
          <div
            className="h-full bg-[#D7F36A] transition-all duration-300 ease-out"
            style={{ width: `${progress.percentComplete}%` }}
          />
        </div>

        {/* Main Instruction Header */}
        <div className="p-3.5 sm:p-4">
          <div className="flex items-start gap-3.5">
            {/* Maneuver Direction Icon Bubble */}
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner border border-white/20 ${
                isArrived
                  ? 'bg-emerald-700 text-[#D7F36A]'
                  : isOffRoute
                  ? 'bg-amber-600 text-white'
                  : 'bg-[#104b30] text-[#D7F36A]'
              }`}
            >
              {isArrived ? (
                <CheckCircle2 className="w-7 h-7 text-[#D7F36A]" />
              ) : isOffRoute ? (
                <AlertTriangle className="w-7 h-7 text-white animate-pulse" />
              ) : (
                renderManeuverIcon(progress.nextManeuver)
              )}
            </div>

            {/* Instruction Text & Turn Distance */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="text-[10px] font-bold tracking-wider uppercase text-[#D7F36A]/90">
                  {isArrived
                    ? 'Destination Reached'
                    : isOffRoute
                    ? 'Off Route Notice'
                    : progress.distanceToNextTurn > 0
                    ? `Next turn in ${formatDistance(progress.distanceToNextTurn)}`
                    : 'Current Instruction'}
                </span>
                <span className="text-[10px] font-medium text-white/70 truncate max-w-[140px]">
                  To: {destinationName}
                </span>
              </div>

              <h2 className="text-sm sm:text-base font-bold leading-tight text-white line-clamp-2">
                {isRecalculating
                  ? 'Recalculating pedestrian route...'
                  : isOffRoute
                  ? 'You are off the route. Head back toward the campus walkway.'
                  : progress.currentInstruction}
              </h2>
            </div>

            {/* End Navigation Button */}
            <button
              onClick={onEndNavigation}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition-colors shrink-0"
              title="Stop live walking guidance"
              aria-label="End walking navigation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Bottom Metric Strip (Remaining Distance, Time, Accuracy, & Recenter Action) */}
          <div className="mt-3 pt-2.5 border-t border-white/15 flex items-center justify-between text-xs flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 font-bold text-white">
                <Footprints className="w-3.5 h-3.5 text-[#D7F36A]" />
                <span>{formatDistance(progress.distanceRemaining)}</span>
              </div>
              <span className="text-white/40">·</span>
              <div className="flex items-center gap-1 text-white/90">
                <Clock className="w-3.5 h-3.5 text-white/70" />
                <span>{formatWalkingDuration(progress.estimatedTimeRemaining)}</span>
              </div>
            </div>

            {/* Accuracy Pill & Resume Camera Button */}
            <div className="flex items-center gap-2">
              <div
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 border ${
                  accuracy <= 10
                    ? 'bg-emerald-950/60 text-[#D7F36A] border-[#D7F36A]/40'
                    : accuracy <= 25
                    ? 'bg-amber-950/60 text-amber-200 border-amber-400/40'
                    : 'bg-red-950/60 text-red-200 border-red-400/40'
                }`}
                title={`GPS horizontal accuracy is within ±${accuracy} meters`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    accuracy <= 10
                      ? 'bg-[#D7F36A] animate-pulse'
                      : accuracy <= 25
                      ? 'bg-amber-400'
                      : 'bg-red-400'
                  }`}
                />
                <span>GPS ±{accuracy}m</span>
              </div>

              {!isFollowingUser && (
                <button
                  onClick={onResumeFollowing}
                  className="px-2.5 py-1 rounded-lg bg-[#D7F36A] text-[#176B45] text-[11px] font-bold flex items-center gap-1 hover:brightness-105 active:scale-95 shadow-md transition-all"
                  title="Center map on your current walking position"
                >
                  <Locate className="w-3.5 h-3.5 animate-spin" />
                  <span>Resume Follow</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
