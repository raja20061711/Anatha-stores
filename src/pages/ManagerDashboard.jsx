import React, { useState, useEffect, useMemo } from 'react';
import { 
  Store, 
  BarChart3, 
  Boxes, 
  Receipt, 
  Truck, 
  AlertTriangle, 
  Clock, 
  LogOut, 
  TrendingUp, 
  Calendar, 
  FileSpreadsheet, 
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Users,
  Search,
  Eye,
  QrCode,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  PackageSearch,
  Edit3
} from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import AnanthaLogo from '../components/AnanthaLogo';
import BarcodeManagement from '../components/BarcodeManagement';
import ReportsSection from '../components/ReportsSection';
import AnanthaAIAssistant from '../components/AnanthaAIAssistant';
import { PosToastContainer } from '../components/PosToast';
import CategoryQuickFilter from '../components/CategoryQuickFilter';

export default function ManagerDashboard({ onOpenBilling }) {
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [dashboardData, setDashboardData] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [productWiseReport, setProductWiseReport] = useState([]);
  const [cashierReport, setCashierReport] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [selectedInventoryCategory, setSelectedInventoryCategory] = useState('All');
  const [inventorySearchFilter, setInventorySearchFilter] = useState('');

  const [stockAdjustModal, setStockAdjustModal] = useState({
    isOpen: false,
    product: null,
    quantityChange: '',
    reason: 'Physical stock verification',
    type: 'ADJUSTMENT',
  });

  useEffect(() => {
    loadManagerData();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadManagerData = async () => {
    try {
      const [dashRes, prodRes, purchRes, pwRes, cwRes, movRes, catRes] = await Promise.all([
        api.get('/reports/dashboard'),
        api.get('/inventory/stock'),
        api.get('/purchases'),
        api.get('/reports/product-wise'),
        api.get('/reports/cashier-wise'),
        api.get('/inventory/movements?limit=50'),
        api.get('/products/categories').catch(() => ({ data: [] })),
      ]);

      setDashboardData(dashRes.data);
      setProducts(prodRes.data);
      setPurchases(purchRes.data);
      setProductWiseReport(pwRes.data);
      setCashierReport(cwRes.data);
      setStockMovements(movRes.data);
      if (catRes?.data) setCategories(catRes.data);
    } catch (err) {
      console.error('Manager load error:', err);
    }
  };

  const handleReceiveGoods = async (purchaseId) => {
    if (!window.confirm('Manager authorization: Confirm that goods have arrived and update stock?')) return;
    try {
      const res = await api.put(`/purchases/${purchaseId}/receive`);
      alert(res.data.message || 'Goods received and stock updated!');
      loadManagerData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to confirm goods');
    }
  };

  const handleStockAdjustment = async () => {
    if (!stockAdjustModal.quantityChange || isNaN(stockAdjustModal.quantityChange)) {
      alert('Enter valid quantity change');
      return;
    }
    try {
      await api.post('/inventory/adjust', {
        productId: stockAdjustModal.product.id,
        quantityChange: parseFloat(stockAdjustModal.quantityChange),
        reason: stockAdjustModal.reason,
        type: stockAdjustModal.type,
      });
      alert('Stock adjusted successfully.');
      setStockAdjustModal({ isOpen: false, product: null, quantityChange: '', reason: 'Correction', type: 'ADJUSTMENT' });
      loadManagerData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to adjust stock');
    }
  };

  const formatStockQuantity = (stock) => {
    const num = Number(stock) || 0;
    return num % 1 === 0 ? num.toString() : num.toFixed(3).replace(/\.?0+$/, '');
  };

  const getStockUnitLabel = (unit, measurementType) => {
    return (unit || (['KG', 'G', 'WEIGHT'].includes((measurementType || '').toUpperCase()) ? 'kg' : 'pcs')).toLowerCase();
  };

  const formatStockValue = (stock, unit, measurementType) => {
    const formatted = formatStockQuantity(stock);
    const u = getStockUnitLabel(unit, measurementType);
    return `${formatted} ${u}`;
  };

  const lowStockItems = useMemo(() => {
    if (!Array.isArray(products)) return [];
    return products.filter(
      (p) => Number(p.currentStock) <= Number(p.minStock) || p.stockStatus === 'LOW_STOCK' || p.stockStatus === 'OUT_OF_STOCK'
    );
  }, [products]);

  const filteredInventoryProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    return products.filter((p) => {
      // Category match
      if (selectedInventoryCategory !== 'All') {
        const catName = p.category?.name || p.categoryName || 'General';
        if (catName !== selectedInventoryCategory) return false;
      }
      // Search match (English name, Tamil title, Brand, Barcode)
      if (inventorySearchFilter && inventorySearchFilter.trim()) {
        const q = inventorySearchFilter.toLowerCase().trim();
        const matchName = p.name && p.name.toLowerCase().includes(q);
        const matchTamil = p.tamilName && p.tamilName.includes(q);
        const matchBrand = p.brand && p.brand.toLowerCase().includes(q);
        const matchBarcode = p.barcode && p.barcode.toLowerCase().includes(q);
        if (!matchName && !matchTamil && !matchBrand && !matchBarcode) return false;
      }
      return true;
    });
  }, [products, selectedInventoryCategory, inventorySearchFilter]);

  return (
    <div className="flex h-screen w-screen bg-[#F3F6FA] bg-grid-dots text-[#17365D] select-none overflow-hidden relative">
      {/* Manager Sidebar — Navy Blue Theme */}
      <aside className={`${sidebarCollapsed ? 'w-20' : 'w-64'} relative bg-[#17365D] border-r border-[#122B4A] text-slate-300 flex flex-col justify-between shrink-0 shadow-md z-20 transition-all duration-200 ease-in-out`}>
        {/* Content Container (Header + Nav) */}
        <div className="relative z-10 flex flex-col flex-1 min-h-0">
          {/* Brand Header */}
          {sidebarCollapsed ? (
            <div className="h-18 px-2 flex flex-col items-center justify-center border-b border-[#234A7D] bg-[#17365D] shrink-0">
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-1.5 shadow-2xs border border-white/20 hover:border-[#F97316] transition-all hover:scale-105 cursor-pointer"
                title="Expand Sidebar"
              >
                <AnanthaLogo variant="header" />
              </button>
            </div>
          ) : (
            <div className="h-18 px-3.5 flex items-center border-b border-[#234A7D] bg-[#17365D] shrink-0">
              <div className="flex items-center gap-2.5 w-full min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-1.5 shadow-2xs border border-white/20 shrink-0">
                  <AnanthaLogo variant="header" />
                </div>
                <div className="min-w-0 flex-1">
                  {/* Row 1: Brand name on left, collapse control on right */}
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-extrabold text-[13px] text-white tracking-wide leading-tight truncate">
                      ANANTHA STORES
                    </span>
                    <button
                      type="button"
                      onClick={() => setSidebarCollapsed(true)}
                      className="w-6 h-6 rounded-lg bg-blue-50 hover:bg-blue-100 active:scale-95 border border-blue-200 text-blue-600 hover:text-blue-700 flex items-center justify-center transition shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 shrink-0"
                      title="Collapse Sidebar"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Row 2: Tamil subtitle on left, role badge immediately after on same row */}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-slate-300 font-tamil font-semibold leading-tight whitespace-nowrap">
                      ஆனந்தா ஸ்டோர்ஸ்
                    </span>
                    <span className="text-[8.5px] bg-[#059669] text-white px-1.5 py-0.5 rounded font-extrabold tracking-wider shadow-2xs leading-none shrink-0">
                      MANAGER
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1.5 text-xs sidebar-blue-scroll">
            {[
              { id: 'overview', label: 'Operations & Monitoring', icon: BarChart3 },
              { id: 'billing', label: 'Billing / POS Terminal', icon: Receipt, action: onOpenBilling },
              { id: 'inventory', label: 'Floor Inventory & Stock', icon: Boxes },
              { id: 'barcodes', label: 'Barcode Management', icon: QrCode },
              { id: 'low-stock', label: 'Low Stock Alerts', icon: AlertTriangle, badge: lowStockItems.length },
              { id: 'sales-reports', label: 'Sales Reports & Rankings', icon: Calendar },
              { id: 'purchases', label: 'Goods Receiving & Orders', icon: Truck },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.action) {
                      item.action();
                    } else {
                      setActiveTab(item.id);
                    }
                  }}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-3' : 'justify-between px-3.5 py-2.5'} rounded-xl font-medium transition duration-150 cursor-pointer ${
                    isSelected
                      ? 'bg-[#F97316] text-white font-bold shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-[#204473]'
                  }`}
                >
                  <div className={`flex items-center gap-2.5 ${sidebarCollapsed ? 'justify-center' : 'min-w-0'}`}>
                    <Icon className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? 'text-white scale-110' : 'text-slate-400'}`} />
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </div>
                  {!sidebarCollapsed && item.badge !== undefined && item.badge > 0 && (
                    <span className="bg-[#DC2626] text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-2xs">
                      {item.badge}
                    </span>
                  )}
                  {!sidebarCollapsed && item.action && (
                    <ArrowUpRight className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Manager User Info (Anchored at Bottom) */}
        <div className="relative z-10 p-3 border-t border-[#234A7D] bg-[#122B4A] shrink-0 space-y-2">
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div 
                className="w-10 h-10 rounded-xl bg-[#F97316] text-white font-black flex items-center justify-center text-sm shadow-soft"
                title={`${user?.fullName || 'Manager'} (MANAGER)`}
              >
                {(user?.fullName || 'M').charAt(0).toUpperCase()}
              </div>
              <button
                onClick={logout}
                className="w-9 h-9 flex items-center justify-center bg-[#17365D] hover:bg-red-600 text-slate-300 hover:text-white border border-[#234A7D] hover:border-red-600 rounded-xl transition shadow-2xs cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4 text-current" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#17365D] border border-[#234A7D] shadow-2xs">
                <div className="w-9 h-9 rounded-xl bg-[#F97316] text-white font-black flex items-center justify-center text-sm shadow-soft shrink-0">
                  {(user?.fullName || 'M').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white text-xs leading-tight truncate">{user?.fullName || 'Store Manager'}</div>
                  <div className="text-[10px] text-slate-300 font-semibold tracking-wide uppercase mt-0.5">Role: {user?.role || 'MANAGER'}</div>
                </div>
              </div>

              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 py-2 bg-[#17365D] hover:bg-red-600 text-slate-300 hover:text-white border border-[#234A7D] hover:border-red-600 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-current" />
                <span className="tracking-wide">Sign Out</span>
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#F3F6FA] relative min-h-0 h-full">
        {/* Top Header — Glass Panel */}
        <header className="h-16 bg-white/95 backdrop-blur-md border-b border-[#D9E2EF] px-6 flex items-center justify-between shadow-soft shrink-0 z-10">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-[#17365D] tracking-tight">
                Manager Operations & Stock Monitoring
              </h2>
              <span className="text-[11px] font-tamil text-[#64748B] font-semibold">
                ஆனந்தா ஸ்டோர்
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* WEXA AI Header Branding Entry */}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-wexa-ai'))}
              className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 bg-gradient-to-r from-[#FFF1E7] to-white hover:from-[#FFE4D5] hover:to-[#FFF1E7] border border-[#FED7AA] hover:border-[#F97316] rounded-xl transition shadow-2xs cursor-pointer group text-left select-none"
              title="Open WEXA AI — Powered by WeEngineerTech"
            >
              <div className="w-6 h-6 rounded-lg bg-[#F97316] text-white flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-xs text-[#17365D] tracking-wide">WEXA AI</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F97316] animate-pulse"></span>
                </div>
                <span className="text-[9.5px] text-[#F97316] font-semibold italic">
                  Powered by WeEngineerTech
                </span>
              </div>
            </button>

            {/* Launch POS Button */}
            <button
              onClick={onOpenBilling}
              className="flex items-center gap-2 bg-[#F97316] hover:bg-[#EA580C] text-white px-4 py-2 rounded-xl text-xs font-extrabold transition shadow-md shadow-orange-500/20 active:scale-95 cursor-pointer"
            >
              <Receipt className="w-4 h-4" />
              <span>Launch POS Billing</span>
            </button>

            {/* Live Clock */}
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-[#17365D] border border-[#D9E2EF] shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-[#F97316]" />
              <span>{currentTime.toLocaleTimeString('en-IN')}</span>
            </div>
          </div>
        </header>

        {/* Content Body with Page Entrance */}
        <main className="flex-1 overflow-y-auto manager-scroll-container p-6 space-y-6 animate-page-entrance min-h-0">
          {/* TAB 1: OPERATIONS OVERVIEW */}
          {activeTab === 'overview' && dashboardData && (
            <div className="space-y-6">
              {/* Key KPI Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-card p-5 rounded-2xl border border-[#D9E2EF] bg-white shadow-soft hover:-translate-y-1 transition duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#64748B] font-bold uppercase tracking-wider">Today's Total Sales</span>
                    <div className="w-8 h-8 rounded-xl bg-[#FFF1E7] border border-[#FED7AA] flex items-center justify-center text-[#F97316]">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-[#17365D] mt-2 font-mono tracking-tight">
                    ₹{Number(dashboardData.todaySales).toFixed(2)}
                  </div>
                  <span className="text-[10.5px] text-emerald-700 font-bold flex items-center gap-1 mt-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Live from cash registers
                  </span>
                </div>

                <div className="glass-card p-5 rounded-2xl border border-[#D9E2EF] bg-white shadow-soft hover:-translate-y-1 transition duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#64748B] font-bold uppercase tracking-wider">Completed Bills</span>
                    <div className="w-8 h-8 rounded-xl bg-slate-50 border border-[#D9E2EF] flex items-center justify-center text-[#17365D]">
                      <Receipt className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-[#17365D] mt-2 font-mono tracking-tight">
                    {dashboardData.todayBills} Bills
                  </div>
                  <span className="text-[10.5px] text-[#F97316] font-bold mt-2 block">Supermarket billing lanes</span>
                </div>

                <div className="glass-card p-5 rounded-2xl border border-[#D9E2EF] bg-white shadow-soft hover:-translate-y-1 transition duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#64748B] font-bold uppercase tracking-wider">Low Stock Alerts</span>
                    <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#D97706]">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-[#D97706] mt-2 font-mono tracking-tight">
                    {lowStockItems.length} Products
                  </div>
                  <span className="text-[10.5px] text-amber-700 font-bold mt-2 block">Below re-order threshold</span>
                </div>

                <div className="glass-card p-5 rounded-2xl border border-[#D9E2EF] bg-white shadow-soft hover:-translate-y-1 transition duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#64748B] font-bold uppercase tracking-wider">Role Permissions</span>
                    <div className="w-8 h-8 rounded-xl bg-slate-50 border border-[#D9E2EF] flex items-center justify-center text-[#17365D]">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-sm font-extrabold text-[#17365D] mt-2 flex items-center gap-1.5">
                    <span>Price Controls Locked</span>
                  </div>
                  <span className="text-[10.5px] text-[#64748B] mt-2 block font-medium">
                    Default prices managed by Admin only
                  </span>
                </div>
              </div>

              {/* Cashier Performance Table */}
              <div className="bg-white rounded-2xl border border-[#D9E2EF] shadow-xs overflow-hidden flex flex-col">
                <div className="p-4 border-b border-[#D9E2EF] flex items-center justify-between shrink-0">
                  <h3 className="font-bold text-[#17365D] text-sm">Cashier Counter Performance</h3>
                  <span className="text-xs text-[#64748B]">Live shift collection</span>
                </div>
                <div className="overflow-x-auto overflow-y-auto inner-scroll-container max-h-[380px] 2xl:max-h-[520px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F3F6FA] text-[#64748B] uppercase font-bold text-[10px] tracking-wider border-b border-[#D9E2EF] sticky top-0 z-10 shadow-2xs">
                      <tr>
                        <th className="py-2.5 px-4">Cashier Name</th>
                        <th className="py-2.5 px-3">Username</th>
                        <th className="py-2.5 px-3 text-center">Bills Generated</th>
                        <th className="py-2.5 px-4 text-right">Total Collection (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D9E2EF]">
                      {cashierReport.map((c) => (
                        <tr key={c.id} className="hover:bg-[#FFF1E7]/40 transition-colors">
                          <td className="py-2.5 px-4 font-bold text-[#17365D]">{c.fullName}</td>
                          <td className="py-2.5 px-3 font-mono text-[#64748B]">{c.username}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-[#17365D]">{c.billCount}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-[#F97316]">
                            ₹{Number(c.totalSales).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FLOOR INVENTORY & STOCK (MATCHES ADMIN INVENTORY UI) */}
          {activeTab === 'inventory' && (
            <div className="space-y-4">
              {/* Top Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={inventorySearchFilter}
                    onChange={(e) => setInventorySearchFilter(e.target.value)}
                    placeholder="Search inventory by product name, Tamil title, or brand..."
                    className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs text-[#17365D] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 shadow-2xs"
                  />
                  {inventorySearchFilter && (
                    <button
                      type="button"
                      onClick={() => setInventorySearchFilter('')}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="text-xs text-[#64748B] flex items-center gap-1.5 self-end sm:self-auto">
                  <span>Total Monitored Items:</span>
                  <strong className="text-[#17365D] font-bold">{products.length}</strong>
                </div>
              </div>

              {/* Reusable Horizontal Category Quick Filter Bar */}
              <CategoryQuickFilter
                categories={categories}
                products={products}
                selectedCategory={selectedInventoryCategory}
                onSelectCategory={setSelectedInventoryCategory}
                filteredCount={filteredInventoryProducts.length}
                totalCount={products.length}
                onReset={() => {
                  setSelectedInventoryCategory('All');
                  setInventorySearchFilter('');
                }}
              />

              {/* Live Inventory & Stock Table Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <h3 className="font-bold text-slate-900 text-sm">Live Inventory & Stock Levels</h3>
                  <span className="text-xs text-slate-400">
                    Showing <strong className="text-[#17365D] font-bold">{filteredInventoryProducts.length}</strong> of {products.length} Products
                  </span>
                </div>
                <div className="overflow-x-auto overflow-y-auto inner-scroll-container max-h-[560px] 2xl:max-h-[700px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
                      <tr>
                        <th className="py-2.5 px-4">Product</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-center">Current Stock</th>
                        <th className="py-2.5 px-3 text-center">Min Stock</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-4 text-center">Adjust Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredInventoryProducts.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-12 text-center text-[#64748B]">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <PackageSearch className="w-8 h-8 text-slate-300 mb-1" />
                              <span className="font-bold text-sm text-[#17365D]">No inventory items found</span>
                              <span className="text-xs text-slate-400">
                                {selectedInventoryCategory !== 'All'
                                  ? `No stock records match category "${selectedInventoryCategory}".`
                                  : 'Try adjusting your search query.'}
                              </span>
                              {selectedInventoryCategory !== 'All' && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedInventoryCategory('All')}
                                  className="mt-2 px-3 py-1 bg-[#FFF1E7] text-[#F97316] border border-[#FED7AA] rounded-lg text-xs font-bold hover:bg-[#F97316] hover:text-white transition cursor-pointer"
                                >
                                  Show All Products
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredInventoryProducts.map((p) => {
                          const isLow = Number(p.currentStock) <= Number(p.minStock) || p.stockStatus === 'LOW_STOCK';
                          const isOut = Number(p.currentStock) <= 0 || p.stockStatus === 'OUT_OF_STOCK';
                          return (
                            <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 px-4 font-bold text-slate-900">
                                {p.name}
                                <span className="text-[10px] text-slate-400 block font-normal">{p.tamilName}</span>
                              </td>
                              <td className="py-2.5 px-3">{p.category?.name || 'General'}</td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                                {formatStockValue(p.currentStock, p.unit, p.measurementType)}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                                {formatStockValue(p.minStock, p.unit, p.measurementType)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isOut
                                    ? 'bg-red-100 text-red-700'
                                    : isLow
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}>
                                  {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => setStockAdjustModal({
                                    isOpen: true,
                                    product: p,
                                    quantityChange: '',
                                    reason: 'Physical stock verification',
                                    type: 'ADJUSTMENT',
                                  })}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>Adjust</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: LOW STOCK ALERTS */}
          {activeTab === 'low-stock' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <h3 className="font-bold text-slate-900 text-sm">Low Stock Warning List</h3>
                  <span className="text-xs text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                    {lowStockItems.length} Products need re-order
                  </span>
                </div>
                <div className="overflow-x-auto overflow-y-auto inner-scroll-container max-h-[560px] 2xl:max-h-[700px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
                      <tr>
                        <th className="py-2.5 px-4">Product</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-center">Current Stock</th>
                        <th className="py-2.5 px-3 text-center">Min Stock</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-4 text-center">Adjust Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lowStockItems.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-12 text-center text-[#64748B]">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-1" />
                              <span className="font-bold text-sm text-[#17365D]">All Stock Healthy</span>
                              <span className="text-xs text-slate-400">No products are currently at or below minimum threshold.</span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        lowStockItems.map((p) => {
                          const isOut = Number(p.currentStock) <= 0 || p.stockStatus === 'OUT_OF_STOCK';
                          return (
                            <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 px-4 font-bold text-slate-900">
                                {p.name}
                                <span className="text-[10px] text-slate-400 block font-normal">{p.tamilName}</span>
                              </td>
                              <td className="py-2.5 px-3">{p.category?.name || 'General'}</td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-700">
                                {formatStockValue(p.currentStock, p.unit, p.measurementType)}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                                {formatStockValue(p.minStock, p.unit, p.measurementType)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isOut
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {isOut ? 'Out of Stock' : 'Low Stock'}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => setStockAdjustModal({
                                    isOpen: true,
                                    product: p,
                                    quantityChange: '',
                                    reason: 'Low stock correction',
                                    type: 'ADJUSTMENT',
                                  })}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>Adjust</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SALES REPORTS & ANALYTICS */}
          {activeTab === 'sales-reports' && (
            <ReportsSection userRole="MANAGER" />
          )}

          {/* TAB 4: PURCHASES & CONFIRM RECEIVED */}
          {activeTab === 'purchases' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <h3 className="font-bold text-slate-900 text-sm">Goods Invoices & Receiving Operations</h3>
                  <span className="text-xs text-slate-400">
                    Showing <strong className="text-[#17365D] font-bold">{purchases.length}</strong> supplier shipments
                  </span>
                </div>
                <div className="overflow-x-auto overflow-y-auto inner-scroll-container max-h-[560px] 2xl:max-h-[700px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
                      <tr>
                        <th className="py-2.5 px-4">Invoice #</th>
                        <th className="py-2.5 px-3">Supplier</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3 text-right">Total (₹)</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {purchases.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-12 text-center text-[#64748B]">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <Truck className="w-8 h-8 text-slate-300 mb-1" />
                              <span className="font-bold text-sm text-[#17365D]">No purchase invoices found</span>
                              <span className="text-xs text-slate-400">No supplier shipments have been recorded yet.</span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        purchases.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-4 font-mono font-bold text-[#F97316]">{p.invoiceNumber}</td>
                            <td className="py-2.5 px-3 font-bold text-[#17365D]">{p.supplier?.name}</td>
                            <td className="py-2.5 px-3 text-[#64748B]">{new Date(p.purchaseDate).toLocaleDateString('en-IN')}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-[#17365D]">
                              ₹{Number(p.totalAmount).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                p.status === 'RECEIVED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {p.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              {p.status === 'DRAFT' && (
                                <button
                                  type="button"
                                  onClick={() => handleReceiveGoods(p.id)}
                                  className="px-3 py-1 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                                >
                                  Confirm Received Goods
                                </button>
                              )}
                              {p.status === 'RECEIVED' && (
                                <span className="text-[11px] text-[#64748B] font-medium">Stock Received</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: BARCODE MANAGEMENT */}
          {activeTab === 'barcodes' && (
            <BarcodeManagement />
          )}
        </main>
      </div>

      {/* MODAL: STOCK ADJUSTMENT */}
      {stockAdjustModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-[#17365D] text-white p-4 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-sm">Adjust Stock: {stockAdjustModal.product?.name}</h3>
              <button
                type="button"
                onClick={() => setStockAdjustModal({ isOpen: false, product: null, quantityChange: '', reason: '', type: 'ADJUSTMENT' })}
                className="text-white hover:opacity-80 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto inner-scroll-container min-h-0">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Adjustment Type</label>
                <select
                  value={stockAdjustModal.type}
                  onChange={(e) => setStockAdjustModal({ ...stockAdjustModal, type: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="ADJUSTMENT">Stock Correction (+/-)</option>
                  <option value="DAMAGE">Damaged Goods (-)</option>
                  <option value="RETURN">Customer Return (+)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Quantity Change (+ or - in {stockAdjustModal.product?.baseUnit || stockAdjustModal.product?.unit || 'units'})
                </label>
                <input
                  type="number"
                  step="any"
                  value={stockAdjustModal.quantityChange}
                  onChange={(e) => setStockAdjustModal({ ...stockAdjustModal, quantityChange: e.target.value })}
                  placeholder="e.g. -0.25 or +10"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Mandatory Reason</label>
                <input
                  type="text"
                  required
                  value={stockAdjustModal.reason}
                  onChange={(e) => setStockAdjustModal({ ...stockAdjustModal, reason: e.target.value })}
                  placeholder="Reason for audit log..."
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStockAdjustModal({ isOpen: false, product: null, quantityChange: '', reason: '', type: 'ADJUSTMENT' })}
                  className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStockAdjustment}
                  className="px-4 py-1.5 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-xs"
                >
                  Apply Adjustment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ANANTHA STORES Advanced AI Business Assistant */}
      <AnanthaAIAssistant pageContext={activeTab} />

      {/* POS Notification & Feedback Toast System */}
      <PosToastContainer />
    </div>
  );
}
