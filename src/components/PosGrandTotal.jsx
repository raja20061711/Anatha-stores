import React from 'react';

/**
 * Shared Grand Total Card Component for ANANTHA STORES POS Terminal
 * 
 * Displays the unified bilingual label:
 *   Grand Total (செலுத்த வேண்டிய மொத்தம்)
 * with the final bill amount placed clearly below the label.
 */
export default function PosGrandTotal({ grandTotal = 0, className = '' }) {
  const amount = Number(grandTotal || 0);

  return (
    <div
      className={`bg-gradient-to-br from-[#17365D] via-[#1E4373] to-[#122B4A] rounded-2xl p-3.5 text-white shadow-lg shadow-[#17365D]/20 border border-[#234A7D] ${className}`}
    >
      <div className="text-left text-[#FED7AA] text-xs sm:text-[13px] font-bold tracking-tight leading-snug break-words">
        Grand Total (செலுத்த வேண்டிய மொத்தம்)
      </div>
      <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight mt-1 text-white text-left drop-shadow-sm">
        {`₹${amount.toFixed(2)}`}
      </div>
    </div>
  );
}
