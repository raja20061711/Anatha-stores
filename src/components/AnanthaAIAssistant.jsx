import React from 'react';
import WexaAIAssistant from './WexaAIAssistant';

/**
 * AnanthaAIAssistant wrapper to integrate WEXA AI — Powered by WeEngineerTech
 * Preserves existing component imports across AdminDashboard, ManagerDashboard, and CashierBilling
 * without modifying any dashboard or POS billing code.
 */
export default function AnanthaAIAssistant(props) {
  return <WexaAIAssistant {...props} />;
}

export { WexaAIAssistant };
