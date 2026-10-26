import React from 'react';
import AnanthaLogo from './AnanthaLogo';

/**
 * Professional, Compact Billing Receipt Component for ANANTHA STORES
 * Designed for thermal printing (58mm, 80mm/85mm) and A4 invoice formats.
 * 
 * Specifications:
 * 1. UNNECESSARY DETAILS REMOVED:
 *    - Completely removed Bill Number / Receipt Number.
 *    - Completely removed Biller Name / Cashier Name.
 *    - No empty fields or redundant labels.
 * 2. COMPACT DESIGN:
 *    - Minimized padding, margins, and vertical gaps.
 *    - Clean, compact 5-column HTML table (#, Product Name, Qty, Price, Amount).
 *    - Natural wrapping for long product names without widening receipt.
 *    - Fits neatly on narrow thermal paper without horizontal overflow.
 * 3. STORE HEADER:
 *    - Official Anantha Stores shopping cart logo.
 *    - ANANTHA STORES
 *    - ஆனந்தா ஸ்டோர்ஸ்
 *    - கிழக்கு ரத வீதி, குருவிகுளம், தமிழ்நாடு - 627754
 *    - Phone: 8072339369
 *    - தரம் • நியாயமான விலை • சிறந்த சேவை (pale-yellow banner)
 * 4. BILL DETAILS:
 *    - Date and Time
 *    - Customer Name (only displayed if available, omitted for walk-in/empty)
 * 5. BILL TOTALS:
 *    - Subtotal
 *    - Discount (only if applicable)
 *    - Tax (only if applicable)
 *    - Grand Total / செலுத்த வேண்டிய மொத்தம் (prominently styled)
 * 6. MODE OF PAYMENT:
 *    - CASH: Cash Received & Change Returned
 *    - UPI: Mode of Payment: UPI (no cash change)
 *    - CARD: Mode of Payment: CARD (no cash change)
 *    - CREDIT: Mode of Payment: CREDIT & Outstanding Balance
 *    - SPLIT PAYMENT: Line-by-line breakdown and inline format (e.g. Cash ₹200 + UPI ₹75)
 * 7. FOOTER:
 *    - 🚚 வீட்டிற்கே டெலிவரி வசதி உண்டு!
 *    - நன்றி! மீண்டும் வருக!
 *    - Thank You! Please Visit Again!
 */
