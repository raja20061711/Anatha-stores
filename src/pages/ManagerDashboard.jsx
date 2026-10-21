import React, { useState, useEffect } from 'react';
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
  Eye
} from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function ManagerDashboard({ onOpenBilling }) {
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [currentTime, setCurrentTime] = useState(new Date());

  const [dashboardData, setDashboardData] = useState(null);
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [productWiseReport, setProductWiseReport] = useState([]);
  const [cashierReport, setCashierReport] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    loadManagerData();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadManagerData = async () => {
    try {
      const [dashRes, prodRes, purchRes, pwRes, cwRes, movRes] = await Promise.all([
        api.get('/reports/dashboard'),
        api.get('/inventory/stock'),
        api.get('/purchases'),
        api.get('/reports/product-wise'),
        api.get('/reports/cashier-wise'),
        api.get('/inventory/movements?limit=50'),
      ]);

      setDashboardData(dashRes.data);
      setProducts(prodRes.data);
      setPurchases(purchRes.data);
      setProductWiseReport(pwRes.data);
      setCashierReport(cwRes.data);
      setStockMovements(movRes.data);
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

  const lowStockItems = products.filter(
    (p) => Number(p.currentStock) <= Number(p.minStock)
  );

  return (
    <div className="flex h-screen w-screen bg-[#F1F5F9] text-[#0F172A] select-none overflow-hidden">
      {/* Manager Sidebar */}
      <aside className="w-64 bg-[#0F172A] text-slate-300 flex flex-col justify-between border-r border-slate-800 shrink-0">
        <div>
          {/* Brand Header */}
          <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-800 bg-slate-900/60">
            <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center text-white font-bold shadow-md shadow-purple-500/20">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm text-white tracking-wider">ANANTHA STORES</span>
                <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-400/30 px-1.5 py-0.2 rounded font-bold">
                  MANAGER
                </span>
              </div>
              <p className="text-[10px] text-purple-200/90 font-tamil font-semibold leading-tight">
                ஆனந்தா ஸ்டோர்
              </p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="p-3 space-y-1 text-xs">
            {[
              { id: 'overview', label: 'Operations & Monitoring', icon: BarChart3 },
              { id: 'billing', label: 'Billing / POS Terminal', icon: Receipt, action: onOpenBilling },
              { id: 'inventory', label: 'Floor Inventory & Stock', icon: Boxes },
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
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium transition ${
                    isSelected
                      ? 'bg-purple-600 text-white font-semibold shadow-sm'
                      : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                      {item.badge}
                    </span>
                  )}
                  {item.action && (
                    <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Manager User Info */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-800/80 mb-2 text-xs">
            <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
              M
            </div>
            <div>
              <div className="font-semibold text-white leading-tight">{user?.fullName}</div>
              <div className="text-[10px] text-purple-400 font-mono">Role: {user?.role}</div>
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 rounded-xl text-xs font-semibold transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-xs">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              Manager Operations & Stock Monitoring — ANANTHA STORES | ஆனந்தா ஸ்டோர்
            </h2>
            <p className="text-xs text-slate-400">
              Daily sales reports, floor inventory, and authorized goods receiving
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenBilling}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm active:scale-95"
            >
              <Receipt className="w-4 h-4" />
              <span>Launch POS Billing Terminal</span>
            </button>

            <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-xl text-xs font-mono text-slate-600 border border-slate-200">
              <Clock className="w-3.5 h-3.5 text-purple-600" />
              <span>{currentTime.toLocaleTimeString('en-IN')}</span>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: OPERATIONS OVERVIEW */}
          {activeTab === 'overview' && dashboardData && (
            <div className="space-y-6">
              {/* Key KPI Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Today's Total Sales</span>
                  <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                    ₹{Number(dashboardData.todaySales).toFixed(2)}
                  </div>
                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
                    <TrendingUp className="w-3 h-3" /> Live from cash registers
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Completed Bills</span>
                  <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                    {dashboardData.todayBills} Bills
                  </div>
                  <span className="text-[11px] text-purple-600 font-semibold mt-1 block">Supermarket billing lanes</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Low Stock Alerts</span>
                  <div className="text-2xl font-black text-amber-600 mt-1 font-mono">
                    {lowStockItems.length} Products
                  </div>
                  <span className="text-[11px] text-amber-600 font-semibold mt-1 block">Below re-order threshold</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Role Permissions</span>
                  <div className="text-xs font-semibold text-slate-700 mt-1 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>Price Controls Locked</span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Default prices managed by Admin only
                  </span>
                </div>
              </div>

              {/* Cashier Performance Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm">Cashier Counter Performance</h3>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Cashier Name</th>
                      <th className="py-2.5 px-3">Username</th>
                      <th className="py-2.5 px-3 text-center">Bills Generated</th>
                      <th className="py-2.5 px-4 text-right">Total Collection (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cashierReport.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-bold text-slate-900">{c.fullName}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{c.username}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">{c.billCount}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-blue-600">
                          ₹{Number(c.totalSales).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: FLOOR INVENTORY & LOW STOCK */}
          {(activeTab === 'inventory' || activeTab === 'low-stock') && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm">
                    {activeTab === 'low-stock' ? 'Low Stock Warning List' : 'Floor Inventory Stock Counts'}
                  </h3>
                  <span className="text-xs text-slate-400">
                    {activeTab === 'low-stock' ? `${lowStockItems.length} Items need re-order` : `${products.length} Products in store`}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Product Name</th>
                        <th className="py-3 px-3">Tamil Label</th>
                        <th className="py-3 px-3">Category</th>
                        <th className="py-3 px-3 text-right">Selling Price</th>
                        <th className="py-3 px-3 text-center">Current Stock</th>
                        <th className="py-3 px-3 text-center">Min Stock</th>
                        <th className="py-3 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(activeTab === 'low-stock' ? lowStockItems : products).map((p) => {
                        const isLow = Number(p.currentStock) <= Number(p.minStock);
                        return (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-bold text-slate-900">
                              {p.name}
                              <span className="text-[10px] text-slate-400 block font-normal">{p.brand}</span>
                            </td>
                            <td className="py-3 px-3 font-tamil text-slate-600">{p.tamilName || '-'}</td>
                            <td className="py-3 px-3">
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold">
                                {p.category?.name || 'General'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                              ₹{Number(p.sellingPrice).toFixed(2)}
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                              {Number(p.currentStock) % 1 === 0 ? Number(p.currentStock) : Number(p.currentStock).toFixed(3).replace(/\.?0+$/, '')} {p.unit}
                            </td>
                            <td className="py-3 px-3 text-center font-mono text-slate-400">
                              {Number(p.minStock) % 1 === 0 ? Number(p.minStock) : Number(p.minStock).toFixed(3).replace(/\.?0+$/, '')} {p.unit}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                isLow
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}>
                                {isLow ? 'Low Stock' : 'In Stock'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SALES REPORTS */}
          {activeTab === 'sales-reports' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm">Product-Wise Sales Ranking</h3>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Product Name</th>
                      <th className="py-2.5 px-3 text-center">Quantity Sold</th>
                      <th className="py-2.5 px-4 text-right">Total Revenue (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {productWiseReport.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-bold text-slate-900">{p.productName}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">{p.totalQty}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-blue-600">
                          ₹{p.totalRevenue.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: PURCHASES & CONFIRM RECEIVED */}
          {activeTab === 'purchases' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm">Goods Invoices & Receiving Operations</h3>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-3">Supplier</th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3 text-right">Total (₹)</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchases.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-bold text-blue-600">{p.invoiceNumber}</td>
                        <td className="py-3 px-3 font-bold text-slate-800">{p.supplier?.name}</td>
                        <td className="py-3 px-3 text-slate-500">{new Date(p.purchaseDate).toLocaleDateString('en-IN')}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          ₹{Number(p.totalAmount).toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.status === 'RECEIVED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {p.status === 'DRAFT' && (
                            <button
                              type="button"
                              onClick={() => handleReceiveGoods(p.id)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                            >
                              Confirm Received Goods
                            </button>
                          )}
                          {p.status === 'RECEIVED' && (
                            <span className="text-[11px] text-slate-400 font-medium">Stock Received</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
