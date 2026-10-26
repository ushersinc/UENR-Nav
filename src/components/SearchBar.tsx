import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, MapPin, Clock, ArrowRight, CheckCircle2, AlertCircle, Compass } from 'lucide-react';
import { CampusLocation, CampusCategory } from '../types/campus';
import { CATEGORY_METAS } from '../data/campusLocations';

interface SearchBarProps {
  locations: CampusLocation[];
  onSelectLocation: (location: CampusLocation) => void;
  recentSearches: string[];
  onSelectRecentSearch: (query: string) => void;
  onClearRecents: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  locations,
  onSelectLocation,
  recentSearches,
  onSelectRecentSearch,
  onClearRecents,
  placeholder = 'Search lecture halls, hostels, labs, or offices...',
  autoFocus = false,
}) => {
  const [rawQuery, setRawQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  // Debounce query input by 150ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(rawQuery.trim());
      setActiveIndex(-1);
    }, 150);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  // Filter locations matching debounced query
  const filteredLocations = useMemo(() => {
    if (!debouncedQuery) return [];
    const q = debouncedQuery.toLowerCase();
    return locations.filter((loc) => {
      const inName = loc.name.toLowerCase().includes(q);
      const inShortCode = loc.shortCode.toLowerCase().includes(q);
      const inAliases = loc.aliases.some((a) => a.toLowerCase().includes(q));
      const inDesc = loc.description.toLowerCase().includes(q);
      const inCategory = loc.category.toLowerCase().includes(q);
      const inFacilities = loc.facilities.some((f) => f.toLowerCase().includes(q));
      return inName || inShortCode || inAliases || inDesc || inCategory || inFacilities;
    });
  }, [debouncedQuery, locations]);

  // Group filtered results by category for clean visual hierarchy
  const groupedResults = useMemo(() => {
    const groups: { category: string; label: string; items: CampusLocation[] }[] = [];
    const map = new Map<string, CampusLocation[]>();

    filteredLocations.forEach((loc) => {
      if (!map.has(loc.category)) {
        map.set(loc.category, []);
      }
      map.get(loc.category)!.push(loc);
    });

    map.forEach((items, cat) => {
      groups.push({
        category: cat,
        label: CATEGORY_METAS[cat as CampusCategory]?.label || cat,
        items,
      });
    });

    return groups;
  }, [filteredLocations]);

  // Flattened items for keyboard indexing
  const flatSearchResults = useMemo(() => {
    return groupedResults.flatMap((g) => g.items);
  }, [groupedResults]);

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
    setRawQuery('');
    setDebouncedQuery('');
    setIsFocused(false);
    setActiveIndex(-1);
  };

  const handleRecentClick = (term: string) => {
    setRawQuery(term);
    setDebouncedQuery(term);
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

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isFocused) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsFocused(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      setIsFocused(false);
      inputRef.current?.blur();
      return;
    }

    if (flatSearchResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev < flatSearchResults.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : flatSearchResults.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < flatSearchResults.length) {
          handleSelect(flatSearchResults[activeIndex]);
        } else if (flatSearchResults.length > 0) {
          handleSelect(flatSearchResults[0]);
        }
      }
    }
  };

  // Auto-scroll highlighted item into view
  useEffect(() => {
    if (activeIndex >= 0 && listboxRef.current) {
      const activeEl = listboxRef.current.querySelector(`[data-index="${activeIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  return (
    <div ref={containerRef} className="relative w-full z-20">
      <div
        className={`flex items-center gap-2.5 px-3.5 py-2.5 bg-white rounded-xl transition-all shadow-sm ${
          isFocused
            ? 'ring-2 ring-[#176B45] shadow-md border-transparent'
            : 'border border-black/10 hover:border-black/20'
        }`}
      >
        <Search
          className={`w-4 h-4 shrink-0 transition-colors ${
            isFocused ? 'text-[#176B45]' : 'text-slate-400'
          }`}
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isFocused}
          aria-autocomplete="list"
          aria-controls="campus-search-results"
          aria-activedescendant={activeIndex >= 0 ? `result-item-${activeIndex}` : undefined}
          autoFocus={autoFocus}
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-transparent text-xs sm:text-sm text-[#263238] placeholder-slate-400 focus:outline-none"
        />
        {rawQuery && (
          <button
            type="button"
            onClick={() => {
              setRawQuery('');
              setDebouncedQuery('');
              setActiveIndex(-1);
              inputRef.current?.focus();
            }}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
            title="Clear search text"
            aria-label="Clear search text"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown Suggestions */}
      {isFocused && (
        <div
          id="campus-search-results"
          ref={listboxRef}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-2xl border border-black/10 overflow-hidden z-50 max-h-96 flex flex-col animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {/* Query Results */}
          {debouncedQuery ? (
            <div className="overflow-y-auto divide-y divide-black/5">
              {flatSearchResults.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
                    <Search className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-semibold text-slate-700">No campus locations found</div>
                  <div className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    Try searching for "LT Block", "Cafeteria", "Hostel", "Clinic", or "Auditorium"
                  </div>
                </div>
              ) : (
                groupedResults.map((group) => (
                  <div key={group.category} className="py-1">
                    <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/70 border-b border-black/5 flex items-center justify-between">
                      <span>{group.label}</span>
                      <span className="font-mono">{group.items.length}</span>
                    </div>

                    <div className="divide-y divide-black/5">
                      {group.items.map((loc) => {
                        const globalIndex = flatSearchResults.findIndex((item) => item.id === loc.id);
                        const isHighlighted = globalIndex === activeIndex;
                        const categoryMeta = CATEGORY_METAS[loc.category];

                        return (
                          <button
                            id={`result-item-${globalIndex}`}
                            data-index={globalIndex}
                            key={loc.id}
                            role="option"
                            aria-selected={isHighlighted}
                            onClick={() => handleSelect(loc)}
                            onMouseEnter={() => setActiveIndex(globalIndex)}
                            className={`w-full text-left p-3 transition-colors flex items-start gap-3 group ${
                              isHighlighted ? 'bg-emerald-50/70' : 'hover:bg-[#F5F7F4]'
                            }`}
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
                                <span
                                  className={`font-semibold text-xs sm:text-sm truncate transition-colors ${
                                    isHighlighted ? 'text-[#176B45]' : 'text-[#263238] group-hover:text-[#176B45]'
                                  }`}
                                >
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
                                <span className="font-medium text-slate-600">{loc.shortCode}</span>
                                {loc.aliases.length > 0 && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="truncate">{loc.aliases.slice(0, 2).join(', ')}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <ArrowRight
                              className={`w-4 h-4 transition-colors shrink-0 self-center ${
                                isHighlighted
                                  ? 'text-[#176B45] translate-x-0.5'
                                  : 'text-slate-300 group-hover:text-[#176B45]'
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
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
                      className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recentSearches.map((term, i) => (
                      <button
                        key={i}
                        onClick={() => handleRecentClick(term)}
                        className="px-2.5 py-1 rounded-lg bg-[#F5F7F4] hover:bg-slate-200/80 text-xs text-slate-700 font-medium transition-colors border border-black/5 flex items-center gap-1"
                      >
                        <span>{term}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Popular UENR Hubs */}
              <div className="px-1 text-xs font-semibold text-slate-500 mb-2 flex items-center justify-between">
                <span>Popular Student Hubs</span>
                <span className="text-[10px] text-slate-400">Quick Jump</span>
              </div>
              <div className="space-y-1">
                {locations.slice(0, 5).map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => handleSelect(loc)}
                    className="w-full text-left p-2 rounded-xl hover:bg-slate-100 flex items-center justify-between text-xs group transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <MapPin className="w-3.5 h-3.5 text-[#176B45] shrink-0" />
                      <span className="font-medium text-slate-800 truncate">{loc.name}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">({loc.shortCode})</span>
                    </div>
                    <span className="text-[11px] text-[#176B45] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                      Select
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
