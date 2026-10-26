import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  Calendar,
  Download,
  RefreshCw,
  BarChart2,
  PieChart as PieIcon,
  ShoppingBag,
  Package,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  CreditCard,
  Users,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Info,
  Lock,
  Search,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import api from '../services/api';
import { exportReportToExcel, exportReportToCSV, exportReportToPDF } from '../utils/reportExport';

const CHART_COLORS = [
  '#F97316', // Primary Orange
  '#17365D', // Primary Navy Blue
  '#16A34A', // Success Green
  '#D97706', // Warning Amber
  '#DC2626', // Error Red
  '#EA580C', // Dark Orange Accent
  '#64748B', // Secondary Text Slate
  '#0284C7', // Sky Accent
];

const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This Week' },
  { id: 'last_week', label: 'Last Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'last_30_days', label: 'Last 30 Days' },
  { id: 'last_90_days', label: 'Last 90 Days' },
  { id: 'custom', label: 'Custom Range' },
];

export default function ReportsSection({ userRole = 'ADMIN' }) {
  const [period, setPeriod] = useState('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // overview, products, categories, stock, financials, staff
  const [topCount, setTopCount] = useState(10); // 5, 10, 20
  const [productSortBy, setProductSortBy] = useState('quantitySold'); // quantitySold, netSales, profit
  const [productSearch, setProductSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);

  // Fetch report data whenever period or custom dates change
  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.append('period', period);
      if (period === 'custom') {
        if (customStart) params.append('startDate', customStart);
        if (customEnd) params.append('endDate', customEnd);
      }

      const res = await api.get(`/reports/analytics?${params.toString()}`);
      setReportData(res.data);
    } catch (err) {
      console.error('Failed to load reports:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load report analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [period]);

  const handleApplyCustomDate = (e) => {
    e.preventDefault();
    if (!customStart || !customEnd) {
      alert('Please select both Start Date and End Date.');
      return;
    }
    fetchReport();
  };

  // Helper formatting
  const fmtCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val || 0);

  const fmtPercent = (val) => {
    if (val === null || val === undefined) return 'N/A';
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(1)}%`;
  };

  // Export handlers
  const handleExportCurrent = (format = 'excel') => {
    if (!reportData) return;
    const periodLabel = reportData.periodLabel || period;

    let title = 'ANANTHA STORES - Report';
    let columns = [];
    let rows = [];
    let summary = [];

    if (activeTab === 'overview') {
      title = 'Sales Overview & Trends Report';
      columns = [
        { key: 'date', label: 'Date / Period' },
        { key: 'totalSales', label: 'Net Sales (₹)' },
        { key: 'grossSales', label: 'Gross Sales (₹)' },
        { key: 'billCount', label: 'Completed Bills' },
        { key: 'itemsCount', label: 'Items Sold' },
        { key: 'avgBill', label: 'Average Bill Value (₹)' },
      ];
      rows = (reportData.salesTrends || []).map((t) => ({
        ...t,
        avgBill: t.billCount > 0 ? (t.totalSales / t.billCount).toFixed(2) : 0,
      }));
      summary = [
        { label: 'Total Net Sales', value: fmtCurrency(reportData.overview?.totalNetSales) },
        { label: 'Total Gross Sales', value: fmtCurrency(reportData.overview?.totalGrossSales) },
        { label: 'Total Completed Bills', value: reportData.overview?.totalBills },
        { label: 'Average Bill Value', value: fmtCurrency(reportData.overview?.averageBillValue) },
        { label: 'Total Discounts Given', value: fmtCurrency(reportData.overview?.totalDiscounts) },
        { label: 'Total Tax Collected', value: fmtCurrency(reportData.overview?.totalTax) },
      ];
    } else if (activeTab === 'products') {
      title = 'Product Sales & Performance Report';
      columns = [
        { key: 'name', label: 'Product Name' },
        { key: 'tamilName', label: 'Tamil Name' },
        { key: 'barcode', label: 'Barcode' },
        { key: 'category', label: 'Category' },
        { key: 'quantitySold', label: 'Qty Sold' },
        { key: 'unit', label: 'Unit' },
        { key: 'billCount', label: 'Bills Included' },
        { key: 'grossSales', label: 'Gross Sales (₹)' },
        { key: 'discounts', label: 'Discounts (₹)' },
        { key: 'netSales', label: 'Net Sales (₹)' },
        { key: 'currentStock', label: 'Current Stock' },
        { key: 'purchaseCost', label: 'Unit Cost (₹)' },
        { key: 'profit', label: 'Gross Profit (₹)' },
        { key: 'lastSaleDate', label: 'Last Sale Date' },
      ];
      rows = reportData.productPerformance?.allProducts || [];
    } else if (activeTab === 'categories') {
      title = 'Category-Wise Sales Report';
      columns = [
        { key: 'categoryName', label: 'Category' },
        { key: 'totalSales', label: 'Sales (₹)' },
        { key: 'quantitySold', label: 'Qty Sold' },
        { key: 'itemTypesSold', label: 'Products Sold' },
        { key: 'percentageShare', label: 'Share (%)' },
      ];
      rows = reportData.categorySales || [];
    } else if (activeTab === 'stock') {
      title = 'Inventory & Stock Valuation Report';
      columns = [
        { key: 'name', label: 'Product Name' },
        { key: 'barcode', label: 'Barcode' },
        { key: 'category', label: 'Category' },
        { key: 'currentStock', label: 'Current Stock' },
        { key: 'minStock', label: 'Min Reorder Stock' },
        { key: 'unit', label: 'Unit' },
        { key: 'status', label: 'Status' },
        { key: 'purchaseCost', label: 'Cost Price (₹)' },
        { key: 'sellingPrice', label: 'Selling Price (₹)' },
        { key: 'totalCostValuation', label: 'Total Cost Value (₹)' },
        { key: 'totalRetailValuation', label: 'Total Retail Value (₹)' },
      ];
      rows = reportData.inventoryReport?.items || [];
      summary = [
        { label: 'Total Inventory Products', value: reportData.inventoryReport?.totalProducts },
        { label: 'In Stock Count', value: reportData.inventoryReport?.inStockCount },
        { label: 'Low Stock Count', value: reportData.inventoryReport?.lowStockCount },
        { label: 'Out of Stock Count', value: reportData.inventoryReport?.outOfStockCount },
        { label: 'Total Stock Valuation (At Cost)', value: fmtCurrency(reportData.inventoryReport?.totalCostValuation) },
        { label: 'Total Stock Valuation (At Retail)', value: fmtCurrency(reportData.inventoryReport?.totalRetailValuation) },
      ];
    } else if (activeTab === 'financials') {
      title = 'Financials, Taxes & Returns Report';
      columns = [
        { key: 'metric', label: 'Financial Metric' },
        { key: 'value', label: 'Value / Amount' },
        { key: 'notes', label: 'Notes' },
      ];
      rows = [
        { metric: 'Total Gross Sales', value: fmtCurrency(reportData.overview?.totalGrossSales), notes: 'Total before line discounts' },
        { metric: 'Total Line & Bill Discounts', value: fmtCurrency(reportData.overview?.totalDiscounts), notes: 'Promotional / cashier discounts' },
        { metric: 'Total Net Sales', value: fmtCurrency(reportData.overview?.totalNetSales), notes: 'Actual revenue collected' },
        { metric: 'GST / Tax Collected', value: fmtCurrency(reportData.overview?.totalTax), notes: 'Included / applied tax' },
        { metric: 'Returned / Cancelled Value', value: fmtCurrency(reportData.returnsReport?.totalRefundedAmount), notes: `${reportData.returnsReport?.totalCancelledBills || 0} cancelled bills` },
        { metric: 'Total Purchases from Suppliers', value: fmtCurrency(reportData.purchasesReport?.totalPurchasesCost), notes: `${reportData.purchasesReport?.totalPurchaseBills || 0} purchase orders` },
      ];
      if (reportData.grossProfitReport?.isAuthorized) {
        rows.push(
          { metric: 'Estimated Cost of Goods Sold (COGS)', value: fmtCurrency(reportData.grossProfitReport?.totalEstimatedCost), notes: 'Based on purchaseCost' },
          { metric: 'Total Gross Profit', value: fmtCurrency(reportData.grossProfitReport?.totalGrossProfit), notes: 'Net Sales minus COGS' },
          { metric: 'Gross Profit Margin', value: `${(reportData.grossProfitReport?.overallMarginPercent || 0).toFixed(1)}%`, notes: 'Profit as % of Net Sales' }
        );
      }
    } else if (activeTab === 'staff') {
      title = 'Cashier & User Sales Performance Report';
      columns = [
        { key: 'cashierName', label: 'Staff / Cashier' },
        { key: 'role', label: 'Role' },
        { key: 'totalSales', label: 'Total Sales (₹)' },
        { key: 'billCount', label: 'Completed Bills' },
        { key: 'itemsCount', label: 'Items Sold' },
        { key: 'averageBillValue', label: 'Avg Bill (₹)' },
      ];
      rows = reportData.cashierReport || [];
    }

    if (format === 'excel') {
      exportReportToExcel(title, periodLabel, columns, rows, summary);
    } else if (format === 'csv') {
      exportReportToCSV(title, periodLabel, columns, rows, summary);
    } else if (format === 'pdf') {
      exportReportToPDF(title, periodLabel, columns, rows, summary);
    }
  };

  // Filtered Products for Tab 2
  const filteredProducts = useMemo(() => {
    if (!reportData?.productPerformance?.allProducts) return [];
    let list = [...reportData.productPerformance.allProducts];

    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.tamilName && p.tamilName.toLowerCase().includes(q)) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      if (productSortBy === 'netSales') return (b.netSales || 0) - (a.netSales || 0);
      if (productSortBy === 'profit') return (b.profit || 0) - (a.profit || 0);
      return (b.quantitySold || 0) - (a.quantitySold || 0);
    });

    return list;
  }, [reportData, productSearch, productSortBy]);

  return (
    <div className="space-y-6">
      {/* Header & Filter Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#D9E2EF] p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#FFF1E7] text-[#F97316] rounded-xl border border-[#FED7AA]">
                <BarChart2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#17365D] tracking-tight">
                  ANANTHA STORES — Business Intelligence & Reports
                </h1>
                <p className="text-xs text-[#64748B]">
                  Comprehensive sales, stock valuation, product velocity, category trends & audit analytics.
                </p>
              </div>
            </div>
          </div>

          {/* Export Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExportCurrent('pdf')}
              disabled={loading || !reportData}
              className="px-3.5 py-2 bg-[#17365D] hover:bg-[#122B4A] disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
              title="Download currently active report in selectable vector PDF (.pdf)"
            >
              <FileText className="w-4 h-4" />
              Export PDF (.pdf)
            </button>
            <button
              onClick={() => handleExportCurrent('excel')}
              disabled={loading || !reportData}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
              title="Download currently active report in Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export Excel (.xlsx)
            </button>
            <button
              onClick={() => handleExportCurrent('csv')}
              disabled={loading || !reportData}
              className="px-3.5 py-2 bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
              title="Download currently active report in CSV (with UTF-8 Tamil support)"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={fetchReport}
              disabled={loading}
              className="p-2 border border-[#D9E2EF] text-[#64748B] hover:bg-[#F3F6FA] rounded-xl transition"
              title="Refresh Analytics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="mt-4 pt-4 border-t border-[#D9E2EF] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${period === p.id
                    ? 'bg-[#F97316] text-white shadow-sm'
                    : 'bg-[#F3F6FA] hover:bg-[#FFF1E7] text-[#64748B]'
                  }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <form onSubmit={handleApplyCustomDate} className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1 text-xs border border-[#D9E2EF] rounded-lg focus:ring-2 focus:ring-[#F97316]/30"
                required
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1 text-xs border border-[#D9E2EF] rounded-lg focus:ring-2 focus:ring-[#F97316]/30"
                required
              />
              <button
                type="submit"
                className="px-3 py-1 text-xs bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg font-medium transition"
              >
                Apply
              </button>
            </form>
          )}

          {reportData?.periodLabel && (
            <div className="text-xs font-semibold text-[#17365D] bg-[#FFF1E7] px-3 py-1 rounded-full border border-[#FED7AA]">
              {reportData.periodLabel}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center border-b border-slate-200 gap-2 overflow-x-auto">
        {[
          { id: 'overview', label: '1. Sales Trends & KPI Comparison', icon: TrendingUp },
          { id: 'products', label: '2. Product Performance & Velocity', icon: ShoppingBag },
          { id: 'categories', label: '3. Categories & Payment Methods', icon: PieIcon },
          { id: 'stock', label: '4. Stock & Valuation', icon: Package },
          { id: 'financials', label: '5. Taxes, Discounts & Profit', icon: DollarSign },
          { id: 'staff', label: '6. Cashier & Movement Audit', icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 whitespace-nowrap transition ${isActive
                  ? 'border-orange-500 text-orange-600 bg-orange-50/50 rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !reportData && (
        <div className="py-20 text-center">
          <RefreshCw className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Calculating real-time analytics from ANANTHA STORES database...</p>
        </div>
      )}

      {/* Main Content Area */}
      {reportData && (
        <>
          {/* TAB 1: OVERVIEW & COMPARISON */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* KPI Cards with Comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Net Sales */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Sales</span>
                    <span className="p-2 bg-orange-50 text-orange-600 rounded-xl">
                      <DollarSign className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-900">
                      {fmtCurrency(reportData.overview?.totalNetSales)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-xs">
                    {reportData.comparison?.salesDiff >= 0 ? (
                      <span className="inline-flex items-center text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        {fmtPercent(reportData.comparison?.salesPercentChange)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded">
                        <ArrowDownRight className="w-3.5 h-3.5" />
                        {fmtPercent(reportData.comparison?.salesPercentChange)}
                      </span>
                    )}
                    <span className="text-slate-400">vs prev {fmtCurrency(reportData.comparison?.prevNetSales)}</span>
                  </div>
                </div>

                {/* Total Completed Bills */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed Bills</span>
                    <span className="p-2 bg-[#FFF1E7] text-[#F97316] rounded-xl border border-[#FED7AA]">
                      <ShoppingBag className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-900">
                      {reportData.overview?.totalBills || 0}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">transactions</span>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-xs">
                    {reportData.comparison?.billsDiff >= 0 ? (
                      <span className="inline-flex items-center text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        {fmtPercent(reportData.comparison?.billsPercentChange)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded">
                        <ArrowDownRight className="w-3.5 h-3.5" />
                        {fmtPercent(reportData.comparison?.billsPercentChange)}
                      </span>
                    )}
                    <span className="text-slate-400">vs prev {reportData.comparison?.prevBills || 0} bills</span>
                  </div>
                </div>

                {/* Average Bill Value */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Average Bill</span>
                    <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                      <TrendingUp className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-900">
                      {fmtCurrency(reportData.overview?.averageBillValue)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                    <span>Items per bill: </span>
                    <span className="font-semibold text-slate-800">
                      {reportData.overview?.totalBills > 0
                        ? (reportData.overview?.totalQuantitySold / reportData.overview?.totalBills).toFixed(1)
                        : '0'}
                    </span>
                  </div>
                </div>

                {/* Gross Profit Summary (Admin Only) */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gross Profit</span>
                    <span className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                      <Layers className="w-4 h-4" />
                    </span>
                  </div>
                  {reportData.grossProfitReport?.isAuthorized ? (
                    <>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-slate-900">
                          {fmtCurrency(reportData.grossProfitReport?.totalGrossProfit)}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-1.5 text-xs">
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold">
                          {(reportData.grossProfitReport?.overallMarginPercent || 0).toFixed(1)}% Margin
                        </span>
                        <span className="text-slate-400">on recorded purchase cost</span>
                      </div>
                    </>
                  ) : (
                    <div className="mt-3 text-xs text-slate-500 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-slate-400" />
                      <span>{reportData.grossProfitReport?.message || 'Admin permission required'}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Chart 1: Daily/Weekly Sales Trend Line Chart */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">
                      Sales Trend ({reportData.periodLabel})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Chronological day-by-day revenue, completed bills, and quantity velocity.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" />
                      <span>Net Sales (₹)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-slate-400 inline-block" />
                      <span>Bill Count</span>
                    </div>
                  </div>
                </div>

                {reportData.salesTrends?.length > 0 ? (
                  <div className="w-full h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={reportData.salesTrends}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                        <YAxis yAxisId="left" stroke="#f97316" fontSize={11} tickFormatter={(v) => `₹${v}`} />
                        <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={11} />
                        <Tooltip
                          formatter={(value, name) => [
                            name === 'totalSales' ? fmtCurrency(value) : value,
                            name === 'totalSales' ? 'Net Sales' : name === 'billCount' ? 'Completed Bills' : name,
                          ]}
                          contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="totalSales"
                          name="totalSales"
                          stroke="#f97316"
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: '#ea580c' }}
                          activeDot={{ r: 6 }}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="billCount"
                          name="billCount"
                          stroke="#94a3b8"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          dot={{ r: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="py-16 text-center text-slate-400 text-sm">
                    No sales recorded for the selected period.
                  </div>
                )}
              </div>

              {/* Chart 2: Gross Sales vs Net Sales Bar Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <h3 className="text-base font-bold text-slate-800 mb-1">Gross vs Net Sales</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Comparison of original gross billing vs net collected after discounts.
                  </p>
                  {reportData.salesTrends?.length > 0 ? (
                    <div className="w-full h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={reportData.salesTrends.slice(-15)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" />
                          <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} />
                          <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `₹${v}`} />
                          <Tooltip formatter={(v) => fmtCurrency(v)} />
                          <Legend />
                          <Bar dataKey="grossSales" name="Gross Sales" fill="#fdba74" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="totalSales" name="Net Sales" fill="#f97316" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="py-16 text-center text-slate-400 text-sm">No transaction data available.</div>
                  )}
                </div>

                {/* Period Comparison Card */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 mb-1">
                      Period Growth Analysis
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                      Comparing {reportData.periodLabel} with previous equivalent timeframe.
                    </p>

                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                        <div>
                          <div className="text-xs text-slate-500">Net Sales Comparison</div>
                          <div className="text-base font-bold text-slate-800 mt-0.5">
                            {fmtCurrency(reportData.overview?.totalNetSales)}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            Previous: {fmtCurrency(reportData.comparison?.prevNetSales)}
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold inline-block ${reportData.comparison?.salesDiff >= 0
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                              }`}
                          >
                            {fmtPercent(reportData.comparison?.salesPercentChange)}
                          </span>
                          <div className="text-xs font-medium text-slate-500 mt-1">
                            {reportData.comparison?.salesDiff >= 0 ? '+' : ''}
                            {fmtCurrency(reportData.comparison?.salesDiff)}
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                        <div>
                          <div className="text-xs text-slate-500">Bill Count Comparison</div>
                          <div className="text-base font-bold text-slate-800 mt-0.5">
                            {reportData.overview?.totalBills || 0} Bills
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            Previous: {reportData.comparison?.prevBills || 0} Bills
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold inline-block ${reportData.comparison?.billsDiff >= 0
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                              }`}
                          >
                            {fmtPercent(reportData.comparison?.billsPercentChange)}
                          </span>
                          <div className="text-xs font-medium text-slate-500 mt-1">
                            {reportData.comparison?.billsDiff >= 0 ? '+' : ''}
                            {reportData.comparison?.billsDiff} Bills
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 mt-4 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-slate-400" />
                    <span>Previous periods with zero historical sales are handled safely without division errors.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRODUCT PERFORMANCE */}
          {activeTab === 'products' && (
            <div className="space-y-6">
              {/* Product Top Bar Filters */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-700">Display Top:</span>
                  <div className="flex items-center gap-1">
                    {[5, 10, 20].map((n) => (
                      <button
                        key={n}
                        onClick={() => setTopCount(n)}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${topCount === n
                            ? 'bg-orange-500 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                      >
                        Top {n}
                      </button>
                    ))}
                  </div>

                  <span className="text-xs font-semibold text-slate-700 ml-2">Sort By:</span>
                  <select
                    value={productSortBy}
                    onChange={(e) => setProductSortBy(e.target.value)}
                    className="px-3 py-1 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-400 bg-white"
                  >
                    <option value="quantitySold">Quantity Sold (Velocity)</option>
                    <option value="netSales">Net Revenue (₹)</option>
                    {reportData.grossProfitReport?.isAuthorized && <option value="profit">Gross Profit (₹)</option>}
                  </select>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search product, barcode, category..."
                    className="pl-9 pr-4 py-1.5 text-xs border border-slate-300 rounded-xl w-64 focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>

              {/* Best-Selling Horizontal Bar Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <h3 className="text-base font-bold text-slate-800 mb-1">
                    Top {topCount} Best-Selling Products
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">Highest volume items moved during this period.</p>
                  {reportData.productPerformance?.bestSelling?.length > 0 ? (
                    <div className="w-full h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          layout="vertical"
                          data={reportData.productPerformance.bestSelling.slice(0, topCount)}
                          margin={{ left: 20, right: 20, top: 10, bottom: 10 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal stroke="#f8fafc" />
                          <XAxis type="number" stroke="#94a3b8" fontSize={11} />
                          <YAxis
                            dataKey="name"
                            type="category"
                            stroke="#475569"
                            fontSize={11}
                            width={130}
                            tickFormatter={(v) => (v.length > 18 ? v.substring(0, 16) + '...' : v)}
                          />
                          <Tooltip formatter={(val, name) => [val, name === 'quantitySold' ? 'Qty Sold' : name]} />
                          <Bar dataKey="quantitySold" fill="#f97316" radius={[0, 6, 6, 0]} barSize={18} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="py-20 text-center text-slate-400 text-sm">No sales data for ranking.</div>
                  )}
                </div>

                {/* Lowest Selling Products */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <h3 className="text-base font-bold text-slate-800 mb-1">
                    Lowest-Selling Active Products
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Items with minimal movement that may require promotions or reorder adjustments.
                  </p>
                  {reportData.productPerformance?.lowestSelling?.length > 0 ? (
                    <div className="w-full h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          layout="vertical"
                          data={reportData.productPerformance.lowestSelling.slice(0, topCount)}
                          margin={{ left: 20, right: 20, top: 10, bottom: 10 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal stroke="#f8fafc" />
                          <XAxis type="number" stroke="#94a3b8" fontSize={11} />
                          <YAxis
                            dataKey="name"
                            type="category"
                            stroke="#475569"
                            fontSize={11}
                            width={130}
                            tickFormatter={(v) => (v.length > 18 ? v.substring(0, 16) + '...' : v)}
                          />
                          <Tooltip formatter={(val) => [val, 'Qty Sold']} />
                          <Bar dataKey="quantitySold" fill="#94a3b8" radius={[0, 6, 6, 0]} barSize={18} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="py-20 text-center text-slate-400 text-sm">No low-selling items found.</div>
                  )}
                </div>
              </div>

              {/* Unsold Products Callout */}
              {reportData.productPerformance?.unsoldProducts?.length > 0 && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <h4 className="text-sm font-bold text-amber-900">
                      {reportData.productPerformance.unsoldProducts.length} Active Products with ZERO Sales in this Period
                    </h4>
                  </div>
                  <p className="text-xs text-amber-800 mb-3">
                    These active catalogue items had 0 transactions during the selected period.
                  </p>
                  <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                    {reportData.productPerformance.unsoldProducts.slice(0, 20).map((u) => (
                      <span
                        key={u.id}
                        className="text-xs bg-white text-slate-700 px-2.5 py-1 rounded-lg border border-amber-200 shadow-2xs"
                      >
                        {u.name} (Stock: {u.currentStock} {u.unit})
                      </span>
                    ))}
                    {reportData.productPerformance.unsoldProducts.length > 20 && (
                      <span className="text-xs text-amber-800 font-semibold self-center">
                        +{reportData.productPerformance.unsoldProducts.length - 20} more...
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Complete Product Velocity Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">
                      Product Velocity & Performance Directory
                    </h3>
                    <p className="text-xs text-slate-500">
                      Displaying {filteredProducts.length} items sold during this period.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto overflow-y-auto inner-scroll-container max-h-[520px] 2xl:max-h-[680px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 font-semibold uppercase sticky top-0 border-b border-slate-200 z-10 shadow-2xs">
                      <tr>
                        <th className="py-3 px-4">Product Name</th>
                        <th className="py-3 px-3">Barcode</th>
                        <th className="py-3 px-3">Category</th>
                        <th className="py-3 px-3 text-right">Qty Sold</th>
                        <th className="py-3 px-3 text-right">Bills</th>
                        <th className="py-3 px-3 text-right">Gross Sales</th>
                        <th className="py-3 px-3 text-right">Net Sales</th>
                        <th className="py-3 px-3 text-right">Current Stock</th>
                        {reportData.grossProfitReport?.isAuthorized && (
                          <th className="py-3 px-4 text-right">Est. Profit</th>
                        )}
                        <th className="py-3 px-4 text-center">Last Sale</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredProducts.map((p) => (
                        <tr key={p.id} className="hover:bg-orange-50/40 transition">
                          <td className="py-3 px-4 font-medium text-slate-900">
                            <div>{p.name}</div>
                            {p.tamilName && <div className="text-[11px] text-slate-400">{p.tamilName}</div>}
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-600">{p.barcode || '—'}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px]">
                              {p.category}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-900">
                            {p.quantitySold} <span className="text-[10px] text-slate-400 font-normal">{p.unit}</span>
                          </td>
                          <td className="py-3 px-3 text-right text-slate-600">{p.billCount}</td>
                          <td className="py-3 px-3 text-right text-slate-500">{fmtCurrency(p.grossSales)}</td>
                          <td className="py-3 px-3 text-right font-bold text-orange-600">{fmtCurrency(p.netSales)}</td>
                          <td className="py-3 px-3 text-right font-semibold">
                            <span className={p.currentStock <= 5 ? 'text-red-600' : 'text-slate-800'}>
                              {p.currentStock}
                            </span>
                          </td>
                          {reportData.grossProfitReport?.isAuthorized && (
                            <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                              {fmtCurrency(p.profit)}
                            </td>
                          )}
                          <td className="py-3 px-4 text-center text-[11px] text-slate-400">
                            {p.lastSaleDate ? new Date(p.lastSaleDate).toLocaleDateString('en-IN') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CATEGORIES & PAYMENTS */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category Donut Chart */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <h3 className="text-base font-bold text-slate-800 mb-1">Category Sales Contribution</h3>
                  <p className="text-xs text-slate-500 mb-4">Proportionate sales contribution across categories.</p>
                  {reportData.categorySales?.length > 0 ? (
                    <div className="w-full h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={reportData.categorySales}
                            dataKey="totalSales"
                            nameKey="categoryName"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={95}
                            paddingAngle={3}
                          >
                            {reportData.categorySales.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(val) => fmtCurrency(val)} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="py-20 text-center text-slate-400 text-sm">No category sales recorded.</div>
                  )}
                </div>

                {/* Payment Method Distribution Chart */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <h3 className="text-base font-bold text-slate-800 mb-1">Payment Method Distribution</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Tender breakdown (Cash, UPI, Card, Net Banking) recorded at billing counter.
                  </p>
                  {reportData.paymentMethods?.length > 0 ? (
                    <div className="w-full h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={reportData.paymentMethods}
                            dataKey="amount"
                            nameKey="method"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={95}
                            paddingAngle={3}
                          >
                            {reportData.paymentMethods.map((entry, index) => (
                              <Cell
                                key={`pay-${index}`}
                                fill={
                                  entry.method === 'CASH'
                                    ? '#16A34A'
                                    : entry.method === 'UPI'
                                      ? '#17365D'
                                      : entry.method === 'CARD'
                                        ? '#F97316'
                                        : '#D97706'
                                }
                              />
                            ))}
                          </Pie>
                          <Tooltip formatter={(val) => fmtCurrency(val)} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="py-20 text-center text-slate-400 text-sm">No payment method records.</div>
                  )}
                </div>
              </div>

              {/* Category Breakdown Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                  <h3 className="text-base font-bold text-slate-800">Category Sales Ledger</h3>
                  <p className="text-xs text-slate-500">Summary of units and revenue aggregated by product category.</p>
                </div>
                <div className="overflow-x-auto overflow-y-auto inner-scroll-container max-h-80">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold uppercase border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
                    <tr>
                      <th className="py-3 px-4">Category Name</th>
                      <th className="py-3 px-4 text-right">Net Sales</th>
                      <th className="py-3 px-4 text-right">Quantity Sold</th>
                      <th className="py-3 px-4 text-right">Products Active</th>
                      <th className="py-3 px-4 text-right">Revenue Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {(reportData.categorySales || []).map((c) => (
                      <tr key={c.categoryId} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-800">{c.categoryName}</td>
                        <td className="py-3 px-4 text-right font-semibold text-orange-600">
                          {fmtCurrency(c.totalSales)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium">{c.quantitySold}</td>
                        <td className="py-3 px-4 text-right text-slate-500">{c.itemTypesSold}</td>
                        <td className="py-3 px-4 text-right">
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded font-semibold text-[11px]">
                            {c.percentageShare}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
          )}

          {/* TAB 4: STOCK & VALUATION */}
          {activeTab === 'stock' && (
            <div className="space-y-6">
              {/* Stock KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Total Items In Catalogue</div>
                  <div className="text-2xl font-bold text-slate-900 mt-2">
                    {reportData.inventoryReport?.totalProducts || 0}
                  </div>
                  <div className="text-xs text-slate-400 mt-2">Active store inventory</div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="text-xs font-semibold text-amber-600 uppercase">Low Stock Alert</div>
                  <div className="text-2xl font-bold text-amber-700 mt-2">
                    {reportData.inventoryReport?.lowStockCount || 0}
                  </div>
                  <div className="text-xs text-amber-700/80 mt-2">At or below reorder threshold</div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="text-xs font-semibold text-red-600 uppercase">Out of Stock</div>
                  <div className="text-2xl font-bold text-red-700 mt-2">
                    {reportData.inventoryReport?.outOfStockCount || 0}
                  </div>
                  <div className="text-xs text-red-600/80 mt-2">0 units remaining</div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                  <div className="text-xs font-semibold text-emerald-600 uppercase">Stock Valuation (Retail)</div>
                  <div className="text-2xl font-bold text-emerald-700 mt-2">
                    {fmtCurrency(reportData.inventoryReport?.totalRetailValuation)}
                  </div>
                  <div className="text-xs text-slate-400 mt-2">
                    Cost Value: {fmtCurrency(reportData.inventoryReport?.totalCostValuation)}
                  </div>
                </div>
              </div>

              {/* Inventory Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Complete Stock Ledger & Valuation</h3>
                    <p className="text-xs text-slate-500">
                      Product by product stock levels, safety thresholds and valuation metrics.
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold uppercase sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Product Name</th>
                        <th className="py-3 px-3">Barcode</th>
                        <th className="py-3 px-3">Category</th>
                        <th className="py-3 px-3 text-right">Current Stock</th>
                        <th className="py-3 px-3 text-right">Min Stock</th>
                        <th className="py-3 px-3 text-center">Status</th>
                        <th className="py-3 px-3 text-right">Cost Price</th>
                        <th className="py-3 px-3 text-right">Selling Price</th>
                        <th className="py-3 px-4 text-right">Retail Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {(reportData.inventoryReport?.items || []).map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-medium text-slate-900">{item.name}</td>
                          <td className="py-3 px-3 font-mono text-slate-600">{item.barcode || '—'}</td>
                          <td className="py-3 px-3">{item.category}</td>
                          <td className="py-3 px-3 text-right font-bold text-slate-800">
                            {item.currentStock} {item.unit}
                          </td>
                          <td className="py-3 px-3 text-right text-slate-500">{item.minStock}</td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${item.status === 'OUT_OF_STOCK'
                                  ? 'bg-red-100 text-red-700'
                                  : item.status === 'LOW_STOCK'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-emerald-100 text-emerald-700'
                                }`}
                            >
                              {item.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right text-slate-500">{fmtCurrency(item.purchaseCost)}</td>
                          <td className="py-3 px-3 text-right font-semibold text-slate-800">
                            {fmtCurrency(item.sellingPrice)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-600">
                            {fmtCurrency(item.totalRetailValuation)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: FINANCIALS, TAXES & RETURNS */}
          {activeTab === 'financials' && (
            <div className="space-y-6">
              {/* Financial Metrics Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <h4 className="text-sm font-bold text-slate-800 mb-2">Discounts & Promotions</h4>
                  <div className="text-2xl font-bold text-orange-600">
                    {fmtCurrency(reportData.overview?.totalDiscounts)}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Total bill-level and item-level price concessions granted to customers.
                  </p>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <h4 className="text-sm font-bold text-slate-800 mb-2">GST / Tax Collected</h4>
                  <div className="text-2xl font-bold text-slate-800">
                    {fmtCurrency(reportData.overview?.totalTax)}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Tax / GST collected across completed transactions during this date range.
                  </p>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <h4 className="text-sm font-bold text-slate-800 mb-2">Returns & Cancelled Bills</h4>
                  <div className="text-2xl font-bold text-red-600">
                    {fmtCurrency(reportData.returnsReport?.totalRefundedAmount)}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    {reportData.returnsReport?.totalCancelledBills || 0} cancelled / refunded transactions.
                  </p>
                </div>
              </div>

              {/* Purchases & Suppliers Report */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Purchases & Supplier Ledger</h3>
                    <p className="text-xs text-slate-500">
                      Total inventory procurements recorded from wholesale suppliers during this period.
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Total Purchase Spend</div>
                    <div className="text-base font-bold text-slate-900">
                      {fmtCurrency(reportData.purchasesReport?.totalPurchasesCost)}
                    </div>
                  </div>
                </div>

                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Supplier</th>
                      <th className="py-3 px-4 text-center">Purchase Orders</th>
                      <th className="py-3 px-4 text-right">Total Purchase Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {reportData.purchasesReport?.supplierBreakdown?.length > 0 ? (
                      reportData.purchasesReport.supplierBreakdown.map((s, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-bold text-slate-800">{s.supplierName}</td>
                          <td className="py-3 px-4 text-center">{s.billCount}</td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            {fmtCurrency(s.totalPurchases)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-slate-400">
                          No supplier purchases recorded during this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mandatory Requirement Note for Expenses */}
              {reportData.expenseReport && !reportData.expenseReport.isAvailable && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                  <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-bold text-slate-800">Expense Report Availability Status</h5>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {reportData.expenseReport.message} Zero values or placeholder estimates are omitted to guarantee data integrity.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: CASHIER & AUDIT */}
          {activeTab === 'staff' && (
            <div className="space-y-6">
              {/* Cashier Sales Performance */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                  <h3 className="text-base font-bold text-slate-800">Cashier / Staff Billing Performance</h3>
                  <p className="text-xs text-slate-500">
                    Total bills processed and revenue generated broken down by cashier user account.
                  </p>
                </div>

                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Cashier Name</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4 text-right">Bills Processed</th>
                      <th className="py-3 px-4 text-right">Total Net Revenue</th>
                      <th className="py-3 px-4 text-right">Average Bill Size</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {reportData.cashierReport?.length > 0 ? (
                      reportData.cashierReport.map((c) => (
                        <tr key={c.cashierId} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-bold text-slate-800">{c.cashierName}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px]">
                              {c.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-medium">{c.billCount}</td>
                          <td className="py-3 px-4 text-right font-bold text-orange-600">
                            {fmtCurrency(c.totalSales)}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-800">
                            {fmtCurrency(c.averageBillValue)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          No cashier transactions found for this timeframe.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Inventory Movements Summary */}
              {reportData.inventoryMovementSummary && (
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <h3 className="text-base font-bold text-slate-800 mb-1">
                    Inventory Stock Movement Logs ({reportData.periodLabel})
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Audit trail summary of automated POS deductions, manual stock adjustments, and goods inward.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-xs text-slate-500">Total Movement Events</div>
                      <div className="text-xl font-bold text-slate-800 mt-1">
                        {reportData.inventoryMovementSummary.totalMovementsCount || 0}
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-xs text-slate-500">Gross Quantity Inward (+)</div>
                      <div className="text-xl font-bold text-emerald-600 mt-1">
                        +{reportData.inventoryMovementSummary.totalInwardQuantity || 0}
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-xs text-slate-500">Gross Quantity Outward (-)</div>
                      <div className="text-xl font-bold text-red-600 mt-1">
                        {reportData.inventoryMovementSummary.totalOutwardQuantity || 0}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
