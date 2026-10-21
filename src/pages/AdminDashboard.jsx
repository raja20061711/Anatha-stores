import React, { useState, useEffect } from 'react';
import { 
  Store, 
  LayoutDashboard, 
  ShoppingBag, 
  FolderTree, 
  Boxes, 
  Truck, 
  Receipt, 
  Users, 
  Award, 
  BarChart3, 
  UserCheck, 
  History, 
  FileText, 
  Settings, 
  LogOut, 
  Plus, 
  Edit3, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  ShieldAlert,
  ArrowUpRight,
  Upload,
  Download,
  Search,
  RefreshCw,
  Eye,
  Trash2,
  Database,
  Lock,
  Layers,
  FileSpreadsheet,
  Printer,
  RotateCcw
} from 'lucide-react';
import ReceiptComponent from '../components/Receipt';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import * as XLSX from 'xlsx';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { isWeightBased, getPriceBasisLabel } from '../utils/unitCalc';

export default function AdminDashboard({ onOpenBilling }) {
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Data states
  const [dashboardData, setDashboardData] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [appSettings, setAppSettings] = useState(null);
  const [loyaltySettings, setLoyaltySettings] = useState(null);
  const [backups, setBackups] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [productWiseReport, setProductWiseReport] = useState([]);
  const [cashierReport, setCashierReport] = useState([]);
  const [profitReport, setProfitReport] = useState(null);

  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Bill Receipt Preview State
  const [previewBill, setPreviewBill] = useState(null);
  const [receiptFormat, setReceiptFormat] = useState('85mm');
  const [showWatermark, setShowWatermark] = useState(true);

  const handleViewReceipt = async (saleId) => {
    try {
      const res = await api.get(`/sales/${saleId}`);
      setPreviewBill(res.data);
    } catch (err) {
      alert('Failed to load bill receipt details.');
    }
  };

  const handlePrint = async () => {
    if (window.electronAPI?.printBill) {
      try {
        const result = await window.electronAPI.printBill({ silent: false, receiptFormat });
        if (result && result.success) return;
      } catch (err) {
        console.warn('Electron printBill failed:', err);
      }
    }
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!previewBill) return;
    const defaultName = `ANANTHA-STORES-BILL-${previewBill.billNumber}.pdf`;
    if (window.electronAPI?.saveToPdf) {
      try {
        const result = await window.electronAPI.saveToPdf({ filename: defaultName, receiptFormat });
        if (result && result.success) {
          alert(`Receipt saved as PDF successfully:\n${result.filePath}`);
          return;
        } else if (result && result.canceled) {
          return;
        }
      } catch (err) {
        console.warn('Native PDF save error:', err);
      }
    }
    window.print();
  };

  // Modals
  const [addProductModal, setAddProductModal] = useState(false);
  const [editProductModal, setEditProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    name: '', tamilName: '', brand: '', categoryId: '', unit: 'pcs',
    measurementType: 'PCS', baseUnit: 'pcs', pricePerKg: 0, packSize: '', barcode: '', sku: '',
    purchaseCost: 0, sellingPrice: 0, currentStock: 0, minStock: 5,
  });

  const formatStockValue = (stock, unit, measurementType) => {
    const num = Number(stock) || 0;
    const formatted = num % 1 === 0 ? num.toString() : num.toFixed(3).replace(/\.?0+$/, '');
    const u = (unit || (['KG', 'G'].includes((measurementType || '').toUpperCase()) ? 'kg' : 'pcs')).toLowerCase();
    return `${formatted} ${u}`;
  };

  const [priceModal, setPriceModal] = useState({ isOpen: false, product: null, newPrice: '', reason: '' });
  const [stockAdjustModal, setStockAdjustModal] = useState({ isOpen: false, product: null, quantityChange: '', reason: 'Correction', type: 'ADJUSTMENT' });
  const [newSupplierModal, setNewSupplierModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: '', contactPerson: '', phone: '', email: '', address: '' });
  
  const [newPurchaseModal, setNewPurchaseModal] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    supplierId: '', invoiceNumber: '', purchaseDate: new Date().toISOString().split('T')[0],
    items: [{ productId: '', quantity: 1, purchaseCost: 0 }], paidAmount: 0, notes: '',
  });

  const [newStaffModal, setNewStaffModal] = useState(false);
  const [staffForm, setStaffForm] = useState({ fullName: '', username: '', password: '', role: 'CASHIER' });

  // Excel Import state
  const [importRows, setImportRows] = useState([]);
  const [importPreviewData, setImportPreviewData] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [duplicateMode, setDuplicateMode] = useState('SKIP'); // 'SKIP' | 'UPDATE'
  const [importResult, setImportResult] = useState(null);

  // Load active tab data
  useEffect(() => {
    loadTabData(activeTab);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [activeTab]);

  const loadTabData = async (tab) => {
    setLoading(true);
    try {
      if (tab === 'dashboard') {
        const res = await api.get('/reports/dashboard');
        setDashboardData(res.data);
      } else if (tab === 'products') {
        const [pRes, cRes] = await Promise.all([
          api.get('/products?includeInactive=true'),
          api.get('/products/categories'),
        ]);
        setProducts(pRes.data);
        setCategories(cRes.data);
      } else if (tab === 'inventory') {
        const [sRes, mRes] = await Promise.all([
          api.get('/inventory/stock'),
          api.get('/inventory/movements?limit=50'),
        ]);
        setProducts(sRes.data);
        setStockMovements(mRes.data);
      } else if (tab === 'suppliers') {
        const res = await api.get('/suppliers');
        setSuppliers(res.data);
      } else if (tab === 'purchases') {
        const [pRes, sRes, prRes] = await Promise.all([
          api.get('/purchases'),
          api.get('/suppliers'),
          api.get('/products'),
        ]);
        setPurchases(pRes.data);
        setSuppliers(sRes.data);
        setProducts(prRes.data);
      } else if (tab === 'customers') {
        const res = await api.get('/customers');
        setCustomers(res.data);
      } else if (tab === 'reports') {
        const [pwRes, cwRes, prRes] = await Promise.all([
          api.get('/reports/product-wise'),
          api.get('/reports/cashier-wise'),
          api.get('/reports/estimated-profit'),
        ]);
        setProductWiseReport(pwRes.data);
        setCashierReport(cwRes.data);
        setProfitReport(prRes.data);
      } else if (tab === 'staff') {
        const res = await api.get('/staff');
        setStaffList(res.data);
      } else if (tab === 'settings') {
        const [setRes, aRes, pRes, bRes] = await Promise.all([
          api.get('/settings'),
          api.get('/settings/audit-logs'),
          api.get('/settings/price-history'),
          api.get('/settings/backups'),
        ]);
        setAppSettings(setRes.data.appSettings);
        setLoyaltySettings(setRes.data.loyaltySettings);
        setAuditLogs(aRes.data);
        setPriceHistory(pRes.data);
        setBackups(bRes.data);
      }
    } catch (err) {
      console.error('Failed to load tab data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Product Add / Edit
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      const isWeight = ['KG', 'G'].includes((productForm.measurementType || '').toUpperCase());
      const payload = {
        ...productForm,
        purchaseCost: parseFloat(productForm.purchaseCost) || 0,
        sellingPrice: parseFloat(productForm.sellingPrice) || 0,
        pricePerKg: isWeight
          ? (parseFloat(productForm.pricePerKg) || parseFloat(productForm.sellingPrice) || 0)
          : null,
        minStock: parseFloat(productForm.minStock) || 0,
        currentStock: parseFloat(productForm.currentStock) || 0,
        baseUnit: isWeight ? 'kg' : (productForm.baseUnit || productForm.unit || 'pcs'),
        unit: isWeight ? 'kg' : (productForm.unit || 'pcs'),
      };

      if (editProductModal && selectedProduct) {
        await api.put(`/products/${selectedProduct.id}`, payload);
        alert('Product updated successfully.');
      } else {
        await api.post('/products', payload);
        alert('Product created successfully.');
      }
      setAddProductModal(false);
      setEditProductModal(false);
      loadTabData('products');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save product');
    }
  };

  const handleUpdatePrice = async () => {
    if (!priceModal.newPrice || isNaN(priceModal.newPrice)) {
      alert('Enter valid price');
      return;
    }
    try {
      await api.put(`/products/${priceModal.product.id}/price`, {
        newSellingPrice: parseFloat(priceModal.newPrice),
        reason: priceModal.reason,
      });
      alert(`Updated ${priceModal.product.name} master price to ₹${priceModal.newPrice}`);
      setPriceModal({ isOpen: false, product: null, newPrice: '', reason: '' });
      loadTabData('products');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update price');
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
      setStockAdjustModal({ isOpen: false, product: null, quantityChange: '', reason: '', type: 'ADJUSTMENT' });
      loadTabData('inventory');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to adjust stock');
    }
  };

  // Supplier Add
  const handleSaveSupplier = async (e) => {
    e.preventDefault();
    try {
      await api.post('/suppliers', supplierForm);
      alert('Supplier registered.');
      setNewSupplierModal(false);
      setSupplierForm({ name: '', contactPerson: '', phone: '', email: '', address: '' });
      loadTabData('suppliers');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add supplier');
    }
  };

  // Purchase Order Add & Confirm Received
  const handleSavePurchase = async (e) => {
    e.preventDefault();
    try {
      await api.post('/purchases', purchaseForm);
      alert('Purchase recorded successfully.');
      setNewPurchaseModal(false);
      loadTabData('purchases');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to record purchase');
    }
  };

  const handleReceiveGoods = async (purchaseId) => {
    if (!window.confirm('Confirm that goods have arrived and update inventory stock?')) return;
    try {
      const res = await api.put(`/purchases/${purchaseId}/receive`);
      alert(res.data.message || 'Goods confirmed received. Stock increased!');
      loadTabData('purchases');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to receive goods');
    }
  };

  // Staff Account Add
  const handleSaveStaff = async (e) => {
    e.preventDefault();
    try {
      await api.post('/staff', staffForm);
      alert(`Created ${staffForm.role} account for ${staffForm.fullName}`);
      setNewStaffModal(false);
      setStaffForm({ fullName: '', username: '', password: '', role: 'CASHIER' });
      loadTabData('staff');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create staff account');
    }
  };

  // Excel Import handlers
  const handleExcelFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        setImportRows(data);
        const res = await api.post('/products/import-preview', { rows: data });
        setImportPreviewData(res.data);
      } catch (err) {
        alert('Failed to parse Excel file: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async () => {
    if (!importPreviewData || importPreviewData.validCount === 0) return;
    setIsImporting(true);
    setImportResult(null);
    try {
      const validRows = importPreviewData.rows.filter((r) => r.isValid);
      const res = await api.post('/products/import-confirm', {
        validRows,
        onDuplicate: duplicateMode,
      });
      setImportResult(res.data);
      alert(res.data.message);
      setImportPreviewData(null);
      setImportRows([]);
      loadTabData('products');
    } catch (err) {
      alert(err.response?.data?.error || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  // Helper to load built-in 100-sample product dataset directly
  const handleLoadBuiltinSampleData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/anantha_store_100_products.json');
      // If JSON not on frontend directly, fetch via xlsx binary from public
      const response = await fetch('/anantha_store_100_products.xlsx');
      const arrayBuffer = await response.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      const wsname = wb.SheetNames[0];
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);
      
      setImportRows(data);
      const prevRes = await api.post('/products/import-preview', { rows: data });
      setImportPreviewData(prevRes.data);
      setImportResult(null);
    } catch (err) {
      alert('Failed to load sample dataset: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Database Backup Create
  const handleCreateBackup = async () => {
    try {
      const res = await api.post('/settings/backup');
      alert(`Backup created successfully: ${res.data.fileName} (${res.data.sizeKb} KB)`);
      loadTabData('settings');
    } catch (err) {
      alert('Backup failed: ' + err.message);
    }
  };

  // Settings Save
  const handleSaveGeneralSettings = async (e) => {
    e.preventDefault();
    try {
      await api.put('/settings/general', appSettings);
      alert('Store details updated successfully.');
    } catch (err) {
      alert('Failed to update settings');
    }
  };

  const handleSavePriceOverrideSettings = async (e) => {
    e.preventDefault();
    try {
      await api.put('/settings/price-override', appSettings);
      alert('Price override rules updated.');
    } catch (err) {
      alert('Failed to update override rules');
    }
  };

  const handleSaveLoyaltySettings = async (e) => {
    e.preventDefault();
    try {
      await api.put('/settings/loyalty', loyaltySettings);
      alert('Loyalty settings updated.');
    } catch (err) {
      alert('Failed to update loyalty');
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#F1F5F9] text-[#0F172A] select-none overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-[#0F172A] text-slate-300 flex flex-col justify-between border-r border-slate-800 shrink-0">
        <div>
          {/* Brand Header */}
          <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-800 bg-slate-900/60">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm text-white tracking-wider">ANANTHA STORES</span>
                <span className="text-[9px] bg-blue-500/20 text-blue-300 border border-blue-400/30 px-1.5 py-0.2 rounded font-bold">
                  ADMIN
                </span>
              </div>
              <p className="text-[10px] text-blue-200/90 font-tamil font-semibold leading-tight">
                ஆனந்தா ஸ்டோர்
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 text-xs overflow-y-auto max-h-[calc(100vh-140px)]">
            {[
              { id: 'dashboard', label: 'Dashboard Overview', icon: LayoutDashboard },
              { id: 'billing', label: 'Billing / POS Terminal', icon: Receipt, action: onOpenBilling },
              { id: 'products', label: 'Products & Price Master', icon: ShoppingBag },
              { id: 'import', label: 'Excel/CSV Import', icon: FileSpreadsheet },
              { id: 'inventory', label: 'Inventory & Stock Alerts', icon: Boxes },
              { id: 'suppliers', label: 'Suppliers Management', icon: Truck },
              { id: 'purchases', label: 'Purchase Invoices', icon: Receipt },
              { id: 'customers', label: 'Customers & Loyalty', icon: Award },
              { id: 'reports', label: 'Sales Reports & Analytics', icon: BarChart3 },
              { id: 'staff', label: 'Staff Accounts', icon: UserCheck },
              { id: 'settings', label: 'Settings, Backup & Audit', icon: Settings },
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
                      ? 'bg-blue-600 text-white shadow-sm font-semibold'
                      : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.action && (
                    <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/80 mb-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                A
              </div>
              <div>
                <div className="font-semibold text-white leading-tight">{user?.fullName}</div>
                <div className="text-[10px] text-blue-400 font-mono">Role: {user?.role}</div>
              </div>
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
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-xs">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              Admin Control Center — ANANTHA STORES | ஆனந்தா ஸ்டோர்
            </h2>
            <p className="text-xs text-slate-400">
              Supermarket administration, master pricing, stock and report analytics
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
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>{currentTime.toLocaleTimeString('en-IN')}</span>
            </div>
          </div>
        </header>

        {/* Dynamic Tab Body */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === 'dashboard' && dashboardData && (
            <div className="space-y-6">
              {/* KPI Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Today's Sales</span>
                  <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                    ₹{Number(dashboardData.todaySales).toFixed(2)}
                  </div>
                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
                    <TrendingUp className="w-3 h-3" /> Live from MySQL database
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Today's Bills</span>
                  <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                    {dashboardData.todayBills} Bills
                  </div>
                  <span className="text-[11px] text-blue-600 font-semibold mt-1 block">Completed registers</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Active Products</span>
                  <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                    {dashboardData.totalProducts} Items
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">Live in store catalog</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Low Stock Alerts</span>
                  <div className="text-2xl font-black text-amber-600 mt-1 font-mono">
                    {dashboardData.lowStockCount} Items
                  </div>
                  <span className="text-[11px] text-amber-600 font-semibold mt-1 block">Need supplier re-order</span>
                </div>
              </div>

              {/* Chart & Payment Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 7-Day Trend Chart */}
                <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-900 text-sm">7-Day Supermarket Sales Trend</h3>
                    <span className="text-xs text-slate-400">Values in INR (₹)</span>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboardData.salesTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                        <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} />
                        <YAxis stroke="#94A3B8" fontSize={11} />
                        <Tooltip />
                        <Bar dataKey="sales" fill="#2563EB" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Payment Breakdown Card */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <h3 className="font-bold text-slate-900 text-sm">Payment Collection Breakdown</h3>
                  <div className="space-y-3">
                    {dashboardData.paymentMethodBreakdown?.map((pm, idx) => (
                      <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                          <span className="font-bold text-xs text-slate-700">{pm.method}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-sm text-slate-900 block">
                            ₹{Number(pm.total).toFixed(2)}
                          </span>
                          <span className="text-[10px] text-slate-400">{pm.count} bills</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Bills Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm">Recent Completed Transactions</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4">Bill #</th>
                        <th className="py-2.5 px-3">Date & Time</th>
                        <th className="py-2.5 px-3">Cashier</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                        <th className="py-2.5 px-3 text-center">Payment</th>
                        <th className="py-2.5 px-4 text-right">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dashboardData.recentSales?.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 font-mono font-bold text-blue-600">{s.billNumber}</td>
                          <td className="py-2.5 px-3 text-slate-500">{new Date(s.createdAt).toLocaleString('en-IN')}</td>
                          <td className="py-2.5 px-3 text-slate-700">{s.cashier?.fullName}</td>
                          <td className="py-2.5 px-3 text-slate-700">{s.customer?.name || 'Walk-in'}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            ₹{Number(s.grandTotal).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold">
                              {s.paymentMethod}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleViewReceipt(s.id)}
                              className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-[#1E3A8A] border border-sky-200 rounded-md text-[11px] font-bold inline-flex items-center gap-1 transition shadow-2xs"
                              title="View & Print Official Receipt"
                            >
                              <Printer className="w-3.5 h-3.5 text-blue-600" />
                              <span>Receipt</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRODUCTS & PRICE MASTER */}
          {activeTab === 'products' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search products by English / Tamil name or brand..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setProductForm({
                        name: '', tamilName: '', brand: '', categoryId: categories[0]?.id || '',
                        unit: 'pcs', measurementType: 'PCS', baseUnit: 'pcs', pricePerKg: 0, packSize: '', barcode: '', sku: '',
                        purchaseCost: 0, sellingPrice: 0, currentStock: 0, minStock: 5,
                      });
                      setEditProductModal(false);
                      setAddProductModal(true);
                    }}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New Product</span>
                  </button>
                </div>
              </div>

              {/* Products Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Product Name</th>
                        <th className="py-3 px-3">Tamil Name</th>
                        <th className="py-3 px-3">Category</th>
                        <th className="py-3 px-3 text-right">Cost Price (₹)</th>
                        <th className="py-3 px-3 text-right">Default Selling Price (₹)</th>
                        <th className="py-3 px-3 text-center">Stock</th>
                        <th className="py-3 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {products
                        .filter((p) => !searchFilter || p.name.toLowerCase().includes(searchFilter.toLowerCase()) || (p.tamilName && p.tamilName.includes(searchFilter)))
                        .map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-bold text-slate-900">
                              <div className="flex items-center gap-2">
                                <span>{p.name}</span>
                                {isWeightBased(p) && (
                                  <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider">
                                    By Weight
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 block font-normal">
                                {p.brand ? `${p.brand} • ` : ''}
                                {p.measurementType || p.unit?.toUpperCase() || 'PCS'}
                                {p.packSize ? ` (${p.packSize})` : ''}
                                {p.barcode ? ` • Barcode: ${p.barcode}` : ''}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-tamil text-slate-600">{p.tamilName || '-'}</td>
                            <td className="py-3 px-3">
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold">
                                {p.category?.name || 'General'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-slate-500">
                              ₹{Number(p.purchaseCost).toFixed(2)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                              ₹{Number(p.sellingPrice).toFixed(2)}
                              <span className="text-[10px] text-slate-400 block font-normal font-sans">
                                {getPriceBasisLabel(p)}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                Number(p.currentStock) <= Number(p.minStock)
                                  ? 'bg-red-50 text-red-600 border border-red-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}>
                                {formatStockValue(p.currentStock, p.unit, p.measurementType)}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setPriceModal({
                                    isOpen: true,
                                    product: p,
                                    newPrice: String(p.sellingPrice),
                                    reason: '',
                                  })}
                                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition"
                                  title={isWeightBased(p) ? 'Change Master Price per KG' : 'Change Default Selling Price'}
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>{isWeightBased(p) ? 'Price/KG' : 'Price'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedProduct(p);
                                    const mt = p.measurementType || (['kg', 'g', 'kilogram', 'gram'].includes(String(p.unit).toLowerCase()) ? 'KG' : 'PCS');
                                    setProductForm({
                                      name: p.name,
                                      tamilName: p.tamilName || '',
                                      brand: p.brand || '',
                                      categoryId: p.categoryId || '',
                                      unit: p.unit || 'pcs',
                                      measurementType: mt,
                                      baseUnit: p.baseUnit || (mt === 'KG' || mt === 'G' ? 'kg' : p.unit || 'pcs'),
                                      pricePerKg: p.pricePerKg != null ? p.pricePerKg : (mt === 'KG' || mt === 'G' ? p.sellingPrice : 0),
                                      packSize: p.packSize || '',
                                      barcode: p.barcode || '',
                                      sku: p.sku || '',
                                      purchaseCost: p.purchaseCost,
                                      sellingPrice: p.sellingPrice,
                                      currentStock: p.currentStock,
                                      minStock: p.minStock,
                                    });
                                    setEditProductModal(true);
                                  }}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                                >
                                  Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EXCEL / CSV IMPORT WORKFLOW */}
          {activeTab === 'import' && (
            <div className="space-y-6">
              {/* Top Banner & Download Cards */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-lg tracking-tight">
                      Bulk Product Excel Import & Catalog Management
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Import product catalogs, review images, detect duplicates, and save valid products directly into MySQL.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href="http://localhost:5000/api/products/template/download"
                      className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-xl text-xs font-bold transition shadow-xs"
                      title="Download clean Excel template"
                    >
                      <Download className="w-4 h-4 text-slate-600" />
                      <span>Blank Template</span>
                    </a>

                    <a
                      href="http://localhost:5000/api/products/sample-100/download"
                      className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-2 rounded-xl text-xs font-bold transition shadow-xs"
                      title="Download 100 sample supermarket products dataset"
                    >
                      <Download className="w-4 h-4 text-blue-600" />
                      <span>100 Sample Products (.xlsx)</span>
                    </a>

                    <a
                      href="http://localhost:5000/api/products/images-zip/download"
                      className="flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3 py-2 rounded-xl text-xs font-bold transition shadow-xs"
                      title="Download ZIP of product card images"
                    >
                      <Download className="w-4 h-4 text-purple-600" />
                      <span>Images Archive (ZIP)</span>
                    </a>
                  </div>
                </div>

                {/* Upload & Quick-Fill Area */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 border-2 border-dashed border-blue-300 rounded-2xl p-6 text-center bg-blue-50/20 hover:bg-blue-50/50 transition flex flex-col items-center justify-center">
                    <Upload className="w-9 h-9 text-blue-600 mb-2" />
                    <h4 className="text-sm font-bold text-slate-800">Select Completed Product Spreadsheet</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Columns: product_name, tamil_name, brand, category, unit, purchase_price, selling_price, opening_stock, minimum_stock, image_filename, status
                    </p>
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleExcelFileUpload}
                      className="mt-4 text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                    />
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800 mb-1">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <span>Quick Development Test</span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Immediately load the 100-product supermarket dataset prepared for Anantha Store with matching local images.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleLoadBuiltinSampleData}
                      disabled={loading}
                      className="w-full mt-3 py-2.5 px-3 bg-white hover:bg-blue-50 border border-blue-300 text-blue-700 rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                      <span>Load 100 Sample Products</span>
                    </button>
                  </div>
                </div>

                {/* Import Result Notification */}
                {importResult && (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2 font-medium">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>{importResult.message}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveTab('products')}
                        className="px-3 py-1 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 text-xs"
                      >
                        View Product Catalog
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Import Preview Results */}
              {importPreviewData && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
                  {/* Stats Bar */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                      <span className="text-[11px] text-slate-500 font-bold block uppercase">Total Rows</span>
                      <span className="text-xl font-extrabold text-slate-900 font-mono">
                        {importPreviewData.totalRows}
                      </span>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                      <span className="text-[11px] text-emerald-700 font-bold block uppercase">New Products</span>
                      <span className="text-xl font-extrabold text-emerald-700 font-mono">
                        {importPreviewData.newCount || 0}
                      </span>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl">
                      <span className="text-[11px] text-amber-700 font-bold block uppercase">Duplicates Found</span>
                      <span className="text-xl font-extrabold text-amber-700 font-mono">
                        {importPreviewData.duplicateCount || 0}
                      </span>
                    </div>

                    <div className="bg-red-50 border border-red-200 p-3 rounded-xl">
                      <span className="text-[11px] text-red-700 font-bold block uppercase">Row Errors</span>
                      <span className="text-xl font-extrabold text-red-700 font-mono">
                        {importPreviewData.errorCount || 0}
                      </span>
                    </div>
                  </div>

                  {/* Duplicate Handling Option Bar */}
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span>Duplicate Resolution Strategy:</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Choose how to handle products that already exist in the database with the same name.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDuplicateMode('SKIP')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                          duplicateMode === 'SKIP'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        Skip Duplicates (Keep Existing)
                      </button>

                      <button
                        type="button"
                        onClick={() => setDuplicateMode('UPDATE')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                          duplicateMode === 'UPDATE'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        Update Duplicates (Refresh Price & Stock)
                      </button>
                    </div>
                  </div>

                  {/* Preview Table with Thumbnails & Validation */}
                  <div className="overflow-x-auto max-h-[500px] border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 uppercase font-bold text-[10px] sticky top-0 border-b border-slate-200 z-10">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Image</th>
                          <th className="py-2.5 px-3">Product Name</th>
                          <th className="py-2.5 px-3">Tamil Name</th>
                          <th className="py-2.5 px-3">Brand</th>
                          <th className="py-2.5 px-3">Category</th>
                          <th className="py-2.5 px-2">Unit</th>
                          <th className="py-2.5 px-3 text-right">Cost (₹)</th>
                          <th className="py-2.5 px-3 text-right">Price (₹)</th>
                          <th className="py-2.5 px-2 text-center">Stock</th>
                          <th className="py-2.5 px-3 text-center">Validation Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importPreviewData.rows.map((r, idx) => (
                          <tr
                            key={idx}
                            className={`hover:bg-slate-50/80 transition ${
                              !r.isValid
                                ? 'bg-red-50/40'
                                : r.isDuplicate
                                ? 'bg-amber-50/30'
                                : ''
                            }`}
                          >
                            <td className="py-2 px-3 font-mono text-slate-400">{r.rowNumber}</td>
                            
                            {/* Image Thumbnail */}
                            <td className="py-1 px-3">
                              {r.imageUrl ? (
                                <img
                                  src={r.imageUrl}
                                  alt={r.name}
                                  className="w-8 h-8 object-contain rounded border border-slate-200 bg-white"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <span className="text-[10px] text-slate-400 font-mono">-</span>
                              )}
                            </td>

                            <td className="py-2 px-3 font-bold text-slate-900">{r.name}</td>
                            <td className="py-2 px-3 font-tamil text-slate-700">{r.tamilName || '-'}</td>
                            <td className="py-2 px-3 text-slate-600">{r.brand || '-'}</td>
                            <td className="py-2 px-3">
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold">
                                {r.categoryName}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-slate-500 font-mono">{r.unit}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600">
                              ₹{Number(r.purchasePrice).toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                              ₹{Number(r.sellingPrice).toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-center font-mono font-semibold">
                              {r.openingStock}
                            </td>
                            
                            {/* Status Badge */}
                            <td className="py-2 px-3 text-center">
                              {!r.isValid ? (
                                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold" title={r.errors.join(', ')}>
                                  {r.errors[0]}
                                </span>
                              ) : r.isDuplicate ? (
                                <span className="bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded text-[10px] font-bold" title="Product already exists in database">
                                  Duplicate
                                </span>
                              ) : (
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold">
                                  New Product
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Confirmation Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setImportPreviewData(null);
                        setImportRows([]);
                      }}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                    >
                      Clear & Choose Another File
                    </button>

                    <button
                      type="button"
                      onClick={handleConfirmImport}
                      disabled={isImporting || importPreviewData.validCount === 0}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition shadow-md disabled:opacity-50 flex items-center gap-2"
                    >
                      {isImporting ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Saving to MySQL...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            Confirm & Import {importPreviewData.validCount} Products ({duplicateMode === 'SKIP' ? 'Skip Duplicates' : 'Update Duplicates'})
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: INVENTORY & STOCK ADJUSTMENTS */}
          {activeTab === 'inventory' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm">Live Inventory & Stock Levels</h3>
                  <span className="text-xs text-slate-400">Total {products.length} Products</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200">
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
                      {products.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
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
                              p.stockStatus === 'OUT_OF_STOCK'
                                ? 'bg-red-100 text-red-700'
                                : p.stockStatus === 'LOW_STOCK'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {p.stockStatus === 'OUT_OF_STOCK' ? 'Out of Stock' : p.stockStatus === 'LOW_STOCK' ? 'Low Stock' : 'In Stock'}
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
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Adjust</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Stock Movement Audit Ledger */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm">Stock Movement Ledger (Audit History)</h3>
                </div>
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-4">Date & Time</th>
                        <th className="py-2 px-3">Product</th>
                        <th className="py-2 px-3 text-center">Movement Type</th>
                        <th className="py-2 px-3 text-right">Change</th>
                        <th className="py-2 px-3 text-right">New Stock</th>
                        <th className="py-2 px-3">Reason</th>
                        <th className="py-2 px-3">Authorized By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stockMovements.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="py-2 px-4 text-slate-500">{new Date(m.createdAt).toLocaleString('en-IN')}</td>
                          <td className="py-2 px-3 font-bold text-slate-800">{m.product?.name}</td>
                          <td className="py-2 px-3 text-center">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold">
                              {m.type}
                            </span>
                          </td>
                          <td className={`py-2 px-3 text-right font-mono font-bold ${
                            Number(m.quantityChange) > 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}>
                            {Number(m.quantityChange) > 0 ? `+${m.quantityChange}` : m.quantityChange}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{m.newStock}</td>
                          <td className="py-2 px-3 text-slate-600">{m.reason}</td>
                          <td className="py-2 px-3 text-slate-700 font-medium">{m.user?.fullName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SUPPLIERS */}
          {activeTab === 'suppliers' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-sm">Supermarket Suppliers</h3>
                <button
                  onClick={() => setNewSupplierModal(true)}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Supplier</span>
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Supplier Name</th>
                      <th className="py-3 px-3">Contact Person</th>
                      <th className="py-3 px-3">Phone</th>
                      <th className="py-3 px-3">Email</th>
                      <th className="py-3 px-3">Address</th>
                      <th className="py-3 px-3 text-center">Total Invoices</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {suppliers.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">{s.name}</td>
                        <td className="py-3 px-3 text-slate-700">{s.contactPerson || '-'}</td>
                        <td className="py-3 px-3 font-mono text-slate-800">{s.phone}</td>
                        <td className="py-3 px-3 text-slate-500">{s.email || '-'}</td>
                        <td className="py-3 px-3 text-slate-600">{s.address || '-'}</td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-blue-600">
                          {s._count?.purchases || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: PURCHASES & CONFIRM RECEIVED */}
          {activeTab === 'purchases' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-sm">Purchase Invoices & Goods Receiving</h3>
                <button
                  onClick={() => setNewPurchaseModal(true)}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Purchase Invoice</span>
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-3">Supplier</th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3 text-right">Total Amount (₹)</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Actions</th>
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
                            <span className="text-[11px] text-slate-400 font-medium">Stock Added</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: CUSTOMERS & LOYALTY */}
          {activeTab === 'customers' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm">Customer Database & Loyalty Points</h3>
                  <span className="text-xs text-slate-400">Total {customers.length} Registered Customers</span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Customer Name</th>
                      <th className="py-3 px-3">Phone</th>
                      <th className="py-3 px-3">Address</th>
                      <th className="py-3 px-3 text-center">Total Bills</th>
                      <th className="py-3 px-4 text-right">Loyalty Points Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customers.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">{c.name}</td>
                        <td className="py-3 px-3 font-mono text-slate-700">{c.phone}</td>
                        <td className="py-3 px-3 text-slate-500">{c.address || '-'}</td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-blue-600">
                          {c._count?.sales || 0}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 text-sm">
                          {Number(c.loyaltyBalance).toFixed(0)} pts
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 8: SALES REPORTS & ESTIMATED PROFIT */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              {/* Estimated Profit Card */}
              {profitReport && (
                <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl p-6 text-white shadow-md">
                  <span className="text-xs text-blue-200 font-bold uppercase tracking-wider block">Estimated Profit Analysis</span>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3">
                    <div>
                      <span className="text-[11px] text-blue-200 block">Total Sales Revenue</span>
                      <span className="text-xl font-black font-mono">₹{profitReport.totalRevenue.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-blue-200 block">Purchase Cost of Goods</span>
                      <span className="text-xl font-black font-mono">₹{profitReport.totalCost.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-blue-200 block">Estimated Gross Profit</span>
                      <span className="text-2xl font-black text-emerald-300 font-mono">₹{profitReport.estimatedProfit.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-blue-200 block">Profit Margin %</span>
                      <span className="text-2xl font-black text-amber-300 font-mono">{profitReport.profitMarginPercentage.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Product-Wise Sales Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm">Product-Wise Sales Ranking</h3>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Product Name</th>
                      <th className="py-2.5 px-3 text-center">Total Quantity Sold</th>
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

          {/* TAB 9: STAFF MANAGEMENT */}
          {activeTab === 'staff' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-sm">Supermarket Staff Accounts (Manager & Cashier)</h3>
                <button
                  onClick={() => setNewStaffModal(true)}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Staff Account</span>
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Full Name</th>
                      <th className="py-3 px-3">Username</th>
                      <th className="py-3 px-3 text-center">Role</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {staffList.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">{s.fullName}</td>
                        <td className="py-3 px-3 font-mono text-slate-700">{s.username}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            s.role === 'ADMIN'
                              ? 'bg-blue-100 text-blue-800'
                              : s.role === 'MANAGER'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {s.role}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            s.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-100 text-red-700'
                          }`}>
                            {s.isActive ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {s.id !== user.id && (
                            <button
                              type="button"
                              onClick={async () => {
                                await api.put(`/staff/${s.id}`, { isActive: !s.isActive });
                                loadTabData('staff');
                              }}
                              className={`px-2.5 py-1 rounded text-xs font-semibold ${
                                s.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              }`}
                            >
                              {s.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 10: SETTINGS, AUDIT LOGS & BACKUPS */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* Settings Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* General Store Settings */}
                {appSettings && (
                  <form onSubmit={handleSaveGeneralSettings} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                    <h4 className="font-bold text-slate-900 text-sm pb-2 border-b border-slate-100">Store Profile</h4>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Shop Name</label>
                      <input
                        type="text"
                        value={appSettings.shopName}
                        onChange={(e) => setAppSettings({ ...appSettings, shopName: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Address</label>
                      <input
                        type="text"
                        value={appSettings.address}
                        onChange={(e) => setAppSettings({ ...appSettings, address: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Telephone</label>
                      <input
                        type="text"
                        value={appSettings.phone}
                        onChange={(e) => setAppSettings({ ...appSettings, phone: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Default Receipt Size</label>
                      <select
                        value={appSettings.receiptSize}
                        onChange={(e) => setAppSettings({ ...appSettings, receiptSize: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                      >
                        <option value="50mm">50mm Thermal Receipt (Compact)</option>
                        <option value="85mm">85mm Thermal Receipt (Standard)</option>
                        <option value="A4">A4 Full Sheet Invoice</option>
                      </select>
                    </div>
                    <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-xs">
                      Save Store Details
                    </button>
                  </form>
                )}

                {/* Price Override Rules */}
                {appSettings && (
                  <form onSubmit={handleSavePriceOverrideSettings} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                    <h4 className="font-bold text-slate-900 text-sm pb-2 border-b border-slate-100">Cashier Price Override Controls</h4>
                    <div className="flex items-center justify-between text-xs py-1">
                      <span>Enable Cashier Rate Changes</span>
                      <input
                        type="checkbox"
                        checked={appSettings.enableCashierPriceOverride}
                        onChange={(e) => setAppSettings({ ...appSettings, enableCashierPriceOverride: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs py-1">
                      <span>Require Override Reason</span>
                      <input
                        type="checkbox"
                        checked={appSettings.requireOverrideReason}
                        onChange={(e) => setAppSettings({ ...appSettings, requireOverrideReason: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Minimum Permitted Price %</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={appSettings.minAllowedPricePercentage}
                        onChange={(e) => setAppSettings({ ...appSettings, minAllowedPricePercentage: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                      />
                      <span className="text-[10px] text-slate-400">e.g. 50% = cannot sell below half default price</span>
                    </div>
                    <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-xs">
                      Save Price Override Rules
                    </button>
                  </form>
                )}

                {/* Database Backup & Recovery */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <h4 className="font-bold text-slate-900 text-sm pb-2 border-b border-slate-100">Database Backup & Recovery</h4>
                  <p className="text-xs text-slate-500">
                    Create secure complete database JSON snapshots to server disk.
                  </p>
                  <button
                    type="button"
                    onClick={handleCreateBackup}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs"
                  >
                    <Database className="w-4 h-4" />
                    <span>Create Database Backup Now</span>
                  </button>
                  <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 text-xs">
                    {backups.map((b, idx) => (
                      <div key={idx} className="py-1.5 flex justify-between items-center text-[11px]">
                        <span className="truncate max-w-[160px] font-mono text-slate-700">{b.fileName}</span>
                        <span className="text-slate-400 font-mono">{b.sizeKb} KB</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Audit Logs Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm">System Audit Trail</h3>
                </div>
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-4">Timestamp</th>
                        <th className="py-2 px-3">Action</th>
                        <th className="py-2 px-3">Entity</th>
                        <th className="py-2 px-3">Details</th>
                        <th className="py-2 px-3">User</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="py-2 px-4 text-slate-500 font-mono">{new Date(log.createdAt).toLocaleString('en-IN')}</td>
                          <td className="py-2 px-3 font-bold text-slate-900">{log.action}</td>
                          <td className="py-2 px-3 text-slate-600">{log.entity}</td>
                          <td className="py-2 px-3 text-slate-700">{log.details}</td>
                          <td className="py-2 px-3 font-medium text-slate-800">{log.user?.fullName || 'System'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL: ADD / EDIT PRODUCT */}
      {(addProductModal || editProductModal) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">
                  {editProductModal ? 'Edit Product & Measurement' : 'Add New Grocery / Product'}
                </h3>
                <p className="text-[11px] text-blue-100 mt-0.5">
                  Configure measurement units, pricing basis (per KG / piece), and stock.
                </p>
              </div>
              <button
                onClick={() => { setAddProductModal(false); setEditProductModal(false); }}
                className="text-white hover:opacity-80 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveProduct} className="p-5 space-y-3.5 max-h-[80vh] overflow-y-auto">
              {/* Product Names */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Product Name (English) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Premium White Ponni Rice"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 font-tamil">Tamil Name (பொருள் பெயர்)</label>
                <input
                  type="text"
                  placeholder="e.g. பொன்னி அரிசி"
                  value={productForm.tamilName}
                  onChange={(e) => setProductForm({ ...productForm, tamilName: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-tamil font-medium"
                />
              </div>

              {/* Category & Brand */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Category</label>
                  <select
                    value={productForm.categoryId}
                    onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Brand</label>
                  <input
                    type="text"
                    placeholder="e.g. Anantha / Organic / Fresh"
                    value={productForm.brand}
                    onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Measurement Configuration */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    Unit & Measurement System
                  </span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                    Automatic Billing
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Measurement Type *</label>
                    <select
                      value={productForm.measurementType || 'PCS'}
                      onChange={(e) => {
                        const mt = e.target.value;
                        let bu = 'pcs';
                        if (mt === 'KG' || mt === 'G') bu = 'kg';
                        else if (mt === 'L' || mt === 'ML') bu = 'l';
                        else if (mt === 'PACK') bu = 'pack';
                        else if (mt === 'BOX') bu = 'box';

                        setProductForm({
                          ...productForm,
                          measurementType: mt,
                          baseUnit: bu,
                          unit: bu,
                        });
                      }}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white"
                    >
                      <option value="PCS">Piece (PCS)</option>
                      <option value="KG">Kilogram (KG)</option>
                      <option value="G">Gram (G)</option>
                      <option value="L">Litre (L)</option>
                      <option value="ML">Millilitre (ML)</option>
                      <option value="PACK">Pack</option>
                      <option value="BOX">Box</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Base Canonical Unit</label>
                    <input
                      type="text"
                      readOnly
                      value={productForm.baseUnit || productForm.unit || 'pcs'}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-100 font-bold uppercase text-slate-600"
                    />
                  </div>
                </div>

                {/* Conditional Pricing & Size Fields */}
                {['KG', 'G'].includes((productForm.measurementType || '').toUpperCase()) && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-extrabold text-amber-900">Price per KG (₹) *</label>
                      <span className="text-[10px] text-amber-700 font-semibold">1 kg canonical basis</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 200.00"
                      value={productForm.pricePerKg || productForm.sellingPrice || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProductForm({
                          ...productForm,
                          pricePerKg: val,
                          sellingPrice: val,
                        });
                      }}
                      className="w-full px-3 py-1.5 border border-amber-300 rounded-lg text-xs font-mono font-extrabold text-slate-900 bg-white"
                    />
                    <p className="text-[10px] text-amber-800 leading-tight">
                      Automatic Weight Billing: Cashier POS will automatically calculate fractional gram pricing (50g, 100g, 150g, 200g, 250g, 500g, custom weights) based on this rate.
                    </p>
                  </div>
                )}

                {['L', 'ML'].includes((productForm.measurementType || '').toUpperCase()) && (
                  <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-1">
                    <label className="font-extrabold text-blue-900 block">Price per Litre (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 60.00"
                      value={productForm.sellingPrice}
                      onChange={(e) => setProductForm({ ...productForm, sellingPrice: e.target.value })}
                      className="w-full px-3 py-1.5 border border-blue-300 rounded-lg text-xs font-mono font-bold bg-white"
                    />
                  </div>
                )}

                {['PACK', 'BOX'].includes((productForm.measurementType || '').toUpperCase()) && (
                  <div className="grid grid-cols-2 gap-2 p-2.5 bg-purple-50 border border-purple-200 rounded-lg text-xs">
                    <div>
                      <label className="font-extrabold text-purple-900 block mb-1">
                        {productForm.measurementType === 'BOX' ? 'Box Price (₹) *' : 'Pack Price (₹) *'}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={productForm.sellingPrice}
                        onChange={(e) => setProductForm({ ...productForm, sellingPrice: e.target.value })}
                        className="w-full px-3 py-1.5 border border-purple-300 rounded-lg text-xs font-mono font-bold bg-white"
                      />
                    </div>
                    <div>
                      <label className="font-extrabold text-purple-900 block mb-1">Pack Size Description</label>
                      <input
                        type="text"
                        placeholder="e.g. 250g, 500g, 12 pcs"
                        value={productForm.packSize || ''}
                        onChange={(e) => setProductForm({ ...productForm, packSize: e.target.value })}
                        className="w-full px-3 py-1.5 border border-purple-300 rounded-lg text-xs bg-white"
                      />
                    </div>
                  </div>
                )}

                {productForm.measurementType === 'PCS' && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Selling Price per Piece (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={productForm.sellingPrice}
                      onChange={(e) => setProductForm({ ...productForm, sellingPrice: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                )}
              </div>

              {/* Barcode & SKU */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Barcode</label>
                  <input
                    type="text"
                    placeholder="Scan or enter barcode"
                    value={productForm.barcode || ''}
                    onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">SKU</label>
                  <input
                    type="text"
                    placeholder="Internal SKU code"
                    value={productForm.sku || ''}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* Purchase Cost & Stock Levels */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Purchase Cost (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={productForm.purchaseCost}
                    onChange={(e) => setProductForm({ ...productForm, purchaseCost: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Stock ({productForm.baseUnit || productForm.unit || 'pcs'})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={productForm.currentStock}
                    onChange={(e) => setProductForm({ ...productForm, currentStock: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Min Stock Alert</label>
                  <input
                    type="number"
                    step="any"
                    value={productForm.minStock}
                    onChange={(e) => setProductForm({ ...productForm, minStock: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setAddProductModal(false); setEditProductModal(false); }}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  {editProductModal ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADMIN PRICE CHANGE */}
      {priceModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {isWeightBased(priceModal.product)
                  ? 'Update Product Price per KG'
                  : 'Update Product Master Selling Price'}
              </h3>
              <button
                onClick={() => setPriceModal({ isOpen: false, product: null, newPrice: '', reason: '' })}
                className="text-white hover:opacity-80"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 text-sm">{priceModal.product.name}</span>
                  {isWeightBased(priceModal.product) && (
                    <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded font-extrabold uppercase">
                      Weight Item
                    </span>
                  )}
                </div>
                <span className="text-slate-500 font-tamil block mt-0.5">{priceModal.product.tamilName}</span>
                <div className="flex justify-between mt-2 pt-2 border-t border-slate-200">
                  <span>Current Default Rate:</span>
                  <span className="font-mono font-bold">
                    ₹{Number(priceModal.product.sellingPrice).toFixed(2)} {getPriceBasisLabel(priceModal.product)}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {isWeightBased(priceModal.product)
                    ? 'New Master Price per KG (₹) *'
                    : 'New Master Selling Price (₹) *'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={priceModal.newPrice}
                  onChange={(e) => setPriceModal({ ...priceModal, newPrice: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold"
                />
                {isWeightBased(priceModal.product) && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Updates the canonical rate per KG. Subsequent POS bills will calculate weight (grams / kg) using this new rate. Past printed receipts remain unchanged.
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Reason for Master Price Change</label>
                <input
                  type="text"
                  value={priceModal.reason}
                  onChange={(e) => setPriceModal({ ...priceModal, reason: e.target.value })}
                  placeholder="e.g. Supplier rate hike, Inflation"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPriceModal({ isOpen: false, product: null, newPrice: '', reason: '' })}
                  className="px-4 py-2 bg-slate-100 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdatePrice}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  Save New Price
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: STOCK ADJUSTMENT */}
      {stockAdjustModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">Adjust Stock: {stockAdjustModal.product?.name}</h3>
              <button
                onClick={() => setStockAdjustModal({ isOpen: false, product: null, quantityChange: '', reason: '', type: 'ADJUSTMENT' })}
                className="text-white hover:opacity-80"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-3">
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
                  className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStockAdjustment}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold"
                >
                  Apply Adjustment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD SUPPLIER */}
      {newSupplierModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">Add New Supplier</h3>
              <button onClick={() => setNewSupplierModal(false)} className="text-white hover:opacity-80">✕</button>
            </div>
            <form onSubmit={handleSaveSupplier} className="p-5 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Supplier Company Name</label>
                <input
                  type="text"
                  required
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Contact Person</label>
                <input
                  type="text"
                  value={supplierForm.contactPerson}
                  onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Phone</label>
                <input
                  type="tel"
                  required
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Address</label>
                <input
                  type="text"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setNewSupplierModal(false)} className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold">
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE PURCHASE */}
      {newPurchaseModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">Create Purchase Invoice</h3>
              <button onClick={() => setNewPurchaseModal(false)} className="text-white hover:opacity-80">✕</button>
            </div>
            <form onSubmit={handleSavePurchase} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Supplier</label>
                  <select
                    required
                    value={purchaseForm.supplierId}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, supplierId: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Invoice Number</label>
                  <input
                    type="text"
                    required
                    value={purchaseForm.invoiceNumber}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, invoiceNumber: e.target.value })}
                    placeholder="e.g. INV-9042"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Select Product & Quantity</label>
                <div className="grid grid-cols-12 gap-2">
                  <select
                    required
                    value={purchaseForm.items[0].productId}
                    onChange={(e) => {
                      const updated = [...purchaseForm.items];
                      updated[0].productId = e.target.value;
                      setPurchaseForm({ ...purchaseForm, items: updated });
                    }}
                    className="col-span-6 px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="">Select Product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    required
                    placeholder="Qty"
                    value={purchaseForm.items[0].quantity}
                    onChange={(e) => {
                      const updated = [...purchaseForm.items];
                      updated[0].quantity = parseFloat(e.target.value) || 1;
                      setPurchaseForm({ ...purchaseForm, items: updated });
                    }}
                    className="col-span-3 px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                  <input
                    type="number"
                    step="0.5"
                    required
                    placeholder="Cost ₹"
                    value={purchaseForm.items[0].purchaseCost}
                    onChange={(e) => {
                      const updated = [...purchaseForm.items];
                      updated[0].purchaseCost = parseFloat(e.target.value) || 0;
                      setPurchaseForm({ ...purchaseForm, items: updated });
                    }}
                    className="col-span-3 px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Paid Amount (₹)</label>
                <input
                  type="number"
                  step="0.5"
                  value={purchaseForm.paidAmount}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, paidAmount: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setNewPurchaseModal(false)} className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold">
                  Save Purchase (Draft)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE STAFF ACCOUNT */}
      {newStaffModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">Create Staff Account</h3>
              <button onClick={() => setNewStaffModal(false)} className="text-white hover:opacity-80">✕</button>
            </div>
            <form onSubmit={handleSaveStaff} className="p-5 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={staffForm.fullName}
                  onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })}
                  placeholder="e.g. Priya Sharma"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Username (Login ID)</label>
                <input
                  type="text"
                  required
                  value={staffForm.username}
                  onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })}
                  placeholder="e.g. priya"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Secure Password</label>
                <input
                  type="password"
                  required
                  value={staffForm.password}
                  onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Role Type</label>
                <select
                  value={staffForm.role}
                  onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="CASHIER">CASHIER (Direct Billing Only)</option>
                  <option value="MANAGER">MANAGER (Operations & Reports)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setNewStaffModal(false)} className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold">
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OFFICIAL BILLING RECEIPT PREVIEW MODAL */}
      {previewBill && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <div className={`bg-white rounded-2xl ${receiptFormat === 'A4' ? 'max-w-4xl' : receiptFormat === '85mm' ? 'max-w-lg' : 'max-w-md'} w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[96vh] transition-all`}>
            {/* Header bar */}
            <div className="bg-[#153B7A] text-white p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
                <div>
                  <h3 className="font-bold text-sm leading-tight">Bill #{previewBill.billNumber}</h3>
                  <p className="text-[10px] text-blue-200">ANANTHA STORES — Official Billing Receipt</p>
                </div>
              </div>

              {/* Format Switcher & Watermark Toggle */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Watermark Toggle */}
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-blue-100 bg-blue-900/70 hover:bg-blue-900 px-2.5 py-1 rounded-md cursor-pointer select-none transition">
                  <input
                    type="checkbox"
                    checked={showWatermark}
                    onChange={(e) => setShowWatermark(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Watermark</span>
                </label>

                {/* Paper Profiles: 50mm, 85mm, A4 */}
                <div className="flex items-center gap-0.5 bg-blue-950/80 p-0.5 rounded-lg text-[10px] font-bold">
                  {['50mm', '85mm', 'A4'].map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setReceiptFormat(fmt)}
                      className={`px-2.5 py-0.5 rounded transition ${
                        receiptFormat === fmt
                          ? 'bg-white text-[#153B7A] shadow-xs font-extrabold'
                          : 'text-blue-200 hover:text-white'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setPreviewBill(null)}
                  className="text-blue-200 hover:text-white font-bold p-1 ml-1"
                  title="Close Preview (ESC)"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Receipt Preview Area */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-4 bg-slate-100/90 flex justify-center">
              <div id="printable-receipt-wrapper" className="flex justify-center w-full">
                <ReceiptComponent
                  bill={previewBill}
                  receiptFormat={receiptFormat}
                  showWatermark={showWatermark}
                  cashierName={previewBill.cashier?.fullName || 'Cashier'}
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setPreviewBill(null)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition"
              >
                Close Preview
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Reprint Bill */}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-xs"
                  title="Reprint Bill without re-charging or modifying inventory"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-blue-300" />
                  <span>Reprint Bill</span>
                </button>

                {/* Download PDF */}
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-xs"
                  title="Download receipt as vector PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>

                {/* Print Bill */}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-4 py-2 bg-[#153B7A] hover:bg-[#102d5e] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm active:scale-95"
                  title={`Print Bill (${receiptFormat})`}
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Bill ({receiptFormat})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
