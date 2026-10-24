import React, { useState, useRef, useEffect } from 'react';
import { Search, X, MapPin, Clock, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { CampusLocation } from '../types/campus';
import { CATEGORY_METAS } from '../data/campusLocations';

interface SearchBarProps {
  locations: CampusLocation[];
  onSelectLocation: (location: CampusLocation) => void;
  recentSearches: string[];
  onSelectRecentSearch: (query: string) => void;
  onClearRecents: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  locations,
  onSelectLocation,
  recentSearches,
  onSelectRecentSearch,
  onClearRecents,
}) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter locations matching query
  const filteredLocations = query.trim()
    ? locations.filter((loc) => {
        const q = query.toLowerCase().trim();
        const inName = loc.name.toLowerCase().includes(q);
        const inShortCode = loc.shortCode.toLowerCase().includes(q);
        const inAliases = loc.aliases.some((a) => a.toLowerCase().includes(q));
        const inDesc = loc.description.toLowerCase().includes(q);
        const inCategory = loc.category.toLowerCase().includes(q);
        const inFacilities = loc.facilities.some((f) => f.toLowerCase().includes(q));
        return inName || inShortCode || inAliases || inDesc || inCategory || inFacilities;
      })
    : [];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (loc: CampusLocation) => {
    onSelectLocation(loc);
    setQuery('');
    setIsFocused(false);
  };

  const handleRecentClick = (term: string) => {
    setQuery(term);
    onSelectRecentSearch(term);
    const match = locations.find(
      (l) =>
        l.name.toLowerCase() === term.toLowerCase() ||
        l.shortCode.toLowerCase() === term.toLowerCase() ||
        l.aliases.some((a) => a.toLowerCase() === term.toLowerCase())
    );
    if (match) {
      onSelectLocation(match);
      setIsFocused(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full z-20">
      <div
        className={`flex items-center gap-2.5 px-3.5 py-2.5 bg-white rounded-xl transition-all shadow-sm ${
          isFocused
            ? 'ring-2 ring-[#176B45] shadow-md border-transparent'
            : 'border border-black/10 hover:border-black/20'
        }`}
      >
        <Search className={`w-5 h-5 shrink-0 transition-colors ${isFocused ? 'text-[#176B45]' : 'text-slate-400'}`} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder="Where do you want to go?"
          className="w-full bg-transparent text-sm text-[#263238] placeholder-slate-400 focus:outline-none"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown Suggestions */}
      {isFocused && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-2xl border border-black/10 overflow-hidden z-50 max-h-96 flex flex-col animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Query Results */}
          {query.trim() ? (
            <div className="overflow-y-auto divide-y divide-black/5">
              {filteredLocations.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                    <Search className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-semibold text-slate-700">No campus locations found</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Try searching for "LT Block", "Cafeteria", "Hostel", "Clinic", or "Auditorium"
                  </div>
                </div>
              ) : (
                filteredLocations.map((loc) => {
                  const categoryMeta = CATEGORY_METAS[loc.category];
                  return (
                    <button
                      key={loc.id}
                      onClick={() => handleSelect(loc)}
                      className="w-full text-left p-3 hover:bg-[#F5F7F4] transition-colors flex items-start gap-3 group"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{
                          backgroundColor: categoryMeta ? categoryMeta.bgColor : '#F1F5F9',
                          color: categoryMeta ? categoryMeta.color : '#176B45',
                        }}
                      >
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs sm:text-sm text-[#263238] truncate group-hover:text-[#176B45]">
                            {loc.name}
                          </span>
                          {loc.verificationStatus === 'verified' ? (
                            <span title="Verified campus coordinate">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#176B45] shrink-0" />
                            </span>
                          ) : (
                            <span title="Awaiting field verification">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          <span className="font-medium text-slate-600">{categoryMeta?.label || loc.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{loc.aliases.slice(0, 2).join(', ')}</span>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#176B45] transition-colors shrink-0 self-center" />
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            /* Recents and Suggested Quick Destinations */
            <div className="p-3">
              {recentSearches.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2 px-1">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5" /> Recent Searches
                    </span>
                    <button
                      onClick={onClearRecents}
                      className="text-[11px] text-slate-400 hover:text-slate-600"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recentSearches.map((term, i) => (
                      <button
                        key={i}
                        onClick={() => handleRecentClick(term)}
                        className="px-2.5 py-1 rounded-md bg-[#F5F7F4] hover:bg-slate-200/80 text-xs text-slate-700 font-medium transition-colors border border-black/5 flex items-center gap-1"
                      >
                        <span>{term}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Popular UENR Hubs */}
              <div className="px-1 text-xs font-semibold text-slate-500 mb-2">
                Popular Student Hubs
              </div>
              <div className="space-y-1">
                {locations.slice(0, 4).map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => handleSelect(loc)}
                    className="w-full text-left p-2 rounded-lg hover:bg-slate-100 flex items-center justify-between text-xs group transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <MapPin className="w-3.5 h-3.5 text-[#176B45] shrink-0" />
                      <span className="font-medium text-slate-800 truncate">{loc.name}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">({loc.shortCode})</span>
                    </div>
                    <span className="text-[11px] text-[#176B45] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                      View
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
