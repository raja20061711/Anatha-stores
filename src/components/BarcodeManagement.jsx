import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  QrCode,
  Printer,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  ShoppingBag,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  ArrowRight,
  Eye,
  Check,
  X,
  Tag,
  Scale,
  Download,
  FileText
} from 'lucide-react';
import api from '../services/api';
import Barcode128 from './Barcode128';
import CategoryQuickFilter from './CategoryQuickFilter';
import { generateBarcodeLabelsPDF } from '../utils/barcodePdf';

export default function BarcodeManagement({ onOpenProductModal }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState({
    totalProducts: 0,
    withBarcode: 0,
    missingBarcode: 0,
    eligibleForGeneration: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [barcodeFilter, setBarcodeFilter] = useState('All'); // 'All' | 'missing' | 'has'
  const [typeFilter, setTypeFilter] = useState('All'); // 'All' | 'unit' | 'weight'

  // Selection for bulk actions
  const [selectedProductIds, setSelectedProductIds] = useState(new Set());

  // Pagination (25 / 50 / 100 / All)
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [confirmGenerateModal, setConfirmGenerateModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationSummary, setGenerationSummary] = useState(null);

  // Print Label Modal State
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printLabelSize, setPrintLabelSize] = useState('50x25'); // '50x25' | '50x30' | '38x25' | '85x40'
  const [globalCopies, setGlobalCopies] = useState(2);
  const [productCopiesMap, setProductCopiesMap] = useState({});
  const [showStoreName, setShowStoreName] = useState(true);
  const [showTamilTitle, setShowTamilTitle] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showNetQty, setShowNetQty] = useState(true);
  const [isPortalPrinting, setIsPortalPrinting] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0 });
  const [cancelPdfRequested, setCancelPdfRequested] = useState(false);
  const cancelPdfRef = useRef(false);

  // Fetch products and stats from real database
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, catRes, statsRes] = await Promise.all([
        api.get('/products?includeInactive=true'),
        api.get('/products/categories'),
        api.get('/products/barcodes/stats'),
      ]);

      setProducts(prodRes.data || []);
      setCategories(catRes.data || []);
      setStats(statsRes.data || {
        totalProducts: prodRes.data.length,
        withBarcode: prodRes.data.filter((p) => p.barcode && p.barcode.trim() !== '').length,
        missingBarcode: prodRes.data.filter((p) => !p.barcode || p.barcode.trim() === '').length,
        eligibleForGeneration: prodRes.data.filter((p) => !p.barcode || p.barcode.trim() === '').length,
      });
    } catch (err) {
      console.error('Failed to load barcode data:', err);
      setError(err.response?.data?.error || err.message || 'Failed to connect to backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Escape key to close label modal
  useEffect(() => {
    if (!printModalOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setPrintModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [printModalOpen]);

  const isWeightBased = (p) => {
    const mt = (p.measurementType || '').toUpperCase();
    const u = (p.unit || p.baseUnit || '').toLowerCase();
    return mt === 'KG' || mt === 'G' || u === 'kg' || u === 'g';
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchesName = (p.name || '').toLowerCase().includes(q);
        const matchesTamil = (p.tamilName || '').toLowerCase().includes(q);
        const matchesBarcode = (p.barcode || '').toLowerCase().includes(q);
        const matchesBrand = (p.brand || '').toLowerCase().includes(q);
        if (!matchesName && !matchesTamil && !matchesBarcode && !matchesBrand) {
          return false;
        }
      }

      // 2. Category
      if (selectedCategory !== 'All') {
        const catName = p.category?.name || '';
        if (catName !== selectedCategory) return false;
      }

      // 3. Barcode status
      const hasBarcode = Boolean(p.barcode && p.barcode.trim() !== '');
      if (barcodeFilter === 'missing' && hasBarcode) return false;
      if (barcodeFilter === 'has' && !hasBarcode) return false;

      // 4. Product Type
      const weight = isWeightBased(p);
      if (typeFilter === 'unit' && weight) return false;
      if (typeFilter === 'weight' && !weight) return false;

      return true;
    });
  }, [products, searchTerm, selectedCategory, barcodeFilter, typeFilter]);

  // Reset page when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, barcodeFilter, typeFilter, pageSize]);

  const totalPages = useMemo(() => {
    if (pageSize === 'All') return 1;
    return Math.max(1, Math.ceil(filteredProducts.length / Number(pageSize)));
  }, [filteredProducts.length, pageSize]);

  const paginatedProducts = useMemo(() => {
    if (pageSize === 'All') return filteredProducts;
    const start = (currentPage - 1) * Number(pageSize);
    return filteredProducts.slice(start, start + Number(pageSize));
  }, [filteredProducts, currentPage, pageSize]);

  // Selection helpers
  const handleToggleSelect = (id) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    if (selectedProductIds.size === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const handleSelectMissingOnly = () => {
    const missing = products.filter((p) => !p.barcode || p.barcode.trim() === '');
    setSelectedProductIds(new Set(missing.map((p) => p.id)));
  };

  // Trigger bulk generation
  const handleGenerateMissingBarcodes = async () => {
    setIsGenerating(true);
    setGenerationSummary(null);
    try {
      const res = await api.post('/products/barcodes/generate-missing', {});
      setGenerationSummary(res.data);
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Bulk barcode generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Trigger single generation
  const handleGenerateSingle = async (productId) => {
    try {
      const res = await api.post(`/products/${productId}/generate-barcode`);
      alert(res.data.message);
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Barcode generation failed.');
    }
  };

  // Open Print Modal for selected or specific items
  const openPrintForSelected = () => {
    if (selectedProductIds.size === 0) return;
    const selectedProds = products.filter((p) => selectedProductIds.has(p.id) && p.barcode);
    if (selectedProds.length === 0) {
      alert('Selected products do not have barcodes yet. Generate barcodes first before printing labels.');
      return;
    }
    const initialCopies = {};
    selectedProds.forEach((p) => {
      initialCopies[p.id] = globalCopies;
    });
    setProductCopiesMap(initialCopies);
    setPrintModalOpen(true);
  };

  const openPrintForAll = () => {
    const prodsWithBarcodes = filteredProducts.filter((p) => p.barcode);
    if (prodsWithBarcodes.length === 0) {
      alert('No products in the current view have barcodes to print.');
      return;
    }
    const initialCopies = {};
    prodsWithBarcodes.forEach((p) => {
      initialCopies[p.id] = globalCopies;
    });
    setProductCopiesMap(initialCopies);
    setPrintModalOpen(true);
  };

  const openPrintForSingle = (product) => {
    if (!product.barcode) {
      alert('This product does not have a barcode. Please click "Generate" first.');
      return;
    }
    setProductCopiesMap({ [product.id]: globalCopies });
    setPrintModalOpen(true);
  };

  const handleGlobalCopiesChange = (copies) => {
    setGlobalCopies(copies);
    setProductCopiesMap((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((id) => {
        next[id] = copies;
      });
      return next;
    });
  };

  // Flatten products for print based on copies
  const productsToPrint = useMemo(() => {
    const list = [];
    const targetProducts = products.filter((p) => Boolean(productCopiesMap[p.id] && p.barcode));
    targetProducts.forEach((p) => {
      const count = productCopiesMap[p.id] || 0;
      for (let i = 0; i < count; i++) {
        list.push({ ...p, copyIndex: i + 1, totalCopies: count });
      }
    });
    return list;
  }, [products, productCopiesMap]);

  // Execute Print (Mounts portal only during active print execution, then unmounts cleanly)
  const handleExecutePrint = () => {
    if (productsToPrint.length === 0 || isPdfGenerating || isPortalPrinting) return;
    setIsPortalPrinting(true);
    // Allow React one event loop tick to mount portal DOM nodes before initiating browser print dialog
    setTimeout(() => {
      window.print();
      setIsPortalPrinting(false);
    }, 250);
  };

  const handleCancelPdf = () => {
    cancelPdfRef.current = true;
    setCancelPdfRequested(true);
  };

  // High-performance vector PDF download for bulk jobs (zero lag)
  const handleDownloadBarcodePdf = async () => {
    if (productsToPrint.length === 0 || isPdfGenerating) return;
    cancelPdfRef.current = false;
    setCancelPdfRequested(false);
    setIsPdfGenerating(true);
    setPdfProgress({ current: 0, total: productsToPrint.length });
    try {
      await generateBarcodeLabelsPDF(productsToPrint, {
        labelSize: printLabelSize,
        showStoreName,
        showTamilTitle,
        showPrice,
        showNetQty,
        onProgress: (current, total) => {
          setPdfProgress({ current, total });
        },
        shouldCancel: () => cancelPdfRef.current,
      });
    } catch (err) {
      if (err.message && err.message.includes('cancelled')) {
        console.log('PDF generation cancelled by user.');
      } else {
        alert('Failed to generate Barcode PDF: ' + err.message);
      }
    } finally {
      setIsPdfGenerating(false);
      setCancelPdfRequested(false);
    }
  };

  // SVG Barcode Dimensions depending on label size
  const getBarcodeSvgDimensions = () => {
    switch (printLabelSize) {
      case '38x25':
        return { width: 110, height: 26 };
      case '50x30':
        return { width: 140, height: 34 };
      case '85x40':
        return { width: 180, height: 42 };
      case '50x25':
      default:
        return { width: 125, height: 28 };
    }
  };

  const svgDims = getBarcodeSvgDimensions();

  return (
    <div className="space-y-5">
      {/* ========================================================= */}
      {/* TOP HEADER: Title & Quick Refresh                         */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#D9E2EF]">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#FFF1E7] border border-[#FED7AA] flex items-center justify-center text-[#F97316]">
              <QrCode className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-black text-[#17365D] tracking-tight uppercase">
              Barcode Master & Label Management
            </h2>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Bulk generate unique Code 128 barcodes and print thermal label stickers for inventory.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-2 bg-white hover:bg-[#F3F6FA] text-[#17365D] border border-[#D9E2EF] rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer disabled:opacity-50"
            title="Refresh database records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#F97316]' : 'text-[#64748B]'}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* STATS CARDS: Live Database Statistics                     */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Products */}
        <div className="bg-white p-4 rounded-2xl border border-[#D9E2EF] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
              Total Products
            </span>
            <div className="text-2xl font-black text-[#17365D] font-mono mt-0.5">
              {stats.totalProducts}
            </div>
            <span className="text-[10px] text-[#64748B]">In active catalog</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F3F6FA] border border-[#D9E2EF] flex items-center justify-center text-[#F97316]">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        {/* Products With Barcode */}
        <div className="bg-white p-4 rounded-2xl border border-[#D9E2EF] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#16A34A] uppercase tracking-wider block">
              With Barcode
            </span>
            <div className="text-2xl font-black text-[#16A34A] font-mono mt-0.5">
              {stats.withBarcode}
            </div>
            <span className="text-[10px] text-[#16A34A] font-semibold">
              {stats.totalProducts > 0
                ? `${Math.round((stats.withBarcode / stats.totalProducts) * 100)}% barcoded`
                : '0%'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#16A34A]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Missing Barcodes */}
        <div className={`p-4 rounded-2xl border shadow-xs flex items-center justify-between ${
          stats.missingBarcode > 0
            ? 'bg-amber-50/70 border-amber-200 text-amber-900'
            : 'bg-white border-[#D9E2EF]'
        }`}>
          <div>
            <span className={`text-[11px] font-bold uppercase tracking-wider block ${
              stats.missingBarcode > 0 ? 'text-amber-800' : 'text-[#64748B]'
            }`}>
              Missing Barcodes
            </span>
            <div className={`text-2xl font-black font-mono mt-0.5 ${
              stats.missingBarcode > 0 ? 'text-amber-700' : 'text-[#17365D]'
            }`}>
              {stats.missingBarcode}
            </div>
            <span className={`text-[10px] ${
              stats.missingBarcode > 0 ? 'text-amber-700 font-semibold' : 'text-[#64748B]'
            }`}>
              {stats.missingBarcode > 0 ? 'Requires generation' : 'All items barcoded'}
            </span>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            stats.missingBarcode > 0
              ? 'bg-amber-100/80 border border-amber-300 text-amber-700'
              : 'bg-[#F3F6FA] border border-[#D9E2EF] text-slate-400'
          }`}>
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Eligible for Generation */}
        <div className="bg-[#FFF1E7] p-4 rounded-2xl border border-[#FED7AA] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#F97316] uppercase tracking-wider block">
              Eligible to Generate
            </span>
            <div className="text-2xl font-black text-[#F97316] font-mono mt-0.5">
              {stats.eligibleForGeneration}
            </div>
            <span className="text-[10px] text-[#64748B] font-semibold">
              Code 128 (AS0000xxxx)
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F97316] text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* PROMINENT BULK ACTION PANEL                               */}
      {/* ========================================================= */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#D9E2EF] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#F97316]" />
            <h3 className="font-extrabold text-[#17365D] text-sm sm:text-base">
              Bulk Barcode Generator & Print Operations
            </h3>
          </div>
          <p className="text-xs text-[#64748B]">
            Automatically assign standard Code 128 barcodes to all unbarcoded products without altering existing valid barcodes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Prominent Button: Generate Missing Barcodes */}
          <button
            type="button"
            onClick={() => setConfirmGenerateModal(true)}
            disabled={stats.missingBarcode === 0 || isGenerating}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-sm cursor-pointer ${
              stats.missingBarcode > 0
                ? 'bg-[#F97316] hover:bg-[#EA580C] text-white active:scale-95 ring-2 ring-[#F97316]/30'
                : 'bg-slate-100 text-[#64748B] border border-slate-200 cursor-not-allowed opacity-70'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate Missing Barcodes</span>
            {stats.missingBarcode > 0 && (
              <span className="bg-white/25 px-1.5 py-0.5 rounded-full text-[10px] font-mono">
                {stats.missingBarcode}
              </span>
            )}
          </button>

          {/* Print Selected Labels */}
          <button
            type="button"
            onClick={openPrintForSelected}
            disabled={selectedProductIds.size === 0}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              selectedProductIds.size > 0
                ? 'bg-[#17365D] hover:bg-[#122B4A] text-white shadow-xs active:scale-95'
                : 'bg-slate-100 text-[#64748B] border border-slate-200 cursor-not-allowed opacity-60'
            }`}
          >
            <Printer className="w-4 h-4 text-[#FED7AA]" />
            <span>Print Selected Labels</span>
            {selectedProductIds.size > 0 && (
              <span className="bg-white/20 text-white px-1.5 py-0.5 rounded-full text-[10px] font-mono">
                {selectedProductIds.size}
              </span>
            )}
          </button>

          {/* Print All Labels */}
          <button
            type="button"
            onClick={openPrintForAll}
            disabled={filteredProducts.length === 0}
            className="px-3.5 py-2.5 bg-[#F3F6FA] hover:bg-[#FFF1E7] text-[#17365D] border border-[#D9E2EF] rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[#64748B]" />
            <span>Print All Barcode Labels</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* FILTER & SEARCH TOOLBAR                                    */}
      {/* ========================================================= */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#D9E2EF] shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by product name, Tamil title, barcode (e.g. AS00000001), or brand..."
              className="w-full pl-9 pr-3 py-2 bg-[#F3F6FA] border border-[#D9E2EF] rounded-xl text-xs text-[#17365D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] transition shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-[#F3F6FA] border border-[#D9E2EF] rounded-xl text-xs font-medium text-[#17365D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] cursor-pointer"
            >
              <option value="All">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Barcode Status Filter */}
            <select
              value={barcodeFilter}
              onChange={(e) => setBarcodeFilter(e.target.value)}
              className="px-3 py-2 bg-[#F3F6FA] border border-[#D9E2EF] rounded-xl text-xs font-medium text-[#17365D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] cursor-pointer"
            >
              <option value="All">All Barcode Status</option>
              <option value="missing">Missing Barcode ({stats.missingBarcode})</option>
              <option value="has">Has Barcode ({stats.withBarcode})</option>
            </select>

            {/* Product Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-[#F3F6FA] border border-[#D9E2EF] rounded-xl text-xs font-medium text-[#17365D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#F97316] cursor-pointer"
            >
              <option value="All">All Product Types</option>
              <option value="unit">Unit (PCS / Pack / Box)</option>
              <option value="weight">Weight-Based (KG / Grams)</option>
            </select>
          </div>
        </div>

        {/* Selection Bar & Quick Select Shortcuts */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#D9E2EF] text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#64748B] font-medium">
              Showing <strong className="text-[#17365D]">{filteredProducts.length}</strong> of {products.length} products
            </span>
            {selectedProductIds.size > 0 && (
              <span className="bg-[#FFF1E7] text-[#F97316] font-bold px-2 py-0.5 rounded-md text-[11px] border border-[#FED7AA]">
                {selectedProductIds.size} selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              className="text-[#F97316] hover:text-[#EA580C] font-bold text-xs cursor-pointer hover:underline"
            >
              {selectedProductIds.size === filteredProducts.length && filteredProducts.length > 0
                ? 'Deselect All'
                : 'Select All Visible'}
            </button>
            {stats.missingBarcode > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={handleSelectMissingOnly}
                  className="text-amber-700 hover:text-amber-800 font-bold text-xs cursor-pointer hover:underline"
                >
                  Select Missing Barcodes ({stats.missingBarcode})
                </button>
              </>
            )}
            {selectedProductIds.size > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={() => setSelectedProductIds(new Set())}
                  className="text-slate-500 hover:text-slate-700 font-semibold text-xs cursor-pointer"
                >
                  Clear Selection
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Reusable Horizontal Category Quick Filter Bar */}
      <CategoryQuickFilter
        categories={categories}
        products={products}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        filteredCount={filteredProducts.length}
        totalCount={products.length}
        onReset={() => {
          setSelectedCategory('All');
        }}
      />

      {/* ========================================================= */}
      {/* BARCODE MANAGEMENT TABLE                                   */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl border border-[#D9E2EF] shadow-xs overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto inner-scroll-container max-h-[580px] 2xl:max-h-[720px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-[#F3F6FA] shadow-2xs">
              <tr className="bg-[#F3F6FA] text-[#64748B] border-b border-[#D9E2EF] uppercase font-bold text-[10.5px] tracking-wider select-none">
                <th className="py-3 px-3 text-center w-10">
                  <input
                    type="checkbox"
                    checked={
                      selectedProductIds.size === filteredProducts.length &&
                      filteredProducts.length > 0
                    }
                    onChange={handleSelectAllFiltered}
                    className="w-4 h-4 rounded text-[#F97316] focus:ring-[#F97316] border-slate-300 cursor-pointer"
                    title="Select all visible products"
                  />
                </th>
                <th className="py-3 px-2 text-center w-14">ID</th>
                <th className="py-3 px-3">Product Name</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Barcode Number</th>
                <th className="py-3 px-2 text-center">Type</th>
                <th className="py-3 px-3 text-right">Selling Price</th>
                <th className="py-3 px-3 text-center w-24">Stock</th>
                <th className="py-3 px-3 text-center">Barcode Status</th>
                <th className="py-3 px-3 text-center w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9E2EF]">
              {loading ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-[#64748B]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin" />
                      <span>Loading products and barcodes from database...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="10" className="py-12 text-center text-[#64748B]">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <QrCode className="w-8 h-8 text-slate-300 mb-1" />
                      <span className="font-bold text-sm text-[#17365D]">
                        {products.length === 0 ? 'No products found' : 'No products match the filter'}
                      </span>
                      <span className="text-xs text-slate-400">
                        {products.length === 0
                          ? 'Add your first product or import an Excel/CSV spreadsheet to generate and print barcodes.'
                          : 'Try adjusting your search query or category filter.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p) => {
                  const isSelected = selectedProductIds.has(p.id);
                  const hasBarcode = Boolean(p.barcode && p.barcode.trim() !== '');
                  const weightBased = isWeightBased(p);

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-[#FFF1E7]/50 transition-colors ${
                        isSelected ? 'bg-[#FFF1E7]/80' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(p.id)}
                          className="w-4 h-4 rounded text-[#F97316] focus:ring-[#F97316] border-slate-300 cursor-pointer"
                        />
                      </td>

                      {/* ID */}
                      <td className="py-3 px-2 text-center font-mono font-bold text-slate-500 text-[11px]">
                        #{p.id}
                      </td>

                      {/* Product Name */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#17365D]">{p.name}</span>
                          {weightBased && (
                            <span className="bg-[#FFF1E7] text-[#F97316] text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider border border-[#FED7AA]">
                              By Weight
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10.5px] text-[#64748B] mt-0.5">
                          {p.tamilName && (
                            <span className="font-tamil font-semibold text-slate-600">
                              {p.tamilName}
                            </span>
                          )}
                          {p.brand && <span>• {p.brand}</span>}
                          {p.packSize && <span>({p.packSize})</span>}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3">
                        <span className="bg-[#FFF1E7] text-[#F97316] border border-[#FED7AA] px-2 py-0.5 rounded text-[10px] font-semibold">
                          {p.category?.name || 'Groceries'}
                        </span>
                      </td>

                      {/* Barcode Number & Inline Visual */}
                      <td className="py-3 px-3">
                        {hasBarcode ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-mono font-bold text-[#17365D] tracking-wider text-xs">
                              {p.barcode}
                            </span>
                            <div className="w-24 overflow-hidden opacity-85">
                              <Barcode128 value={p.barcode} width={90} height={18} showText={false} />
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-amber-700 italic font-medium">
                            No barcode assigned
                          </span>
                        )}
                      </td>

                      {/* Product Type */}
                      <td className="py-3 px-2 text-center">
                        {weightBased ? (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-200">
                            <Scale className="w-2.5 h-2.5" />
                            <span>KG</span>
                          </span>
                        ) : (
                          <span className="bg-[#F3F6FA] text-[#17365D] border border-[#D9E2EF] px-2 py-0.5 rounded text-[10px] font-bold">
                            {p.unit ? p.unit.toUpperCase() : 'PCS'}
                          </span>
                        )}
                      </td>

                      {/* Selling Price */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-[#17365D]">
                        ₹{Number(p.sellingPrice).toFixed(2)}
                        <span className="text-[10px] text-[#64748B] block font-normal font-sans">
                          {weightBased ? 'per KG' : `per ${p.unit || 'pcs'}`}
                        </span>
                      </td>

                      {/* Stock */}
                      <td className="py-3 px-3 text-center w-24">
                        <div className="flex justify-center">
                          <div
                            className={`inline-flex flex-col items-center justify-center min-w-[68px] px-2 py-1 rounded-lg text-center leading-tight shadow-2xs ${
                              Number(p.currentStock) <= Number(p.minStock)
                                ? 'bg-red-50 text-red-600 border border-red-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            <span className="font-mono font-bold text-[11px] leading-tight">
                              {Number(p.currentStock).toFixed(weightBased ? 2 : 0)}
                            </span>
                            <span className="text-[9px] uppercase font-bold opacity-80 leading-tight tracking-wider">
                              {p.unit ? p.unit.toUpperCase() : 'PCS'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Barcode Status */}
                      <td className="py-3 px-3 text-center">
                        {hasBarcode ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>HAS BARCODE</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            <span>MISSING</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {hasBarcode ? (
                            <button
                              type="button"
                              onClick={() => openPrintForSingle(p)}
                              className="px-2.5 py-1 bg-[#FFF1E7] hover:bg-[#FFE4D5] text-[#F97316] border border-[#FED7AA] rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer shadow-2xs"
                              title="Print barcode labels for this product"
                            >
                              <Printer className="w-3 h-3" />
                              <span>Label</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleGenerateSingle(p.id)}
                              className="px-2.5 py-1 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer shadow-2xs"
                              title="Generate unique barcode for this product"
                            >
                              <Sparkles className="w-3 h-3" />
                              <span>Generate</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Client-side Pagination Footer */}
        <div className="p-3 bg-[#F3F6FA] border-t border-[#D9E2EF] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#64748B]">
          <div className="flex flex-wrap items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const val = e.target.value === 'All' ? 'All' : Number(e.target.value);
                setPageSize(val);
                setCurrentPage(1);
              }}
              className="bg-white border border-[#D9E2EF] rounded-lg px-2 py-1 font-bold text-[#17365D] cursor-pointer"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="All">All ({filteredProducts.length})</option>
            </select>
            <span className="text-slate-300">|</span>
            <span>
              Showing {filteredProducts.length === 0 ? 0 : pageSize === 'All' ? `1 - ${filteredProducts.length}` : `${(currentPage - 1) * Number(pageSize) + 1} - ${Math.min(currentPage * Number(pageSize), filteredProducts.length)}`} of {filteredProducts.length}
            </span>
            {selectedProductIds.size > 0 && (
              <span className="bg-[#FFF1E7] text-[#F97316] font-bold px-2 py-0.5 rounded-full text-[10px] border border-[#FED7AA]">
                {selectedProductIds.size} selected across pages
              </span>
            )}
          </div>

          {pageSize !== 'All' && totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2.5 py-1 bg-white border border-[#D9E2EF] rounded-lg disabled:opacity-40 hover:bg-[#FFF1E7] transition cursor-pointer font-medium text-[#17365D]"
              >
                « First
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 bg-white border border-[#D9E2EF] rounded-lg disabled:opacity-40 hover:bg-[#FFF1E7] transition cursor-pointer font-medium text-[#17365D]"
              >
                ‹ Prev
              </button>
              <span className="px-2 font-bold text-[#17365D]">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 bg-white border border-[#D9E2EF] rounded-lg disabled:opacity-40 hover:bg-[#FFF1E7] transition cursor-pointer font-medium text-[#17365D]"
              >
                Next ›
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 bg-white border border-[#D9E2EF] rounded-lg disabled:opacity-40 hover:bg-[#FFF1E7] transition cursor-pointer font-medium text-[#17365D]"
              >
                Last »
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* CONFIRMATION DIALOG: Generate Missing Barcodes in Bulk    */}
      {/* ========================================================= */}
      {confirmGenerateModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fadeIn"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isGenerating) setConfirmGenerateModal(false);
            }}
          >
            <div 
              className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#D9E2EF] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-[#17365D] text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#FED7AA]" />
                  <h3 className="font-bold text-sm">Generate Missing Barcodes</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmGenerateModal(false)}
                  disabled={isGenerating}
                  className="text-white hover:opacity-80 font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-start gap-3 bg-amber-50 p-3.5 rounded-xl border border-amber-200 text-amber-900 text-xs leading-relaxed">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Confirmation Required</p>
                    <p className="mt-1">
                      You are about to generate unique Code 128 barcodes for{' '}
                      <strong className="text-amber-900 font-black">{stats.missingBarcode} products</strong> that currently do not have a barcode.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-[#17365D]">
                  <div className="flex items-center gap-2 text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Existing valid barcodes will remain unchanged.</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Barcodes will be saved permanently to your SQLite database.</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Compatible with standard Code 128 USB and wireless scanners.</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Zero product duplicates; operation is safe to retry.</span>
                  </div>
                </div>

                {generationSummary && (
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-xs">
                    <p className="font-bold">{generationSummary.message}</p>
                    <p className="text-[11px] mt-0.5 text-emerald-700">
                      Generated: {generationSummary.generatedCount} | Failures: {generationSummary.failedCount}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D9E2EF]">
                  <button
                    type="button"
                    onClick={() => setConfirmGenerateModal(false)}
                    disabled={isGenerating}
                    className="px-4 py-2 rounded-xl bg-[#F3F6FA] hover:bg-slate-200 text-[#17365D] text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateMissingBarcodes}
                    disabled={isGenerating}
                    className="px-5 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Generating Barcodes...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Confirm & Generate ({stats.missingBarcode})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ========================================================= */}
      {/* BULK BARCODE LABEL PRINT PREVIEW MODAL (PORTAL)          */}
      {/* ========================================================= */}
      {printModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-[9999] animate-fadeIn no-print"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setPrintModalOpen(false);
            }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl border border-[#D9E2EF] overflow-hidden flex flex-col z-[10000]"
              style={{
                width: 'min(860px, calc(100vw - 32px))',
                maxHeight: '90dvh',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
            <div className="bg-[#17365D] text-white p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Printer className="w-5 h-5 text-[#FED7AA]" />
                <div>
                  <h3 className="font-bold text-sm">Print Product Barcode Labels</h3>
                  <p className="text-[10px] text-slate-200">
                    ANANTHA STORES — High-Resolution Scannable Label Printing
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPrintModalOpen(false)}
                className="text-white hover:opacity-80 font-bold p-1 cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            {/* Config & Controls Header */}
            <div className="bg-[#F3F6FA] p-4 border-b border-[#D9E2EF] space-y-3 shrink-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. Label Size Selection */}
                <div>
                  <label className="text-[11px] font-bold text-[#17365D] block mb-1 uppercase tracking-wider">
                    Label Dimensions
                  </label>
                  <select
                    value={printLabelSize}
                    onChange={(e) => setPrintLabelSize(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-[#D9E2EF] rounded-xl text-xs font-semibold text-[#17365D] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 cursor-pointer"
                  >
                    <option value="50x25">50mm × 25mm (Standard Shelf Label)</option>
                    <option value="50x30">50mm × 30mm (Medium Pouch Label)</option>
                    <option value="38x25">38mm × 25mm (Compact Sticker)</option>
                    <option value="85x40">85mm Roll (Thermal POS Continuous)</option>
                  </select>
                </div>

                {/* 2. Copies per Product */}
                <div>
                  <label className="text-[11px] font-bold text-[#17365D] block mb-1 uppercase tracking-wider">
                    Copies Per Product
                  </label>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 4, 8, 12].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleGlobalCopiesChange(num)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                          globalCopies === num
                            ? 'bg-[#F97316] text-white shadow-2xs'
                            : 'bg-white border border-[#D9E2EF] text-[#17365D] hover:bg-[#FFF1E7]'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={globalCopies}
                      onChange={(e) => handleGlobalCopiesChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-14 px-2 py-1 bg-white border border-[#D9E2EF] rounded-lg text-xs font-mono font-bold text-center text-[#17365D]"
                      title="Custom copies"
                    />
                  </div>
                </div>

                {/* 3. Total Label Count */}
                <div className="flex items-center justify-between md:justify-end gap-3 self-end">
                  <div className="text-right">
                    <span className="text-[10px] text-[#64748B] uppercase font-bold block">
                      Total Printable Labels
                    </span>
                    <span className="text-xl font-black text-[#F97316] font-mono leading-none">
                      {productsToPrint.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-[#D9E2EF] text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={showStoreName}
                    onChange={(e) => setShowStoreName(e.target.checked)}
                    className="rounded text-[#F97316] focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Store Branding Header</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={showTamilTitle}
                    onChange={(e) => setShowTamilTitle(e.target.checked)}
                    className="rounded text-[#F97316] focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Tamil Product Name</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="rounded text-[#F97316] focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Selling Price</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={showNetQty}
                    onChange={(e) => setShowNetQty(e.target.checked)}
                    className="rounded text-[#F97316] focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Net Weight / Unit</span>
                </label>
              </div>
            </div>

            {/* Live Interactive Label Preview Container */}
            <div className="flex-1 overflow-y-auto inner-scroll-container min-h-0 p-4 sm:p-6 bg-[#F3F6FA]">
              <div className="mb-2 text-xs font-bold text-[#64748B] flex items-center justify-between">
                <span>LABEL PRINT PREVIEW ({productsToPrint.length} labels will be printed)</span>
                <span className="font-mono text-[11px] text-[#17365D]">Size: {printLabelSize}mm</span>
              </div>

              {/* High-Volume Optimization Banner */}
              {productsToPrint.length > 30 && (
                <div className="mb-3 p-3 bg-[#FFF1E7] border border-[#FED7AA] rounded-xl text-xs text-[#17365D] flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#F97316] shrink-0" />
                    <span>
                      Showing first <strong>30 of {productsToPrint.length}</strong> labels in fast preview. All <strong>{productsToPrint.length}</strong> labels will be included in the print job and PDF export.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadBarcodePdf}
                    disabled={isPdfGenerating}
                    className="px-3 py-1.5 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold rounded-lg text-xs flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shadow-xs transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isPdfGenerating ? 'Generating...' : 'Fast Vector PDF (Recommended)'}</span>
                  </button>
                </div>
              )}

              {/* Real-time PDF Generation Progress Bar */}
              {isPdfGenerating && (
                <div className="mb-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                    <span className="flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                      {cancelPdfRequested ? 'Cancelling PDF generation...' : 'Generating High-Volume Vector PDF...'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span>
                        {pdfProgress.current} / {pdfProgress.total} labels ({Math.round((pdfProgress.current / (pdfProgress.total || 1)) * 100)}%)
                      </span>
                      {!cancelPdfRequested && (
                        <button
                          type="button"
                          onClick={handleCancelPdf}
                          className="px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-700 rounded text-[11px] font-bold cursor-pointer transition"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-emerald-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-2 transition-all duration-150"
                      style={{ width: `${Math.round((pdfProgress.current / (pdfProgress.total || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {productsToPrint.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-xl border border-dashed border-[#D9E2EF] text-slate-500 text-xs">
                  No labels configured to print.
                </div>
              ) : (
                <div className="flex flex-wrap gap-3 justify-start p-2 bg-white rounded-xl border border-[#D9E2EF] min-h-[220px]">
                  {productsToPrint.slice(0, 30).map((p, idx) => {
                    const weightBased = isWeightBased(p);
                    return (
                      <div
                        key={`${p.id}-${idx}`}
                        className={`bg-white border border-slate-400/80 shadow-xs rounded p-1.5 flex flex-col items-center justify-between box-border text-center overflow-hidden transition-all ${
                          printLabelSize === '50x25'
                            ? 'w-[48mm] h-[24mm]'
                            : printLabelSize === '50x30'
                            ? 'w-[48mm] h-[29mm]'
                            : printLabelSize === '38x25'
                            ? 'w-[36mm] h-[24mm]'
                            : 'w-[80mm] h-[38mm]'
                        }`}
                        style={{ pageBreakInside: 'avoid' }}
                      >
                        {/* Store Header */}
                        {showStoreName && (
                          <div className="text-[7.5px] font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-0.5 w-full text-center">
                            ANANTHA STORES
                          </div>
                        )}

                        {/* Product Title */}
                        <div className="w-full my-0.5 px-0.5">
                          <div className="text-[9px] font-extrabold text-slate-900 leading-tight truncate">
                            {p.name}
                          </div>
                          {showTamilTitle && p.tamilName && (
                            <div className="text-[8px] font-tamil text-slate-600 leading-tight truncate">
                              {p.tamilName}
                            </div>
                          )}
                        </div>

                        {/* Scannable Code 128 SVG Barcode */}
                        <div className="my-0.5 max-w-full overflow-hidden flex justify-center">
                          <Barcode128
                            value={p.barcode}
                            width={svgDims.width}
                            height={svgDims.height}
                            showText={true}
                            textColor="#000000"
                          />
                        </div>

                        {/* Bottom Row: Net Unit & Price */}
                        <div className="flex items-center justify-between w-full text-[8.5px] font-mono font-bold border-t border-slate-300 pt-0.5 px-1">
                          {showNetQty ? (
                            <span className="text-slate-600 truncate max-w-[50%]">
                              {weightBased ? '1 KG' : p.packSize || p.unit || '1 pcs'}
                            </span>
                          ) : (
                            <span />
                          )}
                          {showPrice && (
                            <span className="text-[9.5px] font-black text-slate-900">
                              ₹{Number(p.sellingPrice).toFixed(2)}
                              {weightBased && <span className="text-[7.5px] font-normal text-slate-500">/kg</span>}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-3.5 bg-white border-t border-[#D9E2EF] flex flex-wrap items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setPrintModalOpen(false)}
                className="px-4 py-2 bg-[#F3F6FA] hover:bg-slate-200 text-[#17365D] rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadBarcodePdf}
                  disabled={productsToPrint.length === 0 || isPdfGenerating}
                  className="px-4 py-2.5 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer transition disabled:opacity-50"
                  title="Download ultra-sharp vector PDF for instant high-volume printing without browser lag"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {isPdfGenerating
                      ? `Generating ${pdfProgress.current}/${pdfProgress.total}...`
                      : `Download Barcode PDF (${productsToPrint.length})`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleExecutePrint}
                  disabled={productsToPrint.length === 0 || isPdfGenerating || isPortalPrinting}
                  className="px-5 py-2.5 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer active:scale-95 transition disabled:opacity-50"
                >
                  <Printer className={`w-4 h-4 ${isPortalPrinting ? 'animate-spin' : ''}`} />
                  <span>{isPortalPrinting ? 'Preparing Print...' : 'Print via Browser'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* PRINT PORTAL: Dedicated #pos-print-portal Isolation       */}
      {/* Only mounted into DOM during active window.print() flow    */}
      {/* ========================================================= */}
      {isPortalPrinting &&
        typeof document !== 'undefined' &&
        document.getElementById('pos-print-portal') &&
        createPortal(
          <div id="printable-barcode-labels" className="print-only">
            {productsToPrint.map((p, idx) => {
              const weightBased = isWeightBased(p);
              return (
                <div
                  key={`print-${p.id}-${idx}`}
                  className={`barcode-label-card size-${printLabelSize}`}
                >
                  {showStoreName && (
                    <div style={{ fontSize: '7.5pt', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #000', width: '100%', paddingBottom: '1px' }}>
                      ANANTHA STORES
                    </div>
                  )}

                  <div style={{ width: '100%', margin: '1px 0' }}>
                    <div style={{ fontSize: '8.5pt', fontWeight: 800, color: '#000', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.name}
                    </div>
                    {showTamilTitle && p.tamilName && (
                      <div style={{ fontSize: '7.5pt', fontFamily: 'Noto Sans Tamil, sans-serif', color: '#333', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.tamilName}
                      </div>
                    )}
                  </div>

                  <div style={{ margin: '1px 0', display: 'flex', justifyContent: 'center', width: '100%' }}>
                    <Barcode128
                      value={p.barcode}
                      width={svgDims.width}
                      height={svgDims.height}
                      showText={true}
                      textColor="#000000"
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '8pt', fontWeight: 700, borderTop: '1px solid #000', paddingTop: '1px', fontFamily: 'monospace' }}>
                    {showNetQty ? (
                      <span>{weightBased ? '1 KG' : p.packSize || p.unit || '1 pcs'}</span>
                    ) : (
                      <span />
                    )}
                    {showPrice && (
                      <span style={{ fontWeight: 900, fontSize: '9pt' }}>
                        ₹{Number(p.sellingPrice).toFixed(2)}
                        {weightBased && <span style={{ fontSize: '7pt' }}>/kg</span>}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>,
          document.getElementById('pos-print-portal')
        )}
    </div>
  );
}
