import React, { useState } from 'react';
import {
  X,
  GraduationCap,
  BookOpen,
  Utensils,
  HeartPulse,
  Building2,
  Home,
  Compass,
  Landmark,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  PhoneCall,
  CheckCircle,
} from 'lucide-react';
import { CampusLocation } from '../types/campus';

interface FreshersGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: CampusLocation[];
  onSelectLocation: (loc: CampusLocation) => void;
}

export const FreshersGuideModal: React.FC<FreshersGuideModalProps> = ({
  isOpen,
  onClose,
  locations,
  onSelectLocation,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'academics' | 'life' | 'safety'>('overview');

  if (!isOpen) return null;

  const findLocation = (id: string) => locations.find((l) => l.id === id);

  const handlePickLocation = (id: string) => {
    const loc = findLocation(id);
    if (loc) {
      onSelectLocation(loc);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-black/10 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-[#176B45] text-white p-5 sm:p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-[#D7F36A] text-[#176B45] flex items-center justify-center font-bold">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#D7F36A]">
                Orientation & Campus Guide
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-display">New to UENR? Welcome!</h2>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-white/80 max-w-lg leading-relaxed">
            Starting university can be overwhelming. Here is your fast-track map guide to finding
            your lecture halls, laboratories, food joints, clinic, and security on the Sunyani campus.
          </p>

          {/* Navigation Tabs */}
          <div className="flex gap-2 mt-4 overflow-x-auto no-scrollbar pt-1">
            {[
              { id: 'overview', label: 'Orientation' },
              { id: 'academics', label: 'Lectures & Labs' },
              { id: 'life', label: 'Food & Hostels' },
              { id: 'safety', label: 'Clinic & Security' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[#D7F36A] text-[#176B45]'
                    : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-sm">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-[#176B45] shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-emerald-950">
                  <span className="font-bold">Pro-tip for freshers:</span> On your first day,
                  always enter through the <strong>Main Campus Gate</strong>. The Central
                  Administration is straight ahead past the sports field, while LT Block and BoG
                  Auditorium are along the main walkway.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => handlePickLocation('bog-auditorium')}
                  className="p-3.5 rounded-2xl bg-[#F5F7F4] hover:bg-emerald-50 border border-black/5 hover:border-emerald-200 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs sm:text-sm text-slate-800 group-hover:text-[#176B45]">
                      Bank of Ghana Auditorium
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#176B45] group-hover:translate-x-1 transition-all" />
                  </div>
                  <p className="text-xs text-slate-600">
                    Where your Matriculation & Orientation ceremonies take place.
                  </p>
                </div>

                <div
                  onClick={() => handlePickLocation('lt-block')}
                  className="p-3.5 rounded-2xl bg-[#F5F7F4] hover:bg-emerald-50 border border-black/5 hover:border-emerald-200 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs sm:text-sm text-slate-800 group-hover:text-[#176B45]">
                      LT Block (Lecture Theatres)
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#176B45] group-hover:translate-x-1 transition-all" />
                  </div>
                  <p className="text-xs text-slate-600">
                    The central hub for level 100 lectures, general university courses, and tutorials.
                  </p>
                </div>

                <div
                  onClick={() => handlePickLocation('schools-clinic')}
                  className="p-3.5 rounded-2xl bg-[#F5F7F4] hover:bg-emerald-50 border border-black/5 hover:border-emerald-200 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs sm:text-sm text-slate-800 group-hover:text-[#176B45]">
                      School's Clinic
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#176B45] group-hover:translate-x-1 transition-all" />
                  </div>
                  <p className="text-xs text-slate-600">
                    24/7 medical care, student registration medical exam, and emergency triage.
                  </p>
                </div>

                <div
                  onClick={() => handlePickLocation('cafeteria')}
                  className="p-3.5 rounded-2xl bg-[#F5F7F4] hover:bg-emerald-50 border border-black/5 hover:border-emerald-200 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs sm:text-sm text-slate-800 group-hover:text-[#176B45]">
                      Central Cafeteria
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#176B45] group-hover:translate-x-1 transition-all" />
                  </div>
                  <p className="text-xs text-slate-600">
                    Hot meals (Jollof, Waakye, Banku), snacks, cold drinks, and socializing.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'academics' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-500 font-medium">
                Click any academic building below to navigate directly to it:
              </div>
              {[
                { id: 'lt-block', title: 'LT Block', desc: 'Main Lecture Theatres 1, 2 & 3' },
                { id: 'lts-block', title: 'LTS Block', desc: 'Lecture Theatre South for large classes' },
                { id: 'sh-block', title: 'SH Block', desc: 'Social / Science Hall lecture theatres' },
                { id: 'odum-block', title: 'Odum Block', desc: 'Forestry and Natural Resources Faculty' },
                { id: 'rcees-building', title: 'RCEES Building', desc: 'Renewable energy research & postgraduate' },
                { id: 'uenr-chemistry-lab', title: 'Chemistry Lab', desc: 'Practical wet chemistry and analysis' },
                { id: 'engineering-lab', title: 'Engineering Lab', desc: 'Mechanical, electrical, renewable labs' },
                { id: 'app-lab', title: 'APP Lab', desc: 'Applied computing, coding, and software' },
                { id: 'old-library-block', title: 'Old Library Block', desc: 'Quiet study reading rooms & books' },
              ].map((item) => (
                <div
                  key={item.id}
                  onClick={() => handlePickLocation(item.id)}
                  className="p-3 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200/70 hover:border-emerald-200 transition-colors flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <div className="font-semibold text-xs sm:text-sm text-slate-800">{item.title}</div>
                    <div className="text-xs text-slate-500">{item.desc}</div>
                  </div>
                  <span className="text-xs font-semibold text-[#176B45] flex items-center gap-1">
                    Locate <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'life' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-500 font-medium">
                Student accommodation, food courts, and campus life:
              </div>
              {[
                { id: 'university-hall-1', title: 'University Hall 1 (Hall One)', desc: 'Traditional hall of residence' },
                { id: 'university-hall-2', title: 'University Hall 2 (Hall Two)', desc: 'Residential hall with inner quad' },
                { id: 'getfund-hostel', title: 'GETFund Hostel', desc: 'Modern student hostel complex' },
                { id: 'cafeteria', title: 'Central Cafeteria', desc: 'Affordable breakfast, lunch, and dinner' },
                { id: 'summer-hut', title: 'Summer Hut Gazebos', desc: 'Outdoor shaded student hangout & study' },
                { id: 'commercial-centre', title: 'Campus Mini Mart & Photocopy', desc: 'Printing, stationery & supplies' },
                { id: 'uenr-school-field', title: 'Sports Stadium & Field', desc: 'Jogging track, soccer & sports' },
              ].map((item) => (
                <div
                  key={item.id}
                  onClick={() => handlePickLocation(item.id)}
                  className="p-3 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200/70 hover:border-emerald-200 transition-colors flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <div className="font-semibold text-xs sm:text-sm text-slate-800">{item.title}</div>
                    <div className="text-xs text-slate-500">{item.desc}</div>
                  </div>
                  <span className="text-xs font-semibold text-[#176B45] flex items-center gap-1">
                    Locate <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'safety' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-red-50 border border-red-100 space-y-3">
                <div className="flex items-center gap-2 text-red-900 font-bold text-sm">
                  <ShieldAlert className="w-5 h-5 text-red-600" />
                  <span>UENR Campus Security & Emergency Contacts</span>
                </div>
                <p className="text-xs text-red-800 leading-relaxed">
                  Save these official campus hotline numbers directly into your phone for immediate
                  assistance in case of lost items, security emergencies, or medical needs:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-white rounded-xl border border-red-200 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-red-950">Campus Security 1</div>
                      <div className="font-mono text-red-700 text-xs">+233 59 657 4532</div>
                    </div>
                    <a
                      href="tel:+233596574532"
                      className="px-2.5 py-1 bg-red-600 text-white rounded font-medium hover:bg-red-700"
                    >
                      Call
                    </a>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-red-200 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-red-950">Campus Security 2</div>
                      <div className="font-mono text-red-700 text-xs">+233 55 091 0106</div>
                    </div>
                    <a
                      href="tel:+233550910106"
                      className="px-2.5 py-1 bg-red-600 text-white rounded font-medium hover:bg-red-700"
                    >
                      Call
                    </a>
                  </div>
                </div>
              </div>

              <div
                onClick={() => handlePickLocation('schools-clinic')}
                className="p-3.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <HeartPulse className="w-5 h-5 text-[#176B45]" />
                  <div>
                    <div className="font-bold text-xs sm:text-sm text-emerald-950">
                      Navigate to School's Clinic
                    </div>
                    <div className="text-xs text-emerald-800">
                      Walk-in consultations, pharmacy, and medical exams
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#176B45]" />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-black/10 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            UENR Nav · Developed for Sunyani Campus
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#176B45] text-white hover:bg-[#125537] text-xs font-semibold transition-colors shadow-sm"
          >
            Start Exploring Map
          </button>
        </div>
      </div>
    </div>
  );
};