export default function Receipt({
  bill,
  receiptFormat = '85mm',
  showWatermark = true,
}) {
  if (!bill) return null;

  // Format date & time in Indian Locale
  const formatDateTime = (dateVal) => {
    try {
      const d = dateVal ? new Date(dateVal) : new Date();
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return new Date().toLocaleString('en-IN');
    }
  };

  // Customer Name: only display if present and not a generic walk-in
  const rawCustomer = bill.customer?.name || bill.customerName;
  const isWalkIn =
    !rawCustomer ||
    rawCustomer === 'Walk-in' ||
    rawCustomer === 'Walk-in Customer' ||
    rawCustomer === 'பொது வாடிக்கையாளர்' ||
    String(rawCustomer).trim() === '';
  const customerDisplay = isWalkIn ? null : String(rawCustomer).trim();

  // Financial calculations from saved transaction data
  const subtotal = Number(bill.subtotal || 0);
  const discountTotal = Number(bill.discountTotal || 0);
  const taxTotal = Number(bill.taxTotal || 0);
  const grandTotal = Number(bill.grandTotal || 0);
  const amountReceived = Number(bill.amountReceived || 0);
  const changeAmount = Number(bill.changeAmount || 0);
  const earnedPoints = Number(bill.earnedPoints || 0);

  // Normalize payment method
  const pmRaw = String(bill.paymentMethod || 'CASH').toUpperCase();
  const isSplit =
    pmRaw === 'SPLIT' ||
    pmRaw === 'SPLIT PAYMENT' ||
    (Array.isArray(bill.payments) && bill.payments.length > 1) ||
    (Array.isArray(bill.splitPayments) && bill.splitPayments.length > 1);
  const isCredit = pmRaw === 'CREDIT';
  const isUpi = pmRaw === 'UPI';
  const isCard = pmRaw === 'CARD';
  const isCash = !isSplit && !isCredit && !isUpi && !isCard;

  // Extract split payment breakdown
  let splitItems = [];
  if (Array.isArray(bill.payments) && bill.payments.length > 0) {
    splitItems = bill.payments.map((p) => ({
      method: String(p.paymentMethod || p.method || 'CASH').toUpperCase(),
      amount: Number(p.amount || 0),
    }));
  } else if (Array.isArray(bill.splitPayments) && bill.splitPayments.length > 0) {
    splitItems = bill.splitPayments.map((p) => ({
      method: String(p.paymentMethod || p.method || 'CASH').toUpperCase(),
      amount: Number(p.amount || 0),
    }));
  } else if (bill.splitDetails && typeof bill.splitDetails === 'string') {
    splitItems = bill.splitDetails.split('+').map((part) => {
      const match = part.trim().match(/([A-Za-z]+)\s*[₹:]*\s*([\d.]+)/);
      if (match) {
        return { method: match[1].toUpperCase(), amount: parseFloat(match[2]) };
      }
      return { method: part.trim().toUpperCase(), amount: 0 };
    });
  } else if (bill.notes && bill.notes.includes('+')) {
    splitItems = bill.notes.split('+').map((part) => {
      const match = part.trim().match(/([A-Za-z]+)\s*[₹:]*\s*([\d.]+)/);
      if (match) {
        return { method: match[1].toUpperCase(), amount: parseFloat(match[2]) };
      }
      return { method: part.trim().toUpperCase(), amount: 0 };
    });
  }

  const hasCashInSplit = splitItems.some((s) => s.method === 'CASH');

  // Credit outstanding balance
  const creditBalance = Number(
    bill.outstandingBalance ??
      bill.customer?.outstandingBalance ??
      bill.customer?.creditBalance ??
      bill.customer?.balance ??
      bill.grandTotal ??
      0
  );

  return (
    <>
      {/* Dynamic @page rule for Chromium / Electron print and PDF rendering (85mm continuous roll) */}
      <style>{`
        @page {
          size: 85mm auto;
          margin: 0;
        }
      `}</style>

      <div
        id="printable-receipt"
        className="receipt-container receipt-format-85mm receipt-print thermal-receipt bg-white border border-[#CCE3FF] rounded-xl shadow-md text-slate-800 font-sans relative select-text transition-all w-[80mm] max-w-full text-[10px] sm:text-[10.5px] p-2.5 sm:p-3 mx-auto"
        style={{
          isolation: 'isolate',
          backgroundColor: '#ffffff',
          boxSizing: 'border-box',
          width: '80mm',
          maxWidth: '85mm',
        }}
      >
        {/* ======================================================== */}
        {/* 1. SUBTLE LOGO WATERMARK BEHIND ITEMS TABLE & TOTALS    */}
        {/* ======================================================== */}
        {showWatermark && (
          <div
            className="receipt-watermark pointer-events-none select-none absolute left-1/2 top-[50%] -translate-x-1/2 -translate-y-1/2 flex items-center justify-center overflow-hidden"
            style={{
              zIndex: 0,
              width: '55%',
              maxWidth: '180px',
              opacity: 0.05, // 5% subtle opacity
            }}
            aria-hidden="true"
          >
            <AnanthaLogo
              variant="watermark"
              alt=""
            />
          </div>
        )}

        {/* ======================================================== */}
        {/* 2. RECEIPT CONTENT LAYER (z-index: 1)                   */}
        {/* ======================================================== */}
        <div className="receipt-content relative space-y-1.5" style={{ zIndex: 1 }}>
          
          {/* ====================================================== */}
          {/* STORE HEADER                                           */}
          {/* ====================================================== */}
          <div className="receipt-header-section text-center space-y-0.5">
            {/* Store Shopping Cart Logo */}
            <div className="flex justify-center mb-0.5">
              <AnanthaLogo
                variant="receipt"
                alt="ANANTHA STORES Logo"
              />
            </div>

            {/* English Shop Name */}
            <h1 className="text-xs sm:text-sm font-black text-[#153B7A] tracking-wider uppercase font-sans leading-tight">
              ANANTHA STORES
            </h1>

            {/* Tamil Shop Name */}
            <h2
              className="text-xs sm:text-sm font-bold text-[#153B7A] font-tamil leading-tight"
              style={{ letterSpacing: 'normal' }}
            >
              ஆனந்தா ஸ்டோர்ஸ்
            </h2>

            {/* Tamil Address */}
            <p
              className="text-[9px] sm:text-[9.5px] text-slate-600 font-tamil leading-tight px-1"
              style={{ letterSpacing: 'normal' }}
            >
              கிழக்கு ரத வீதி, குருவிகுளம், தமிழ்நாடு - 627754
            </p>

            {/* Phone Number */}
            <p className="text-[9px] sm:text-[9.5px] text-slate-700 font-medium">
              Phone: <span className="font-bold font-mono tracking-wider text-slate-900">8072339369</span>
            </p>

            {/* Tagline Banner */}
            <div className="pt-0.5">
              <div
                className="inline-block bg-[#FFF5D6] text-[#153B7A] border border-[#FDE68A] rounded-full px-2 py-0.5 text-[8.5px] sm:text-[9.5px] font-semibold font-tamil shadow-2xs"
                style={{ letterSpacing: 'normal' }}
              >
                தரம் • நியாயமான விலை • சிறந்த சேவை
              </div>
            </div>
          </div>

          {/* ====================================================== */}
          {/* BILL DETAILS (Date/Time & Customer only if available)  */}
          {/* ====================================================== */}
          <div className="receipt-details-section border-t border-b border-dashed border-[#CCE3FF] py-1 text-[9px] sm:text-[9.5px] text-slate-700 font-tamil space-y-0.5" style={{ letterSpacing: 'normal' }}>
            <div className="flex justify-between items-baseline gap-1">
              <span className="text-slate-500 font-medium font-sans shrink-0">Date & Time:</span>
              <span className="font-mono text-slate-800 text-[8.5px] sm:text-[9px] text-right">{formatDateTime(bill.createdAt)}</span>
            </div>
            {customerDisplay && (
              <div className="flex justify-between items-baseline gap-1 pt-0.5">
                <span className="text-slate-500 font-medium font-sans shrink-0">Customer:</span>
                <span className="font-semibold text-slate-900 break-words text-right max-w-[70%]">{customerDisplay}</span>
              </div>
            )}
          </div>

          {/* ====================================================== */}
          {/* ====================================================== */}
          {/* COMPACT PRODUCT TABLE                                  */}
          {/* Columns: #, Product Name, Qty, Price, Amount           */}
          {/* ====================================================== */}
          <div className="space-y-0.5">
            <table className="w-full table-fixed border-collapse text-[9px] sm:text-[10px]">
              <thead>
                <tr className="bg-[#EAF4FF] text-[#153B7A] font-bold border border-[#CCE3FF]">
                  <th style={{ width: '6%' }} className="py-1 px-0.5 text-center font-mono">#</th>
                  <th style={{ width: '43%', letterSpacing: 'normal' }} className="py-1 px-1 text-left font-tamil">
                    Product Name
                  </th>
                  <th style={{ width: '13%', letterSpacing: 'normal' }} className="py-1 px-0.5 text-center font-tamil whitespace-nowrap">
                    Qty
                  </th>
                  <th style={{ width: '18%', letterSpacing: 'normal' }} className="py-1 px-1 text-right font-tamil whitespace-nowrap">
                    Price
                  </th>
                  <th style={{ width: '20%', letterSpacing: 'normal', whiteSpace: 'nowrap' }} className="amount-heading py-1 px-1 text-right font-sans font-bold whitespace-nowrap">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-[#CCE3FF]/60">
                {bill.items?.map((it, idx) => {
                  const qty = Number(it.quantity);
                  const rate = Number(it.billedRate);
                  const total = Number(it.lineTotal || (qty * rate));
                  const name = it.productName || it.name;
                  const tamilName = it.product?.tamilName;

                  // Format quantity with unit for clear display
                  let qtyDisplay = String(qty);
                  if (it.selectedQuantity && it.selectedUnit) {
                    qtyDisplay = `${Number(it.selectedQuantity)} ${it.selectedUnit}`;
                  } else {
                    const u = String(it.unit || it.product?.unit || it.product?.baseUnit || '').toLowerCase();
                    const mt = String(it.measurementType || it.product?.measurementType || '').toUpperCase();
                    if (mt === 'KG' || mt === 'G' || u === 'kg' || u === 'g') {
                      if (qty < 1 && qty > 0) {
                        qtyDisplay = `${Math.round(qty * 1000)} g`;
                      } else {
                        qtyDisplay = `${qty} kg`;
                      }
                    } else if (mt === 'L' || mt === 'ML' || u === 'l' || u === 'ml') {
                      if (qty < 1 && qty > 0) {
                        qtyDisplay = `${Math.round(qty * 1000)} ml`;
                      } else {
                        qtyDisplay = `${qty} L`;
                      }
                    } else if (u && u !== 'pcs' && u !== 'piece') {
                      qtyDisplay = `${qty} ${u}`;
                    }
                  }

                  const isWeight = String(it.measurementType || it.product?.measurementType || '').toUpperCase() === 'KG' || 
                    String(it.unit || it.product?.unit || '').toLowerCase() === 'kg';

                  return (
                    <tr key={idx} className="align-top">
                      <td className="py-1 px-0.5 text-center font-mono text-slate-400 text-[8.5px]">
                        {idx + 1}
                      </td>
                      <td className="py-1 px-1 text-left break-words">
                        <span className="font-semibold text-slate-900 block break-words leading-tight">
                          {name}
                        </span>
                        {tamilName && tamilName !== name && (
                          <span
                            className="text-[8.5px] text-slate-500 font-tamil block break-words leading-tight mt-0.5"
                            style={{ letterSpacing: 'normal' }}
                          >
                            {tamilName}
                          </span>
                        )}
                      </td>
                      <td className="py-1 px-0.5 text-center font-mono font-semibold text-slate-800 whitespace-nowrap">
                        {qtyDisplay}
                      </td>
                      <td className="py-1 px-1 text-right font-mono text-slate-700 whitespace-nowrap text-[8.5px] sm:text-[9.5px]">
                        {`₹${rate.toFixed(2)}`}{isWeight ? <span className="text-[7.5px] text-slate-500 font-sans">/kg</span> : null}
                      </td>
                      <td className="amount-value py-1 px-1 text-right font-mono font-bold text-slate-950 whitespace-nowrap">
                        {`₹${total.toFixed(2)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ====================================================== */}
          {/* BILL TOTALS                                            */}
          {/* ====================================================== */}
          <div className="receipt-totals-section border-t border-dashed border-[#CCE3FF] pt-1.5 space-y-1 text-[9.5px] sm:text-[10px] font-sans">
            {/* Subtotal */}
            <div className="flex justify-between items-center text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono font-bold text-slate-900">{`₹${subtotal.toFixed(2)}`}</span>
            </div>

            {/* Discount (only if applicable) */}
            {discountTotal > 0 && (
              <div className="flex justify-between items-center text-[#DC2626] font-semibold">
                <span>Discount:</span>
                <span className="font-mono">{`-₹${discountTotal.toFixed(2)}`}</span>
              </div>
            )}

            {/* Tax (only if applicable) */}
            {taxTotal > 0 && (
              <div className="flex justify-between items-center text-slate-600">
                <span>Tax:</span>
                <span className="font-mono font-bold text-slate-900">{`₹${taxTotal.toFixed(2)}`}</span>
              </div>
            )}

            {/* Prominent Grand Total */}
            <div className="grand-total bg-[#EAF4FF] border border-[#B9DCFF] rounded-lg p-1.5 flex justify-between items-center text-xs font-extrabold text-[#153B7A] shadow-2xs gap-2">
              <div className="grand-total-label flex-1 min-w-0 flex flex-wrap items-center gap-1.5 leading-tight">
                <span className="font-bold text-[#153B7A] text-[11px] whitespace-nowrap">Grand Total</span>
                <span className="text-[9.5px] font-semibold text-slate-600 font-tamil" style={{ letterSpacing: 'normal' }}>
                  / செலுத்த வேண்டிய மொத்தம்:
                </span>
              </div>
              <div className="grand-total-amount flex-shrink-0 text-right whitespace-nowrap font-mono text-xs sm:text-sm tracking-wide font-black text-[#153B7A]">
                {`₹${grandTotal.toFixed(2)}`}
              </div>
            </div>
          </div>

          {/* ==================================================== */}
          {/* MODE OF PAYMENT (Clear, Method-Specific Details)      */}
          {/* Placed immediately below Grand Total                 */}
          {/* ==================================================== */}
          <div className="receipt-payment-section pt-1.5 space-y-1 border-t border-dashed border-[#CCE3FF]">
            {isSplit ? (
              /* SPLIT PAYMENT */
              <div className="space-y-0.5">
                <div className="flex justify-between items-center text-slate-700">
                  <span className="font-semibold">Mode of Payment:</span>
                  <span className="font-mono font-bold text-[#153B7A]">SPLIT PAYMENT</span>
                </div>

                {splitItems.length > 0 ? (
                  <div className="pl-2 pt-0.5 space-y-0.5 border-l-2 border-blue-200">
                    {splitItems.map((sp, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[9px] sm:text-[9.5px] text-slate-600">
                        <span>{`${sp.method}:`}</span>
                        <span className="font-mono font-semibold text-slate-900">{`₹${Number(sp.amount).toFixed(2)}`}</span>
                      </div>
                    ))}
                    <div className="text-[8.5px] sm:text-[9px] font-mono text-blue-700 pt-0.5 font-semibold">
                      {splitItems.map((sp) => `${sp.method} ₹${Number(sp.amount).toFixed(2)}`).join(' + ')}
                    </div>
                  </div>
                ) : bill.notes ? (
                  <div className="text-[9px] font-mono text-slate-600 pl-2">
                    {bill.notes}
                  </div>
                ) : null}

                {hasCashInSplit && amountReceived > 0 && (
                  <>
                    <div className="flex justify-between items-center text-slate-600 pt-0.5">
                      <span>Cash Received:</span>
                      <span className="font-mono font-bold text-slate-900">{`₹${amountReceived.toFixed(2)}`}</span>
                    </div>
                    {changeAmount > 0 && (
                      <div className="flex justify-between items-center text-[#168A57] font-bold">
                        <span>Change Returned:</span>
                        <span className="font-mono">{`₹${changeAmount.toFixed(2)}`}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : isCredit ? (
              /* CREDIT */
              <div className="space-y-0.5">
                <div className="flex justify-between items-center text-slate-700">
                  <span className="font-semibold">Mode of Payment:</span>
                  <span className="font-mono font-bold text-[#153B7A]">CREDIT</span>
                </div>
                <div className="flex justify-between items-center text-[#DC2626] font-semibold">
                  <span>Outstanding Balance:</span>
                  <span className="font-mono font-bold">{`₹${creditBalance.toFixed(2)}`}</span>
                </div>
              </div>
            ) : isUpi ? (
              /* UPI */
              <div className="flex justify-between items-center text-slate-700">
                <span className="font-semibold">Mode of Payment:</span>
                <span className="font-mono font-bold text-[#153B7A]">UPI</span>
              </div>
            ) : isCard ? (
              /* CARD */
              <div className="flex justify-between items-center text-slate-700">
                <span className="font-semibold">Mode of Payment:</span>
                <span className="font-mono font-bold text-[#153B7A]">CARD</span>
              </div>
            ) : (
              /* CASH */
              <div className="space-y-0.5">
                <div className="flex justify-between items-center text-slate-700">
                  <span className="font-semibold">Mode of Payment:</span>
                  <span className="font-mono font-bold text-[#153B7A]">CASH</span>
                </div>
                {amountReceived > 0 && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Cash Received:</span>
                    <span className="font-mono font-bold text-slate-900">{`₹${amountReceived.toFixed(2)}`}</span>
                  </div>
                )}
                {changeAmount > 0 && (
                  <div className="flex justify-between items-center text-[#168A57] font-bold">
                    <span>Change Returned:</span>
                    <span className="font-mono text-[9.5px] sm:text-[10px]">{`₹${changeAmount.toFixed(2)}`}</span>
                  </div>
                )}
              </div>
            )}

            {earnedPoints > 0 && (
              <div className="flex justify-between items-center text-blue-700 font-bold pt-0.5">
                <span>Loyalty Points Earned:</span>
                <span className="font-mono">{`+${earnedPoints} pts`}</span>
              </div>
            )}
          </div>

          {/* ====================================================== */}
          {/* RECEIPT FOOTER                                         */}
          {/* Placed cleanly beneath payment details                 */}
          {/* ====================================================== */}
          <div className="receipt-footer-section pt-1.5 border-t border-dashed border-[#CCE3FF] space-y-1 text-center">
            {/* Delivery message */}
            <div
              className="text-[#DC2626] font-tamil font-bold text-[9.5px] sm:text-[10px] flex items-center justify-center gap-1 leading-snug"
              style={{ letterSpacing: 'normal' }}
            >
              <span>🚚 வீட்டிற்கே டெலிவரி வசதி உண்டு!</span>
            </div>

            {/* Thank You Greetings */}
            <div className="space-y-0.5 pt-0.5">
              <div
                className="text-[10.5px] sm:text-xs font-bold text-[#153B7A] font-tamil leading-tight"
                style={{ letterSpacing: 'normal' }}
              >
                நன்றி! மீண்டும் வருக!
              </div>
              <div className="text-[9px] sm:text-[9.5px] font-sans font-semibold text-[#153B7A]/80 tracking-wide">
                Thank You! Please Visit Again!
              </div>
            </div>

            {/* Thermal paper cut feed clearance: ensures the physical auto-cutter blade cuts cleanly below the footer */}
            <div className="h-2 print:h-3 w-full" aria-hidden="true" />
          </div>

        </div>
      </div>
    </>
  );
}
