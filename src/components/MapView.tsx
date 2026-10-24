import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { CampusLocation, RouteInfo } from '../types/campus';
import { CATEGORY_METAS, CAMPUS_CENTER } from '../data/campusLocations';
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
} from 'lucide-react';

interface MapViewProps {
  locations: CampusLocation[];
  selectedLocation: CampusLocation | null;
  onSelectLocation: (location: CampusLocation) => void;
  userLocation: [number, number] | null;
  userAccuracy?: number | null;
  onUserLocationFound: (coords: [number, number], accuracy: number) => void;
  onUserLocationError: (msg: string) => void;
  route: RouteInfo | null;
  isPickingOnMap: boolean;
  onMapClickCoordinates?: (coords: [number, number]) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  locations,
  selectedLocation,
  onSelectLocation,
  userLocation,
  userAccuracy,
  onUserLocationFound,
  onUserLocationError,
  route,
  isPickingOnMap,
  onMapClickCoordinates,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.FeatureGroup | null>(null);
  const userMarkerRef = useRef<L.LayerGroup | null>(null);

  const [activeLayer, setActiveLayer] = useState<'streets' | 'satellite'>('streets');
  const [isLocating, setIsLocating] = useState(false);
  const [mapZoom, setMapZoom] = useState(16);

  // Tile layer URLs
  const streetTilesRef = useRef<L.TileLayer | null>(null);
  const satTilesRef = useRef<L.TileLayer | null>(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [CAMPUS_CENTER.lat, CAMPUS_CENTER.lng],
      zoom: CAMPUS_CENTER.zoom,
      minZoom: 14,
      maxZoom: 19,
      zoomControl: false, // We render custom ergonomic controls
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

    // Layer groups for markers and routes
    markersLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.featureGroup().addTo(map);
    userMarkerRef.current = L.layerGroup().addTo(map);

    map.on('zoomend', () => {
      setMapZoom(map.getZoom());
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (onMapClickCoordinates) {
        onMapClickCoordinates([e.latlng.lat, e.latlng.lng]);
      }
    });

    mapInstanceRef.current = map;

    return () => {
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
          </div>
          <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded bg-white/90 backdrop-blur-sm text-[10px] font-bold text-[#263238] shadow-sm border border-black/10 pointer-events-none transition-opacity ${
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

  // Center on Selected Location
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedLocation) return;

    map.flyTo([selectedLocation.lat, selectedLocation.lng], 18, {
      duration: 1.2,
      easeLinearity: 0.25,
    });
  }, [selectedLocation]);

  // Render User Location
  useEffect(() => {
    const map = mapInstanceRef.current;
    const userLayer = userMarkerRef.current;
    if (!map || !userLayer) return;

    userLayer.clearLayers();

    if (userLocation) {
      const [lat, lng] = userLocation;

      // Accuracy circle
      if (userAccuracy && userAccuracy < 100) {
        const accuracyCircle = L.circle([lat, lng], {
          radius: userAccuracy,
          color: '#176B45',
          fillColor: '#176B45',
          fillOpacity: 0.12,
          weight: 1,
        });
        userLayer.addLayer(accuracyCircle);
      }

      // Live user GPS radar pin
      const userIcon = L.divIcon({
        className: 'user-gps-marker',
        html: `
          <div class="relative w-6 h-6 flex items-center justify-center">
            <div class="absolute inset-0 rounded-full bg-[#176B45]/30 user-location-pulse"></div>
            <div class="w-4 h-4 rounded-full bg-[#176B45] border-2 border-white shadow-md flex items-center justify-center">
              <div class="w-1.5 h-1.5 rounded-full bg-[#D7F36A]"></div>
            </div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 });
      userLayer.addLayer(marker);
    }
  }, [userLocation, userAccuracy]);

  // Render Pedestrian Walking Route
  useEffect(() => {
    const map = mapInstanceRef.current;
    const routeLayer = routeLayerRef.current;
    if (!map || !routeLayer) return;

    routeLayer.clearLayers();

    if (route && route.coordinates.length > 1) {
      // Glow under-layer
      const underGlow = L.polyline(route.coordinates, {
        color: '#D7F36A',
        weight: 8,
        opacity: 0.7,
        lineCap: 'round',
        lineJoin: 'round',
      });
      routeLayer.addLayer(underGlow);

      // Primary Route Polyline
      const polyline = L.polyline(route.coordinates, {
        color: '#176B45',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
        className: 'route-walking-line',
      });
      routeLayer.addLayer(polyline);

      // Start Marker (Origin)
      const startCoord = route.coordinates[0];
      const startIcon = L.divIcon({
        className: 'route-start-pin',
        html: `
          <div class="w-7 h-7 rounded-full bg-slate-800 text-white border-2 border-white flex items-center justify-center shadow-lg font-bold text-[11px]">
            A
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      const startMarker = L.marker(startCoord, { icon: startIcon });
      routeLayer.addLayer(startMarker);

      // End Marker (Destination)
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
      const endMarker = L.marker(endCoord, { icon: endIcon });
      routeLayer.addLayer(endMarker);

      // Fit map view to route bounds with comfortable padding
      map.fitBounds(routeLayer.getBounds(), {
        padding: [60, 60],
        maxZoom: 18,
      });
    }
  }, [route]);

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
        onUserLocationFound(coords, pos.coords.accuracy);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo(coords, 17, { duration: 1 });
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
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
    );
  };

  // Reset to full campus view
  const handleResetCampusView = () => {
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
      {/* Leaflet Map Div */}
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
          title={activeLayer === 'streets' ? 'Switch to Satellite' : 'Switch to Street Map'}
        >
          <Layers className="w-5 h-5 text-slate-700 group-hover:text-[#176B45]" />
          <span className="sr-only">Toggle Map View</span>
        </button>

        {/* Locate Me (GPS) */}
        <button
          onClick={handleLocateMe}
          disabled={isLocating}
          className={`p-2.5 rounded-xl shadow-lg border transition-all active:scale-95 flex items-center justify-center ${
            userLocation
              ? 'bg-[#176B45] text-[#D7F36A] border-[#176B45]'
              : 'bg-white text-slate-700 border-black/10 hover:bg-slate-50'
          }`}
          title="Find my current location"
        >
          <Locate className={`w-5 h-5 ${isLocating ? 'animate-spin text-amber-500' : ''}`} />
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

      {/* Map Attribution and Coordinates Bar (Bottom Left) */}
      <div className="absolute bottom-3 left-3 z-20 pointer-events-none">
        <div className="bg-white/85 backdrop-blur-sm px-2.5 py-1 rounded-md text-[10px] text-slate-600 border border-black/5 shadow-sm hidden sm:flex items-center gap-2">
          <span className="font-semibold text-[#176B45]">UENR Sunyani</span>
          <span>·</span>
          <span>7.3495° N, 2.3435° W</span>
          {userLocation && (
            <>
              <span>·</span>
              <span className="text-emerald-700 font-medium">GPS Active</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
