import React, { useState } from 'react';
import {
  X,
  Navigation,
  ArrowUpDown,
  Footprints,
  Clock,
  Compass,
  MapPin,
  ChevronRight,
  AlertCircle,
  Locate,
  Accessibility,
  CheckCircle2,
  AlertTriangle,
  Flame,
} from 'lucide-react';
import { CampusLocation, RouteInfo, RoutingPreference } from '../types/campus';
import { formatDistance, formatWalkingDuration } from '../services/routingService';

interface DirectionsPanelProps {
  route: RouteInfo | null;
  locations: CampusLocation[];
  destination: CampusLocation;
  startPoint: { name: string; coordinates: [number, number] };
  userLocation: [number, number] | null;
  isLoading: boolean;
  onSelectStartLocation: (start: { name: string; coordinates: [number, number] }) => void;
  onSwapPoints: () => void;
  onClearDirections: () => void;
  onEnablePickOnMap: () => void;
  isPickingOnMap: boolean;
  routingPreference: RoutingPreference;
  onChangePreference: (pref: RoutingPreference) => void;
}

export const DirectionsPanel: React.FC<DirectionsPanelProps> = ({
  route,
  locations,
  destination,
  startPoint,
  userLocation,
  isLoading,
  onSelectStartLocation,
  onSwapPoints,
  onClearDirections,
  onEnablePickOnMap,
  isPickingOnMap,
  routingPreference,
  onChangePreference,
}) => {
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  // Popular starting points on campus (Geographically verified)
  const quickStartOptions = [
    ...(userLocation ? [{ name: 'My Current Location (GPS)', coordinates: userLocation }] : []),
    { name: 'Main Campus Gate', coordinates: [7.34919, -2.34382] as [number, number] },
    { name: 'University Hall 1', coordinates: [7.35280, -2.34420] as [number, number] },
    { name: 'Central Cafeteria', coordinates: [7.34951, -2.34248] as [number, number] },
    { name: 'LT Block Plaza', coordinates: [7.35124, -2.34158] as [number, number] },
    { name: 'Central Administration', coordinates: [7.34793, -2.34224] as [number, number] },
    { name: 'Bank of Ghana Aud', coordinates: [7.35337, -2.34024] as [number, number] },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-black/10 overflow-hidden flex flex-col w-full text-[#263238] transition-all max-h-[85vh] sm:max-h-[640px]">
      {/* Top Header */}
      <div className="bg-[#176B45] text-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Footprints className="w-5 h-5 text-[#D7F36A]" />
            <h2 className="font-display font-bold text-base sm:text-lg">Campus Navigation</h2>
          </div>
          <button
            onClick={onClearDirections}
            className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Cancel directions"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Origin & Destination inputs */}
        <div className="space-y-2 relative">
          {/* Start Point */}
          <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2 border border-white/15">
            <div className="w-2.5 h-2.5 rounded-full bg-white shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase font-semibold text-white/70">From (Starting Point)</div>
              <div className="text-xs font-semibold text-white truncate">{startPoint.name}</div>
            </div>
            {/* Quick drop selector */}
            <select
              value={startPoint.name}
              onChange={(e) => {
                const opt = quickStartOptions.find((o) => o.name === e.target.value);
                if (opt) onSelectStartLocation(opt);
              }}
              className="bg-transparent text-white text-[11px] font-medium border-0 focus:ring-0 cursor-pointer max-w-[120px] truncate"
            >
              {quickStartOptions.map((opt, i) => (
                <option key={i} value={opt.name} className="text-[#263238] bg-white">
                  {opt.name}
                </option>
              ))}
            </select>
          </div>

          {/* Swap icon */}
          <button
            onClick={onSwapPoints}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-[#D7F36A] text-[#176B45] shadow-md hover:scale-105 transition-all z-10"
            title="Swap start and destination"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>

          {/* Destination */}
          <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2 border border-white/15">
            <div className="w-2.5 h-2.5 rounded-full bg-[#D7F36A] shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase font-semibold text-[#D7F36A]">To (Destination)</div>
              <div className="text-xs font-semibold text-white truncate">{destination.name}</div>
            </div>
          </div>
        </div>

        {/* Start Point Alternatives */}
        <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-white/10 text-xs flex-wrap">
          <button
            onClick={onEnablePickOnMap}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
              isPickingOnMap
                ? 'bg-[#D7F36A] text-[#176B45] font-bold'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{isPickingOnMap ? 'Clicking on Map...' : 'Pick on Map'}</span>
          </button>

          {userLocation && (
            <button
              onClick={() =>
                onSelectStartLocation({
                  name: 'My Current Location (GPS)',
                  coordinates: userLocation,
                })
              }
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium transition-colors flex items-center gap-1.5"
            >
              <Locate className="w-3.5 h-3.5 text-[#D7F36A]" />
              <span>Use My GPS</span>
            </button>
          )}
        </div>

        {/* Accessible Routing Mode Selector */}
        <div className="mt-3 pt-2.5 border-t border-white/15">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-white/80 mb-1.5 flex items-center gap-1">
            <Accessibility className="w-3.5 h-3.5 text-[#D7F36A]" />
            <span>Route Accessibility Preference</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 bg-black/20 p-1 rounded-xl text-[11px]">
            <button
              type="button"
              onClick={() => onChangePreference('all')}
              className={`py-1.5 px-2 rounded-lg font-medium transition-all text-center ${
                routingPreference === 'all'
                  ? 'bg-white text-[#176B45] font-bold shadow-xs'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              Standard Walk
            </button>
            <button
              type="button"
              onClick={() => onChangePreference('step_free')}
              className={`py-1.5 px-2 rounded-lg font-medium transition-all text-center flex items-center justify-center gap-1 ${
                routingPreference === 'step_free' || routingPreference === 'wheelchair'
                  ? 'bg-[#D7F36A] text-[#176B45] font-bold shadow-xs'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <Accessibility className="w-3.5 h-3.5" />
              <span>Step-Free</span>
            </button>
            <button
              type="button"
              onClick={() => onChangePreference('avoid_stairs')}
              className={`py-1.5 px-2 rounded-lg font-medium transition-all text-center ${
                routingPreference === 'avoid_stairs'
                  ? 'bg-white text-[#176B45] font-bold shadow-xs'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              Avoid Stairs
            </button>
          </div>
        </div>
      </div>

      {/* Route Summary & Accessibility Verification Card */}
      {isLoading ? (
        <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center space-y-2">
          <div className="w-7 h-7 border-3 border-[#176B45] border-t-transparent rounded-full animate-spin" />
          <div className="text-xs font-medium">Calculating verified campus route...</div>
        </div>
      ) : route ? (
        <>
          {/* No Accessible Route Found Warning Screen */}
          {route.noAccessibleRouteFound ? (
            <div className="p-5 sm:p-6 text-center space-y-3 bg-amber-50/70 border-b border-amber-200">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="text-sm font-bold text-slate-800">No Verified Accessible Route Found</div>
              <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                We couldn't verify an accessible step-free route for this destination. Please choose another route or consult campus assistance at the Main Gate or Health Clinic.
              </p>
              <div className="pt-1">
                <button
                  onClick={() => onChangePreference('all')}
                  className="px-3.5 py-1.5 rounded-xl bg-[#176B45] text-white text-xs font-semibold hover:bg-[#125537] transition-colors"
                >
                  Switch to Standard Pedestrian Route
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Distance, Duration & Accessibility Verification Badge */}
              <div className="px-4 py-3 bg-[#F5F7F4] border-b border-black/5 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#176B45]" />
                    <span className="font-display font-bold text-base text-[#176B45]">
                      {formatWalkingDuration(route.duration)}
                    </span>
                    <span className="text-xs text-slate-500">walk</span>
                  </div>
                  <span className="text-slate-300">|</span>
                  <div className="flex items-center gap-1.5">
                    <Footprints className="w-4 h-4 text-slate-500" />
                    <span className="font-semibold text-xs text-slate-700">
                      {formatDistance(route.distance)}
                    </span>
                  </div>
                </div>

                {/* Accessibility Badge */}
                {route.accessibility?.isStepFree ? (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                    <Accessibility className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Verified Step-Free</span>
                  </div>
                ) : route.accessibility?.hasStairs ? (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-[11px] font-bold">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                    <span>Contains Stairs Flight</span>
                  </div>
                ) : (
                  <span className="text-[11px] font-semibold text-slate-700 bg-slate-200/70 px-2 py-0.5 rounded-md">
                    Pedestrian Pathway
                  </span>
                )}
              </div>

              {/* Surface & Path Quality Banner */}
              {route.accessibility && (
                <div className="px-4 py-2 bg-emerald-50/50 border-b border-emerald-100 text-[11px] text-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-medium">{route.accessibility.surfaceSummary}</span>
                  </div>
                  {route.accessibility.maxSlope !== 'flat' && (
                    <span className="text-[10px] text-slate-500 capitalize">
                      Grade: {route.accessibility.maxSlope} slope
                    </span>
                  )}
                </div>
              )}

              {/* Accessibility Warnings if any exist on the selected path */}
              {route.accessibility && route.accessibility.accessibilityWarnings.length > 0 && (
                <div className="mx-3 mt-2.5 p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs space-y-1">
                  <div className="font-semibold flex items-center gap-1.5 text-amber-800">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Accessibility Ground Advisories:</span>
                  </div>
                  <ul className="list-disc list-inside text-[11px] text-amber-800 space-y-0.5 pl-1">
                    {route.accessibility.accessibilityWarnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Approach Notice if start/destination is off-network */}
              {route.isEstimatedRoute && (
                <div className="mx-3 mt-2 p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{route.routeNotice || 'Includes approach path from entrance or courtyard.'}</span>
                </div>
              )}

              {/* Turn-by-Turn Instruction List */}
              <div className="flex-1 overflow-y-auto divide-y divide-black/5 p-2">
                <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Step-by-Step Navigation</span>
                  <span className="text-[10px] font-normal text-slate-400">
                    {route.steps.length} segments
                  </span>
                </div>
                {route.steps.map((step, idx) => {
                  const isCurrent = activeStepIndex === idx;
                  return (
                    <div
                      key={idx}
                      onClick={() => setActiveStepIndex(idx)}
                      className={`p-3 rounded-xl transition-all cursor-pointer flex items-start gap-3 ${
                        isCurrent
                          ? 'bg-emerald-50/80 border border-emerald-200'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5 ${
                          isCurrent
                            ? 'bg-[#176B45] text-white shadow-sm'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs sm:text-sm font-medium leading-snug ${
                            isCurrent ? 'text-[#176B45] font-semibold' : 'text-slate-800'
                          }`}
                        >
                          {step.instruction}
                        </p>

                        {/* Step Accessibility Annotation */}
                        {step.accessibilityNote && (
                          <div className="mt-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/60 inline-block">
                            {step.accessibilityNote}
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                          <span>{step.distance} meters</span>
                          <span aria-hidden="true">·</span>
                          <span>approx {formatWalkingDuration(step.duration)}</span>
                        </div>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 shrink-0 transition-transform ${
                          isCurrent ? 'text-[#176B45] translate-x-0.5' : 'text-slate-300'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Bottom Footnote & Exit Button */}
              <div className="p-3 bg-slate-50 border-t border-black/10 flex items-center justify-between gap-2">
                <div className="text-[10px] text-slate-500 leading-tight">
                  Follow paved walkways. Campus security patrols 24/7 along illuminated routes.
                </div>
                <button
                  onClick={onClearDirections}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-xs font-semibold text-slate-700 transition-colors shrink-0"
                >
                  Exit Route
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="p-6 text-center text-slate-500 space-y-2">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
          <div className="text-sm font-semibold text-slate-800">Routing is currently unavailable</div>
          <p className="text-xs text-slate-500">
            Please pick a different starting location or tap any position on the campus map.
          </p>
        </div>
      )}
    </div>
  );
};
