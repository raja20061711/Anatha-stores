import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
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
import api, { getProductImageUrl } from '../services/api';
import { useAuthStore } from '../store/authStore';
import Receipt from '../components/Receipt';
import AnanthaLogo from '../components/AnanthaLogo';
import PosGrandTotal from '../components/PosGrandTotal';
import { PosToastContainer, showPosToast } from '../components/PosToast';
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

function PosProductImage({ product, isWeight, isLiq }) {
  const [hasError, setHasError] = useState(false);
  const imageUrl = product.imageUrl ? getProductImageUrl(product.imageUrl) : null;
  const showImage = Boolean(imageUrl && !hasError);

  return (
    <div className="w-full h-24 bg-[#F3F6FA] rounded-xl mb-2 overflow-hidden flex items-center justify-center border border-[#D9E2EF] relative group-hover:border-[#FED7AA] transition select-none">
      {showImage ? (
        <img
          src={imageUrl}
          alt={product.name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-contain p-1 pointer-events-none"
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#F3F6FA] text-[#64748B] pointer-events-none">
          {isWeight ? (
            <Scale className="w-7 h-7 text-[#F97316] mb-1" />
          ) : (
            <Package className="w-7 h-7 text-[#F97316]/70 mb-1" />
          )}
          <span className="text-[9px] text-[#64748B] font-semibold">
            {product.category?.name || 'Product'}
          </span>
        </div>
      )}

      {/* Weight or Liquid Badge */}
      {isWeight && (
        <span className="absolute top-1.5 left-1.5 bg-[#F97316] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-md shadow-2xs flex items-center gap-0.5 pointer-events-none">
          <Scale className="w-2.5 h-2.5" />
          <span>By Weight</span>
        </span>
      )}
      {isLiq && (
        <span className="absolute top-1.5 left-1.5 bg-[#17365D] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-md shadow-2xs pointer-events-none">
          By Volume
        </span>
      )}
    </div>
  );
}

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

  // Bill Completion & Thermal Receipt Modal (85mm Thermal Paper only)
  const [completedBill, setCompletedBill] = useState(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [lastBill, setLastBill] = useState(null);
  const receiptFormat = '85mm';
  const [showWatermark, setShowWatermark] = useState(true);

  // Recent Bills Modal (F6)
  const [recentBillsModalOpen, setRecentBillsModalOpen] = useState(false);
  const [recentBills, setRecentBills] = useState([]);
  const [recentBillsLoading, setRecentBillsLoading] = useState(false);

  // Search input ref for keyboard shortcut F2
  const searchInputRef = useRef(null);
  const customInputRef = useRef(null);
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
        // Prevent accidental repeated triggers or triggering while checking out or inside another modal
        if (
          cart.length > 0 &&
          !isCheckingOut &&
          !weightModalOpen &&
          !rateModalOpen &&
          !newCustomerModalOpen &&
          !recentBillsModalOpen &&
          !previewModalOpen
        ) {
          handleCompleteBill();
        }
      } else if (e.key === 'F6') {
        e.preventDefault();
        openRecentBills();
      } else if (e.key === 'Escape') {
        setWeightModalOpen(false);
        setRateModalOpen(false);
        setPreviewModalOpen(false);
        setNewCustomerModalOpen(false);
        setRecentBillsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    cart,
    isCheckingOut,
    paymentMethod,
    amountReceived,
    discountAmount,
    selectedCustomer,
    redeemedPoints,
    weightModalOpen,
    rateModalOpen,
    newCustomerModalOpen,
    recentBillsModalOpen,
    previewModalOpen,
  ]);

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
        // Module 8: Combine multiple weight selections for the same product
        const item = updated[existingIdx];
        const combinedCanonicalQty = roundPrecision(item.quantity + canonicalQty, 4);

        if (combinedCanonicalQty > stock) {
          alert(`Cannot add more ${product.name}. Combined weight (${combinedCanonicalQty} ${canonicalUnit}) exceeds available stock (${stock} ${canonicalUnit})!`);
          return;
        }

        const activeRate = item.isOverridden ? item.billedRate : rate;
        const newLineTotal = roundMoney(combinedCanonicalQty * activeRate);

        let displayQty = combinedCanonicalQty;
        let displayUnit = canonicalUnit;
        if (canonicalUnit === 'kg') {
          if (combinedCanonicalQty < 1) {
            displayQty = Math.round(combinedCanonicalQty * 1000);
            displayUnit = 'g';
          } else {
            displayQty = roundPrecision(combinedCanonicalQty, 3);
            displayUnit = 'kg';
          }
        } else if (canonicalUnit === 'l') {
          if (combinedCanonicalQty < 1) {
            displayQty = Math.round(combinedCanonicalQty * 1000);
            displayUnit = 'ml';
          } else {
            displayQty = roundPrecision(combinedCanonicalQty, 3);
            displayUnit = 'l';
          }
        }

        updated[existingIdx] = {
          ...item,
          quantity: combinedCanonicalQty,
          selectedQuantity: displayQty,
          selectedUnit: displayUnit,
          unit: displayUnit,
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
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 60);
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

  // Directly set unit product quantity from editable textbox (Module 4)
  const handleQuantityDirectEdit = (index, value) => {
    const updated = [...cart];
    const item = updated[index];
    if (!item) return;

    if (value === '') {
      item.quantity = '';
      setCart(updated);
      return;
    }

    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 1) {
      return;
    }

    if (parsed > item.currentStock) {
      alert(`Stock limit reached! Only ${item.currentStock} available in stock.`);
      item.quantity = item.currentStock;
      item.selectedQuantity = item.currentStock;
      item.lineTotal = roundMoney(item.currentStock * item.billedRate);
      setCart(updated);
      return;
    }

    item.quantity = parsed;
    item.selectedQuantity = parsed;
    item.lineTotal = roundMoney(parsed * item.billedRate);
    setCart(updated);
  };

  const handleQuantityBlur = (index) => {
    const updated = [...cart];
    const item = updated[index];
    if (!item) return;
    if (!item.quantity || item.quantity < 1) {
      item.quantity = 1;
      item.selectedQuantity = 1;
      item.lineTotal = roundMoney(1 * item.billedRate);
      setCart(updated);
    }
  };

  // Barcode Scanner submission handler (Enter key trigger, Module 10)
  const handleBarcodeScanOrSearchSubmit = async () => {
    const term = searchQuery.trim();
    if (!term) return;

    // 1. Check exact barcode in loaded products
    let match = products.find((p) => p.barcode && p.barcode.toLowerCase() === term.toLowerCase());

    // 2. Query backend exact barcode endpoint if not found in loaded array
    if (!match) {
      try {
        const res = await api.get(`/products/barcode/${encodeURIComponent(term)}`);
        if (res.data) {
          match = res.data;
        }
      } catch {
        // Not found by barcode
      }
    }

    // 3. Fallback to SKU match
    if (!match) {
      match = products.find((p) => p.sku && p.sku.toLowerCase() === term.toLowerCase());
    }

    // 4. Fallback to single search match in filteredProducts
    if (!match && filteredProducts.length === 1) {
      match = filteredProducts[0];
    }

    if (match) {
      const stock = Number(match.currentStock);
      if (stock <= 0) {
        alert(`"${match.name}" is out of stock!`);
        setSearchQuery('');
        return;
      }

      setSearchQuery('');
      if (isWeightBased(match) || isLiquidBased(match)) {
        const existingIndex = cart.findIndex((item) => item.productId === match.id);
        openWeightModal(match, existingIndex);
      } else {
        addToCart(match);
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
    } else {
      if (filteredProducts.length === 0) {
        alert(`No product found with barcode / query: "${term}"`);
        setSearchQuery('');
      }
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

  // Complete Bill & Checkout via Backend Transaction with Direct 85mm Thermal Printing
  const handleCompleteBill = async () => {
    if (isCheckingOut) return;

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

      // 1. Mount into #pos-print-portal and save for reprinting
      setCompletedBill(completed);
      setLastBill(completed);

      // 2. Ensure preview modal is NOT opened during direct checkout
      setPreviewModalOpen(false);

      // 3. Refresh product stock after checkout (deducted exactly once on server)
      fetchProducts();

      // 4. Reset cart & payment fields immediately to prepare screen for next customer
      setCart([]);
      setSelectedCustomer(null);
      setDiscountAmount(0);
      setRedeemedPoints(0);
      setAmountReceived('');
      setBillNotes('');

      // 5. Automatically initiate direct 85mm thermal receipt printing workflow
      setTimeout(() => {
        handleDirectPrint(completed);
      }, 150);
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

  // Reprint previous bill (opens receipt preview modal for manual review, reprint, or PDF export)
  const handleReprintBill = (sale) => {
    setCompletedBill(sale);
    setPreviewModalOpen(true);
    setRecentBillsModalOpen(false);
  };

  // Direct print trigger for 85mm thermal receipt without requiring modal interaction
  const handleDirectPrint = async (billData) => {
    try {
      if (window.electronAPI?.printBill) {
        const result = await window.electronAPI.printBill({ silent: true, receiptFormat, bill: billData });
        if (result && result.success) return;
      }
      window.print();
    } catch (err) {
      console.warn('Direct 85mm print error, invoking fallback:', err);
      try {
        window.print();
      } catch (fallbackErr) {
        console.error('Window print error:', fallbackErr);
      }
    }
  };

  // Safe manual print handler for modal action buttons
  const handlePrint = async () => {
    if (window.electronAPI?.printBill) {
      try {
        const result = await window.electronAPI.printBill({ silent: false, receiptFormat, bill: completedBill });
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
    <div className="pos-main-screen flex flex-col h-screen w-screen bg-[#F3F6FA] bg-grid-dots text-[#17365D] select-none overflow-hidden relative">
      {/* Top Application Bar — 3D Glass Header */}
      <header className="h-16 bg-white/95 backdrop-blur-md text-[#17365D] px-5 flex items-center justify-between border-b border-[#D9E2EF] shadow-soft shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-1.5 shadow-soft border border-[#D9E2EF]">
            <AnanthaLogo variant="header" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-wider text-[#17365D]">ANANTHA STORES</span>
              <span className="text-[10px] bg-[#FFF1E7] text-[#F97316] border border-[#FED7AA] px-2 py-0.5 rounded-full font-extrabold tracking-wider shadow-2xs">
                BILLING POS
              </span>
            </div>
            <p className="text-[10.5px] text-[#64748B] font-tamil font-semibold leading-tight">
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
            className="flex items-center gap-1.5 bg-white hover:bg-[#FFF1E7] active:scale-95 text-[#17365D] border border-[#D9E2EF] hover:border-[#F97316]/50 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
            title="View Recent Bills (F6)"
          >
            <History className="w-3.5 h-3.5 text-[#F97316]" />
            <span>Recent Bills [F6]</span>
          </button>

          {/* Quick Preview & Reprint for Last Completed Bill */}
          {lastBill && (
            <button
              type="button"
              onClick={() => handleReprintBill(lastBill)}
              className="flex items-center gap-1.5 bg-[#FFF1E7] hover:bg-[#FFE4D5] active:scale-95 text-[#F97316] border border-[#FED7AA] px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
              title={`Preview & Reprint Last Bill #${lastBill.billNumber}`}
            >
              <Printer className="w-3.5 h-3.5 text-[#F97316]" />
              <span>Last Bill ({lastBill.billNumber})</span>
            </button>
          )}

          {/* Held Bills Badge */}
          {heldBills.length > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-900 border border-amber-300 px-3 py-1.5 rounded-xl text-xs font-bold animate-pulse shadow-2xs">
              <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Held Bills: {heldBills.length}</span>
            </div>
          )}

          {/* Clock */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-[#D9E2EF] text-xs font-mono font-bold text-[#17365D] shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-[#17365D]" />
            <span>{currentTime.toLocaleTimeString('en-IN')}</span>
          </div>

          {/* Cashier Profile */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-[#D9E2EF] text-xs text-[#17365D] shadow-2xs">
            <div className="w-6 h-6 rounded-lg bg-[#17365D] text-white font-black flex items-center justify-center text-[10px]">
              {(user?.fullName || 'C').charAt(0).toUpperCase()}
            </div>
            <span className="font-bold text-[#17365D]">{user?.fullName || 'Cashier'}</span>
            <span className="text-[10px] bg-[#FFF1E7] text-[#F97316] border border-[#FED7AA] px-1.5 py-0.5 rounded font-extrabold uppercase">
              {user?.role}
            </span>
          </div>

          {/* If user is Admin or Manager, allow switching back to Dashboard */}
          {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && onSwitchView && (
            <button
              onClick={onSwitchView}
              className="text-xs font-extrabold bg-[#FFF1E7] hover:bg-[#FFE4D5] text-[#F97316] px-3 py-1.5 rounded-xl border border-[#FED7AA] transition shadow-2xs cursor-pointer"
            >
              Back to Dashboard
            </button>
          )}

          {/* Logout Button */}
          <button
            onClick={logout}
            className="flex items-center gap-1.5 bg-white hover:bg-red-50 active:scale-95 text-red-600 hover:text-red-700 border border-[#D9E2EF] hover:border-red-200 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
            title="Logout Cashier"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main 3-Column POS Workspace */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden p-3 gap-3 bg-[#F3F6FA]">
        {/* ======================================================== */}
        {/* COLUMN 1: Product Search & Product Grid (Cols 1 - 4)    */}
        {/* ======================================================== */}
        <div className="col-span-4 glass-panel bg-white/95 backdrop-blur-md rounded-2xl border border-[#D9E2EF] shadow-soft flex flex-col overflow-hidden">
          {/* Search Header */}
          <div className="p-3.5 border-b border-[#D9E2EF] space-y-2.5 bg-[#F8FAFC]">
            <div className="relative">
              <Search className="w-4 h-4 text-[#F97316] absolute left-3.5 top-3" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleBarcodeScanOrSearchSubmit();
                  }
                }}
                placeholder="Scan barcode or search products... [F2]"
                className="w-full pl-10 pr-8 py-2.5 bg-white border border-[#D9E2EF] rounded-xl text-xs text-[#17365D] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition shadow-2xs font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-[#64748B] hover:text-[#17365D] text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-100"
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
                  className={`px-3 py-1.5 rounded-full whitespace-nowrap font-bold transition duration-150 cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-[#F97316] text-white shadow-2xs'
                      : 'bg-white text-[#64748B] border border-[#D9E2EF] hover:text-[#17365D] hover:bg-[#FFF1E7]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Cards Grid */}
          <div className="flex-1 overflow-y-auto manager-scroll-container p-3.5 grid grid-cols-2 gap-3 content-start min-h-0">
            {filteredProducts.length === 0 ? (
              <div className="col-span-2 py-12 text-center text-[#64748B]">
                <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30 text-[#17365D]" />
                <p className="text-xs font-bold text-[#17365D]">No matching products found</p>
                <p className="text-[11px] text-[#64748B] mt-1">Try another search term or category</p>
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
                    className={`group glass-card bg-white border rounded-2xl p-3 flex flex-col justify-between transition-all duration-150 ${
                      isOutOfStock
                        ? 'opacity-60 cursor-not-allowed border-[#D9E2EF] bg-slate-50'
                        : 'border-[#D9E2EF] hover:border-[#FED7AA] hover:-translate-y-1 hover:shadow-soft active:scale-[0.97] cursor-pointer'
                    }`}
                  >
                    <div>
                      {/* Product Image */}
                      <PosProductImage product={product} isWeight={isWeight} isLiq={isLiq} />

                      <div className="flex items-start justify-between gap-1">
                        <span className="text-[10px] text-[#64748B] font-semibold truncate max-w-[85px]">
                          {product.brand || product.category?.name || 'General'}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          isOutOfStock
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : stock <= Number(product.minStock)
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {isOutOfStock ? 'Out of Stock' : isWeight ? `Stock: ${stock.toFixed(2)} kg` : `Stock: ${Math.floor(stock)}`}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-[#17365D] mt-1.5 leading-snug group-hover:text-[#F97316] line-clamp-2 transition-colors">
                        {product.name}
                      </h4>

                      {product.tamilName && (
                        <p className="text-[11px] text-[#64748B] font-tamil mt-0.5 line-clamp-1">
                          {product.tamilName}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-[#D9E2EF] flex items-center justify-between">
                      <div>
                        {isWeight ? (
                          <>
                            <span className="text-[10px] text-[#F97316] font-bold block -mb-0.5">Price per KG</span>
                            <span className="text-sm font-black text-[#17365D] font-mono">
                              ₹{Number(product.pricePerKg || product.sellingPrice).toFixed(2)}
                              <span className="text-[10px] text-[#64748B] font-normal">/kg</span>
                            </span>
                          </>
                        ) : isLiq ? (
                          <>
                            <span className="text-[10px] text-[#17365D] font-bold block -mb-0.5">Price per L</span>
                            <span className="text-sm font-black text-[#17365D] font-mono">
                              ₹{Number(product.sellingPrice).toFixed(2)}
                              <span className="text-[10px] text-[#64748B] font-normal">/L</span>
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] text-[#64748B] block -mb-0.5 font-medium">{product.unit || 'pcs'}</span>
                            <span className="text-sm font-black text-[#17365D] font-mono">
                              ₹{Number(product.sellingPrice).toFixed(2)}
                            </span>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isOutOfStock}
                        className="w-7 h-7 rounded-xl text-white flex items-center justify-center shadow-2xs active:scale-95 transition-all disabled:opacity-30 bg-[#F97316] hover:bg-[#EA580C] cursor-pointer"
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
        <div className="col-span-5 glass-panel bg-white/90 backdrop-blur-md rounded-2xl border border-white/80 shadow-soft flex flex-col overflow-hidden">
          {/* Bill Header */}
          <div className="p-3 border-b border-[#D9E2EF] flex items-center justify-between bg-[#F3F6FA] backdrop-blur-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#17365D]">Current Register</span>
              <span className="text-xs text-[#64748B]">• New Bill</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleHoldBill}
                disabled={cart.length === 0}
                className="px-2.5 py-1 rounded-xl bg-amber-50/90 hover:bg-amber-100/90 text-amber-800 border border-amber-200/80 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs"
                title="Hold Current Bill"
              >
                <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Hold</span>
              </button>

              <button
                type="button"
                onClick={clearCart}
                disabled={cart.length === 0}
                className="px-2.5 py-1 rounded-xl bg-rose-50/90 hover:bg-rose-100/90 text-rose-600 border border-rose-200/80 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs"
                title="Clear Cart"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            </div>
          </div>

          {/* Held Bills Bar if any */}
          {heldBills.length > 0 && (
            <div className="bg-amber-50/80 backdrop-blur-xs border-b border-amber-200/70 px-3 py-1.5 flex items-center gap-2 overflow-x-auto text-xs">
              <span className="font-semibold text-amber-800 shrink-0 text-[11px]">Held Bills:</span>
              {heldBills.map((b) => (
                <button
                  key={b.id}
                  onClick={() => handleRestoreBill(b)}
                  className="bg-white hover:bg-amber-100 border border-amber-300 rounded-lg px-2 py-0.5 text-amber-900 font-mono text-[11px] font-semibold flex items-center gap-1 transition shrink-0 cursor-pointer shadow-2xs active:scale-95"
                >
                  <PlayCircle className="w-3 h-3 text-amber-600" />
                  <span>{b.customerName || 'Held'} (₹{Number(b.totalAmount).toFixed(0)})</span>
                </button>
              ))}
            </div>
          )}

          {/* Cart Items Table */}
          <div className="flex-1 overflow-y-auto manager-scroll-container min-h-0">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[#64748B] p-6">
                <ShoppingBag className="w-12 h-12 stroke-1 mb-2 text-[#FED7AA]" />
                <p className="text-sm font-semibold text-[#17365D]">Cart is empty</p>
                <p className="text-xs text-[#64748B] mt-1 text-center">
                  Search or click products on the left panel to add to bill
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#F3F6FA] backdrop-blur-xs text-[#64748B] uppercase text-[10px] font-bold sticky top-0 border-b border-[#D9E2EF] z-10 tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Item Details</th>
                    <th className="py-2.5 px-2 text-center w-24">Qty</th>
                    <th className="py-2.5 px-2 text-right w-24">Rate (₹)</th>
                    <th className="py-2.5 px-3 text-right w-24">Amount (₹)</th>
                    <th className="py-2.5 px-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9E2EF]">
                  {cart.map((item, index) => {
                    const lineTotal = item.lineTotal !== undefined ? item.lineTotal : roundMoney(item.billedRate * item.quantity);
                    const isWeight = isWeightBased(item);
                    const isLiq = isLiquidBased(item);

                    return (
                      <tr key={index} className="hover:bg-[#FFF1E7]/50 transition-colors">
                        <td className="py-2 px-3">
                          <div className="font-semibold text-[#17365D] leading-tight">
                            {item.name}
                          </div>
                          <div className="text-[11px] text-[#64748B] font-tamil leading-tight">
                            {item.tamilName}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            {isWeight && (
                              <span className="text-[9.5px] bg-[#FFF1E7] text-[#F97316] border border-[#FED7AA] px-1 rounded font-semibold flex items-center gap-0.5">
                                <Scale className="w-2.5 h-2.5" />
                                <span>Weight Grocery</span>
                              </span>
                            )}
                            {item.isOverridden && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-[#F97316] bg-[#FFF1E7] border border-[#FED7AA] px-1.5 rounded font-medium">
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
                                className="w-5 h-5 rounded-lg bg-slate-100 hover:bg-[#F97316] hover:text-white text-[#17365D] flex items-center justify-center font-bold active:scale-90 cursor-pointer transition-colors shadow-2xs"
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
                                className="px-2.5 py-0.5 rounded-full bg-[#FFF1E7] hover:bg-[#FFE4D5] border border-[#FED7AA] text-[#F97316] font-mono font-bold text-xs cursor-pointer shadow-2xs active:scale-95 transition whitespace-nowrap"
                                title="Click to edit quantity or unit"
                              >
                                {item.selectedQuantity !== undefined ? item.selectedQuantity : item.quantity} {item.selectedUnit || item.unit}
                              </button>
                              <button
                                type="button"
                                onClick={() => updateQuantity(index, 1)}
                                className="w-5 h-5 rounded-lg bg-slate-100 hover:bg-[#F97316] hover:text-white text-[#17365D] flex items-center justify-center font-bold active:scale-90 cursor-pointer transition-colors shadow-2xs"
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
                                className="w-5 h-5 rounded-lg bg-slate-100 hover:bg-[#F97316] hover:text-white text-[#17365D] flex items-center justify-center font-bold active:scale-90 cursor-pointer transition-colors shadow-2xs"
                                title="Decrease"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                max={item.currentStock}
                                value={item.quantity}
                                onChange={(e) => handleQuantityDirectEdit(index, e.target.value)}
                                onBlur={() => handleQuantityBlur(index)}
                                onFocus={(e) => e.target.select()}
                                className="w-12 text-center font-mono font-bold text-[#17365D] bg-white border border-[#D9E2EF] rounded-lg px-1 py-0.5 text-xs focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] focus:outline-none transition-shadow"
                                title="Type quantity directly"
                              />
                              <button
                                type="button"
                                onClick={() => updateQuantity(index, 1)}
                                className="w-5 h-5 rounded-lg bg-slate-100 hover:bg-[#F97316] hover:text-white text-[#17365D] flex items-center justify-center font-bold active:scale-90 cursor-pointer transition-colors shadow-2xs"
                                title="Increase"
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
                            className="inline-flex items-center gap-1 hover:text-[#F97316] font-bold group text-[#17365D] cursor-pointer transition-colors"
                            title="Click to change rate for this bill"
                          >
                            <span>
                              ₹{item.billedRate.toFixed(2)}
                              {isWeight ? <span className="text-[10px] text-[#64748B] font-normal">/kg</span> : isLiq ? <span className="text-[10px] text-[#64748B] font-normal">/L</span> : null}
                            </span>
                            <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-[#F97316]" />
                          </button>
                        </td>

                        {/* Line Amount */}
                        <td className="py-2 px-3 text-right font-mono font-bold text-[#17365D]">
                          ₹{lineTotal.toFixed(2)}
                        </td>

                        {/* Remove Action */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeFromCart(index)}
                            className="text-[#64748B] hover:text-red-500 transition cursor-pointer"
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
          <div className="p-3 border-t border-[#D9E2EF] bg-[#F8FAFC] flex items-center justify-between text-xs">
            <span className="text-[#64748B]">
              Total Items: <strong className="text-[#17365D]">{cart.reduce((s, i) => s + i.quantity, 0)}</strong> ({cart.length} unique)
            </span>
            <span className="text-[#64748B] font-mono">
              Cart Subtotal: <strong className="text-sm font-bold text-[#17365D]">₹{subtotal.toFixed(2)}</strong>
            </span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMN 3: Customer, Payment & Checkout (Cols 9 - 12)    */}
        {/* ======================================================== */}
        <div className="col-span-3 glass-panel bg-white/90 backdrop-blur-md rounded-2xl border border-white/80 shadow-soft flex flex-col justify-between overflow-hidden min-h-0">
          <div className="p-3.5 space-y-3 overflow-y-auto flex-1 manager-scroll-container min-h-0">
            {/* Customer Selector & Loyalty */}
            <div className="space-y-1.5 pb-2.5 border-b border-[#D9E2EF] relative">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-[#17365D] uppercase tracking-wider">
                  Customer & Loyalty
                </label>
                <button
                  type="button"
                  onClick={() => setNewCustomerModalOpen(true)}
                  className="text-[10px] text-[#F97316] font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>+ New</span>
                </button>
              </div>

              {selectedCustomer ? (
                <div className="bg-[#FFF1E7] border border-[#FED7AA] rounded-xl p-2.5 flex items-center justify-between text-xs shadow-2xs">
                  <div>
                    <div className="font-bold text-[#17365D]">{selectedCustomer.name}</div>
                    <div className="text-[11px] text-[#F97316] font-mono font-semibold">{selectedCustomer.phone}</div>
                    <div className="text-[10px] text-[#16A34A] font-bold mt-0.5">
                      Points Balance: {Number(selectedCustomer.loyaltyBalance).toFixed(0)} pts
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setRedeemedPoints(0);
                    }}
                    className="text-[#F97316] hover:text-red-600 p-1 cursor-pointer"
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
                    className="w-full px-3 py-2 bg-slate-50/80 border border-[#D9E2EF] rounded-xl text-xs placeholder-[#64748B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] transition shadow-2xs"
                  />
                  {customerDropdownOpen && customers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 glass-panel bg-white/95 backdrop-blur-md border border-[#D9E2EF] rounded-xl shadow-lg z-20 max-h-40 overflow-y-auto text-xs divide-y divide-[#D9E2EF]/60">
                      {customers.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedCustomer(c);
                            setCustomerDropdownOpen(false);
                            setCustomerSearch('');
                          }}
                          className="p-2 hover:bg-[#FFF1E7] cursor-pointer flex justify-between items-center transition-colors"
                        >
                          <div>
                            <span className="font-bold text-[#17365D]">{c.name}</span>
                            <span className="text-[11px] text-[#64748B] block font-mono">{c.phone}</span>
                          </div>
                          <span className="text-[10px] text-[#16A34A] font-bold font-mono">
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
                  <span className="text-[11px] text-[#64748B] font-medium">Redeem Points:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max={Number(selectedCustomer.loyaltyBalance)}
                      value={redeemedPoints || ''}
                      onChange={(e) => setRedeemedPoints(Math.min(Number(selectedCustomer.loyaltyBalance), parseFloat(e.target.value) || 0))}
                      placeholder="0"
                      className="w-16 px-1.5 py-0.5 text-right bg-white border border-[#D9E2EF] rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-[#F97316] focus:border-[#F97316] outline-none"
                    />
                    <span className="text-[11px] text-[#16A34A] font-bold">(-₹{loyaltyDiscount.toFixed(0)})</span>
                  </div>
                </div>
              )}
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-[#64748B]">
                <span>Subtotal (கூட்டுத் தொகை)</span>
                <span className="font-mono font-semibold text-[#17365D]">₹{subtotal.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between text-[#64748B]">
                <span>Discount (தள்ளுபடி ₹)</span>
                <input
                  type="number"
                  min="0"
                  value={discountAmount || ''}
                  onChange={(e) => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0.00"
                  className="w-20 px-2 py-0.5 text-right bg-slate-50 border border-[#D9E2EF] rounded-lg text-xs font-mono font-bold text-[#17365D] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#F97316] focus:border-[#F97316] transition"
                />
              </div>

              {loyaltyDiscount > 0 && (
                <div className="flex justify-between text-[#16A34A] font-medium">
                  <span>Loyalty Discount</span>
                  <span className="font-mono font-bold">-₹{loyaltyDiscount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-[#64748B] text-[11px]">
                <span>Tax (GST)</span>
                <span>₹0.00 (Exempt)</span>
              </div>
            </div>

            {/* Grand Total Box (Prominent Blue Gradient with Unified Bilingual Label) */}
            <PosGrandTotal grandTotal={grandTotal} />

            {/* Payment Method Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#17365D] uppercase tracking-wider block">
                Payment Method (பணம் செலுத்தும் முறை)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'CASH', label: 'Cash (ரொக்கம்)', icon: Banknote },
                  { id: 'UPI', label: 'UPI / QR', icon: Smartphone },
                  { id: 'CARD', label: 'Card (அட்டை)', icon: CreditCard },
                ].map((m) => {
                  const Icon = m.icon;
                  const isSelected = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      className={`py-2 px-1 rounded-xl border text-center font-bold text-xs flex flex-col items-center gap-1 transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#F97316] text-white border-transparent shadow-md shadow-orange-500/25 ring-2 ring-[#F97316]/40'
                          : 'bg-white/80 border-[#D9E2EF] text-[#64748B] hover:text-[#17365D] hover:bg-white hover:border-[#FED7AA] shadow-2xs'
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
              <div className="bg-[#F8FAFC] border border-[#D9E2EF] rounded-xl p-2.5 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#17365D]">Received (பெற்ற தொகை):</span>
                  <input
                    type="number"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    placeholder={grandTotal.toFixed(2)}
                    className="w-24 px-2 py-1 text-right bg-white border border-[#D9E2EF] rounded-lg text-xs font-mono font-bold text-[#17365D] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-[#D9E2EF] font-semibold">
                  <span className="text-[#64748B]">Change (மீதித் தொகை):</span>
                  <span className={`font-mono text-sm font-extrabold ${changeAmount > 0 ? 'text-[#16A34A]' : 'text-[#17365D]'}`}>
                    ₹{changeAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Complete Bill Action Button */}
          <div className="p-3 border-t border-[#D9E2EF] bg-[#F3F6FA] backdrop-blur-xs space-y-1.5 shrink-0">
            <button
              type="button"
              onClick={handleCompleteBill}
              disabled={cart.length === 0 || isCheckingOut}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-[#16A34A] to-[#22C55E] hover:from-[#15803d] hover:to-[#16a34a] active:scale-[0.98] text-white rounded-xl text-sm font-extrabold shadow-md shadow-emerald-500/25 flex items-center justify-center gap-2 transition duration-150 disabled:opacity-50 cursor-pointer"
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
              { label: '100 ml', qty: '100', unit: 'ml' },
              { label: '250 ml', qty: '250', unit: 'ml' },
              { label: '500 ml', qty: '500', unit: 'ml' },
              { label: '750 ml', qty: '750', unit: 'ml' },
              { label: '1 L', qty: '1', unit: 'l' },
              { label: '1.5 L', qty: '1.5', unit: 'l' },
              { label: '2 L', qty: '2', unit: 'l' },
              { label: '3 L', qty: '3', unit: 'l' },
            ]
          : [
              { label: '100g', qty: '100', unit: 'g' },
              { label: '250g', qty: '250', unit: 'g' },
              { label: '500g', qty: '500', unit: 'g' },
              { label: '750g', qty: '750', unit: 'g' },
              { label: '1kg', qty: '1', unit: 'kg' },
              { label: '1.5kg', qty: '1.5', unit: 'kg' },
              { label: '2kg', qty: '2', unit: 'kg' },
              { label: '3kg', qty: '3', unit: 'kg' },
            ];

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
              {/* Modal Header */}
              <div className="bg-[#17365D] text-white p-4 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shadow-xs">
                    <Scale className="w-5 h-5 text-[#F97316]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm leading-tight text-white">
                      {isLiq ? 'Select Volume / Quantity' : 'Automatic Weight-Based Pricing'}
                    </h3>
                    <p className="text-[11px] text-slate-200">
                      {isLiq ? 'திரவ அளவு தேர்வு' : 'எடை தேர்வு & தானியங்கி விலை கணக்கீடு'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setWeightModalOpen(false)}
                  className="text-white/80 hover:text-white font-bold p-1 cursor-pointer"
                  title="Close (ESC)"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto">
                {/* Product Info Card */}
                <div className="bg-[#FFF1E7] p-3.5 rounded-xl border border-[#FED7AA] flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold text-[#F97316] uppercase tracking-wider block">
                      {product.brand || product.category?.name || 'Grocery'}
                    </span>
                    <h4 className="font-extrabold text-[#17365D] text-sm">{product.name}</h4>
                    {product.tamilName && (
                      <p className="text-xs text-[#64748B] font-tamil mt-0.5">{product.tamilName}</p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-[#64748B] block">Configured Price</span>
                    <span className="text-base font-black text-[#17365D] font-mono">
                      ₹{ratePerUnit.toFixed(2)}
                      <span className="text-xs font-normal text-[#64748B]">{isLiq ? '/L' : '/kg'}</span>
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
                    <label className="text-xs font-bold text-[#17365D] uppercase tracking-wider flex items-center gap-1">
                      <span>One-Click Preset Weights</span>
                      <span className="text-[10px] text-[#64748B] font-normal font-tamil">(ஒரு கிளிக் தேர்வு)</span>
                    </label>
                    <span className="text-[11px] text-[#F97316] font-semibold">Click to instantly add</span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {quickButtons.map((btn) => {
                      const btnCanonical = isLiq
                        ? (btn.unit === 'ml' ? Number(btn.qty) / 1000 : Number(btn.qty))
                        : (btn.unit === 'g' ? Number(btn.qty) / 1000 : Number(btn.qty));
                      const btnCost = roundMoney(btnCanonical * ratePerUnit);
                      const isOverBtnStock = btnCanonical > stock;

                      return (
                        <button
                          key={btn.label}
                          type="button"
                          disabled={isOverBtnStock}
                          onClick={() => handleSaveWeight(btn.qty, btn.unit)}
                          className={`py-2 px-1.5 rounded-xl border text-center transition flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow-2xs ${
                            isOverBtnStock
                              ? 'bg-slate-100 border-[#D9E2EF] text-[#64748B] opacity-60 cursor-not-allowed'
                              : 'bg-[#F8FAFC] border-[#D9E2EF] hover:bg-[#F97316] hover:text-white text-[#17365D] active:scale-95 hover:border-[#F97316] hover:shadow-xs'
                          }`}
                          title={isOverBtnStock ? 'Exceeds stock' : `One-click: Add ${btn.label} to bill`}
                        >
                          <span className="font-mono font-bold text-xs">{btn.label}</span>
                          <span className="text-[10px] opacity-80 font-mono">₹{btnCost.toFixed(2)}</span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        customInputRef.current?.focus();
                        customInputRef.current?.select();
                      }}
                      className="py-2 px-1.5 rounded-xl border border-[#D9E2EF] bg-[#F8FAFC] hover:bg-[#FFF1E7] text-[#17365D] text-xs font-bold transition text-center shadow-2xs flex flex-col items-center justify-center cursor-pointer"
                      title="Enter custom weight"
                    >
                      <span className="text-xs font-bold">Custom Weight</span>
                      <span className="text-[10px] text-[#64748B] font-normal">Type below</span>
                    </button>
                  </div>
                </div>

                {/* Custom Weight Entry Input with Unit Toggle */}
                <div className="space-y-2 pt-1 border-t border-[#D9E2EF]">
                  <label className="text-xs font-bold text-[#17365D] uppercase tracking-wider block">
                    Custom Quantity Entry (சுய எடை உள்ளீடு)
                  </label>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        ref={customInputRef}
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
                        className="w-full px-3.5 py-2.5 bg-white border border-[#D9E2EF] rounded-xl text-base font-mono font-bold text-[#17365D] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] shadow-2xs"
                      />
                    </div>

                    {/* Clear Unit Toggle Buttons */}
                    <div className="flex rounded-xl bg-[#F3F6FA] p-1 border border-[#D9E2EF] shrink-0">
                      {(isLiq ? ['ml', 'l'] : ['g', 'kg']).map((u) => {
                        const active = weightUnit.toLowerCase() === u.toLowerCase();
                        return (
                          <button
                            key={u}
                            type="button"
                            onClick={() => setWeightUnit(u)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase font-mono transition cursor-pointer ${
                              active
                                ? 'bg-[#17365D] text-white shadow-xs'
                                : 'text-[#64748B] hover:text-[#17365D]'
                            }`}
                          >
                            {u === 'g' ? 'Grams (g)' : u === 'kg' ? 'Kilograms (kg)' : u === 'ml' ? 'Millilitres (ml)' : 'Litres (L)'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] px-1 text-[#64748B]">
                    <span>
                      Selected Unit: <strong className="text-[#17365D] font-bold">{weightUnit.toUpperCase()}</strong>
                      {weightUnit === 'g' ? ' (1000 g = 1 kg)' : ' (Canonical Unit: KG)'}
                    </span>
                    {convInfo && (
                      <span className="font-mono font-semibold text-[#17365D]">
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
                      <span className="font-mono text-[#64748B] text-[11px]">
                        Formula: ({convInfo.selectedUnit === 'g' ? `${convInfo.selectedQty}g / 1000` : `${convInfo.selectedQty}kg`}) × ₹{ratePerUnit.toFixed(2)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between pt-1 border-t border-emerald-200/50">
                    <div>
                      <span className="text-[11px] text-[#64748B] block">Total Line Amount:</span>
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
                        <span className="text-[#64748B] block text-[11px]">
                          Stock remaining: <strong className="text-[#17365D] font-mono">{(stock - convInfo.canonicalQty).toFixed(2)} {isLiq ? 'L' : 'kg'}</strong>
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
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#64748B] text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={numInput <= 0 || isOverStock}
                    onClick={() => handleSaveWeight()}
                    className="px-5 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold flex items-center gap-2 transition shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
            <div className="bg-[#17365D] text-white p-4 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#F97316]" />
                <h3 className="font-bold text-sm text-white">Change Bill Rate (விலை மாற்றம்)</h3>
              </div>
              <button
                onClick={() => setRateModalOpen(false)}
                className="text-white/80 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-[#D9E2EF] text-xs space-y-1">
                <div className="font-bold text-[#17365D] text-sm">{selectedCartItem.name}</div>
                <div className="text-[#64748B] font-tamil">{selectedCartItem.tamilName}</div>
                <div className="flex justify-between pt-2 border-t border-[#D9E2EF] text-[#64748B]">
                  <span>Default Store Price:</span>
                  <span className="font-mono font-bold text-[#17365D]">₹{selectedCartItem.defaultRate.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#17365D] block">
                  New Rate for This Bill (₹)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={newRateInput}
                  onChange={(e) => setNewRateInput(e.target.value)}
                  placeholder="Enter new rate"
                  className="w-full px-3 py-2 bg-white border border-[#D9E2EF] rounded-xl text-sm font-mono font-bold text-[#17365D] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                />
                <p className="text-[11px] text-[#64748B]">
                  * Note: Changing a bill's rate will NOT change the product's default selling price.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#17365D] block">
                  Reason for Rate Override (காரணம்)
                </label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Special Customer Discount, Bulk promo"
                  className="w-full px-3 py-2 bg-white border border-[#D9E2EF] rounded-xl text-xs text-[#17365D] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#64748B] text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveRate}
                  className="px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold transition shadow-sm cursor-pointer"
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
          <div className="bg-white rounded-2xl max-sm w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#17365D] text-white p-4 flex items-center justify-between shadow-xs">
              <h3 className="font-bold text-sm text-white">Register New Customer</h3>
              <button
                onClick={() => setNewCustomerModalOpen(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateCustomer} className="p-5 space-y-3">
              <div>
                <label className="text-xs font-bold text-[#17365D] block mb-1">Customer Name</label>
                <input
                  type="text"
                  required
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2 border border-[#D9E2EF] rounded-xl text-xs text-[#17365D] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#17365D] block mb-1">Mobile Phone (Unique)</label>
                <input
                  type="tel"
                  required
                  value={newCustomerForm.phone}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                  placeholder="e.g. 9840012345"
                  className="w-full px-3 py-2 border border-[#D9E2EF] rounded-xl text-xs font-mono text-[#17365D] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#17365D] block mb-1">Address (Optional)</label>
                <input
                  type="text"
                  value={newCustomerForm.address}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                  placeholder="e.g. Supermarket Cross Street"
                  className="w-full px-3 py-2 border border-[#D9E2EF] rounded-xl text-xs text-[#17365D] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewCustomerModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-semibold text-[#64748B] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg text-xs font-bold cursor-pointer shadow-xs"
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
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-[#D9E2EF] overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-[#17365D] text-white p-4 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#FED7AA]" />
                <h3 className="font-bold text-sm text-white">Recent Bills & Reprinting [F6]</h3>
              </div>
              <button
                onClick={() => setRecentBillsModalOpen(false)}
                className="text-white/80 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto manager-scroll-container p-4 min-h-0">
              {recentBillsLoading ? (
                <div className="py-12 text-center text-[#64748B]">Loading recent bills...</div>
              ) : recentBills.length === 0 ? (
                <div className="py-12 text-center text-[#64748B]">No completed bills yet.</div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#F3F6FA] text-[#64748B] uppercase text-[10px] font-bold border-b border-[#D9E2EF] tracking-wider sticky top-0 z-10 shadow-2xs">
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
                  <tbody className="divide-y divide-[#D9E2EF]">
                    {recentBills.map((s) => (
                      <tr key={s.id} className="hover:bg-[#FFF1E7]/50 transition-colors">
                        <td className="py-2 px-3 font-mono font-bold text-[#17365D]">{s.billNumber}</td>
                        <td className="py-2 px-2 text-[#64748B]">{new Date(s.createdAt).toLocaleString('en-IN')}</td>
                        <td className="py-2 px-2 text-[#17365D]">{s.cashier?.fullName || '-'}</td>
                        <td className="py-2 px-2 text-[#17365D]">{s.customer?.name || 'Walk-in'}</td>
                        <td className="py-2 px-2 text-center text-[#17365D]">{s.items?.length || 0}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-[#17365D]">
                          ₹{Number(s.grandTotal).toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleReprintBill(s)}
                            className="px-2.5 py-1 bg-[#FFF1E7] hover:bg-[#FFE4D5] text-[#F97316] border border-[#FED7AA] rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition"
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
      {previewModalOpen && completedBill && (
        <div className="receipt-modal-backdrop fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <div className="receipt-modal-container bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-[#D9E2EF] overflow-hidden flex flex-col max-h-[96vh] transition-all">
            {/* Header bar */}
            <div className="no-print bg-[#17365D] text-white p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
                <div>
                  <h3 className="font-bold text-sm leading-tight text-white">Bill #{completedBill.billNumber}</h3>
                  <p className="text-[10px] text-slate-200">ANANTHA STORES — Official Billing Receipt</p>
                </div>
              </div>

              {/* Watermark Toggle & 85mm Thermal Badge */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Watermark Toggle */}
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-white bg-[#122B4A] hover:bg-[#0E2038] px-2.5 py-1 rounded-md cursor-pointer select-none transition">
                  <input
                    type="checkbox"
                    checked={showWatermark}
                    onChange={(e) => setShowWatermark(e.target.checked)}
                    className="rounded text-[#F97316] focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Watermark</span>
                </label>

                {/* Permanent 85mm Thermal Paper Indicator */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#122B4A] border border-[#234A7D] rounded-md text-[10px] font-bold text-slate-200 select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]"></span>
                  <span>85mm Thermal</span>
                </div>

                <button
                  onClick={() => setPreviewModalOpen(false)}
                  className="text-white/80 hover:text-white font-bold p-1 ml-1 cursor-pointer"
                  title="Close Preview (ESC)"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Receipt Preview Area */}
            <div className="flex-1 overflow-y-auto manager-scroll-container min-h-0 p-2 sm:p-4 bg-[#F3F6FA] flex justify-center">
              <div id="printable-receipt-wrapper" className="flex justify-center w-full">
                <Receipt
                  bill={completedBill}
                  receiptFormat="85mm"
                  showWatermark={showWatermark}
                  cashierName={user?.fullName || 'Cashier'}
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="no-print p-3 bg-white border-t border-[#D9E2EF] flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="px-3.5 py-2 bg-[#F3F6FA] hover:bg-[#E2E8F0] rounded-lg text-xs font-semibold text-[#64748B] transition cursor-pointer"
              >
                Close Preview
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Reprint Bill */}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3 py-2 bg-[#17365D] hover:bg-[#122B4A] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-xs"
                  title="Reprint Bill without re-charging or modifying inventory"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#FED7AA]" />
                  <span>Reprint Bill</span>
                </button>

                {/* Download PDF */}
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="px-3.5 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-xs"
                  title="Download receipt as vector PDF (85mm)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>

                {/* Print Bill */}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-4 py-2 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm active:scale-95"
                  title="Print Bill (85mm)"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Bill (85mm)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Portal to #pos-print-portal outside #root for isolated zero-blank-page printing */}
      {completedBill && typeof document !== 'undefined' && document.getElementById('pos-print-portal') && (
        createPortal(
          <div id="printable-receipt-wrapper" className="flex justify-center w-full">
            <Receipt
              bill={completedBill}
              receiptFormat={receiptFormat}
              showWatermark={showWatermark}
              cashierName={user?.fullName || 'Cashier'}
            />
          </div>,
          document.getElementById('pos-print-portal')
        )
      )}

      {/* POS Notification & Feedback Toast System */}
      <PosToastContainer />
    </div>
  );
}
