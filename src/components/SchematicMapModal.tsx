import React, { useState } from 'react';
import { X, ExternalLink, MapPin, ZoomIn, ZoomOut, CheckCircle2, PhoneCall } from 'lucide-react';
import { CampusLocation } from '../types/campus';

interface SchematicMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: CampusLocation[];
  onSelectLocation: (loc: CampusLocation) => void;
}

export const SchematicMapModal: React.FC<SchematicMapModalProps> = ({
  isOpen,
  onClose,
  locations,
  onSelectLocation,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);

  if (!isOpen) return null;

  const schematicKeypoints = [
    { name: 'RCEES BUILDING', locId: 'rcees-building', color: '#06b6d4' },
    { name: 'LTS BLOCK', locId: 'lts-block', color: '#ec4899' },
    { name: 'SH BLOCK', locId: 'sh-block', color: '#4f46e5' },
    { name: 'APP LAB', locId: 'app-lab', color: '#22c55e' },
    { name: 'UENR IT DEPARTMENT', locId: 'uenr-it-department', color: '#c084fc' },
    { name: 'PAVILION', locId: 'pavilion', color: '#f97316' },
    { name: "SCHOOL'S CLINIC", locId: 'schools-clinic', color: '#b91c1c' },
    { name: 'UENR CHEMISTRY LAB', locId: 'uenr-chemistry-lab', color: '#f43f5e' },
    { name: 'OLD AUDITORIUM', locId: 'old-auditorium', color: '#6366f1' },
    { name: 'CAFETERIA', locId: 'cafeteria', color: '#0ea5e9' },
    { name: 'LT BLOCK', locId: 'lt-block', color: '#eab308' },
    { name: 'OLD LIBRARY BLOCK', locId: 'old-library-block', color: '#15803d' },
    { name: 'ENGINEERING LAB', locId: 'engineering-lab', color: '#dc2626' },
    { name: 'ODUM BLOCK', locId: 'odum-block', color: '#fb923c' },
    { name: 'UENR SCHOOL FIELD', locId: 'uenr-school-field', color: '#a855f7' },
    { name: 'UNIVERSITY HALL 1', locId: 'university-hall-1', color: '#facc15' },
    { name: 'UNIVERSITY HALL 2', locId: 'university-hall-2', color: '#86efac' },
    { name: 'SUMMER HUT', locId: 'summer-hut', color: '#f472b6' },
    { name: 'BANK OF GHANA AUDITORIUM', locId: 'bog-auditorium', color: '#4ade80' },
  ];

  const handlePointClick = (locId: string) => {
    const found = locations.find((l) => l.id === locId);
    if (found) {
      onSelectLocation(found);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-black/10 w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-[#176B45] text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#D7F36A] text-[#176B45] flex items-center justify-center font-bold">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold font-display">
                  Official UENR Campus Blueprint Reference
                </h2>
                <span className="text-[10px] bg-[#D7F36A] text-[#176B45] px-2 py-0.5 rounded font-bold uppercase hidden sm:inline-block">
                  Reference Map
                </span>
              </div>
              <p className="text-xs text-white/80">
                Click any key point on the legend to jump straight to its location on the live GPS map
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 bg-white/10 rounded-lg p-1">
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.2))}
                className="p-1 hover:bg-white/20 rounded text-white"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono px-1">{Math.round(zoomLevel * 100)}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(2, z + 0.2))}
                className="p-1 hover:bg-white/20 rounded text-white"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Split view (Image + Interactive Legend) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-900">
          {/* Image Viewer Container */}
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center relative bg-slate-950/80 min-h-[280px]">
            <img
              src="/assets/aistudio/WhatsApp_Image_2026-10-22_at_19.36.53_4a5b0ee2.jpeg"
              alt="UENR Campus Map Schematic"
              style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
              className="max-h-[75vh] w-auto object-contain rounded-xl shadow-2xl transition-transform duration-200"
            />
          </div>

          {/* Interactive Legend Sidebar */}
          <div className="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l border-black/10 flex flex-col max-h-[300px] md:max-h-none overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-black/5 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Keywords & Buildings ({schematicKeypoints.length})
              </span>
              <span className="text-[10px] text-slate-400">Tap to locate</span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {schematicKeypoints.map((pt, idx) => (
                <button
                  key={idx}
                  onClick={() => handlePointClick(pt.locId)}
                  className="w-full text-left p-2 rounded-xl hover:bg-emerald-50 transition-colors flex items-center justify-between text-xs group"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 shadow-sm border border-black/15"
                      style={{ backgroundColor: pt.color }}
                    />
                    <span className="font-semibold text-slate-800 group-hover:text-[#176B45] truncate">
                      {pt.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-[#176B45] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    Map →
                  </span>
                </button>
              ))}
            </div>

            {/* Emergency Hotline Banner */}
            <div className="p-3 bg-red-50 border-t border-red-100 text-xs">
              <div className="font-bold text-red-900 flex items-center gap-1.5 mb-1">
                <PhoneCall className="w-3.5 h-3.5 text-red-600" />
                <span>Schematic Help Numbers:</span>
              </div>
              <div className="flex flex-col gap-1 font-mono text-[11px] text-red-800">
                <a href="tel:+233596574532" className="hover:underline">
                  +233 59 657 4532
                </a>
                <a href="tel:+233550910106" className="hover:underline">
                  +233 55 091 0106
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
