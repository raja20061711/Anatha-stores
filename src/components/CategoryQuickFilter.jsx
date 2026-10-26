import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Tag, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

/**
 * Reusable Horizontal Category Quick-Filter Bar for Anantha Stores Admin Panel.
 *
 * @param {Array} categories - Array of category objects or string names
 * @param {Array} products - Array of product objects to calculate category counts from
 * @param {string} selectedCategory - Currently selected category name ('All' or category string)
 * @param {function} onSelectCategory - Callback when a category chip is clicked
 * @param {number} [filteredCount] - Current filtered products count (optional)
 * @param {number} [totalCount] - Total products count (optional)
 * @param {function} [onReset] - Optional custom reset handler
 * @param {function} [getCategoryName] - Extractor function for category name from product item
 * @param {string} [className] - Optional extra class names for container
 */
export default function CategoryQuickFilter({
  categories = [],
  products = [],
  selectedCategory = 'All',
  onSelectCategory,
  filteredCount,
  totalCount,
  onReset,
  getCategoryName,
  className = '',
}) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Helper to extract category name from a product item
  const extractCatName = useCallback(
    (item) => {
      if (getCategoryName) return getCategoryName(item);
      if (!item) return '';
      return item.category?.name || item.categoryName || item.category || '';
    },
    [getCategoryName]
  );

  // Dynamically compute unique, sorted category options
  const categoryOptions = useMemo(() => {
    const set = new Set();

    // From categories prop
    if (Array.isArray(categories)) {
      categories.forEach((c) => {
        const name = typeof c === 'string' ? c : c?.name;
        if (name && typeof name === 'string' && name.trim()) {
          set.add(name.trim());
        }
      });
    }

    // From products prop
    if (Array.isArray(products)) {
      products.forEach((p) => {
        const name = extractCatName(p);
        if (name && typeof name === 'string' && name.trim()) {
          set.add(name.trim());
        }
      });
    }

    const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
    return ['All', ...sorted];
  }, [categories, products, extractCatName]);

  // Compute live product count for each category
  const categoryCounts = useMemo(() => {
    const counts = { All: Array.isArray(products) ? products.length : 0 };
    if (Array.isArray(products)) {
      products.forEach((p) => {
        const cat = extractCatName(p) || 'Uncategorized';
        counts[cat] = (counts[cat] || 0) + 1;
      });
    }
    return counts;
  }, [products, extractCatName]);

  // Check scroll boundary to enable/disable arrow buttons
  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);

    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [updateScrollState, categoryOptions]);

  // Auto-scroll active category into visible view when selection changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const activeBtn = el.querySelector('[data-active="true"]');
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
    updateScrollState();
  }, [selectedCategory, updateScrollState]);

  // Mouse wheel horizontal scroll handler
  const handleWheel = (e) => {
    if (scrollRef.current && e.deltaY !== 0) {
      scrollRef.current.scrollLeft += e.deltaY;
    }
  };

  // Scroll buttons step
  const handleScrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -220, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 220, behavior: 'smooth' });
    }
  };

  // Reset handler
  const handleReset = () => {
    if (onReset) {
      onReset();
    } else if (onSelectCategory) {
      onSelectCategory('All');
    }
  };

  const displayTotal = totalCount !== undefined ? totalCount : products?.length || 0;
  const displayFiltered =
    filteredCount !== undefined
      ? filteredCount
      : selectedCategory === 'All'
      ? displayTotal
      : categoryCounts[selectedCategory] || 0;

  return (
    <div
      className={`bg-white px-3.5 py-2.5 rounded-2xl border border-[#D9E2EF] shadow-xs flex items-center gap-2 select-none ${className}`}
      role="region"
      aria-label="Category Quick Filter"
    >
      {/* Category Section Label */}
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#64748B] uppercase tracking-wider shrink-0 pl-1 pr-2.5 border-r border-[#D9E2EF]">
        <Tag className="w-3.5 h-3.5 text-[#F97316]" />
        <span>Category</span>
      </div>

      {/* Left Navigation Arrow */}
      <button
        type="button"
        onClick={handleScrollLeft}
        disabled={!canScrollLeft}
        aria-label="Scroll categories left"
        className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition ${
          canScrollLeft
            ? 'bg-[#F3F6FA] hover:bg-[#FFF1E7] text-[#17365D] hover:text-[#F97316] border-[#D9E2EF] hover:border-[#FED7AA] cursor-pointer active:scale-95'
            : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed opacity-40'
        }`}
        title={canScrollLeft ? 'Scroll Left' : 'Start reached'}
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>

      {/* Horizontally Scrollable Category Chips Container */}
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        className="flex items-center gap-1.5 overflow-x-auto py-0.5 flex-1 scroll-smooth"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#CBD5E1 transparent',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {categoryOptions.map((catName) => {
          const isActive = selectedCategory === catName;
          const count = categoryCounts[catName] ?? 0;

          return (
            <button
              key={catName}
              type="button"
              data-active={isActive ? 'true' : 'false'}
              onClick={() => onSelectCategory && onSelectCategory(catName)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-150 cursor-pointer shrink-0 shadow-2xs ${
                isActive
                  ? 'bg-[#F97316] text-white shadow-sm shadow-orange-500/25 ring-2 ring-[#F97316]/30'
                  : 'bg-[#F3F6FA] hover:bg-[#FFF1E7] text-[#17365D] hover:text-[#F97316] border border-[#D9E2EF] hover:border-[#FED7AA]'
              }`}
            >
              <span>{catName}</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                  isActive
                    ? 'bg-white/25 text-white'
                    : 'bg-white text-[#64748B] border border-[#D9E2EF]'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right Navigation Arrow */}
      <button
        type="button"
        onClick={handleScrollRight}
        disabled={!canScrollRight}
        aria-label="Scroll categories right"
        className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition ${
          canScrollRight
            ? 'bg-[#F3F6FA] hover:bg-[#FFF1E7] text-[#17365D] hover:text-[#F97316] border-[#D9E2EF] hover:border-[#FED7AA] cursor-pointer active:scale-95'
            : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed opacity-40'
        }`}
        title={canScrollRight ? 'Scroll Right' : 'End reached'}
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>

      {/* Filtered Result Count & Reset Control */}
      <div className="shrink-0 flex items-center gap-2 pl-2 border-l border-[#D9E2EF] text-xs">
        <span className="text-[#64748B] text-[11px] font-medium whitespace-nowrap">
          <strong className="text-[#17365D] font-extrabold">{displayFiltered}</strong> / {displayTotal}
        </span>
        {(selectedCategory !== 'All' || (filteredCount !== undefined && totalCount !== undefined && filteredCount < totalCount)) && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 text-[11px] text-[#F97316] hover:text-[#EA580C] font-bold cursor-pointer hover:underline whitespace-nowrap"
            title="Reset Category Filter"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>
    </div>
  );
}
