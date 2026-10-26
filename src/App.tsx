import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { CategoryFilter } from './components/CategoryFilter';
import { MapView } from './components/MapView';
import { LocationDetailCard } from './components/LocationDetailCard';
import { DirectionsPanel } from './components/DirectionsPanel';
import { FreshersGuideModal } from './components/FreshersGuideModal';
import { ReportIssueModal } from './components/ReportIssueModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { SchematicMapModal } from './components/SchematicMapModal';
import { AuthModal } from './components/AuthModal';
import { AnnouncementsModal } from './components/AnnouncementsModal';
import { AuthProvider } from './context/AuthContext';
import {
  CampusCategory,
  CampusLocation,
  CampusNotice,
  CampusReport,
  RouteInfo,
  RoutingPreference,
} from './types/campus';
import { CATEGORY_METAS } from './data/campusLocations';
import {
  getStoredLocations,
  fetchLocations,
  saveStoredLocations,
  getFavorites,
  toggleFavorite,
  getRecentSearches,
  addRecentSearch,
  clearRecentSearches,
  fetchNotices,
  fetchReports,
  getStoredReports,
  getReadNoticeIds,
  filterVisibleNotices,
} from './services/storageService';
import { calculatePedestrianRoute } from './services/routingService';
import {
  Bookmark,
  MapPin,
  ChevronRight,
  Info,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Compass,
  PanelLeftClose,
  PanelLeftOpen,
  Navigation,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

export default function App() {
  // Campus data
  const [locations, setLocations] = useState<CampusLocation[]>(() => getStoredLocations());
  const [notices, setNotices] = useState<CampusNotice[]>([]);
  const [reports, setReports] = useState<CampusReport[]>(() => getStoredReports());
  const [favorites, setFavorites] = useState<string[]>(() => getFavorites());
  const [recentSearches, setRecentSearches] = useState<string[]>(() => getRecentSearches());

  // Synchronize with server on mount
  useEffect(() => {
    fetchLocations().then((data) => {
      if (data && data.length > 0) setLocations(data);
    });
    fetchNotices().then((data) => {
      if (data) setNotices(data);
    });
    fetchReports().then((data) => {
      if (data) setReports(data);
    });
  }, []);

  // UI & Selection States
  const [selectedLocation, setSelectedLocation] = useState<CampusLocation | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CampusCategory | 'all'>('all');
  const [activeSidebarTab, setActiveSidebarTab] = useState<'explore' | 'favorites'>('explore');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // User Geolocation
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [userAccuracy, setUserAccuracy] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Pedestrian & Accessible Routing
  const [isDirectionsActive, setIsDirectionsActive] = useState(false);
  const [routingPreference, setRoutingPreference] = useState<RoutingPreference>('all');
  const [routeStart, setRouteStart] = useState<{ name: string; coordinates: [number, number] }>({
    name: 'Main Campus Gate',
    coordinates: [7.34919, -2.34382],
  });
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [isPickingOnMap, setIsPickingOnMap] = useState(false);

  // Announcements & Notifications
  const [isAnnouncementsOpen, setIsAnnouncementsOpen] = useState(false);
  const [readNoticeIds, setReadNoticeIds] = useState<string[]>(() => getReadNoticeIds());

  // Modals
  const [isFreshersGuideOpen, setIsFreshersGuideOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isSchematicOpen, setIsSchematicOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [reportTargetLocation, setReportTargetLocation] = useState<CampusLocation | null>(null);

  // Mobile Bottom Drawer Expand state (peek vs expanded)
  const [isMobileDrawerExpanded, setIsMobileDrawerExpanded] = useState(false);

  // Save locations to local storage when modified
  const handleUpdateLocations = (updated: CampusLocation[]) => {
    setLocations(updated);
    saveStoredLocations(updated);
  };

  // Toggle favorite place
  const handleToggleFavorite = async (locationId: string) => {
    const updated = await toggleFavorite(locationId);
    setFavorites(updated);
  };

  // Select a location
  const handleSelectLocation = (loc: CampusLocation) => {
    setSelectedLocation(loc);
    setRecentSearches(addRecentSearch(loc.name));
    setIsSidebarCollapsed(false);
    setIsMobileDrawerExpanded(true);

    // If directions are active, update the destination
    if (isDirectionsActive) {
      computeRoute(routeStart, { name: loc.name, coordinates: [loc.lat, loc.lng] }, routingPreference);
    }
  };

  // Trigger Walking Directions
  const handleGetDirections = (dest: CampusLocation) => {
    setIsDirectionsActive(true);
    setSelectedLocation(dest);
    setIsSidebarCollapsed(false);
    setIsMobileDrawerExpanded(true);

    // Determine initial start point
    const initialStart = userLocation
      ? { name: 'My Current Location (GPS)', coordinates: userLocation }
      : { name: 'Main Campus Gate', coordinates: [7.34919, -2.34382] as [number, number] };

    setRouteStart(initialStart);
    computeRoute(initialStart, { name: dest.name, coordinates: [dest.lat, dest.lng] }, routingPreference);
  };

  // Compute pedestrian or accessible walking route
  const computeRoute = async (
    start: { name: string; coordinates: [number, number] },
    end: { name: string; coordinates: [number, number] },
    pref: RoutingPreference = routingPreference
  ) => {
    setIsCalculatingRoute(true);
    try {
      const calculatedRoute = await calculatePedestrianRoute(start, end, { preference: pref });
      setRoute(calculatedRoute);
    } catch (err) {
      console.error('Route calculation error:', err);
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  // Swap origin and destination
  const handleSwapRoutePoints = () => {
    if (!selectedLocation) return;
    const currentEnd = {
      name: selectedLocation.name,
      coordinates: [selectedLocation.lat, selectedLocation.lng] as [number, number],
    };
    const newStart = currentEnd;
    const newEnd = routeStart;

    // Find if new destination matches an existing campus location
    const matched = locations.find(
      (l) => l.lat === newEnd.coordinates[0] && l.lng === newEnd.coordinates[1]
    );

    if (matched) {
      setSelectedLocation(matched);
    }

    setRouteStart(newStart);
    computeRoute(newStart, newEnd);
  };

  // Handle map click when picking coordinate
  const handleMapClickCoordinates = (coords: [number, number]) => {
    if (isPickingOnMap && selectedLocation) {
      const customStart = {
        name: `Map Pin (${coords[0].toFixed(4)}, ${coords[1].toFixed(4)})`,
        coordinates: coords,
      };
      setRouteStart(customStart);
      setIsPickingOnMap(false);
      computeRoute(customStart, {
        name: selectedLocation.name,
        coordinates: [selectedLocation.lat, selectedLocation.lng],
      });
    }
  };

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    locations.forEach((loc) => {
      counts[loc.category] = (counts[loc.category] || 0) + 1;
    });
    return counts;
  }, [locations]);

  // Filtered locations based on category & tab
  const displayedLocations = useMemo(() => {
    let list = locations;
    if (activeSidebarTab === 'favorites') {
      list = list.filter((l) => favorites.includes(l.id));
    }
    if (selectedCategory !== 'all') {
      list = list.filter((l) => l.category === selectedCategory);
    }
    return list;
  }, [locations, selectedCategory, activeSidebarTab, favorites]);

  // Handle User Location Found
  const handleUserLocationFound = (coords: [number, number], accuracy: number) => {
    setUserLocation(coords);
    setUserAccuracy(accuracy);
    setLocationError(null);
  };

  // Handle URL deep-linking (?place=bog-auditorium)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const placeId = params.get('place');
    if (placeId) {
      const match = locations.find((l) => l.id === placeId);
      if (match) {
        setSelectedLocation(match);
      }
    }
  }, [locations]);

  const unreadNoticesCount = useMemo(() => {
    return filterVisibleNotices(notices, false).filter((n) => !readNoticeIds.includes(n.id)).length;
  }, [notices, readNoticeIds]);

  return (
    <AuthProvider>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#F5F7F4] text-[#263238] select-none">
        {/* Top Header */}
        <Header
          onOpenFreshersGuide={() => setIsFreshersGuideOpen(true)}
          onOpenAdmin={() => setIsAdminOpen(true)}
          onOpenSchematic={() => setIsSchematicOpen(true)}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onOpenAnnouncements={() => setIsAnnouncementsOpen(true)}
          unreadCount={unreadNoticesCount}
          notices={notices}
          onSelectNotice={() => setIsAnnouncementsOpen(true)}
        />

        {/* Main Workspace Layout */}
        <div className="flex-1 flex flex-col md:flex-row relative overflow-hidden">
          {/* Desktop Left Sidebar (Collapsible: 390px - 430px) */}
          <aside
            className={`hidden md:flex flex-col bg-white border-r border-black/10 shadow-lg z-20 overflow-hidden shrink-0 transition-all duration-300 ${
              isSidebarCollapsed ? 'w-0 border-r-0' : 'w-[390px] lg:w-[420px]'
            }`}
          >
            {/* Search Bar Container */}
            <div className="p-3.5 border-b border-black/5 bg-white">
              <SearchBar
                locations={locations}
                onSelectLocation={handleSelectLocation}
                recentSearches={recentSearches}
                onSelectRecentSearch={(term) => {
                  setRecentSearches(addRecentSearch(term));
                }}
                onClearRecents={() => {
                  clearRecentSearches();
                  setRecentSearches([]);
                }}
              />
            </div>

            {/* Category Shortcuts */}
            <CategoryFilter
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              categoryCounts={categoryCounts}
            />

            {/* Dynamic Content: Directions Panel, Location Detail Card, or Explorer List */}
            <div className="flex-1 overflow-y-auto">
              {isDirectionsActive && selectedLocation ? (
                <div className="p-3">
                  <DirectionsPanel
                    route={route}
                    locations={locations}
                    destination={selectedLocation}
                    startPoint={routeStart}
                    userLocation={userLocation}
                    isLoading={isCalculatingRoute}
                    routingPreference={routingPreference}
                    onChangePreference={(newPref) => {
                      setRoutingPreference(newPref);
                      if (selectedLocation) {
                        computeRoute(
                          routeStart,
                          { name: selectedLocation.name, coordinates: [selectedLocation.lat, selectedLocation.lng] },
                          newPref
                        );
                      }
                    }}
                    onSelectStartLocation={(newStart) => {
                      setRouteStart(newStart);
                      computeRoute(
                        newStart,
                        { name: selectedLocation.name, coordinates: [selectedLocation.lat, selectedLocation.lng] },
                        routingPreference
                      );
                    }}
                    onSwapPoints={handleSwapRoutePoints}
                    onClearDirections={() => {
                      setIsDirectionsActive(false);
                      setRoute(null);
                    }}
                    onEnablePickOnMap={() => setIsPickingOnMap(!isPickingOnMap)}
                    isPickingOnMap={isPickingOnMap}
                  />
                </div>
              ) : selectedLocation ? (
                <div className="p-3">
                  <LocationDetailCard
                    location={selectedLocation}
                    isSaved={favorites.includes(selectedLocation.id)}
                    onToggleSave={handleToggleFavorite}
                    onGetDirections={handleGetDirections}
                    onClose={() => setSelectedLocation(null)}
                    onReportIssue={(loc) => {
                      setReportTargetLocation(loc);
                      setIsReportModalOpen(true);
                    }}
                  />
                </div>
              ) : (
                /* Explorer View / Campus Directory */
                <div className="flex flex-col h-full">
                  {/* View Tabs: Explore vs Saved Places */}
                  <div className="px-4 py-2 bg-slate-50 border-b border-black/5 flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg">
                      <button
                        onClick={() => setActiveSidebarTab('explore')}
                        className={`px-3 py-1 rounded-md transition-colors ${
                          activeSidebarTab === 'explore'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        All Facilities
                      </button>
                      <button
                        onClick={() => setActiveSidebarTab('favorites')}
                        className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${
                          activeSidebarTab === 'favorites'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Bookmark className="w-3 h-3 text-amber-500" />
                        <span>Saved ({favorites.length})</span>
                      </button>
                    </div>

                    <span className="text-[11px] text-slate-500 font-normal">
                      {displayedLocations.length} locations
                    </span>
                  </div>

                  {/* Locations Listing */}
                  <div className="flex-1 overflow-y-auto divide-y divide-black/5">
                    {displayedLocations.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 space-y-2">
                        <Bookmark className="w-8 h-8 text-slate-300 mx-auto" />
                        <div className="font-semibold text-xs text-slate-700">No places in this view</div>
                        <p className="text-xs text-slate-400">
                          {activeSidebarTab === 'favorites'
                            ? 'Tap the bookmark icon on any building to save your frequent lecture halls and hostels!'
                            : 'Try selecting a different category filter above.'}
                        </p>
                      </div>
                    ) : (
                      displayedLocations.map((loc) => {
                        const categoryMeta = CATEGORY_METAS[loc.category];
                        const isSaved = favorites.includes(loc.id);

                        return (
                          <div
                            key={loc.id}
                            onClick={() => handleSelectLocation(loc)}
                            className="p-3.5 hover:bg-[#F5F7F4] transition-colors cursor-pointer flex items-start justify-between gap-2 group"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div
                                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                                style={{
                                  backgroundColor: categoryMeta ? categoryMeta.bgColor : '#F1F5F9',
                                  color: categoryMeta ? categoryMeta.color : '#176B45',
                                }}
                              >
                                <MapPin className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <h3 className="font-semibold text-xs sm:text-sm text-[#263238] group-hover:text-[#176B45] truncate">
                                    {loc.name}
                                  </h3>
                                  {loc.verificationStatus === 'verified' && (
                                    <CheckCircle2 className="w-3 h-3 text-[#176B45] shrink-0" />
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                  {loc.description}
                                </p>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                                  <span className="font-medium text-slate-600">
                                    {categoryMeta?.label || loc.category}
                                  </span>
                                  <span>·</span>
                                  <span>Code: {loc.shortCode}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0 self-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleFavorite(loc.id);
                                }}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  isSaved
                                    ? 'text-amber-500 bg-amber-50'
                                    : 'text-slate-300 hover:text-slate-500'
                                }`}
                                title={isSaved ? 'Remove bookmark' : 'Bookmark'}
                              >
                                <Bookmark className="w-4 h-4" fill={isSaved ? 'currentColor' : 'none'} />
                              </button>
                              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#176B45] group-hover:translate-x-0.5 transition-all" />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Desktop Sidebar Toggle Button */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden md:flex absolute top-4 left-4 z-20 p-2.5 rounded-xl bg-white text-[#263238] shadow-lg border border-black/10 hover:bg-slate-50 transition-all items-center justify-center group"
            title={isSidebarCollapsed ? 'Open side panel' : 'Collapse side panel'}
            style={{
              left: isSidebarCollapsed ? '16px' : undefined,
            }}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-slate-700 group-hover:text-[#176B45]" />
            ) : (
              <PanelLeftClose className="w-4 h-4 text-slate-700 group-hover:text-[#176B45]" />
            )}
            <span className="sr-only">{isSidebarCollapsed ? 'Expand Panel' : 'Collapse Panel'}</span>
          </button>

          {/* Center / Right: Interactive Leaflet Map */}
          <main className="flex-1 relative flex flex-col h-full overflow-hidden">
            {/* Mobile Top Floating Search Bar */}
            <div className="md:hidden absolute top-2 left-2 right-2 z-20 space-y-1.5 pointer-events-auto">
              <SearchBar
                locations={locations}
                onSelectLocation={handleSelectLocation}
                recentSearches={recentSearches}
                onSelectRecentSearch={(term) => setRecentSearches(addRecentSearch(term))}
                onClearRecents={() => {
                  clearRecentSearches();
                  setRecentSearches([]);
                }}
              />
              {/* Category horizontal bar on mobile */}
              <CategoryFilter
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                categoryCounts={categoryCounts}
              />
            </div>

            {/* Interactive Leaflet Map */}
            <MapView
              locations={displayedLocations}
              selectedLocation={selectedLocation}
              onSelectLocation={handleSelectLocation}
              userLocation={userLocation}
              userAccuracy={userAccuracy}
              onUserLocationFound={handleUserLocationFound}
              onUserLocationError={(err) => setLocationError(err)}
              route={route}
              isPickingOnMap={isPickingOnMap}
              onMapClickCoordinates={handleMapClickCoordinates}
            />

            {/* Mobile Collapsible Bottom Drawer */}
            {(selectedLocation || isDirectionsActive) && (
              <div
                className={`md:hidden absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-3xl shadow-2xl border-t border-black/15 overflow-hidden flex flex-col transition-all duration-300 ${
                  isMobileDrawerExpanded ? 'max-h-[82vh]' : 'max-h-[140px]'
                }`}
              >
                {/* Peek / Expand Handle Bar */}
                <div
                  onClick={() => setIsMobileDrawerExpanded(!isMobileDrawerExpanded)}
                  className="w-full py-2.5 px-4 flex items-center justify-between cursor-pointer bg-slate-100/90 border-b border-black/5 hover:bg-slate-200/60 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-1 rounded-full bg-slate-300 shrink-0" />
                    {selectedLocation && (
                      <span className="font-semibold text-xs text-[#263238] truncate">
                        {isDirectionsActive ? 'Walking Directions' : selectedLocation.name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-[11px] font-semibold text-[#176B45]">
                    <span>{isMobileDrawerExpanded ? 'Minimize' : 'Details'}</span>
                    {isMobileDrawerExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronUp className="w-4 h-4" />
                    )}
                  </div>
                </div>

                {/* Collapsible Content */}
                <div className="overflow-y-auto p-3">
                  {isDirectionsActive && selectedLocation ? (
                    <DirectionsPanel
                      route={route}
                      locations={locations}
                      destination={selectedLocation}
                      startPoint={routeStart}
                      userLocation={userLocation}
                      isLoading={isCalculatingRoute}
                      routingPreference={routingPreference}
                      onChangePreference={(newPref) => {
                        setRoutingPreference(newPref);
                        if (selectedLocation) {
                          computeRoute(
                            routeStart,
                            { name: selectedLocation.name, coordinates: [selectedLocation.lat, selectedLocation.lng] },
                            newPref
                          );
                        }
                      }}
                      onSelectStartLocation={(newStart) => {
                        setRouteStart(newStart);
                        computeRoute(
                          newStart,
                          { name: selectedLocation.name, coordinates: [selectedLocation.lat, selectedLocation.lng] },
                          routingPreference
                        );
                      }}
                      onSwapPoints={handleSwapRoutePoints}
                      onClearDirections={() => {
                        setIsDirectionsActive(false);
                        setRoute(null);
                      }}
                      onEnablePickOnMap={() => setIsPickingOnMap(!isPickingOnMap)}
                      isPickingOnMap={isPickingOnMap}
                    />
                  ) : selectedLocation ? (
                    <LocationDetailCard
                      location={selectedLocation}
                      isSaved={favorites.includes(selectedLocation.id)}
                      onToggleSave={handleToggleFavorite}
                      onGetDirections={handleGetDirections}
                      onClose={() => setSelectedLocation(null)}
                      onReportIssue={(loc) => {
                        setReportTargetLocation(loc);
                        setIsReportModalOpen(true);
                      }}
                    />
                  ) : null}
                </div>
              </div>
            )}

            {/* Location permission notice toast */}
            {locationError && (
              <div className="absolute top-24 left-4 right-4 sm:left-auto sm:right-4 z-40 max-w-sm p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs shadow-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold block">Location Notice</span>
                  <span>{locationError}</span>
                </div>
                <button
                  onClick={() => setLocationError(null)}
                  className="text-amber-700 hover:text-amber-950 p-0.5"
                >
                  ✕
                </button>
              </div>
            )}
          </main>
        </div>

        {/* Freshers Orientation Guide Modal */}
        <FreshersGuideModal
          isOpen={isFreshersGuideOpen}
          onClose={() => setIsFreshersGuideOpen(false)}
          locations={locations}
          onSelectLocation={handleSelectLocation}
        />

        {/* Report Issue Modal */}
        <ReportIssueModal
          isOpen={isReportModalOpen}
          onClose={() => {
            setIsReportModalOpen(false);
            setReportTargetLocation(null);
          }}
          targetLocation={reportTargetLocation}
          onReportSubmitted={(newRep) => {
            setReports([newRep, ...reports]);
          }}
        />

        {/* Campus Admin Panel Modal */}
        <AdminPanelModal
          isOpen={isAdminOpen}
          onClose={() => setIsAdminOpen(false)}
          locations={locations}
          onUpdateLocations={handleUpdateLocations}
          reports={reports}
          onUpdateReports={setReports}
          notices={notices}
          onUpdateNotices={setNotices}
          onFocusLocation={handleSelectLocation}
        />

        {/* Schematic Campus Blueprint Modal */}
        <SchematicMapModal
          isOpen={isSchematicOpen}
          onClose={() => setIsSchematicOpen(false)}
          locations={locations}
          onSelectLocation={handleSelectLocation}
        />

        {/* Student / User Authentication Modal */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />

        {/* Campus Announcements & Notifications Modal */}
        <AnnouncementsModal
          isOpen={isAnnouncementsOpen}
          onClose={() => setIsAnnouncementsOpen(false)}
          notices={notices}
          readNoticeIds={readNoticeIds}
          onUpdateReadNoticeIds={setReadNoticeIds}
          locations={locations}
          onSelectLocationOnMap={(loc) => {
            setIsAnnouncementsOpen(false);
            handleSelectLocation(loc);
          }}
          onGetDirectionsToLocation={(loc) => {
            setIsAnnouncementsOpen(false);
            handleGetDirections(loc);
          }}
        />
      </div>
    </AuthProvider>
  );
}
