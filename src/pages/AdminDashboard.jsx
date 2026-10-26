import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import AnanthaLogo from '../components/AnanthaLogo';
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
  RotateCcw,
  QrCode,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Command,
  X,
  Tag,
  PackageSearch
} from 'lucide-react';
import ReceiptComponent from '../components/Receipt';
import BarcodeManagement from '../components/BarcodeManagement';
import CategoryQuickFilter from '../components/CategoryQuickFilter';
import AnanthaAIAssistant from '../components/AnanthaAIAssistant';
import { PosToastContainer, showPosToast } from '../components/PosToast';
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
import api, { getApiUrl, getProductImageUrl } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { isWeightBased, getPriceBasisLabel } from '../utils/unitCalc';
import ReportsSection from '../components/ReportsSection';
import { exportReportToCSV, exportFailedRowsToCSV } from '../utils/reportExport';

export default function AdminDashboard({ onOpenBilling }) {
  const { user, token, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [quickSearchTerm, setQuickSearchTerm] = useState('');

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
  const [selectedProductCategory, setSelectedProductCategory] = useState('All');

  // Filter products by both category chip selection and search query (Products & Price Master)
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Category match
      if (selectedProductCategory !== 'All') {
        const catName = p.category?.name || p.categoryName || 'Uncategorized';
        if (catName !== selectedProductCategory) return false;
      }
      // Search match
      if (searchFilter && searchFilter.trim()) {
        const q = searchFilter.toLowerCase().trim();
        const matchName = p.name && p.name.toLowerCase().includes(q);
        const matchTamil = p.tamilName && p.tamilName.includes(q);
        const matchBrand = p.brand && p.brand.toLowerCase().includes(q);
        const matchBarcode = p.barcode && p.barcode.toLowerCase().includes(q);
        if (!matchName && !matchTamil && !matchBrand && !matchBarcode) return false;
      }
      return true;
    });
  }, [products, selectedProductCategory, searchFilter]);

  // Inventory & Stock Alerts category and search filter state
  const [selectedInventoryCategory, setSelectedInventoryCategory] = useState('All');
  const [inventorySearchFilter, setInventorySearchFilter] = useState('');

  // Filter products for Inventory & Stock Alerts table
  const filteredInventoryProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    return products.filter((p) => {
      // Category match
      if (selectedInventoryCategory !== 'All') {
        const catName = p.category?.name || p.categoryName || 'General';
        if (catName !== selectedInventoryCategory) return false;
      }
      // Search match
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
    purchaseCost: 0, sellingPrice: 0, currentStock: 0, minStock: 5, imageUrl: '',
  });

  // Product Image Upload state
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageError, setImageError] = useState(null);
  const [removeImageFlag, setRemoveImageFlag] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageError(null);

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const validExts = ['.jpg', '.jpeg', '.png', '.webp'];

    if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
      setImageError('Invalid file type. Only JPG, JPEG, PNG, and WebP images are allowed.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 5 MB limit
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setImageError(`File size exceeds 5 MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB). Please select an image under 5 MB.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedImageFile(file);
    setRemoveImageFlag(false);

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedImageFile(null);
    setImagePreview(null);
    setImageError(null);
    setRemoveImageFlag(true);
    setProductForm((prev) => ({ ...prev, imageUrl: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
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
  const [isDragging, setIsDragging] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Load active tab data
  useEffect(() => {
    loadTabData(activeTab);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [activeTab]);

  // Pre-load products on mount so global search can find products immediately from any tab
  useEffect(() => {
    api.get('/products?includeInactive=false').then((res) => {
      if (Array.isArray(res.data) && res.data.length > 0) {
        setProducts(res.data);
      }
    }).catch(() => {});
  }, []);

  // Ensure products are populated whenever quick search is opened
  useEffect(() => {
    if (quickSearchOpen && products.length === 0) {
      api.get('/products?includeInactive=false').then((res) => {
        if (Array.isArray(res.data)) setProducts(res.data);
      }).catch(() => {});
    }
  }, [quickSearchOpen]);

  // Global Shortcut: Ctrl+K / Cmd+K Quick Search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuickSearchOpen((prev) => !prev);
      } else if (e.key === 'Escape' && quickSearchOpen) {
        setQuickSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quickSearchOpen]);

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
        const [sRes, mRes, cRes] = await Promise.all([
          api.get('/inventory/stock'),
          api.get('/inventory/movements?limit=50'),
          api.get('/products/categories'),
        ]);
        setProducts(sRes.data);
        setStockMovements(mRes.data);
        setCategories(cRes.data || []);
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
      setIsUploadingImage(true);
      let finalImageUrl = productForm.imageUrl || null;

      if (removeImageFlag) {
        finalImageUrl = null;
      } else if (selectedImageFile) {
        // Upload image to backend
        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(selectedImageFile);
        });

        const uploadRes = await api.post('/products/upload-image', {
          image: base64Data,
          name: selectedImageFile.name,
        });

        if (uploadRes.data?.imageUrl) {
          finalImageUrl = uploadRes.data.imageUrl;
        }
      }

      const isWeight = ['KG', 'G'].includes((productForm.measurementType || '').toUpperCase());
      const payload = {
        ...productForm,
        imageUrl: finalImageUrl,
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
      setSelectedImageFile(null);
      setImagePreview(null);
      setImageError(null);
      setRemoveImageFlag(false);
      loadTabData('products');
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Failed to save product');
    } finally {
      setIsUploadingImage(false);
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

  // Selected Products for Bulk Delete
  const [selectedProductIds, setSelectedProductIds] = useState([]);

  // Single Product Delete Handler (Safe soft-delete if sales exist, else hard delete)
  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Are you sure you want to delete / deactivate "${product.name}"?`)) return;
    try {
      const res = await api.delete(`/products/${product.id}`);
      alert(res.data.message || 'Product deleted successfully.');
      loadTabData('products');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete product');
    }
  };

  // Bulk Product Delete Handler
  const handleBulkDeleteProducts = async () => {
    if (selectedProductIds.length === 0) {
      alert('Please select at least one product to delete.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedProductIds.length} selected products? Products with sales history will be safely archived (deactivated) instead of breaking historical records.`)) {
      return;
    }
    try {
      const res = await api.post('/products/bulk-delete', { ids: selectedProductIds });
      alert(res.data.message || 'Bulk deletion completed.');
      setSelectedProductIds([]);
      loadTabData('products');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to bulk delete products');
    }
  };

  // Download Failed Rows CSV helper
  const handleDownloadFailedRows = (failedRows, filename = 'failed_import_rows') => {
    if (!failedRows || failedRows.length === 0) {
      alert('No failed rows to download.');
      return;
    }
    exportFailedRowsToCSV(failedRows, filename);
  };

  // Excel & CSV Import handlers - Fixed ArrayBuffer + UTF-8 65001 codepage for Tamil font support
  const handleExcelFileUpload = (fileOrEvent) => {
    let file = null;
    if (fileOrEvent && fileOrEvent.target && fileOrEvent.target.files) {
      file = fileOrEvent.target.files[0];
    } else if (fileOrEvent instanceof File) {
      file = fileOrEvent;
    }
    if (!file) return;

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') && !fileName.endsWith('.csv')) {
      alert('Invalid file format. Please upload a spreadsheet with .xlsx, .xls, or .csv extension.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      alert('File size exceeds the 20 MB limit.');
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const buffer = evt.target.result;
        const wb = XLSX.read(buffer, { type: 'array', codepage: 65001 });
        if (!wb.SheetNames || wb.SheetNames.length === 0) {
          throw new Error('Workbook contains no sheets.');
        }
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (!data || data.length === 0) {
          alert('The uploaded spreadsheet is empty or contains no readable product rows.');
          setIsImporting(false);
          return;
        }

        setImportRows(data);
        const res = await api.post('/products/import-preview', { rows: data });
        setImportPreviewData(res.data);
      } catch (err) {
        alert('Failed to parse spreadsheet file: ' + (err.response?.data?.error || err.message));
      } finally {
        setIsImporting(false);
      }
    };
    reader.onerror = () => {
      alert('Error reading the selected file from disk.');
      setIsImporting(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleExcelFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
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
    <div className="admin-dashboard-screen flex h-screen w-screen bg-[#F3F6FA] bg-grid-dots text-[#17365D] select-none overflow-hidden relative">
      {/* Admin Sidebar — Navy Blue Theme */}
      <aside className={`${sidebarCollapsed ? 'w-20' : 'w-64'} relative bg-[#17365D] border-r border-[#122B4A] text-slate-300 flex flex-col justify-between shrink-0 shadow-md z-20 transition-all duration-200 ease-in-out`}>
        {/* Content Container (Header + Nav) */}
        <div className="relative z-10 flex flex-col flex-1 min-h-0">
          {/* Brand Header */}
          {sidebarCollapsed ? (
            <div className="h-18 px-2 flex flex-col items-center justify-center border-b border-[#234A7D] bg-[#17365D] shrink-0 gap-1">
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
                    <span className="text-[8.5px] bg-[#2563EB] text-white px-1.5 py-0.5 rounded font-extrabold tracking-wider shadow-2xs leading-none shrink-0">
                      ADMIN
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1.5 text-xs sidebar-blue-scroll">
            {[
              { id: 'dashboard', label: 'Dashboard Overview', icon: LayoutDashboard },
              { id: 'billing', label: 'Billing / POS Terminal', icon: Receipt, action: onOpenBilling },
              { id: 'products', label: 'Products & Price Master', icon: ShoppingBag },
              { id: 'barcodes', label: 'Barcode Management', icon: QrCode },
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
                  {!sidebarCollapsed && item.action && (
                    <ArrowUpRight className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout (Anchored at Bottom) */}
        <div className="relative z-10 p-3 border-t border-[#234A7D] bg-[#122B4A] shrink-0 space-y-2">
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div 
                className="w-10 h-10 rounded-xl bg-[#F97316] text-white font-black flex items-center justify-center text-sm shadow-soft"
                title={`${user?.fullName || 'Admin'} (${user?.role || 'ADMIN'})`}
              >
                {(user?.fullName || 'A').charAt(0).toUpperCase()}
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
                  {(user?.fullName || 'A').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white text-xs leading-tight truncate">{user?.fullName || 'Anantha Admin'}</div>
                  <div className="text-[10px] text-slate-300 font-semibold tracking-wide uppercase mt-0.5">Role: {user?.role || 'ADMIN'}</div>
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
      <div className="flex-1 flex flex-col overflow-hidden bg-[#F3F6FA] relative">
        {/* Top bar — Glass Panel */}
        <header className="h-16 bg-white/95 backdrop-blur-md border-b border-[#D9E2EF] px-6 flex items-center justify-between shadow-soft shrink-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-baseline gap-2.5">
              <h2 className="text-base font-extrabold text-[#17365D] tracking-tight whitespace-nowrap">
                {activeTab === 'barcodes'
                  ? 'Barcode Master & Label Management'
                  : 'Admin Control Center'}
              </h2>
              <span className="text-[11px] font-tamil text-[#64748B] font-semibold whitespace-nowrap">
                {activeTab === 'barcodes' ? 'ஆனந்தா பார்-கோடு' : 'ஆனந்தா ஸ்டோர்ஸ்'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Search Shortcut Trigger */}
            <button
              type="button"
              onClick={() => setQuickSearchOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-[#FFF1E7] border border-[#D9E2EF] hover:border-[#F97316]/50 rounded-xl text-xs text-[#64748B] transition shadow-2xs cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-[#F97316]" />
              <span>Quick Search...</span>
              <kbd className="px-1.5 py-0.5 bg-[#F3F6FA] border border-[#D9E2EF] rounded text-[10px] font-mono font-bold text-[#F97316]">Ctrl+K</kbd>
            </button>

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

            {/* Live Clock */}
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-[#17365D] border border-[#D9E2EF] shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-[#F97316]" />
              <span>{currentTime.toLocaleTimeString('en-IN')}</span>
            </div>

            {/* Launch POS Button */}
            <button
              onClick={onOpenBilling}
              className="flex items-center gap-2 bg-[#F97316] hover:bg-[#EA580C] text-white px-4 py-2 rounded-xl text-xs font-extrabold transition shadow-md shadow-orange-500/20 active:scale-95 cursor-pointer"
            >
              <Receipt className="w-4 h-4" />
              <span>Launch POS Billing</span>
            </button>
          </div>
        </header>

        {/* Dynamic Tab Body with Smooth Page Entrance */}
        <main className="flex-1 overflow-y-auto admin-scroll-container p-6 space-y-6 animate-page-entrance min-h-0">
          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === 'dashboard' && dashboardData && (
            <div className="space-y-6">
              {/* 5 KPI Stat Cards in Glass Design */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* 1. Today Sales */}
                <div className="glass-card p-5 rounded-2xl border border-[#D9E2EF] bg-white shadow-soft hover:-translate-y-1 transition duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#64748B] font-bold uppercase tracking-wider">Today's Sales</span>
                    <div className="w-8 h-8 rounded-xl bg-[#FFF1E7] border border-[#FED7AA] flex items-center justify-center text-[#F97316]">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-[#17365D] mt-2 font-mono tracking-tight">
                    ₹{Number(dashboardData.todaySales).toFixed(2)}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse"></span>
                    <span className="text-[10.5px] text-[#16A34A] font-bold">Live database sync</span>
                  </div>
                </div>

                {/* 2. Today Bills */}
                <div className="glass-card p-5 rounded-2xl border border-[#D9E2EF] bg-white shadow-soft hover:-translate-y-1 transition duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#64748B] font-bold uppercase tracking-wider">Today's Bills</span>
                    <div className="w-8 h-8 rounded-xl bg-[#F3F6FA] border border-[#D9E2EF] flex items-center justify-center text-[#17365D]">
                      <Receipt className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-[#17365D] mt-2 font-mono tracking-tight">
                    {dashboardData.todayBills} <span className="text-sm font-bold text-[#64748B]">Bills</span>
                  </div>
                  <div className="text-[10.5px] text-[#F97316] font-bold mt-2">Completed checkouts</div>
                </div>

                {/* 3. Catalog Products */}
                <div className="glass-card p-5 rounded-2xl border border-[#D9E2EF] bg-white shadow-soft hover:-translate-y-1 transition duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#64748B] font-bold uppercase tracking-wider">Catalog Items</span>
                    <div className="w-8 h-8 rounded-xl bg-[#F3F6FA] border border-[#D9E2EF] flex items-center justify-center text-[#17365D]">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-[#17365D] mt-2 font-mono tracking-tight">
                    {dashboardData.totalProducts} <span className="text-sm font-bold text-[#64748B]">Items</span>
                  </div>
                  <div className="text-[10.5px] text-[#64748B] font-semibold mt-2">Active shelf master</div>
                </div>

                {/* 4. Low Stock Alerts */}
                <div className="glass-card p-5 rounded-2xl border border-[#D9E2EF] bg-white shadow-soft hover:-translate-y-1 transition duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#64748B] font-bold uppercase tracking-wider">Low Stock Alerts</span>
                    <div className="w-8 h-8 rounded-xl bg-[#FFF1E7] border border-[#FED7AA] flex items-center justify-center text-[#D97706]">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-[#D97706] mt-2 font-mono tracking-tight">
                    {dashboardData.lowStockCount} <span className="text-sm font-bold text-[#D97706]">Items</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] animate-ping"></span>
                    <span className="text-[10.5px] text-[#D97706] font-bold">Needs supplier reorder</span>
                  </div>
                </div>

                {/* 5. Estimated Gross Margin */}
                <div className="glass-card p-5 rounded-2xl border border-[#D9E2EF] bg-white shadow-soft hover:-translate-y-1 transition duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#64748B] font-bold uppercase tracking-wider">Est. Gross Margin</span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#16A34A]">
                      <DollarSign className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-[#16A34A] mt-2 font-mono tracking-tight">
                    ~18.5%
                  </div>
                  <div className="text-[10.5px] text-[#16A34A] font-bold mt-2">Profitable retail spread</div>
                </div>
              </div>

              {/* Chart & Payment Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 7-Day Trend Chart */}
                <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-[#D9E2EF] bg-white shadow-soft">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-extrabold text-[#17365D] text-sm">7-Day Supermarket Sales Trend</h3>
                      <p className="text-xs text-[#64748B]">Daily gross revenue performance (INR ₹)</p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-[#FFF1E7] text-[#F97316] border border-[#FED7AA] px-2.5 py-1 rounded-lg text-xs font-bold">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Live 7 Days</span>
                    </div>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboardData.salesTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                        <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} tickLine={false} />
                        <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#FFFFFF', 
                            borderRadius: '12px', 
                            border: '1px solid #D9E2EF',
                            boxShadow: '0 4px 12px rgba(23,54,93,0.08)',
                            fontSize: '12px',
                            fontWeight: 600
                          }} 
                        />
                        <Bar dataKey="sales" fill="#F97316" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Payment Breakdown Card */}
                <div className="glass-panel p-6 rounded-2xl border border-[#D9E2EF] bg-white shadow-soft space-y-4">
                  <div>
                    <h3 className="font-extrabold text-[#17365D] text-sm">Payment Collection Breakdown</h3>
                    <p className="text-xs text-[#64748B]">By settlement channel</p>
                  </div>
                  <div className="space-y-3">
                    {dashboardData.paymentMethodBreakdown?.map((pm, idx) => {
                      const methodColors = {
                        CASH: 'bg-[#16A34A]',
                        UPI: 'bg-[#F97316]',
                        CARD: 'bg-[#17365D]',
                        SPLIT: 'bg-[#D97706]'
                      };
                      return (
                        <div key={idx} className="bg-white p-3.5 rounded-xl border border-[#D9E2EF] flex items-center justify-between shadow-2xs hover:border-[#F97316]/50 transition">
                          <div className="flex items-center gap-2.5">
                            <span className={`w-3 h-3 rounded-full ${methodColors[pm.method] || 'bg-[#17365D]'} shadow-2xs`}></span>
                            <span className="font-bold text-xs text-[#17365D]">{pm.method}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-extrabold text-sm text-[#17365D] block">
                              ₹{Number(pm.total).toFixed(2)}
                            </span>
                            <span className="text-[10px] text-[#64748B] font-semibold">{pm.count} bills</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Recent Bills Table */}
              <div className="glass-panel rounded-2xl border border-[#D9E2EF] bg-white shadow-soft overflow-hidden flex flex-col">
                <div className="p-4 border-b border-[#D9E2EF] flex items-center justify-between shrink-0">
                  <div>
                    <h3 className="font-extrabold text-[#17365D] text-sm">Recent Completed Transactions</h3>
                    <p className="text-xs text-[#64748B]">Real-time register receipts and customer checkout logs</p>
                  </div>
                </div>
                <div className="overflow-x-auto overflow-y-auto inner-scroll-container max-h-96">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFC] text-[#64748B] uppercase font-bold text-[10px] border-b border-[#D9E2EF] tracking-wider sticky top-0 z-10 shadow-2xs">
                      <tr>
                        <th className="py-3 px-4">Bill #</th>
                        <th className="py-3 px-3">Date & Time</th>
                        <th className="py-3 px-3">Cashier</th>
                        <th className="py-3 px-3">Customer</th>
                        <th className="py-3 px-3 text-right">Amount (₹)</th>
                        <th className="py-3 px-3 text-center">Payment</th>
                        <th className="py-3 px-4 text-right">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D9E2EF]">
                      {dashboardData.recentSales?.map((s) => (
                        <tr key={s.id} className="hover:bg-[#FFF1E7]/40 transition">
                          <td className="py-3 px-4 font-mono font-bold text-[#17365D]">{s.billNumber}</td>
                          <td className="py-3 px-3 text-[#64748B]">{new Date(s.createdAt).toLocaleString('en-IN')}</td>
                          <td className="py-3 px-3 text-[#17365D] font-semibold">{s.cashier?.fullName}</td>
                          <td className="py-3 px-3 text-[#17365D]">{s.customer?.name || 'Walk-in'}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-[#17365D]">
                            ₹{Number(s.grandTotal).toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="bg-[#FFF1E7] text-[#F97316] border border-[#FED7AA] px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                              {s.paymentMethod}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleViewReceipt(s.id)}
                              className="px-2.5 py-1 bg-white hover:bg-[#FFF1E7] text-[#F97316] border border-[#FED7AA] rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition shadow-2xs cursor-pointer"
                              title="View & Print Official Receipt"
                            >
                              <Printer className="w-3.5 h-3.5 text-[#F97316]" />
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
                  {selectedProductIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleBulkDeleteProducts}
                      className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm animate-pulse"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Selected ({selectedProductIds.length})</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setProductForm({
                        name: '', tamilName: '', brand: '', categoryId: categories[0]?.id || '',
                        unit: 'pcs', measurementType: 'PCS', baseUnit: 'pcs', pricePerKg: 0, packSize: '', barcode: '', sku: '',
                        purchaseCost: 0, sellingPrice: 0, currentStock: 0, minStock: 5, imageUrl: '',
                      });
                      setSelectedImageFile(null);
                      setImagePreview(null);
                      setImageError(null);
                      setRemoveImageFlag(false);
                      setEditProductModal(false);
                      setAddProductModal(true);
                    }}
                    className="flex items-center gap-1.5 bg-[#F97316] hover:bg-[#EA580C] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New Product</span>
                  </button>
                </div>
              </div>

              {/* Reusable Horizontal Category Quick Filter Bar */}
              <CategoryQuickFilter
                categories={categories}
                products={products}
                selectedCategory={selectedProductCategory}
                onSelectCategory={setSelectedProductCategory}
                filteredCount={filteredProducts.length}
                totalCount={products.length}
                onReset={() => {
                  setSelectedProductCategory('All');
                  setSearchFilter('');
                }}
              />

              {/* Products Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                <div className="overflow-x-auto overflow-y-auto inner-scroll-container max-h-[580px] 2xl:max-h-[720px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
                      <tr>
                        <th className="py-3 px-3 text-center w-8">
                          <input
                            type="checkbox"
                            checked={
                              filteredProducts.length > 0 &&
                              filteredProducts.every((p) => selectedProductIds.includes(p.id))
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProductIds((prev) => {
                                  const set = new Set(prev);
                                  filteredProducts.forEach((p) => set.add(p.id));
                                  return Array.from(set);
                                });
                              } else {
                                const currentFilteredIds = new Set(filteredProducts.map((p) => p.id));
                                setSelectedProductIds((prev) => prev.filter((id) => !currentFilteredIds.has(id)));
                              }
                            }}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                          />
                        </th>
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
                      {filteredProducts.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="py-12 text-center text-[#64748B]">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <PackageSearch className="w-8 h-8 text-slate-300 mb-1" />
                              <span className="font-bold text-sm text-[#17365D]">No products found</span>
                              <span className="text-xs text-slate-400">
                                {products.length === 0
                                  ? 'Add your first product or import an Excel/CSV spreadsheet to build your inventory catalog.'
                                  : selectedProductCategory !== 'All'
                                  ? `No products match category "${selectedProductCategory}".`
                                  : 'Try adjusting your search query.'}
                              </span>
                              {products.length === 0 ? (
                                <div className="flex items-center gap-2 mt-2">
                                  <button
                                    type="button"
                                    onClick={() => { resetProductForm(); setNewProductModal(true); }}
                                    className="px-3.5 py-1.5 bg-[#F97316] text-white rounded-xl text-xs font-bold hover:bg-[#EA580C] transition cursor-pointer flex items-center gap-1 shadow-xs"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Add First Product</span>
                                  </button>
                                </div>
                              ) : selectedProductCategory !== 'All' ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedProductCategory('All')}
                                  className="mt-2 px-3 py-1 bg-[#FFF1E7] text-[#F97316] border border-[#FED7AA] rounded-lg text-xs font-bold hover:bg-[#F97316] hover:text-white transition cursor-pointer"
                                >
                                  Show All Products
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredProducts.map((p) => (
                          <tr key={p.id} className={`hover:bg-slate-50 ${selectedProductIds.includes(p.id) ? 'bg-blue-50/40' : ''}`}>
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={selectedProductIds.includes(p.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedProductIds((prev) => [...prev, p.id]);
                                  } else {
                                    setSelectedProductIds((prev) => prev.filter((id) => id !== p.id));
                                  }
                                }}
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                              />
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-900">
                              <div className="flex items-center gap-2.5">
                                {p.imageUrl ? (
                                  <img
                                    src={getProductImageUrl(p.imageUrl)}
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                    className="w-8 h-8 rounded-lg object-contain border border-slate-200 bg-slate-50 shrink-0 p-0.5"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                ) : null}
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span>{p.name}</span>
                                    {isWeightBased(p) && (
                                      <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider">
                                        By Weight
                                      </span>
                                    )}
                                  </div>
                                </div>
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
                            <td className="py-3 px-3">
                              <div className="flex items-center justify-center">
                                <div
                                  className={`inline-flex items-center justify-between min-w-[88px] max-w-[110px] px-2.5 py-1 rounded-lg text-xs font-semibold border shadow-2xs transition-all ${
                                    Number(p.currentStock) <= 0
                                      ? 'bg-red-50 text-red-700 border-red-200'
                                      : Number(p.currentStock) <= Number(p.minStock)
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}
                                  title={`Current Stock: ${formatStockQuantity(p.currentStock)} ${getStockUnitLabel(p.unit, p.measurementType)} (Min: ${formatStockQuantity(p.minStock)})`}
                                >
                                  <span className="font-mono font-bold text-[11px] tabular-nums text-right flex-1 tracking-tight truncate">
                                    {formatStockQuantity(p.currentStock)}
                                  </span>
                                  <span className="text-[10px] uppercase font-bold tracking-wider ml-1.5 opacity-80 text-left shrink-0">
                                    {getStockUnitLabel(p.unit, p.measurementType)}
                                  </span>
                                </div>
                              </div>
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
                                      imageUrl: p.imageUrl || '',
                                    });
                                    setSelectedImageFile(null);
                                    setImagePreview(p.imageUrl ? getProductImageUrl(p.imageUrl) : null);
                                    setImageError(null);
                                    setRemoveImageFlag(false);
                                    setEditProductModal(true);
                                  }}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteProduct(p)}
                                  className="p-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-semibold transition"
                                  title="Delete or Deactivate Product"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
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
                      href={`${getApiUrl('/products/template/download')}?token=${encodeURIComponent(token || '')}`}
                      className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-xl text-xs font-bold transition shadow-xs"
                      title="Download clean Excel template (.xlsx)"
                    >
                      <Download className="w-4 h-4 text-slate-600" />
                      <span>Excel Template (.xlsx)</span>
                    </a>

                    <a
                      href={`${getApiUrl('/products/template-csv/download')}?token=${encodeURIComponent(token || '')}`}
                      className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-xl text-xs font-bold transition shadow-xs"
                      title="Download clean CSV template with UTF-8 Tamil support (.csv)"
                    >
                      <Download className="w-4 h-4 text-emerald-600" />
                      <span>CSV Template (.csv)</span>
                    </a>

                    <a
                      href={`${getApiUrl('/products/sample-100/download')}?token=${encodeURIComponent(token || '')}`}
                      className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-2 rounded-xl text-xs font-bold transition shadow-xs"
                      title="Download 100 sample supermarket products dataset"
                    >
                      <Download className="w-4 h-4 text-blue-600" />
                      <span>100 Sample Products</span>
                    </a>

                    <a
                      href={`${getApiUrl('/products/images-zip/download')}?token=${encodeURIComponent(token || '')}`}
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
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleFileDrop}
                    className={`md:col-span-2 border-2 border-dashed rounded-2xl p-6 text-center transition flex flex-col items-center justify-center ${
                      isDragging
                        ? 'border-blue-600 bg-blue-100/60 scale-[1.01]'
                        : 'border-blue-300 bg-blue-50/20 hover:bg-blue-50/50'
                    }`}
                  >
                    <Upload className="w-9 h-9 text-blue-600 mb-2" />
                    <h4 className="text-sm font-bold text-slate-800">
                      {isDragging ? 'Drop spreadsheet here to upload' : 'Drag & Drop or Select Product Spreadsheet'}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Supports .xlsx, .xls, and .csv files with UTF-8 Tamil text. Max 20 MB.
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Columns: product_name, tamil_name, brand, category, barcode, unit, purchase_price, selling_price, opening_stock, minimum_stock, status
                    </p>
                    <label className="mt-4 inline-flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-bold bg-[#F97316] text-white hover:bg-[#EA580C] cursor-pointer shadow-sm transition">
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Browse Spreadsheet File</span>
                      <input
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        onChange={handleExcelFileUpload}
                        className="hidden"
                      />
                    </label>
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
                            ? 'bg-[#17365D] text-white border-[#17365D] shadow-sm'
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
                  <div className="overflow-x-auto overflow-y-auto inner-scroll-container max-h-[500px] border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 uppercase font-bold text-[10px] sticky top-0 border-b border-slate-200 z-10 shadow-2xs">
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
                    <div className="flex items-center gap-2">
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

                      {importPreviewData.invalidCount > 0 && (
                        <button
                          type="button"
                          onClick={() => handleDownloadFailedRows(importPreviewData.failedRows || importPreviewData.rows.filter(r => !r.isValid), 'preview_failed_rows')}
                          className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download Failed Rows CSV ({importPreviewData.invalidCount})</span>
                        </button>
                      )}
                    </div>

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
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-[#17365D] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30"
                  />
                  {inventorySearchFilter && (
                    <button
                      type="button"
                      onClick={() => setInventorySearchFilter('')}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
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
                        filteredInventoryProducts.map((p) => (
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
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Stock Movement Audit Ledger */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 shrink-0">
                  <h3 className="font-bold text-slate-900 text-sm">Stock Movement Ledger (Audit History)</h3>
                </div>
                <div className="overflow-x-auto overflow-y-auto inner-scroll-container max-h-80">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] sticky top-0 border-b border-slate-200 z-10 shadow-2xs">
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
                  className="flex items-center gap-1.5 bg-[#F97316] hover:bg-[#EA580C] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Supplier</span>
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                <div className="overflow-x-auto overflow-y-auto inner-scroll-container max-h-[580px] 2xl:max-h-[720px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
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
                      {suppliers.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-12 text-center text-[#64748B]">
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              <Truck className="w-8 h-8 text-slate-300 mb-1" />
                              <span className="font-bold text-sm text-[#17365D]">No suppliers added yet.</span>
                              <span className="text-xs text-slate-400">Add wholesale vendor contacts to manage purchase shipments.</span>
                              <button
                                type="button"
                                onClick={() => setNewSupplierModal(true)}
                                className="mt-2 px-3.5 py-1.5 bg-[#FFF1E7] text-[#F97316] border border-[#FED7AA] rounded-xl text-xs font-bold hover:bg-[#F97316] hover:text-white transition cursor-pointer flex items-center gap-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add First Supplier</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        suppliers.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-bold text-slate-900">{s.name}</td>
                            <td className="py-3 px-3 text-slate-700">{s.contactPerson || '-'}</td>
                            <td className="py-3 px-3 font-mono text-slate-800">{s.phone}</td>
                            <td className="py-3 px-3 text-slate-500">{s.email || '-'}</td>
                            <td className="py-3 px-3 text-slate-600">{s.address || '-'}</td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-[#17365D]">
                              {s._count?.purchases || 0}
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

          {/* TAB 6: PURCHASES & CONFIRM RECEIVED */}
          {activeTab === 'purchases' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-sm">Purchase Invoices & Goods Receiving</h3>
                <button
                  onClick={() => setNewPurchaseModal(true)}
                  className="flex items-center gap-1.5 bg-[#F97316] hover:bg-[#EA580C] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Purchase Invoice</span>
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                <div className="overflow-x-auto overflow-y-auto inner-scroll-container max-h-[580px] 2xl:max-h-[720px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
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
                    {purchases.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-12 text-center text-[#64748B]">
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            <Truck className="w-8 h-8 text-slate-300 mb-1" />
                            <span className="font-bold text-sm text-[#17365D]">No purchase invoices found.</span>
                            <span className="text-xs text-slate-400">Record your first supplier purchase invoice to receive incoming inventory.</span>
                            <button
                              type="button"
                              onClick={() => setNewPurchaseModal(true)}
                              className="mt-2 px-3.5 py-1.5 bg-[#FFF1E7] text-[#F97316] border border-[#FED7AA] rounded-xl text-xs font-bold hover:bg-[#F97316] hover:text-white transition cursor-pointer flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Create Purchase Invoice</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      purchases.map((p) => (
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          )}

          {/* TAB 7: CUSTOMERS & LOYALTY */}
          {activeTab === 'customers' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <h3 className="font-bold text-slate-900 text-sm">Customer Database & Loyalty Points</h3>
                  <span className="text-xs text-slate-400">Total {customers.length} Registered Customers</span>
                </div>
                <div className="overflow-x-auto overflow-y-auto inner-scroll-container max-h-[580px] 2xl:max-h-[720px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
                    <tr>
                      <th className="py-3 px-4">Customer Name</th>
                      <th className="py-3 px-3">Phone</th>
                      <th className="py-3 px-3">Address</th>
                      <th className="py-3 px-3 text-center">Total Bills</th>
                      <th className="py-3 px-4 text-right">Loyalty Points Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customers.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-12 text-center text-[#64748B]">
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            <Users className="w-8 h-8 text-slate-300 mb-1" />
                            <span className="font-bold text-sm text-[#17365D]">No customers registered yet.</span>
                            <span className="text-xs text-slate-400">Customers will appear here when registered during POS billing checkout.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      customers.map((c) => (
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          )}

          {/* TAB 8: SALES REPORTS & ADVANCED ANALYTICS */}
          {activeTab === 'reports' && (
            <ReportsSection userRole="ADMIN" />
          )}

          {/* TAB 9: STAFF MANAGEMENT */}
          {activeTab === 'staff' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-sm">Supermarket Staff Accounts (Manager & Cashier)</h3>
                <button
                  onClick={() => setNewStaffModal(true)}
                  className="flex items-center gap-1.5 bg-[#F97316] hover:bg-[#EA580C] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Staff Account</span>
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                <div className="overflow-x-auto overflow-y-auto inner-scroll-container max-h-[580px] 2xl:max-h-[720px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
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
                                ? 'bg-[#17365D] text-white'
                                : s.role === 'MANAGER'
                                ? 'bg-[#FFF1E7] text-[#F97316] border border-[#FED7AA]'
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
                    <button type="submit" className="w-full py-2 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition">
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
                    <button type="submit" className="w-full py-2 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition">
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
            <div className="bg-[#17365D] text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">
                  {editProductModal ? 'Edit Product & Measurement' : 'Add New Grocery / Product'}
                </h3>
                <p className="text-[11px] text-slate-200 mt-0.5">
                  Configure measurement units, pricing basis (per KG / piece), and stock.
                </p>
              </div>
              <button
                onClick={() => {
                  setAddProductModal(false);
                  setEditProductModal(false);
                  setSelectedImageFile(null);
                  setImagePreview(null);
                  setImageError(null);
                  setRemoveImageFlag(false);
                }}
                className="text-white hover:opacity-80 p-1 rounded-lg cursor-pointer"
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

              {/* Product Image Field */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Product Image <span className="text-[10px] font-normal text-slate-400">(Optional — JPG, PNG, WebP up to 5 MB)</span>
                </label>

                {imagePreview ? (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="w-16 h-16 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center relative shadow-2xs">
                      <img
                        src={imagePreview}
                        alt="Product preview"
                        className="w-full h-full object-contain p-1"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {selectedImageFile ? selectedImageFile.name : (productForm.imageUrl ? 'Current Product Image' : 'Selected Image')}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {selectedImageFile ? `${(selectedImageFile.size / 1024).toFixed(1)} KB` : 'Uploaded'}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <label className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md border border-blue-200 cursor-pointer transition">
                          Change Image
                          <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/jpeg,image/png,image/webp,image/jpg"
                            className="hidden"
                            onChange={handleImageChange}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="text-[11px] font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-md border border-red-200 transition cursor-pointer"
                        >
                          Remove Image
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-3.5 text-center cursor-pointer bg-slate-50 hover:bg-blue-50/50 transition flex flex-col items-center justify-center gap-1 group"
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                    <div className="w-8 h-8 rounded-full bg-blue-100/80 group-hover:bg-blue-200 text-blue-600 flex items-center justify-center transition">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div className="text-xs">
                      <span className="font-semibold text-blue-600 hover:underline">
                        Click to choose image
                      </span>
                      <span className="text-slate-500"> from computer</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Supports JPG, JPEG, PNG, WebP (Max 5 MB)
                    </p>
                  </div>
                )}

                {imageError && (
                  <p className="text-[11px] text-red-600 font-semibold mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{imageError}</span>
                  </p>
                )}
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
                  onClick={() => {
                    setAddProductModal(false);
                    setEditProductModal(false);
                    setSelectedImageFile(null);
                    setImagePreview(null);
                    setImageError(null);
                    setRemoveImageFlag(false);
                  }}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingImage}
                  className="px-5 py-1.5 bg-[#F97316] hover:bg-[#EA580C] disabled:bg-orange-300 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  {isUploadingImage && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isUploadingImage ? 'Uploading Image...' : (editProductModal ? 'Update Product' : 'Create Product')}</span>
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
            <div className="bg-[#17365D] text-white p-4 flex items-center justify-between">
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
                  className="px-4 py-2 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer transition"
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
            <div className="bg-[#17365D] text-white p-4 flex items-center justify-between">
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
                  className="px-4 py-1.5 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-xs"
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
            <div className="bg-[#17365D] text-white p-4 flex items-center justify-between">
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
                <button type="submit" className="px-4 py-1.5 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-xs">
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
            <div className="bg-[#17365D] text-white p-4 flex items-center justify-between">
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
                <button type="submit" className="px-4 py-1.5 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-xs">
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
            <div className="bg-[#17365D] text-white p-4 flex items-center justify-between">
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
                <button type="submit" className="px-4 py-1.5 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-xs">
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OFFICIAL BILLING RECEIPT PREVIEW MODAL */}
      {previewBill && (
        <div className="receipt-modal-backdrop fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <div className={`receipt-modal-container bg-white rounded-2xl ${receiptFormat === 'A4' ? 'max-w-4xl' : receiptFormat === '85mm' ? 'max-w-lg' : 'max-w-md'} w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[96vh] transition-all`}>
            {/* Header bar */}
            <div className="no-print bg-[#153B7A] text-white p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-2">
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

      {/* Portal to #pos-print-portal outside #root for isolated zero-blank-page printing */}
      {previewBill && typeof document !== 'undefined' && document.getElementById('pos-print-portal') && (
        createPortal(
          <div id="printable-receipt-wrapper" className="flex justify-center w-full">
            <ReceiptComponent
              bill={previewBill}
              receiptFormat={receiptFormat}
              showWatermark={showWatermark}
              cashierName={previewBill.cashier?.fullName || 'Cashier'}
            />
          </div>,
          document.getElementById('pos-print-portal')
        )
      )}

      {/* ANANTHA STORES Advanced AI Business Assistant */}
      <AnanthaAIAssistant pageContext={activeTab} />

      {/* POS Notification & Feedback Toast System */}
      <PosToastContainer />

      {/* Global Quick Search Modal (Ctrl+K) Portal */}
      {quickSearchOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center pt-20 p-4 z-[9999] animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setQuickSearchOpen(false);
              setQuickSearchTerm('');
            }
          }}
        >
          <div 
            className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-[#D9E2EF] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Bar */}
            <div className="p-4 border-b border-[#D9E2EF] bg-[#F3F6FA] flex items-center gap-3">
              <Search className="w-5 h-5 text-[#F97316] shrink-0" />
              <input
                type="text"
                autoFocus
                value={quickSearchTerm}
                onChange={(e) => setQuickSearchTerm(e.target.value)}
                placeholder="Search modules, products (English/தமிழ்), or actions..."
                className="w-full bg-transparent text-sm text-[#17365D] placeholder-[#64748B] focus:outline-none font-medium"
              />
              {quickSearchTerm && (
                <button
                  type="button"
                  onClick={() => setQuickSearchTerm('')}
                  className="p-1 rounded-md text-[#64748B] hover:text-[#17365D] hover:bg-slate-200/60 transition cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <kbd 
                onClick={() => { setQuickSearchOpen(false); setQuickSearchTerm(''); }}
                className="px-2 py-0.5 bg-white border border-[#D9E2EF] hover:bg-slate-50 rounded text-[11px] font-mono font-bold text-[#64748B] cursor-pointer shadow-2xs"
              >
                ESC
              </kbd>
            </div>

            {/* Results Content Area */}
            {(() => {
              const term = quickSearchTerm.trim().toLowerCase();
              
              const allModules = [
                { id: 'dashboard', label: 'Dashboard Overview', tamil: 'டாஷ்போர்டு மேலோட்டம்', icon: LayoutDashboard, keywords: ['dashboard', 'overview', 'analytics', 'today sales', 'kpi', 'summary'] },
                { id: 'billing', label: 'Billing / POS Terminal', tamil: 'பில்லிங் கவுண்டர்', icon: Receipt, action: onOpenBilling, keywords: ['pos', 'terminal', 'billing', 'cashier', 'checkout', 'counter', 'sale'] },
                { id: 'products', label: 'Products & Price Master', tamil: 'பொருட்கள் & விலை விபரம்', icon: ShoppingBag, keywords: ['products', 'pricing', 'mrp', 'items', 'catalog', 'cost', 'edit price'] },
                { id: 'barcodes', label: 'Barcode Management', tamil: 'பார்கோடு மேலாண்மை', icon: QrCode, keywords: ['barcode', 'labels', 'print barcode', 'sticker', 'code128', 'stickers'] },
                { id: 'import', label: 'Excel/CSV Bulk Import', tamil: 'எக்செல் இறக்குமதி', icon: FileSpreadsheet, keywords: ['import', 'excel', 'csv', 'upload spreadsheet', 'bulk import'] },
                { id: 'inventory', label: 'Inventory & Stock Alerts', tamil: 'சரக்கு இருப்பு & எச்சரிக்கை', icon: Boxes, keywords: ['inventory', 'stock', 'low stock', 'reorder', 'adjust stock', 'movements'] },
                { id: 'suppliers', label: 'Suppliers Management', tamil: 'சப்ளையர் மேலாண்மை', icon: Truck, keywords: ['suppliers', 'vendors', 'dealers', 'distributors'] },
                { id: 'purchases', label: 'Purchase Invoices', tamil: 'கொள்முதல் இன்வாய்ஸ்', icon: Receipt, keywords: ['purchase', 'invoices', 'bills', 'grn', 'goods received'] },
                { id: 'customers', label: 'Customers & Loyalty', tamil: 'வாடிக்கையாளர் & லாயல்டி', icon: Award, keywords: ['customers', 'loyalty', 'points', 'phone', 'members'] },
                { id: 'reports', label: 'Sales Reports & Analytics', tamil: 'விற்பனை அறிக்கைகள்', icon: BarChart3, keywords: ['reports', 'profit', 'cashier report', 'product report', 'analytics'] },
                { id: 'staff', label: 'Staff Accounts', tamil: 'பணியாளர் கணக்குகள்', icon: UserCheck, keywords: ['staff', 'users', 'accounts', 'cashier login', 'roles'] },
                { id: 'settings', label: 'Settings, Backup & Audit', tamil: 'அமைப்புகள் & காப்புநகல்', icon: Settings, keywords: ['settings', 'backup', 'restore', 'audit logs', 'price history'] },
              ];

              const allActions = [
                {
                  id: 'action-add-product',
                  label: 'Add New Product',
                  tamil: 'புதிய தயாரிப்பைச் சேர்',
                  icon: Plus,
                  keywords: ['add product', 'new product', 'create product', 'new item'],
                  run: () => {
                    setProductForm({
                      name: '', tamilName: '', brand: '', categoryId: '', unit: 'pcs',
                      measurementType: 'PCS', baseUnit: 'pcs', pricePerKg: 0, packSize: '', barcode: '', sku: '',
                      purchaseCost: 0, sellingPrice: 0, currentStock: 0, minStock: 5, imageUrl: '',
                    });
                    setSelectedImageFile(null);
                    setImagePreview(null);
                    setImageError(null);
                    setRemoveImageFlag(false);
                    setAddProductModal(true);
                  }
                },
                {
                  id: 'action-open-wexa',
                  label: 'Open WEXA AI Assistant',
                  tamil: 'WEXA AI உதவியாளர்',
                  icon: Sparkles,
                  keywords: ['wexa', 'ai', 'assistant', 'chat', 'ask ai', 'weengineertech'],
                  run: () => window.dispatchEvent(new CustomEvent('open-wexa-ai'))
                },
                {
                  id: 'action-launch-pos',
                  label: 'Launch POS Billing Counter',
                  tamil: 'POS பில்லிங் திற',
                  icon: Receipt,
                  keywords: ['pos', 'launch pos', 'open pos', 'terminal', 'new bill'],
                  run: onOpenBilling
                }
              ];

              const isFiltered = term.length > 0;

              const matchedModules = isFiltered
                ? allModules.filter(m => 
                    m.label.toLowerCase().includes(term) ||
                    (m.tamil && m.tamil.includes(term)) ||
                    (m.keywords && m.keywords.some(k => k.includes(term)))
                  )
                : allModules;

              const matchedActions = isFiltered
                ? allActions.filter(a => 
                    a.label.toLowerCase().includes(term) ||
                    (a.tamil && a.tamil.includes(term)) ||
                    (a.keywords && a.keywords.some(k => k.includes(term)))
                  )
                : allActions;

              const matchedProducts = isFiltered && products.length > 0
                ? products.filter(p => 
                    (p.name && p.name.toLowerCase().includes(term)) ||
                    (p.tamilName && p.tamilName.includes(term)) ||
                    (p.barcode && p.barcode.toLowerCase().includes(term)) ||
                    (p.brand && p.brand.toLowerCase().includes(term))
                  ).slice(0, 8)
                : [];

              const totalMatches = (isFiltered ? matchedModules.length : 0) + 
                                   (isFiltered ? matchedActions.length : 0) + 
                                   matchedProducts.length;

              if (isFiltered && totalMatches === 0) {
                return (
                  <div className="p-8 text-center flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-[#FFF1E7] border border-[#FED7AA] flex items-center justify-center text-[#F97316] mb-3">
                      <Search className="w-6 h-6 text-[#F97316]" />
                    </div>
                    <p className="font-bold text-sm text-[#17365D]">No results found for &ldquo;{quickSearchTerm}&rdquo;</p>
                    <p className="text-xs text-[#64748B] mt-1 max-w-sm">
                      Try searching with product names (English or தமிழ்), barcodes, or page titles.
                    </p>
                  </div>
                );
              }

              return (
                <div className="max-h-96 overflow-y-auto p-3 divide-y divide-[#D9E2EF] text-xs">
                  {/* Actions Section */}
                  {matchedActions.length > 0 && (
                    <div className="py-2">
                      <span className="px-2 text-[10.5px] uppercase font-extrabold text-[#F97316] tracking-wider">
                        {isFiltered ? 'Matching Actions' : 'Quick Actions'}
                      </span>
                      <div className="mt-1 space-y-1">
                        {matchedActions.map((act) => {
                          const Icon = act.icon;
                          return (
                            <div
                              key={act.id}
                              onClick={() => {
                                act.run();
                                setQuickSearchOpen(false);
                                setQuickSearchTerm('');
                              }}
                              className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#FFF1E7] hover:text-[#17365D] cursor-pointer transition text-[#17365D] group"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-[#FFF1E7] group-hover:bg-[#F97316] text-[#F97316] group-hover:text-white flex items-center justify-center transition-colors">
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div>
                                  <span className="font-bold text-xs">{act.label}</span>
                                  {act.tamil && <span className="text-[11px] text-[#64748B] font-tamil ml-2">{act.tamil}</span>}
                                </div>
                              </div>
                              <span className="text-[10px] text-[#F97316] font-bold bg-[#FFF1E7] px-2 py-0.5 rounded-full border border-[#FED7AA]">
                                Action
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Modules Section */}
                  {matchedModules.length > 0 && (
                    <div className="py-2">
                      <span className="px-2 text-[10.5px] uppercase font-extrabold text-[#64748B] tracking-wider">
                        {isFiltered ? 'Matching Modules & Pages' : 'Navigation'}
                      </span>
                      <div className="mt-1 space-y-1">
                        {matchedModules.map((item) => {
                          const Icon = item.icon;
                          return (
                            <div
                              key={item.id}
                              onClick={() => {
                                if (item.action) item.action();
                                else setActiveTab(item.id);
                                setQuickSearchOpen(false);
                                setQuickSearchTerm('');
                              }}
                              className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#FFF1E7] hover:text-[#17365D] cursor-pointer transition text-[#17365D] group"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-[#F3F6FA] group-hover:bg-[#FFF1E7] text-[#17365D] group-hover:text-[#F97316] flex items-center justify-center transition-colors">
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div>
                                  <span className="font-semibold text-xs">{item.label}</span>
                                  {item.tamil && <span className="text-[11px] text-[#64748B] font-tamil ml-2">{item.tamil}</span>}
                                </div>
                              </div>
                              <span className="text-[10px] text-[#64748B] group-hover:text-[#F97316]">Open &rarr;</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Matching Products Section */}
                  {matchedProducts.length > 0 && (
                    <div className="py-2">
                      <span className="px-2 text-[10.5px] uppercase font-extrabold text-[#16A34A] tracking-wider">
                        Matching Products ({matchedProducts.length})
                      </span>
                      <div className="mt-1 space-y-1">
                        {matchedProducts.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setActiveTab('products');
                              setSearchFilter(p.name);
                              setQuickSearchOpen(false);
                              setQuickSearchTerm('');
                            }}
                            className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#FFF1E7] cursor-pointer transition text-[#17365D] group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                                {p.category?.name ? p.category.name.substring(0, 2).toUpperCase() : 'PR'}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs truncate group-hover:text-[#F97316]">{p.name}</span>
                                  {p.tamilName && <span className="text-[11px] text-[#64748B] font-tamil shrink-0">{p.tamilName}</span>}
                                </div>
                                <div className="flex items-center gap-2 text-[10.5px] text-[#64748B]">
                                  {p.barcode && <span className="font-mono">BAR: {p.barcode}</span>}
                                  {p.brand && <span>• {p.brand}</span>}
                                  <span>• Stock: {formatStockValue(p.currentStock, p.unit, p.measurementType)}</span>
                                </div>
                              </div>
                            </div>
                            <span className="font-mono font-bold text-xs text-[#F97316] shrink-0 ml-2">
                              ₹{Number(p.sellingPrice).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Modal Footer with Keyboard Help */}
            <div className="px-4 py-2.5 bg-[#F3F6FA] border-t border-[#D9E2EF] flex items-center justify-between text-[11px] text-[#64748B]">
              <div className="flex items-center gap-3">
                <span>Select to open</span>
                <span>•</span>
                <span>Type product or module name</span>
              </div>
              <div className="flex items-center gap-1">
                <span>Press</span>
                <kbd className="px-1.5 py-0.5 bg-white border border-[#D9E2EF] rounded text-[10px] font-mono font-bold text-[#64748B]">ESC</kbd>
                <span>to close</span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
