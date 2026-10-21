import React, { useState, useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import CashierBilling from './pages/CashierBilling';
import AdminDashboard from './pages/AdminDashboard';
import ManagerDashboard from './pages/ManagerDashboard';

export default function App() {
  const { user, isAuthenticated, checkAuth } = useAuthStore();
  const [adminView, setAdminView] = useState('dashboard'); // 'dashboard' | 'billing'
  const [managerView, setManagerView] = useState('dashboard'); // 'dashboard' | 'billing'

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // If not logged in, show the commercial Login Page
  if (!isAuthenticated || !user) {
    return <Login />;
  }

  // 1. CASHIER ROLE: Always opens the Billing / POS screen directly
  if (user.role === 'CASHIER') {
    return <CashierBilling />;
  }

  // 2. ADMIN ROLE: Opens Admin Dashboard (with ability to toggle into POS Billing)
  if (user.role === 'ADMIN') {
    if (adminView === 'billing') {
      return <CashierBilling onSwitchView={() => setAdminView('dashboard')} />;
    }
    return <AdminDashboard onOpenBilling={() => setAdminView('billing')} />;
  }

  // 3. MANAGER ROLE: Opens Manager Dashboard (with ability to toggle into POS Billing)
  if (user.role === 'MANAGER') {
    if (managerView === 'billing') {
      return <CashierBilling onSwitchView={() => setManagerView('dashboard')} />;
    }
    return <ManagerDashboard onOpenBilling={() => setManagerView('billing')} />;
  }

  // Fallback for safety
  return <CashierBilling />;
}
