import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Store, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Smartphone, 
  Banknote, 
  PauseCircle, 
  PlayCircle, 
  Printer, 
  FileText, 
  LogOut, 
  User, 
  Edit3, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  UserPlus,
  History,
  Tag,
  DollarSign,
  Layers,
  ChevronDown,
  X,
  Package,
  Download,
  Scale
} from 'lucide-react';
import Fuse from 'fuse.js';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import Receipt from '../components/Receipt';
import {
  isWeightBased,
  isLiquidBased,
  getPriceBasis,
  getPriceBasisLabel,
  getCanonicalPrice,
  convertToCanonical,
  calculateLineTotal,
  roundMoney,
  roundPrecision,
  formatQuantityWithUnit,
} from '../utils/unitCalc';

export default function CashierBilling({ onSwitchView }) {
  const { user, logout } = useAuthStore();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [heldBills, setHeldBills] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Checkout & Payment State
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [newCustomerModalOpen, setNewCustomerModalOpen] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', phone: '', address: '' });
  
  const [redeemedPoints, setRedeemedPoints] = useState(0);
  const [loyaltySettings, setLoyaltySettings] = useState(null);
  const [appSettings, setAppSettings] = useState(null);

  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [amountReceived, setAmountReceived] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [billNotes, setBillNotes] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Weight & Measurement Selector Modal State
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [weightModalProduct, setWeightModalProduct] = useState(null);
  const [weightModalIndex, setWeightModalIndex] = useState(-1);
  const [weightInput, setWeightInput] = useState('500');
  const [weightUnit, setWeightUnit] = useState('g');

  // Rate Override Modal State
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [selectedCartItem, setSelectedCartItem] = useState(null);
  const [newRateInput, setNewRateInput] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  // Bill Completion & Thermal Receipt Modal
  const [completedBill, setCompletedBill] = useState(null);
  const [receiptFormat, setReceiptFormat] = useState('85mm'); // '50mm', '85mm', 'A4'
  const [showWatermark, setShowWatermark] = useState(true);

  // Recent Bills Modal (F6)
  const [recentBillsModalOpen, setRecentBillsModalOpen] = useState(false);
  const [recentBills, setRecentBills] = useState([]);
  const [recentBillsLoading, setRecentBillsLoading] = useState(false);

  // Search input ref for keyboard shortcut F2
  const searchInputRef = useRef(null);
  const printRef = useRef(null);

  // Load initial store data
  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchHeldBills();
    fetchStoreSettings();

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Keyboard shortcut listener: F2=Search, F4=Checkout, F6=Recent Bills, ESC=Close modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0 && !isCheckingOut) {
          handleCompleteBill();
        }
      } else if (e.key === 'F6') {
        e.preventDefault();
        openRecentBills();
      } else if (e.key === 'Escape') {
        setWeightModalOpen(false);
        setRateModalOpen(false);
        setCompletedBill(null);
        setNewCustomerModalOpen(false);
        setRecentBillsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, isCheckingOut, paymentMethod, amountReceived, discountAmount, selectedCustomer, redeemedPoints]);

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      setProducts(res.data);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/products/categories');
      setCategories(res.data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const fetchHeldBills = async () => {
    try {
      const res = await api.get('/sales/held/list');
      setHeldBills(res.data);
    } catch (err) {
      console.error('Failed to fetch held bills:', err);
    }
  };

  const fetchStoreSettings = async () => {
    try {
      const res = await api.get('/settings');
      setAppSettings(res.data.appSettings);
      setLoyaltySettings(res.data.loyaltySettings);
      if (res.data.appSettings?.receiptSize) {
        const sz = res.data.appSettings.receiptSize;
        const normalized = sz === '50mm' || sz === '58mm' ? '50mm' : sz === 'A4' ? 'A4' : '85mm';
        setReceiptFormat(normalized);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const searchCustomers = async (query) => {
    setCustomerSearch(query);
    if (!query || query.trim().length < 2) {
      setCustomers([]);
      return;
    }
    try {
      const res = await api.get(`/customers?search=${encodeURIComponent(query.trim())}`);
      setCustomers(res.data);
    } catch (err) {
      console.error('Customer search error:', err);
    }
  };

  // Configure Fuse.js for typo-tolerant product search
  const fuse = useMemo(() => {
    return new Fuse(products, {
      keys: ['name', 'tamilName', 'brand', 'category.name', 'barcode', 'sku'],
      threshold: 0.45, // Typo-tolerant: e.g. 'biscut' -> 'Biscuit', 'milkk' -> 'Milk'
      distance: 100,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
  }, [products]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    let result = products;

    if (selectedCategory !== 'All') {
      result = result.filter((p) => p.category?.name === selectedCategory);
    }

    if (searchQuery.trim()) {
      const fuseResults = fuse.search(searchQuery.trim());
      result = fuseResults.map((r) => r.item);
    }

    return result;
  }, [products, selectedCategory, searchQuery, fuse]);

  // Cart Calculations with financial paise precision
  const subtotal = useMemo(() => {
    return roundMoney(cart.reduce((sum, item) => sum + (item.lineTotal !== undefined ? item.lineTotal : (item.billedRate * item.quantity)), 0));
  }, [cart]);

  const loyaltyDiscount = useMemo(() => {
    if (!selectedCustomer || !loyaltySettings?.isEnabled || redeemedPoints <= 0) return 0;
    return redeemedPoints * parseFloat(loyaltySettings.pointsRedemptionValue || 1);
  }, [selectedCustomer, loyaltySettings, redeemedPoints]);

  const grandTotal = useMemo(() => {
    const rawTotal = subtotal - (Number(discountAmount) || 0) - loyaltyDiscount;
    return Math.max(0, roundMoney(rawTotal));
  }, [subtotal, discountAmount, loyaltyDiscount]);

  const changeAmount = useMemo(() => {
    if (paymentMethod !== 'CASH') return 0;
    const received = Number(amountReceived) || 0;
    return Math.max(0, roundMoney(received - grandTotal));
  }, [paymentMethod, amountReceived, grandTotal]);

  // Open Weight Modal for Weight-based products
  const openWeightModal = (product, existingIndex = -1) => {
    const isLiq = isLiquidBased(product);
    setWeightModalProduct(product);
    setWeightModalIndex(existingIndex);

    if (existingIndex >= 0 && cart[existingIndex]) {
      const item = cart[existingIndex];
      const initialQty = item.selectedQuantity !== undefined ? item.selectedQuantity : (item.unit === 'g' ? item.quantity * 1000 : item.quantity);
      setWeightInput(String(initialQty));
      setWeightUnit(item.selectedUnit || item.unit || (isLiq ? 'ml' : 'g'));
    } else {
      setWeightInput(isLiq ? '500' : '500');
      setWeightUnit(isLiq ? 'ml' : 'g');
    }
    setWeightModalOpen(true);
  };

  // Confirm and Save Weight Selection to Cart
  const handleSaveWeight = (customQty, customUnit) => {
    const rawQty = customQty !== undefined ? customQty : weightInput;
    const rawUnit = customUnit !== undefined ? customUnit : weightUnit;

    const numQty = parseFloat(rawQty);
    if (isNaN(numQty) || numQty <= 0) {
      alert('Please enter a valid positive quantity greater than zero.');
      return;
    }

    const product = weightModalProduct;
    if (!product) return;

    let conversion;
    try {
      conversion = convertToCanonical(numQty, rawUnit, product.measurementType);
    } catch (err) {
      alert(err.message);
      return;
    }

    const { canonicalQty, canonicalUnit, selectedQty, selectedUnit } = conversion;
    const stock = Number(product.currentStock);

    if (canonicalQty > stock) {
      alert(`Cannot add ${selectedQty} ${selectedUnit}. Only ${stock} ${canonicalUnit} available in stock!`);
      return;
    }

    const rate = getCanonicalPrice(product);
    const lineTotal = roundMoney(canonicalQty * rate);

    const updated = [...cart];
    if (weightModalIndex >= 0 && weightModalIndex < updated.length) {
      const item = updated[weightModalIndex];
      const activeRate = item.isOverridden ? item.billedRate : rate;
      const newLineTotal = roundMoney(canonicalQty * activeRate);

      updated[weightModalIndex] = {
        ...item,
        quantity: canonicalQty,
        selectedQuantity: selectedQty,
        selectedUnit: selectedUnit,
        unit: selectedUnit,
        lineTotal: newLineTotal,
      };
    } else {
      const existingIdx = updated.findIndex((i) => i.productId === product.id);
      if (existingIdx > -1) {
        const item = updated[existingIdx];
        const activeRate = item.isOverridden ? item.billedRate : rate;
        const newLineTotal = roundMoney(canonicalQty * activeRate);

        updated[existingIdx] = {
          ...item,
          quantity: canonicalQty,
          selectedQuantity: selectedQty,
          selectedUnit: selectedUnit,
          unit: selectedUnit,
          lineTotal: newLineTotal,
        };
      } else {
        updated.push({
          productId: product.id,
          name: product.name,
          tamilName: product.tamilName || product.name,
          unit: selectedUnit,
          measurementType: product.measurementType || (isWeightBased(product) ? 'KG' : isLiquidBased(product) ? 'L' : 'PCS'),
          defaultRate: rate,
          billedRate: rate,
          isOverridden: false,
          overrideReason: '',
          quantity: canonicalQty,
          selectedQuantity: selectedQty,
          selectedUnit: selectedUnit,
          priceBasis: getPriceBasis(product),
          lineTotal: lineTotal,
          currentStock: stock,
        });
      }
    }

    setCart(updated);
    setWeightModalOpen(false);
  };

  // Handle Product Select from Card or Search
  const handleProductSelect = (product) => {
    const stock = Number(product.currentStock);
    if (stock <= 0) {
      alert(`"${product.name}" is out of stock!`);
      return;
    }

    if (isWeightBased(product) || isLiquidBased(product)) {
      const existingIndex = cart.findIndex((item) => item.productId === product.id);
      openWeightModal(product, existingIndex);
    } else {
      addToCart(product);
    }
  };

  // Add piece/pack product to cart
  const addToCart = (product) => {
    const stock = Number(product.currentStock);
    if (stock <= 0) {
      alert(`"${product.name}" is out of stock!`);
      return;
    }

    if (isWeightBased(product) || isLiquidBased(product)) {
      const existingIndex = cart.findIndex((item) => item.productId === product.id);
      openWeightModal(product, existingIndex);
      return;
    }

    const sellingPrice = Number(product.sellingPrice);
    const existingIndex = cart.findIndex((item) => item.productId === product.id);

    if (existingIndex > -1) {
      const currentQty = cart[existingIndex].quantity;
      if (currentQty + 1 > stock) {
        alert(`Cannot add more. Only ${stock} items available in stock!`);
        return;
      }
      const updated = [...cart];
      const newQty = updated[existingIndex].quantity + 1;
      updated[existingIndex].quantity = newQty;
      updated[existingIndex].selectedQuantity = newQty;
      updated[existingIndex].lineTotal = roundMoney(newQty * updated[existingIndex].billedRate);
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          productId: product.id,
          name: product.name,
          tamilName: product.tamilName || product.name,
          unit: product.unit || 'pcs',
          measurementType: product.measurementType || 'PCS',
          defaultRate: sellingPrice,
          billedRate: sellingPrice,
          isOverridden: false,
          overrideReason: '',
          quantity: 1,
          selectedQuantity: 1,
          selectedUnit: product.unit || 'pcs',
          priceBasis: getPriceBasis(product),
          lineTotal: sellingPrice,
          currentStock: stock,
        },
      ]);
    }
  };

  // Update item quantity
  const updateQuantity = (index, delta) => {
    const updated = [...cart];
    const item = updated[index];
    const isWeight = isWeightBased(item);
    const isLiq = isLiquidBased(item);

    if (isWeight || isLiq) {
      const step = item.selectedUnit === 'g' || item.selectedUnit === 'ml' ? 100 : 0.25;
      const newSelQty = Math.round(((item.selectedQuantity || 100) + delta * step) * 1000) / 1000;
      if (newSelQty <= 0) {
        updated.splice(index, 1);
        setCart(updated);
        return;
      }
      try {
        const { canonicalQty, selectedQty, selectedUnit } = convertToCanonical(newSelQty, item.selectedUnit, item.measurementType);
        if (canonicalQty > item.currentStock) {
          alert(`Stock limit reached! Only ${item.currentStock} ${item.unit} available in stock.`);
          return;
        }
        item.quantity = canonicalQty;
        item.selectedQuantity = selectedQty;
        item.selectedUnit = selectedUnit;
        item.lineTotal = roundMoney(canonicalQty * item.billedRate);
        setCart(updated);
      } catch (err) {
        alert(err.message);
      }
    } else {
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        updated.splice(index, 1);
      } else {
        if (newQty > item.currentStock) {
          alert(`Stock limit reached! Only ${item.currentStock} available in stock.`);
          return;
        }
        item.quantity = newQty;
        item.selectedQuantity = newQty;
        item.lineTotal = roundMoney(newQty * item.billedRate);
      }
      setCart(updated);
    }
  };

  // Remove item
  const removeFromCart = (index) => {
    const updated = [...cart];
    updated.splice(index, 1);
    setCart(updated);
  };

  // Clear cart
  const clearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm('Clear all items from the current bill?')) {
      setCart([]);
      setDiscountAmount(0);
      setRedeemedPoints(0);
      setAmountReceived('');
      setBillNotes('');
    }
  };

  // Hold current bill in database
  const handleHoldBill = async () => {
    if (cart.length === 0) return;
    try {
      const billData = {
        cart,
        customer: selectedCustomer,
        discountAmount,
        notes: billNotes,
      };
      await api.post('/sales/held', {
        billData,
        customerName: selectedCustomer ? selectedCustomer.name : 'Walk-in',
        totalAmount: grandTotal,
      });
      fetchHeldBills();
      setCart([]);
      setSelectedCustomer(null);
      setDiscountAmount(0);
      setRedeemedPoints(0);
      setAmountReceived('');
      setBillNotes('');
      alert('Bill held successfully.');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to hold bill');
    }
  };

  // Restore held bill from database
  const handleRestoreBill = async (held) => {
    try {
      let data = held.billData;
      if (typeof data === 'string') {
        data = JSON.parse(data);
      }
      setCart(data.cart || []);
      setSelectedCustomer(data.customer || null);
      setDiscountAmount(data.discountAmount || 0);
      setBillNotes(data.notes || '');

      await api.delete(`/sales/held/${held.id}`);
      fetchHeldBills();
    } catch (err) {
      alert('Failed to restore held bill');
    }
  };

  // Open Rate Change Dialog
  const openRateModal = (item, index) => {
    setSelectedCartItem({ ...item, cartIndex: index });
    setNewRateInput(String(item.billedRate));
    setOverrideReason(item.overrideReason || '');
    setRateModalOpen(true);
  };

  // Save Rate Change
  const handleSaveRate = () => {
    const rate = parseFloat(newRateInput);
    if (isNaN(rate) || rate < 0) {
      alert('Please enter a valid positive billing rate.');
      return;
    }

    if (rate === 0 && !appSettings?.zeroPriceAllowed) {
      alert('Store policy prohibits zero-price billing.');
      return;
    }

    const minAllowedPct = parseFloat(appSettings?.minAllowedPricePercentage || 50);
    const minPermitted = (selectedCartItem.defaultRate * minAllowedPct) / 100;
    if (rate < minPermitted) {
      alert(`Rate cannot be below ₹${minPermitted.toFixed(2)} (${minAllowedPct}% of default rate).`);
      return;
    }

    if (appSettings?.requireOverrideReason && !overrideReason.trim()) {
      alert('Please specify a reason for changing the billing rate.');
      return;
    }

    const updated = [...cart];
    const idx = selectedCartItem.cartIndex;
    const isModified = Math.abs(rate - updated[idx].defaultRate) > 0.001;

    updated[idx].billedRate = rate;
    updated[idx].isOverridden = isModified;
    updated[idx].overrideReason = isModified ? overrideReason.trim() : '';
    updated[idx].lineTotal = roundMoney(updated[idx].quantity * rate);

    setCart(updated);
    setRateModalOpen(false);
  };

  // Create new customer
  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/customers', newCustomerForm);
      setSelectedCustomer(res.data);
      setNewCustomerModalOpen(false);
      setNewCustomerForm({ name: '', phone: '', address: '' });
      alert(`Customer ${res.data.name} added successfully.`);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add customer');
    }
  };

  // Complete Bill & Checkout via Backend Transaction
  const handleCompleteBill = async () => {
    if (cart.length === 0) {
      alert('Cart is empty. Please add items to complete bill.');
      return;
    }

    if (paymentMethod === 'CASH') {
      const received = Number(amountReceived) || 0;
      if (received < grandTotal) {
        alert(`Insufficient cash. Grand Total is ₹${grandTotal.toFixed(2)}, received ₹${received.toFixed(2)}.`);
        return;
      }
    }

    setIsCheckingOut(true);
    try {
      const payload = {
        customerId: selectedCustomer ? selectedCustomer.id : null,
        items: cart.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unit: i.selectedUnit || i.unit,
          selectedQuantity: i.selectedQuantity,
          selectedUnit: i.selectedUnit,
          billedRate: i.billedRate,
          overrideReason: i.overrideReason,
        })),
        discountTotal: Number(discountAmount) || 0,
        paymentMethod,
        amountReceived: paymentMethod === 'CASH' ? Number(amountReceived) : grandTotal,
        redeemedPoints: Number(redeemedPoints) || 0,
        notes: billNotes,
      };

      const res = await api.post('/sales/checkout', payload);
      const completed = res.data.sale;
      completed.earnedPoints = res.data.earnedPoints || 0;

      setCompletedBill(completed);

      // Refresh product stock after checkout
      fetchProducts();

      // Reset cart
      setCart([]);
      setSelectedCustomer(null);
      setDiscountAmount(0);
      setRedeemedPoints(0);
      setAmountReceived('');
      setBillNotes('');
    } catch (err) {
      alert(err.response?.data?.error || 'Checkout failed.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Open Recent Bills Modal (F6)
  const openRecentBills = async () => {
    setRecentBillsModalOpen(true);
    setRecentBillsLoading(true);
    try {
      const res = await api.get('/sales?limit=20');
      setRecentBills(res.data.sales);
    } catch (err) {
      console.error(err);
    } finally {
      setRecentBillsLoading(false);
    }
  };

  // Reprint previous bill
  const handleReprintBill = (sale) => {
    setCompletedBill(sale);
    setRecentBillsModalOpen(false);
  };

  // Safe print handler
  const handlePrint = async () => {
    if (window.electronAPI?.printBill) {
      try {
        const result = await window.electronAPI.printBill({ silent: false, receiptFormat });
        if (result && result.success) return;
      } catch (err) {
        console.warn('Electron printBill failed, falling back to window.print():', err);
      }
    }
    window.print();
  };

  // Download PDF Handler with selectable text
  const handleDownloadPdf = async () => {
    if (!completedBill) return;
    const defaultName = `ANANTHA-STORES-BILL-${completedBill.billNumber}.pdf`;

    if (window.electronAPI?.saveToPdf) {
      try {
        const result = await window.electronAPI.saveToPdf({ filename: defaultName, receiptFormat });
        if (result && result.success) {
          alert(`Receipt PDF saved successfully:\n${result.filePath}`);
          return;
        } else if (result && result.canceled) {
          return;
        }
      } catch (err) {
        console.warn('Native PDF save error, falling back to print dialog:', err);
      }
    }

    // Web fallback: triggers print dialog which provides "Save as PDF" with vector selectable text
    window.print();
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#F1F5F9] text-[#0F172A] select-none overflow-hidden">
      {/* Top Application Bar */}
      <header className="h-14 bg-[#0F172A] text-white px-5 flex items-center justify-between border-b border-slate-800 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-sm ring-1 ring-blue-400/40">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-wider text-white">ANANTHA STORES</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-semibold">
                BILLING POS
              </span>
            </div>
            <p className="text-[10px] text-blue-200/90 font-tamil font-semibold leading-tight">
              ஆனந்தா ஸ்டோர்
            </p>
          </div>
        </div>

        {/* Global Live Bar */}
        <div className="flex items-center gap-3">
          {/* Recent Bills (F6) */}
          <button
            type="button"
            onClick={openRecentBills}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 px-2.5 py-1 rounded-md text-xs font-semibold transition"
            title="View Recent Bills (F6)"
          >
            <History className="w-3.5 h-3.5 text-blue-400" />
            <span>Recent Bills [F6]</span>
          </button>

          {/* Held Bills Badge */}
          {heldBills.length > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-400/30 px-2.5 py-1 rounded-md text-xs font-semibold animate-pulse">
              <PauseCircle className="w-3.5 h-3.5" />
              <span>Held Bills: {heldBills.length}</span>
            </div>
          )}

          {/* Clock */}
          <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1 rounded-md border border-slate-700/60 text-xs font-mono text-slate-300">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>{currentTime.toLocaleTimeString('en-IN')}</span>
          </div>

          {/* Cashier Profile */}
          <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1 rounded-md border border-slate-700/60 text-xs text-slate-300">
            <User className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-medium text-white">{user?.fullName || 'Cashier'}</span>
            <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-300 font-semibold uppercase">
              {user?.role}
            </span>
          </div>

          {/* If user is Admin or Manager, allow switching back to Dashboard */}
          {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && onSwitchView && (
            <button
              onClick={onSwitchView}
              className="text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-md border border-slate-700 transition"
            >
              Back to Dashboard
            </button>
          )}

          {/* Logout Button */}
          <button
            onClick={logout}
            className="flex items-center gap-1.5 bg-red-600/90 hover:bg-red-700 active:scale-95 text-white px-2.5 py-1 rounded-md text-xs font-semibold transition shadow-sm"
            title="Logout Cashier"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main 3-Column POS Workspace */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden p-3 gap-3">
        {/* ======================================================== */}
        {/* COLUMN 1: Product Search & Product Grid (Cols 1 - 4)    */}
        {/* ======================================================== */}
        <div className="col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          {/* Search Header */}
          <div className="p-3 border-b border-slate-100 space-y-2 bg-slate-50/70">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products... (e.g. biscut, milk, rice) [F2]"
                className="w-full pl-9 pr-7 py-2 bg-white border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
              {['All', ...categories.map((c) => c.name)].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Cards Grid */}
          <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2.5 content-start">
            {filteredProducts.length === 0 ? (
              <div className="col-span-2 py-12 text-center text-slate-400">
                <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-semibold">No matching products found</p>
                <p className="text-[11px] text-slate-400 mt-1">Try another search term or category</p>
              </div>
            ) : (
              filteredProducts.map((product) => {
                const stock = Number(product.currentStock);
                const isOutOfStock = stock <= 0;
                const isWeight = isWeightBased(product);
                const isLiq = isLiquidBased(product);

                return (
                  <div
                    key={product.id}
                    onClick={() => !isOutOfStock && handleProductSelect(product)}
                    className={`group bg-white border rounded-xl p-2.5 flex flex-col justify-between transition shadow-xs ${
                      isOutOfStock
                        ? 'opacity-60 cursor-not-allowed border-slate-200 bg-slate-50'
                        : 'hover:bg-blue-50/40 border-slate-200/90 hover:border-blue-300 cursor-pointer hover:shadow-sm'
                    }`}
                  >
                    <div>
                      {/* Product Image */}
                      <div className="w-full h-24 bg-slate-50 rounded-lg mb-2 overflow-hidden flex items-center justify-center border border-slate-100 relative group-hover:border-blue-200">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-contain p-1"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const fallback = e.currentTarget.parentElement.querySelector('.img-fallback');
                              if (fallback) fallback.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`img-fallback w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400 ${product.imageUrl ? 'hidden' : ''}`}>
                          {isWeight ? (
                            <Scale className="w-7 h-7 text-amber-500/50 mb-1" />
                          ) : (
                            <Package className="w-7 h-7 text-blue-500/40 mb-1" />
                          )}
                          <span className="text-[9px] text-slate-500 font-medium">
                            {product.category?.name || 'Product'}
                          </span>
                        </div>

                        {/* Weight or Liquid Badge */}
                        {isWeight && (
                          <span className="absolute top-1 left-1 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs flex items-center gap-0.5">
                            <Scale className="w-2.5 h-2.5" />
                            <span>By Weight</span>
                          </span>
                        )}
                        {isLiq && (
                          <span className="absolute top-1 left-1 bg-cyan-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                            By Volume
                          </span>
                        )}
                      </div>

                      <div className="flex items-start justify-between gap-1">
                        <span className="text-[10px] text-slate-500 font-semibold truncate max-w-[85px]">
                          {product.brand || product.category?.name || 'General'}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                          isOutOfStock
                            ? 'bg-red-100 text-red-700'
                            : stock <= Number(product.minStock)
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {isOutOfStock ? 'Out of Stock' : isWeight ? `Stock: ${stock.toFixed(2)} kg` : `Stock: ${Math.floor(stock)}`}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 mt-1 leading-snug group-hover:text-blue-700 line-clamp-2">
                        {product.name}
                      </h4>

                      {product.tamilName && (
                        <p className="text-[11px] text-slate-600 font-tamil mt-0.5 line-clamp-1">
                          {product.tamilName}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                      <div>
                        {isWeight ? (
                          <>
                            <span className="text-[10px] text-amber-700 font-bold block -mb-0.5">Price per KG</span>
                            <span className="text-sm font-extrabold text-slate-900 font-mono">
                              ₹{Number(product.pricePerKg || product.sellingPrice).toFixed(2)}
                              <span className="text-[10px] text-slate-500 font-normal">/kg</span>
                            </span>
                          </>
                        ) : isLiq ? (
                          <>
                            <span className="text-[10px] text-cyan-700 font-bold block -mb-0.5">Price per L</span>
                            <span className="text-sm font-extrabold text-slate-900 font-mono">
                              ₹{Number(product.sellingPrice).toFixed(2)}
                              <span className="text-[10px] text-slate-500 font-normal">/L</span>
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] text-slate-400 block -mb-0.5">{product.unit || 'pcs'}</span>
                            <span className="text-sm font-extrabold text-slate-900 font-mono">
                              ₹{Number(product.sellingPrice).toFixed(2)}
                            </span>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isOutOfStock}
                        className={`w-7 h-7 rounded-lg text-white flex items-center justify-center shadow-sm active:scale-95 transition disabled:opacity-30 ${
                          isWeight ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                        title={isWeight ? 'Select Weight' : 'Add to Bill'}
                      >
                        {isWeight ? <Scale className="w-3.5 h-3.5" /> : <Plus className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMN 2: Current Bill & Cart (Cols 5 - 8)               */}
        {/* ======================================================== */}
        <div className="col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          {/* Bill Header */}
          <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800">Current Register</span>
              <span className="text-xs text-slate-400">• New Bill</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleHoldBill}
                disabled={cart.length === 0}
                className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-semibold flex items-center gap-1 transition disabled:opacity-50"
                title="Hold Current Bill"
              >
                <PauseCircle className="w-3.5 h-3.5" />
                <span>Hold</span>
              </button>

              <button
                type="button"
                onClick={clearCart}
                disabled={cart.length === 0}
                className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold flex items-center gap-1 transition disabled:opacity-50"
                title="Clear Cart"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            </div>
          </div>

          {/* Held Bills Bar if any */}
          {heldBills.length > 0 && (
            <div className="bg-amber-50/90 border-b border-amber-200 px-3 py-1.5 flex items-center gap-2 overflow-x-auto text-xs">
              <span className="font-semibold text-amber-800 shrink-0 text-[11px]">Held Bills:</span>
              {heldBills.map((b) => (
                <button
                  key={b.id}
                  onClick={() => handleRestoreBill(b)}
                  className="bg-white hover:bg-amber-100 border border-amber-300 rounded px-2 py-0.5 text-amber-900 font-mono text-[11px] font-semibold flex items-center gap-1 transition shrink-0"
                >
                  <PlayCircle className="w-3 h-3 text-amber-600" />
                  <span>{b.customerName || 'Held'} (₹{Number(b.totalAmount).toFixed(0)})</span>
                </button>
              ))}
            </div>
          )}

          {/* Cart Items Table */}
          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6">
                <ShoppingBag className="w-12 h-12 stroke-1 mb-2 text-slate-300" />
                <p className="text-sm font-semibold text-slate-600">Cart is empty</p>
                <p className="text-xs text-slate-400 mt-1 text-center">
                  Search or click products on the left panel to add to bill
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold sticky top-0 border-b border-slate-200 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Item Details</th>
                    <th className="py-2.5 px-2 text-center w-24">Qty</th>
                    <th className="py-2.5 px-2 text-right w-24">Rate (₹)</th>
                    <th className="py-2.5 px-3 text-right w-24">Amount (₹)</th>
                    <th className="py-2.5 px-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cart.map((item, index) => {
                    const lineTotal = item.lineTotal !== undefined ? item.lineTotal : roundMoney(item.billedRate * item.quantity);
                    const isWeight = isWeightBased(item);
                    const isLiq = isLiquidBased(item);

                    return (
                      <tr key={index} className="hover:bg-slate-50/80 transition">
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-900 leading-tight">
                            {item.name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-tamil leading-tight">
                            {item.tamilName}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            {isWeight && (
                              <span className="text-[9.5px] bg-amber-50 text-amber-800 border border-amber-200 px-1 rounded font-semibold flex items-center gap-0.5">
                                <Scale className="w-2.5 h-2.5" />
                                <span>Weight Grocery</span>
                              </span>
                            )}
                            {item.isOverridden && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 rounded font-medium">
                                <Sparkles className="w-2.5 h-2.5" /> Rate Modified (Default: ₹{item.defaultRate.toFixed(2)})
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Quantity / Weight Controls */}
                        <td className="py-2 px-2">
                          {isWeight || isLiq ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => updateQuantity(index, -1)}
                                className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold active:scale-95"
                                title="Decrease"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const p = products.find((prod) => prod.id === item.productId) || item;
                                  openWeightModal(p, index);
                                }}
                                className="px-2 py-0.5 rounded-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-900 font-mono font-bold text-xs cursor-pointer shadow-2xs transition whitespace-nowrap"
                                title="Click to edit quantity or unit"
                              >
                                {item.selectedQuantity !== undefined ? item.selectedQuantity : item.quantity} {item.selectedUnit || item.unit}
                              </button>
                              <button
                                type="button"
                                onClick={() => updateQuantity(index, 1)}
                                className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold active:scale-95"
                                title="Increase"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => updateQuantity(index, -1)}
                                className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold active:scale-95"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-6 text-center font-mono font-bold text-slate-800">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(index, 1)}
                                className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold active:scale-95"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Rate with Manual Override Trigger */}
                        <td className="py-2 px-2 text-right font-mono">
                          <button
                            type="button"
                            onClick={() => openRateModal(item, index)}
                            className="inline-flex items-center gap-1 hover:text-blue-600 font-bold group text-slate-800"
                            title="Click to change rate for this bill"
                          >
                            <span>
                              ₹{item.billedRate.toFixed(2)}
                              {isWeight ? <span className="text-[10px] text-slate-500 font-normal">/kg</span> : isLiq ? <span className="text-[10px] text-slate-500 font-normal">/L</span> : null}
                            </span>
                            <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-blue-500" />
                          </button>
                        </td>

                        {/* Line Amount */}
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          ₹{lineTotal.toFixed(2)}
                        </td>

                        {/* Remove Action */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeFromCart(index)}
                            className="text-slate-300 hover:text-red-500 transition"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Cart Footer Summary */}
          <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Total Items: <strong className="text-slate-900">{cart.reduce((s, i) => s + i.quantity, 0)}</strong> ({cart.length} unique)
            </span>
            <span className="text-slate-700 font-mono">
              Cart Subtotal: <strong className="text-sm font-bold text-slate-900">₹{subtotal.toFixed(2)}</strong>
            </span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMN 3: Customer, Payment & Checkout (Cols 9 - 12)    */}
        {/* ======================================================== */}
        <div className="col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="p-3.5 space-y-3 overflow-y-auto">
            {/* Customer Selector & Loyalty */}
            <div className="space-y-1.5 pb-2.5 border-b border-slate-100 relative">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Customer & Loyalty
                </label>
                <button
                  type="button"
                  onClick={() => setNewCustomerModalOpen(true)}
                  className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-0.5"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>+ New</span>
                </button>
              </div>

              {selectedCustomer ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-blue-950">{selectedCustomer.name}</div>
                    <div className="text-[11px] text-blue-700 font-mono">{selectedCustomer.phone}</div>
                    <div className="text-[10px] text-emerald-700 font-bold mt-0.5">
                      Points Balance: {Number(selectedCustomer.loyaltyBalance).toFixed(0)} pts
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setRedeemedPoints(0);
                    }}
                    className="text-blue-500 hover:text-red-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      searchCustomers(e.target.value);
                      setCustomerDropdownOpen(true);
                    }}
                    onFocus={() => setCustomerDropdownOpen(true)}
                    placeholder="Search by phone or name..."
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                  {customerDropdownOpen && customers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-40 overflow-y-auto text-xs divide-y divide-slate-100">
                      {customers.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedCustomer(c);
                            setCustomerDropdownOpen(false);
                            setCustomerSearch('');
                          }}
                          className="p-2 hover:bg-blue-50 cursor-pointer flex justify-between items-center"
                        >
                          <div>
                            <span className="font-bold text-slate-800">{c.name}</span>
                            <span className="text-[11px] text-slate-400 block font-mono">{c.phone}</span>
                          </div>
                          <span className="text-[10px] text-emerald-600 font-bold font-mono">
                            {Number(c.loyaltyBalance).toFixed(0)} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Redeem points option */}
              {selectedCustomer && Number(selectedCustomer.loyaltyBalance) >= Number(loyaltySettings?.minRedemptionPoints || 10) && (
                <div className="pt-1 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-600 font-medium">Redeem Points:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max={Number(selectedCustomer.loyaltyBalance)}
                      value={redeemedPoints || ''}
                      onChange={(e) => setRedeemedPoints(Math.min(Number(selectedCustomer.loyaltyBalance), parseFloat(e.target.value) || 0))}
                      placeholder="0"
                      className="w-16 px-1.5 py-0.5 text-right bg-white border border-slate-300 rounded text-xs font-mono font-bold"
                    />
                    <span className="text-[11px] text-emerald-600 font-bold">(-₹{loyaltyDiscount.toFixed(0)})</span>
                  </div>
                </div>
              )}
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal (கூட்டுத் தொகை)</span>
                <span className="font-mono font-medium text-slate-800">₹{subtotal.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between text-slate-500">
                <span>Discount (தள்ளுபடி ₹)</span>
                <input
                  type="number"
                  min="0"
                  value={discountAmount || ''}
                  onChange={(e) => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0.00"
                  className="w-20 px-2 py-0.5 text-right bg-slate-50 border border-slate-200 rounded text-xs font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              {loyaltyDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Loyalty Discount</span>
                  <span className="font-mono font-bold">-₹{loyaltyDiscount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Tax (GST)</span>
                <span>₹0.00 (Exempt)</span>
              </div>
            </div>

            {/* Grand Total Box (Prominent) */}
            <div className="bg-gradient-to-br from-blue-700 to-blue-600 rounded-xl p-3 text-white shadow-md">
              <div className="flex items-center justify-between text-blue-200 text-xs font-semibold">
                <span>செலுத்த வேண்டிய மொத்தம்</span>
                <span>GRAND TOTAL</span>
              </div>
              <div className="text-2xl font-black font-mono tracking-tight mt-1 text-white">
                ₹{grandTotal.toFixed(2)}
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Payment Method (பணம் செலுத்தும் முறை)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'CASH', label: 'Cash (ரொக்கம்)', icon: Banknote },
                  { id: 'UPI', label: 'UPI / QR', icon: Smartphone },
                  { id: 'CARD', label: 'Card (அட்டை)', icon: CreditCard },
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      className={`py-2 px-1 rounded-lg border text-center font-bold text-xs flex flex-col items-center gap-1 transition ${
                        paymentMethod === m.id
                          ? 'bg-blue-50 border-blue-600 text-blue-700 ring-1 ring-blue-600'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[10px]">{m.id}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cash Tender & Change Calculator */}
            {paymentMethod === 'CASH' && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Received (பெற்ற தொகை):</span>
                  <input
                    type="number"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    placeholder={grandTotal.toFixed(2)}
                    className="w-24 px-2 py-1 text-right bg-white border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 font-semibold">
                  <span className="text-slate-600">Change (மீதித் தொகை):</span>
                  <span className={`font-mono text-sm font-extrabold ${changeAmount > 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                    ₹{changeAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Complete Bill Action Button */}
          <div className="p-3 border-t border-slate-100 bg-slate-50 space-y-1.5">
            <button
              type="button"
              onClick={handleCompleteBill}
              disabled={cart.length === 0 || isCheckingOut}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-sm font-extrabold shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 transition duration-150 disabled:opacity-50"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{isCheckingOut ? 'Completing Sale...' : 'Complete Bill & Print (F4)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL 0: AUTOMATIC WEIGHT & QUANTITY SELECTOR MODAL      */}
      {/* ======================================================== */}
      {weightModalOpen && weightModalProduct && (() => {
        const product = weightModalProduct;
        const isLiq = isLiquidBased(product);
        const ratePerUnit = getCanonicalPrice(product);
        const stock = Number(product.currentStock);
        const numInput = parseFloat(weightInput) || 0;
        
        let convInfo = null;
        let lineTotalCalc = 0;
        let isOverStock = false;
        try {
          if (numInput > 0) {
            convInfo = convertToCanonical(numInput, weightUnit, product.measurementType);
            lineTotalCalc = roundMoney(convInfo.canonicalQty * ratePerUnit);
            isOverStock = convInfo.canonicalQty > stock;
          }
        } catch {
          // ignore parsing error during typing
        }

        const quickButtons = isLiq
          ? [
              { label: '1 L', qty: '1', unit: 'l' },
              { label: '500 ml', qty: '500', unit: 'ml' },
              { label: '250 ml', qty: '250', unit: 'ml' },
              { label: '200 ml', qty: '200', unit: 'ml' },
              { label: '150 ml', qty: '150', unit: 'ml' },
              { label: '100 ml', qty: '100', unit: 'ml' },
              { label: '50 ml', qty: '50', unit: 'ml' },
            ]
          : [
              { label: '1 kg', qty: '1', unit: 'kg' },
              { label: '500 g', qty: '500', unit: 'g' },
              { label: '250 g', qty: '250', unit: 'g' },
              { label: '200 g', qty: '200', unit: 'g' },
              { label: '150 g', qty: '150', unit: 'g' },
              { label: '100 g', qty: '100', unit: 'g' },
              { label: '50 g', qty: '50', unit: 'g' },
            ];

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
              {/* Modal Header */}
              <div className="bg-[#153B7A] text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <Scale className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm leading-tight">
                      {isLiq ? 'Select Volume / Quantity' : 'Automatic Weight-Based Pricing'}
                    </h3>
                    <p className="text-[11px] text-blue-200">
                      {isLiq ? 'திரவ அளவு தேர்வு' : 'எடை தேர்வு & தானியங்கி விலை கணக்கீடு'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setWeightModalOpen(false)}
                  className="text-blue-200 hover:text-white font-bold p-1"
                  title="Close (ESC)"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto">
                {/* Product Info Card */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                      {product.brand || product.category?.name || 'Grocery'}
                    </span>
                    <h4 className="font-extrabold text-slate-900 text-sm">{product.name}</h4>
                    {product.tamilName && (
                      <p className="text-xs text-slate-600 font-tamil mt-0.5">{product.tamilName}</p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-500 block">Configured Price</span>
                    <span className="text-base font-black text-[#153B7A] font-mono">
                      ₹{ratePerUnit.toFixed(2)}
                      <span className="text-xs font-normal text-slate-500">{isLiq ? '/L' : '/kg'}</span>
                    </span>
                    <div className="mt-0.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        stock <= 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        Available Stock: {stock.toFixed(2)} {isLiq ? 'L' : 'kg'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Select Buttons */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                      <span>Quick Select Weights</span>
                      <span className="text-[10px] text-slate-400 font-normal font-tamil">(விரைவு தேர்வு)</span>
                    </label>
                    <span className="text-[11px] text-blue-600 font-medium">Click to pick</span>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                    {quickButtons.map((btn) => {
                      const isSelected = weightInput === btn.qty && weightUnit === btn.unit;
                      return (
                        <button
                          key={btn.label}
                          type="button"
                          onClick={() => {
                            setWeightInput(btn.qty);
                            setWeightUnit(btn.unit);
                          }}
                          className={`py-2 px-1 rounded-lg border text-xs font-bold font-mono transition text-center ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600 text-white shadow-xs scale-102 ring-2 ring-blue-300'
                              : 'bg-white hover:bg-blue-50 border-slate-200 text-slate-700 hover:border-blue-300 active:scale-95'
                          }`}
                        >
                          {btn.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Weight Entry Input with Unit Toggle */}
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Custom Quantity Entry (சுய எடை உள்ளீடு)
                  </label>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        step="any"
                        min="0.001"
                        autoFocus
                        value={weightInput}
                        onChange={(e) => setWeightInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveWeight();
                          }
                        }}
                        placeholder="e.g. 75, 125, 250, 1.25..."
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-base font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-2xs"
                      />
                    </div>

                    {/* Clear Unit Toggle Buttons (Avoid 0.5kg vs 0.5g ambiguity) */}
                    <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 shrink-0">
                      {(isLiq ? ['ml', 'l'] : ['g', 'kg']).map((u) => {
                        const active = weightUnit.toLowerCase() === u.toLowerCase();
                        return (
                          <button
                            key={u}
                            type="button"
                            onClick={() => setWeightUnit(u)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase font-mono transition ${
                              active
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {u === 'g' ? 'Grams (g)' : u === 'kg' ? 'Kilograms (kg)' : u === 'ml' ? 'Millilitres (ml)' : 'Litres (L)'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] px-1 text-slate-500">
                    <span>
                      Selected Unit: <strong className="text-blue-700 font-bold">{weightUnit.toUpperCase()}</strong>
                      {weightUnit === 'g' ? ' (1000 g = 1 kg)' : ' (Canonical Unit: KG)'}
                    </span>
                    {convInfo && (
                      <span className="font-mono font-semibold text-slate-700">
                        {convInfo.selectedQty} {convInfo.selectedUnit} = {convInfo.canonicalQty} {convInfo.canonicalUnit}
                      </span>
                    )}
                  </div>
                </div>

                {/* Calculation Summary Card */}
                <div className={`p-3.5 rounded-xl border transition ${
                  isOverStock 
                    ? 'bg-red-50 border-red-200 text-red-800' 
                    : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                }`}>
                  <div className="flex items-center justify-between mb-1.5 text-xs">
                    <span className="font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Automatic Calculation (கணக்கீடு)
                    </span>
                    {convInfo && (
                      <span className="font-mono text-slate-500 text-[11px]">
                        Formula: ({convInfo.selectedUnit === 'g' ? `${convInfo.selectedQty}g / 1000` : `${convInfo.selectedQty}kg`}) × ₹{ratePerUnit.toFixed(2)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between pt-1 border-t border-emerald-200/50">
                    <div>
                      <span className="text-[11px] text-slate-600 block">Total Line Amount:</span>
                      <div className="text-2xl font-black font-mono text-emerald-700">
                        ₹{lineTotalCalc.toFixed(2)}
                      </div>
                    </div>

                    <div className="text-right text-xs">
                      {isOverStock ? (
                        <span className="font-bold text-red-600 block text-xs">
                          ⚠ Exceeds available stock ({stock.toFixed(2)} {isLiq ? 'L' : 'kg'})!
                        </span>
                      ) : convInfo ? (
                        <span className="text-slate-600 block text-[11px]">
                          Stock remaining: <strong className="text-slate-900 font-mono">{(stock - convInfo.canonicalQty).toFixed(2)} {isLiq ? 'L' : 'kg'}</strong>
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setWeightModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={numInput <= 0 || isOverStock}
                    onClick={() => handleSaveWeight()}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 transition shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                    <span>
                      {weightModalIndex >= 0 ? 'Update Weight in Bill' : 'Add to Bill (ரசீதில் சேர்க்க)'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ======================================================== */}
      {/* MODAL 1: MANUAL RATE CHANGE (MANDATORY REQUIREMENT)      */}
      {/* ======================================================== */}
      {rateModalOpen && selectedCartItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm">Change Bill Rate (விலை மாற்றம்)</h3>
              </div>
              <button
                onClick={() => setRateModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                <div className="font-bold text-slate-800 text-sm">{selectedCartItem.name}</div>
                <div className="text-slate-500 font-tamil">{selectedCartItem.tamilName}</div>
                <div className="flex justify-between pt-2 border-t border-slate-200 text-slate-600">
                  <span>Default Store Price:</span>
                  <span className="font-mono font-bold text-slate-900">₹{selectedCartItem.defaultRate.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  New Rate for This Bill (₹)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={newRateInput}
                  onChange={(e) => setNewRateInput(e.target.value)}
                  placeholder="Enter new rate"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <p className="text-[11px] text-slate-400">
                  * Note: Changing a bill's rate will NOT change the product's default selling price.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Reason for Rate Override (காரணம்)
                </label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Special Customer Discount, Bulk promo"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRateModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveRate}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm"
                >
                  Save Rate (விலை சேமி)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: ADD NEW CUSTOMER MODAL                         */}
      {/* ======================================================== */}
      {newCustomerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">Register New Customer</h3>
              <button
                onClick={() => setNewCustomerModalOpen(false)}
                className="text-white hover:opacity-80"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateCustomer} className="p-5 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Customer Name</label>
                <input
                  type="text"
                  required
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Mobile Phone (Unique)</label>
                <input
                  type="tel"
                  required
                  value={newCustomerForm.phone}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                  placeholder="e.g. 9840012345"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Address (Optional)</label>
                <input
                  type="text"
                  value={newCustomerForm.address}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                  placeholder="e.g. Supermarket Cross Street"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewCustomerModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: RECENT BILLS MODAL (F6)                         */}
      {/* ======================================================== */}
      {recentBillsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm">Recent Bills & Reprinting [F6]</h3>
              </div>
              <button
                onClick={() => setRecentBillsModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {recentBillsLoading ? (
                <div className="py-12 text-center text-slate-400">Loading recent bills...</div>
              ) : recentBills.length === 0 ? (
                <div className="py-12 text-center text-slate-400">No completed bills yet.</div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Bill Number</th>
                      <th className="py-2.5 px-2">Date & Time</th>
                      <th className="py-2.5 px-2">Cashier</th>
                      <th className="py-2.5 px-2">Customer</th>
                      <th className="py-2.5 px-2 text-center">Items</th>
                      <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                      <th className="py-2.5 px-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentBills.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-bold text-blue-600">{s.billNumber}</td>
                        <td className="py-2 px-2 text-slate-500">{new Date(s.createdAt).toLocaleString('en-IN')}</td>
                        <td className="py-2 px-2 text-slate-700">{s.cashier?.fullName || '-'}</td>
                        <td className="py-2 px-2 text-slate-700">{s.customer?.name || 'Walk-in'}</td>
                        <td className="py-2 px-2 text-center">{s.items?.length || 0}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          ₹{Number(s.grandTotal).toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleReprintBill(s)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-xs font-semibold inline-flex items-center gap-1"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Reprint</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: PROFESSIONAL ANANTHA STORES BILLING RECEIPT PREVIEW */}
      {/* ======================================================== */}
      {completedBill && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <div className={`bg-white rounded-2xl ${receiptFormat === 'A4' ? 'max-w-4xl' : receiptFormat === '85mm' ? 'max-w-lg' : 'max-w-md'} w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[96vh] transition-all`}>
            {/* Header bar */}
            <div className="bg-[#153B7A] text-white p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
                <div>
                  <h3 className="font-bold text-sm leading-tight">Bill #{completedBill.billNumber}</h3>
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
                  onClick={() => setCompletedBill(null)}
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
                <Receipt
                  bill={completedBill}
                  receiptFormat={receiptFormat}
                  showWatermark={showWatermark}
                  cashierName={user?.fullName || 'Cashier'}
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setCompletedBill(null)}
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
