import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { CampusLocation, RouteInfo } from '../types/campus';
import { CATEGORY_METAS, CAMPUS_CENTER, CAMPUS_BOUNDS } from '../data/campusLocations';
import {
  Locate,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Navigation,
  Compass,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

interface MapViewProps {
  locations: CampusLocation[];
  selectedLocation: CampusLocation | null;
  onSelectLocation: (location: CampusLocation) => void;
  userLocation: [number, number] | null;
  userAccuracy?: number | null;
  userHeading?: number | null;
  isLiveNavigating?: boolean;
  isFollowingUser?: boolean;
  onToggleFollowUser?: (following: boolean) => void;
  onUserLocationFound: (coords: [number, number], accuracy: number, heading?: number | null) => void;
  onUserLocationError: (msg: string) => void;
  route: RouteInfo | null;
  completedCoordinates?: [number, number][];
  remainingCoordinates?: [number, number][];
  isPickingOnMap: boolean;
  onMapClickCoordinates?: (coords: [number, number]) => void;
  onRequestStartWalking?: () => void;
}

export const MapView: React.FC<MapViewProps> = ({
  locations,
  selectedLocation,
  onSelectLocation,
  userLocation,
  userAccuracy,
  userHeading,
  isLiveNavigating = false,
  isFollowingUser = false,
  onToggleFollowUser,
  onUserLocationFound,
  onUserLocationError,
  route,
  completedCoordinates,
  remainingCoordinates,
  isPickingOnMap,
  onMapClickCoordinates,
  onRequestStartWalking,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.FeatureGroup | null>(null);
  const userMarkerRef = useRef<L.LayerGroup | null>(null);

  const [activeLayer, setActiveLayer] = useState<'streets' | 'satellite'>('streets');
  const [isLocating, setIsLocating] = useState(false);
  const [mapZoom, setMapZoom] = useState(17);

  // Tile layer URLs
  const streetTilesRef = useRef<L.TileLayer | null>(null);
  const satTilesRef = useRef<L.TileLayer | null>(null);

  // Keep ref of following state for map event callbacks
  const isFollowingUserRef = useRef(isFollowingUser);
  useEffect(() => {
    isFollowingUserRef.current = isFollowingUser;
  }, [isFollowingUser]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const southWest = L.latLng(CAMPUS_BOUNDS[0][0], CAMPUS_BOUNDS[0][1]);
    const northEast = L.latLng(CAMPUS_BOUNDS[1][0], CAMPUS_BOUNDS[1][1]);
    const maxBounds = L.latLngBounds(southWest, northEast).pad(0.35);

    const map = L.map(mapContainerRef.current, {
      center: [CAMPUS_CENTER.lat, CAMPUS_CENTER.lng],
      zoom: CAMPUS_CENTER.zoom,
      minZoom: 14,
      maxZoom: 19,
      maxBounds: maxBounds,
      maxBoundsViscosity: 0.8,
      zoomControl: false,
      attributionControl: false,
    });

    // Custom attribution control bottom right
    L.control
      .attribution({
        position: 'bottomright',
        prefix: false,
      })
      .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · UENR Nav')
      .addTo(map);

    // Street Tiles
    streetTilesRef.current = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }
    );

    // Satellite Tiles (Esri World Imagery)
    satTilesRef.current = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri',
      }
    );

    streetTilesRef.current.addTo(map);

    // Layer groups for markers, routes, user position
    markersLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.featureGroup().addTo(map);
    userMarkerRef.current = L.layerGroup().addTo(map);

    map.on('zoomend', () => {
      setMapZoom(map.getZoom());
    });

    // Pause camera follow when user manually touches, drags, or pinch-zooms map
    const pauseFollowingOnUserGesture = () => {
      if (isFollowingUserRef.current && onToggleFollowUser) {
        onToggleFollowUser(false);
      }
    };

    map.on('dragstart', pauseFollowingOnUserGesture);

    const containerEl = mapContainerRef.current;
    if (containerEl) {
      containerEl.addEventListener('wheel', pauseFollowingOnUserGesture, { passive: true });
      containerEl.addEventListener('touchstart', (e: TouchEvent) => {
        if (e.touches.length > 1) {
          pauseFollowingOnUserGesture();
        }
      }, { passive: true });
    }

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (onMapClickCoordinates) {
        onMapClickCoordinates([e.latlng.lat, e.latlng.lng]);
      }
    });

    mapInstanceRef.current = map;

    // Invalidate map size after initial paint to prevent grey patches
    const initTimer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    // ResizeObserver to automatically invalidate size when container or drawers resize
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    const handleWindowResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      clearTimeout(initTimer);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle Base Tile Switching
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !streetTilesRef.current || !satTilesRef.current) return;

    if (activeLayer === 'streets') {
      if (map.hasLayer(satTilesRef.current)) map.removeLayer(satTilesRef.current);
      if (!map.hasLayer(streetTilesRef.current)) streetTilesRef.current.addTo(map);
    } else {
      if (map.hasLayer(streetTilesRef.current)) map.removeLayer(streetTilesRef.current);
      if (!map.hasLayer(satTilesRef.current)) satTilesRef.current.addTo(map);
    }
  }, [activeLayer]);

  // Render Campus Location Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    locations.forEach((loc) => {
      const meta = CATEGORY_METAS[loc.category];
      const isSelected = selectedLocation?.id === loc.id;
      const color = meta ? meta.color : '#176B45';
      const isNeedsReview =
        loc.verificationStatus === 'needs_review' ||
        loc.verificationStatus === 'pending_verification';

      // Custom HTML Pin icon
      const iconHtml = `
        <div class="relative group cursor-pointer transition-transform duration-200 ${
          isSelected ? 'scale-125 z-40' : 'hover:scale-110 z-20'
        }">
          ${
            isSelected
              ? `<div class="absolute -inset-2 rounded-full bg-[#176B45]/20 animate-ping"></div>`
              : ''
          }
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-lg border-2 ${
            isSelected ? 'border-[#D7F36A] ring-4 ring-[#176B45]/40' : 'border-white'
          }" style="background-color: ${color};">
            <svg class="w-4 h-4 fill-white" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            ${
              isNeedsReview
                ? `<div class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full border border-white flex items-center justify-center text-[9px] font-bold text-white shadow">!</div>`
                : ''
            }
          </div>
          <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded bg-white/95 backdrop-blur-sm text-[10px] font-bold text-[#263238] shadow-sm border border-black/10 pointer-events-none transition-opacity ${
            isSelected || mapZoom >= 17 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }">
            ${loc.shortCode || loc.name}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-campus-pin',
        html: iconHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
      });

      const marker = L.marker([loc.lat, loc.lng], { icon: customIcon });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectLocation(loc);
      });

      markersLayer.addLayer(marker);
    });
  }, [locations, selectedLocation, mapZoom]);

  // Center on Selected Location (when not actively in follow mode)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedLocation || isLiveNavigating) return;

    map.flyTo([selectedLocation.lat, selectedLocation.lng], 18, {
      duration: 0.9,
      easeLinearity: 0.25,
    });
  }, [selectedLocation, isLiveNavigating]);

  // Real-Time Camera Follow: keep user marker centered when isFollowingUser is true
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !userLocation || !isFollowingUser) return;

    const currentCenter = map.getCenter();
    const distFromCenter = L.latLng(currentCenter.lat, currentCenter.lng).distanceTo(
      L.latLng(userLocation[0], userLocation[1])
    );

    // If the map was zoomed out while exploring, smoothly fly in to walking zoom 18
    if (map.getZoom() < 17) {
      map.flyTo([userLocation[0], userLocation[1]], 18, {
        duration: 0.8,
      });
    } else if (distFromCenter > 3) {
      map.panTo([userLocation[0], userLocation[1]], {
        animate: true,
        duration: 0.7,
      });
    }
  }, [userLocation, isFollowingUser]);

  // Render User Location & Accuracy Indicator & Dynamic Heading Cone
  useEffect(() => {
    const map = mapInstanceRef.current;
    const userLayer = userMarkerRef.current;
    if (!map || !userLayer) return;

    userLayer.clearLayers();

    if (userLocation) {
      const [lat, lng] = userLocation;

      // Accuracy circle
      if (userAccuracy && userAccuracy < 150) {
        const accuracyCircle = L.circle([lat, lng], {
          radius: userAccuracy,
          color: '#176B45',
          fillColor: '#176B45',
          fillOpacity: 0.12,
          weight: 1,
        });
        userLayer.addLayer(accuracyCircle);
      }

      // Heading directional pointer (if available)
      const hasHeading = typeof userHeading === 'number' && !isNaN(userHeading);

      const userIcon = L.divIcon({
        className: 'user-gps-marker',
        html: `
          <div class="relative w-8 h-8 flex items-center justify-center">
            ${
              hasHeading
                ? `
                <div class="absolute inset-0 flex items-center justify-center transition-transform duration-300" style="transform: rotate(${userHeading}deg);">
                  <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[14px] border-b-[#176B45] -translate-y-4 filter drop-shadow"></div>
                </div>
                `
                : ''
            }
            <div class="absolute inset-1 rounded-full bg-[#176B45]/25 user-location-pulse"></div>
            <div class="w-4 h-4 rounded-full bg-[#176B45] border-2 border-white shadow-md flex items-center justify-center">
              <div class="w-1.5 h-1.5 rounded-full bg-[#D7F36A]"></div>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 });
      userLayer.addLayer(marker);
    }
  }, [userLocation, userAccuracy, userHeading]);

  // Render Pedestrian Walking Route with Completed vs Remaining Styling
  useEffect(() => {
    const map = mapInstanceRef.current;
    const routeLayer = routeLayerRef.current;
    if (!map || !routeLayer) return;

    routeLayer.clearLayers();

    if (route && route.coordinates.length > 1) {
      if (isLiveNavigating && completedCoordinates && remainingCoordinates) {
        // 1. Completed Path (Muted trail)
        if (completedCoordinates.length > 1) {
          const completedLine = L.polyline(completedCoordinates, {
            color: '#64748B',
            weight: 4,
            opacity: 0.6,
            dashArray: '6, 6',
            lineCap: 'round',
            lineJoin: 'round',
          });
          routeLayer.addLayer(completedLine);
        }

        // 2. Remaining Path (Vibrant accent & glow)
        if (remainingCoordinates.length > 1) {
          const remainingGlow = L.polyline(remainingCoordinates, {
            color: '#D7F36A',
            weight: 8,
            opacity: 0.75,
            lineCap: 'round',
            lineJoin: 'round',
          });
          routeLayer.addLayer(remainingGlow);

          const remainingLine = L.polyline(remainingCoordinates, {
            color: '#176B45',
            weight: 5,
            opacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round',
          });
          routeLayer.addLayer(remainingLine);
        }
      } else {
        // Standard Route Polyline
        const underGlow = L.polyline(route.coordinates, {
          color: '#D7F36A',
          weight: 8,
          opacity: 0.75,
          lineCap: 'round',
          lineJoin: 'round',
        });
        routeLayer.addLayer(underGlow);

        const polyline = L.polyline(route.coordinates, {
          color: '#176B45',
          weight: 5,
          opacity: 0.95,
          dashArray: route.isEstimatedRoute ? '8, 8' : undefined,
          lineCap: 'round',
          lineJoin: 'round',
        });
        routeLayer.addLayer(polyline);
      }

      // Origin Marker (Start)
      const startCoord = route.coordinates[0];
      const startIcon = L.divIcon({
        className: 'route-start-pin',
        html: `
          <div class="w-7 h-7 rounded-full bg-[#263238] text-white border-2 border-white flex items-center justify-center shadow-lg font-bold text-[11px]">
            A
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      routeLayer.addLayer(L.marker(startCoord, { icon: startIcon }));

      // Destination Marker (End)
      const endCoord = route.coordinates[route.coordinates.length - 1];
      const endIcon = L.divIcon({
        className: 'route-end-pin',
        html: `
          <div class="w-8 h-8 rounded-full bg-[#176B45] text-[#D7F36A] border-2 border-[#D7F36A] flex items-center justify-center shadow-xl font-bold text-xs">
            B
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      routeLayer.addLayer(L.marker(endCoord, { icon: endIcon }));

      // Initial fit to bounds if not live following
      if (!isLiveNavigating && !isFollowingUser) {
        map.fitBounds(routeLayer.getBounds(), {
          padding: [60, 60],
          maxZoom: 18,
        });
      }
    }
  }, [route, isLiveNavigating, completedCoordinates, remainingCoordinates, isFollowingUser]);

  // Request Current Location
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      onUserLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        onUserLocationFound(coords, pos.coords.accuracy, pos.coords.heading);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo(coords, 18, { duration: 0.9 });
        }
        if (onToggleFollowUser) {
          onToggleFollowUser(true);
        }
      },
      (err) => {
        setIsLocating(false);
        let errorMsg = 'Could not access your location. Please check device location permissions.';
        if (err.code === 1) {
          errorMsg = 'Location permission was denied. You can select a starting point manually.';
        } else if (err.code === 2) {
          errorMsg = 'GPS position is currently unavailable.';
        }
        onUserLocationError(errorMsg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
    );
  };

  // Reset to full campus view
  const handleResetCampusView = () => {
    if (onToggleFollowUser) onToggleFollowUser(false);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([CAMPUS_CENTER.lat, CAMPUS_CENTER.lng], CAMPUS_CENTER.zoom, {
        duration: 0.8,
      });
    }
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  return (
    <div className="relative w-full h-full flex-1 min-h-[300px] overflow-hidden">
      {/* Leaflet Map Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Map Picking Crosshair Overlay */}
      {isPickingOnMap && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="px-3.5 py-1.5 rounded-full bg-[#176B45] text-white text-xs font-semibold shadow-lg flex items-center gap-2 border border-[#D7F36A]">
            <Compass className="w-4 h-4 text-[#D7F36A] animate-spin" />
            <span>Click any spot on campus to set starting point</span>
          </div>
        </div>
      )}

      {/* Floating Map Controls (Top Right) */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        {/* Layer Switcher (Streets / Satellite) */}
        <button
          onClick={() => setActiveLayer(activeLayer === 'streets' ? 'satellite' : 'streets')}
          className="p-2.5 bg-white text-[#263238] rounded-xl shadow-lg border border-black/10 hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center group"
          title={
            activeLayer === 'streets'
              ? 'Switch to Satellite View (Esri Imagery)'
              : 'Switch to Street Map (OpenStreetMap)'
          }
        >
          <Layers className="w-5 h-5 text-slate-700 group-hover:text-[#176B45]" />
          <span className="sr-only">Toggle Map View</span>
        </button>

        {/* Locate / Follow Me (GPS) */}
        <button
          onClick={() => {
            if (isLiveNavigating) {
              if (onToggleFollowUser) onToggleFollowUser(true);
              if (userLocation && mapInstanceRef.current) {
                mapInstanceRef.current.flyTo(userLocation, 18, { duration: 0.8 });
              }
            } else {
              handleLocateMe();
            }
          }}
          disabled={isLocating}
          className={`p-2.5 rounded-xl shadow-lg border transition-all active:scale-95 flex items-center justify-center ${
            isFollowingUser
              ? 'bg-[#176B45] text-[#D7F36A] border-[#176B45] ring-2 ring-[#D7F36A]'
              : userLocation
              ? 'bg-[#176B45] text-[#D7F36A] border-[#176B45]'
              : 'bg-white text-slate-700 border-black/10 hover:bg-slate-50'
          }`}
          title={isFollowingUser ? 'Camera is currently following your walking position' : 'Center on my location'}
        >
          <Locate
            className={`w-5 h-5 ${
              isLocating
                ? 'animate-spin text-amber-500'
                : isFollowingUser
                ? 'animate-pulse text-[#D7F36A]'
                : ''
            }`}
          />
          <span className="sr-only">Locate Me</span>
        </button>

        {/* Center Campus */}
        <button
          onClick={handleResetCampusView}
          className="p-2.5 bg-white text-[#263238] rounded-xl shadow-lg border border-black/10 hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center group"
          title="Reset to UENR Campus Center"
        >
          <RotateCcw className="w-5 h-5 text-slate-700 group-hover:text-[#176B45]" />
          <span className="sr-only">Center Campus</span>
        </button>

        {/* Zoom Controls */}
        <div className="bg-white rounded-xl shadow-lg border border-black/10 overflow-hidden flex flex-col divide-y divide-black/5">
          <button
            onClick={handleZoomIn}
            className="p-2.5 hover:bg-slate-50 text-slate-700 transition-colors flex items-center justify-center"
            title="Zoom in"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2.5 hover:bg-slate-50 text-slate-700 transition-colors flex items-center justify-center"
            title="Zoom out"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Floating Resume Following Banner (Bottom Center on Map) */}
      {isLiveNavigating && !isFollowingUser && userLocation && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={() => {
              if (onToggleFollowUser) onToggleFollowUser(true);
              if (userLocation && mapInstanceRef.current) {
                mapInstanceRef.current.flyTo(userLocation, 18, { duration: 0.8 });
              }
            }}
            className="px-4 py-2 rounded-full bg-[#176B45] text-[#D7F36A] font-bold text-xs shadow-xl border border-[#D7F36A] flex items-center gap-2 hover:brightness-105 active:scale-95 transition-all"
          >
            <Locate className="w-4 h-4 animate-spin" />
            <span>Resume Following My Location</span>
          </button>
        </div>
      )}

      {/* Map Status Bar (Bottom Left) */}
      <div className="absolute bottom-3 left-3 z-20 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg text-[11px] text-slate-700 border border-black/10 shadow-md flex items-center gap-2">
          <span className="font-bold text-[#176B45] flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            UENR Sunyani
          </span>
          <span className="text-slate-300">·</span>
          {selectedLocation ? (
            <span className="font-mono text-slate-800">
              {selectedLocation.name}: {selectedLocation.lat.toFixed(5)}° N,{' '}
              {Math.abs(selectedLocation.lng).toFixed(5)}° W
            </span>
          ) : (
            <span className="font-mono text-slate-600">
              {CAMPUS_CENTER.lat.toFixed(4)}° N, {Math.abs(CAMPUS_CENTER.lng).toFixed(4)}° W
            </span>
          )}
          {userLocation && (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {isLiveNavigating ? 'Live Guidance' : 'GPS Active'}
                {typeof userAccuracy === 'number' ? ` (±${userAccuracy}m)` : ''}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
