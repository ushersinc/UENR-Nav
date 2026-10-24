import React from 'react';
import {
  CampusCategory,
  CategoryMeta,
} from '../types/campus';
import { CATEGORY_METAS } from '../data/campusLocations';
import {
  Landmark,
  BookOpen,
  FlaskConical,
  Building2,
  Home,
  Library,
  Utensils,
  Briefcase,
  Users,
  HeartPulse,
  Compass,
  Trophy,
  LayoutGrid,
} from 'lucide-react';

interface CategoryFilterProps {
  selectedCategory: CampusCategory | 'all';
  onSelectCategory: (cat: CampusCategory | 'all') => void;
  categoryCounts: Record<string, number>;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  selectedCategory,
  onSelectCategory,
  categoryCounts,
}) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Landmark':
        return <Landmark className="w-3.5 h-3.5" />;
      case 'BookOpen':
        return <BookOpen className="w-3.5 h-3.5" />;
      case 'FlaskConical':
        return <FlaskConical className="w-3.5 h-3.5" />;
      case 'Building2':
        return <Building2 className="w-3.5 h-3.5" />;
      case 'Home':
        return <Home className="w-3.5 h-3.5" />;
      case 'Library':
        return <Library className="w-3.5 h-3.5" />;
      case 'Utensils':
        return <Utensils className="w-3.5 h-3.5" />;
      case 'Briefcase':
        return <Briefcase className="w-3.5 h-3.5" />;
      case 'Users':
        return <Users className="w-3.5 h-3.5" />;
      case 'HeartPulse':
        return <HeartPulse className="w-3.5 h-3.5" />;
      case 'Compass':
        return <Compass className="w-3.5 h-3.5" />;
      case 'Trophy':
        return <Trophy className="w-3.5 h-3.5" />;
      default:
        return <LayoutGrid className="w-3.5 h-3.5" />;
    }
  };

  const categories = Object.values(CATEGORY_METAS);
  const totalCount = Object.values(categoryCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="py-2.5 px-3 bg-white border-b border-black/6">
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5">
        {/* All Places Button */}
        <button
          onClick={() => onSelectCategory('all')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
            selectedCategory === 'all'
              ? 'bg-[#176B45] text-white shadow-sm'
              : 'bg-[#F5F7F4] text-[#263238] hover:bg-slate-200/80 border border-black/5'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>All Places</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
              selectedCategory === 'all'
                ? 'bg-white/20 text-[#D7F36A]'
                : 'bg-black/5 text-slate-500'
            }`}
          >
            {totalCount}
          </span>
        </button>

        {/* Categories */}
        {categories.map((cat: CategoryMeta) => {
          const isSelected = selectedCategory === cat.id;
          const count = categoryCounts[cat.id] || 0;

          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(isSelected ? 'all' : cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                isSelected
                  ? 'bg-[#176B45] text-white shadow-sm'
                  : 'bg-[#F5F7F4] text-[#263238] hover:bg-slate-200/80 border border-black/5'
              }`}
            >
              <span className={isSelected ? 'text-[#D7F36A]' : 'text-slate-600'}>
                {getIcon(cat.iconName)}
              </span>
              <span>{cat.label}</span>
              {count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                    isSelected
                      ? 'bg-white/20 text-[#D7F36A]'
                      : 'bg-black/5 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
