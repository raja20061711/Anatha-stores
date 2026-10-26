import * as aiData from './aiDataService.js';
import { generateLLMExplanation, getAIProviderStatus } from './aiProvider.js';

// In-memory conversation state for multi-turn context
const conversationStore = new Map();

/**
 * Retrieve or initialize a conversation session.
 */
function getConversationSession(conversationId) {
  if (!conversationId) return { id: 'default', history: [], lastContext: {} };
  if (!conversationStore.has(conversationId)) {
    conversationStore.set(conversationId, {
      id: conversationId,
      history: [],
      lastContext: {},
      lastUpdated: Date.now(),
    });
  }
  return conversationStore.get(conversationId);
}

/**
 * Clear conversation memory.
 */
export function clearConversationHistory(conversationId) {
  if (conversationId && conversationStore.has(conversationId)) {
    conversationStore.delete(conversationId);
  }
}

/**
 * Detect language of prompt: 'ta' (Tamil script), 'tanglish' (Tamil in English), or 'en' (English).
 */
export function detectLanguage(text = '') {
  if (/[\u0B80-\u0BFF]/.test(text)) {
    return 'ta';
  }
  const tanglishRegex = /\b(inniku|iniku|nethu|indha|inda|vaaram|maasam|evlo|avlo|aachu|achu|irukku|iruku|enna|ennathu|kammi|kammia|kudunga|kudukanum|vendiya|sold|aana|endha|enda|panunga|pannunga|theriyuma|kamikavum|kamikanum)\b/i;
  if (tanglishRegex.test(text)) {
    return 'tanglish';
  }
  return 'en';
}

/**
 * Extract target date period from natural language.
 */
export function extractPeriod(text = '') {
  const lower = text.toLowerCase();
  if (lower.includes('yesterday') || lower.includes('nethu') || lower.includes('நேற்று')) return 'yesterday';
  if (lower.includes('today') || lower.includes('inniku') || lower.includes('iniku') || lower.includes('இன்று')) return 'today';
  if (lower.includes('last week') || lower.includes('pona vaaram') || lower.includes('சென்ற வாரம்') || lower.includes('கடந்த வாரம்')) return 'last_week';
  if (lower.includes('this week') || lower.includes('indha vaaram') || lower.includes('inda vaaram') || lower.includes('இந்த வாரம்')) return 'this_week';
  if (lower.includes('last month') || lower.includes('pona maasam') || lower.includes('சென்ற மாதம்') || lower.includes('கடந்த மாதம்')) return 'last_month';
  if (lower.includes('this month') || lower.includes('indha maasam') || lower.includes('இந்த மாதம்')) return 'this_month';
  if (lower.includes('this year') || lower.includes('indha varusham') || lower.includes('இந்த வருடம்')) return 'this_year';
  if (lower.includes('last 30 days') || lower.includes('30 days')) return 'last_30_days';
  return null;
}

/**
 * Detect query intent and entities.
 */
export function detectIntent(text = '', lastContext = {}) {
  const lower = text.toLowerCase();
  const period = extractPeriod(lower);

  // 0. Identity & Branding: WEXA AI / WeEngineerTech / Assistant Identity
  if (/(who are you|what is your name|what are you|wexa|weengineertech|who powered you|unga peyar|neenga yaaru|who made you|who built you|யார் நீங்கள்|உன் பெயர்|உன்னை உருவாக்கியது யார்)/i.test(lower)) {
    return { type: 'WEXA_IDENTITY' };
  }

  // 0.1 Setup & Configuration Guide
  if (/(setup.*ai|configure.*ai|how to.*api key|gemini key|enable gemini|ai setup|how to.*configure)/i.test(lower)) {
    return { type: 'AI_SETUP_GUIDE' };
  }

  // 0.2 Business recommendations & tips
  if (/(recommendation|recommendations|supermarket tips|business tips|how to increase sales|how to increase profit|how to improve sales|growth advice|business advice|விற்பனை அதிகரிக்க|யோசனை|ஆலோசனை)/i.test(lower)) {
    return { type: 'BUSINESS_RECOMMENDATIONS' };
  }

  // 1. Follow-up: "report for these", "export these", "download report for these"
  if (/(report for these|export these|ivatrai export|ivatrai report)/i.test(lower)) {
    return {
      type: 'REPORT_GENERATION',
      subType: lastContext.lastDataType || 'LOW_STOCK',
      format: lower.includes('excel') || lower.includes('xlsx') ? 'EXCEL' : lower.includes('csv') ? 'CSV' : 'PDF',
    };
  }

  // 2. Follow-up: "compare them with last month / week / yesterday"
  if (/(compare them|compare with|oppidu|oppidunga|nethu compare|compare pannu)/i.test(lower) && lastContext.lastDataType) {
    return {
      type: 'PERIOD_COMPARISON',
      basePeriod: lastContext.lastPeriod || 'this_week',
      targetPeriod: period || 'last_month',
    };
  }

  // 3. Why sales decreased / increased
  if (/(why.*(decrease|drop|down|fall|reduce|low|less|kammi|kurainthathu)|yen.*sales.*(kammi|koranchithu))/i.test(lower)) {
    return { type: 'SALES_DECLINE_ANALYSIS', period: period || 'today' };
  }

  // 4. Staff & Cashiers (including "cashier-wise sales report")
  if (/(cashier|cashiers|staff|shift|employee|reconciliation|பணியாளர்|பில்லிங் ஆள்)/i.test(lower)) {
    return { type: 'STAFF_CASHIER' };
  }

  // 5. Which product / item made highest profit or most sales
  if (/(which|what|top|highest).*(product|item).*(profit|margin|money)/i.test(lower) ||
      /(top[- ]selling|highest[- ]selling|best[- ]selling|most sold|athigam vitta|அதிகம் விற்ற|fast[- ]moving)/i.test(lower)) {
    return { type: 'TOP_SELLING', period: period || 'this_month' };
  }

  // 6. Slow moving / zero sales
  if (/(slow[- ]moving|least sold|zero sales|no sales|vikkatha|விற்பனை ஆகாத)/i.test(lower)) {
    return { type: 'SLOW_MOVING', period: period || 'this_month' };
  }

  // 7. Low stock, out of stock & reorders (matches "low stock", "low in stock", "out of stock", etc.)
  if (/(low.*stock|out.*stock|running out|reorder|stock kammi|theernthu|stock ila|shortage|சரக்கு குறைவு|மீள் ஆர்டர்)/i.test(lower)) {
    return { type: 'INVENTORY_ALERT' };
  }

  // 8. Profit & financial analysis (gross profit, cogs, expenses, margin, loss, revenue, gross sales)
  if (/(profit|margin|cogs|loss|cost of goods|expense|expenses|revenue|gross.*sales|net.*sales|laabam|லாபம்)/i.test(lower)) {
    return { type: 'PROFIT_FINANCIAL', period: period || 'this_month' };
  }

  // 9. Barcode & printing
  if (/(barcode|barcodes|qr|label|labels|pending label|duplicate barcode|missing barcode|print label|பார்வோட்|பார்கோடு)/i.test(lower)) {
    return { type: 'BARCODE_PRINTING' };
  }

  // 10. Expiry queries
  if (/(expiry|expire|expiring|shelf life|kaalavathi|காலாவதி)/i.test(lower)) {
    return { type: 'EXPIRY_ALERT' };
  }

  // 11. Stock valuation
  if (/(stock value|inventory value|valuation|stock worth|சரக்கு மதிப்பு)/i.test(lower)) {
    return { type: 'STOCK_VALUATION' };
  }

  // 12. Suppliers & purchases
  if (/(supplier|suppliers|vendor|purchase invoice|purchase order|pending dues|distributor|சப்ளையர்)/i.test(lower)) {
    return { type: 'SUPPLIERS' };
  }

  // 13. Customers & loyalty
  if (/(customer|customers|loyalty|reward point|points balance|வாடிக்கையாளர்)/i.test(lower)) {
    return { type: 'CUSTOMERS' };
  }

  // 14. Explicit period comparison ("last week compared with this week")
  if (/(compare.*(week|month|year|yesterday|today)|sales.*compared|last week.*this week)/i.test(lower)) {
    return { type: 'PERIOD_COMPARISON', periodA: 'this_week', periodB: 'last_week' };
  }

  // 15. Explicit general report export request
  if (/(export|generate|download|create|make).*(report|excel|pdf|csv)/i.test(lower)) {
    return {
      type: 'REPORT_GENERATION',
      subType: lastContext.lastDataType || 'SALES',
      format: lower.includes('excel') || lower.includes('xlsx') ? 'EXCEL' : lower.includes('csv') ? 'CSV' : 'PDF',
    };
  }

  // 16. Period-specific sales summary (e.g. "Show last week's sales summary", "today sales", "yesterday sales")
  if (period || /(sales|sale|bill|bills|revenue|evlo sales|collection|விற்பனை)/i.test(lower)) {
    return { type: 'SALES_BILLING', period: period || 'today' };
  }

  // 17. Store overall summary
  if (/(summary|overview|status of.*supermarket|how is.*store|surukkam|சுருக்கம்)/i.test(lower)) {
    return { type: 'STORE_SUMMARY' };
  }

  // Fallback: general lookup
  return { type: 'GENERAL_LOOKUP' };
}

/**
 * Primary Natural-Language Execution Router
 */
export async function processAIQuestion({
  prompt,
  conversationId,
  user,
  pageContext = 'dashboard',
  selectionState = null,
}) {
  const startTime = Date.now();
  const session = getConversationSession(conversationId);
  const lang = detectLanguage(prompt);
  const intent = detectIntent(prompt, session.lastContext);

  const userRole = user?.role || 'CASHIER';
  const userId = user?.id;

  let verifiedData = null;
  let textResponse = '';
  let cards = [];
  let chart = null;
  let table = null;
  let reportAction = null;
  let suggestedFollowUps = [];

  // ==========================================
  // DISPATCH TO APPROVED BACKEND DATA SERVICE
  // ==========================================

  switch (intent.type) {
    case 'WEXA_IDENTITY': {
      const providerStatus = getAIProviderStatus();
      cards = [
        { label: 'AI Assistant', value: 'WEXA AI', highlight: true, color: 'orange' },
        { label: 'Powered By', value: 'WeEngineerTech', color: 'blue' },
        { label: 'Application', value: 'ANANTHA STORES POS', color: 'emerald' },
        { label: 'Intelligence Engine', value: providerStatus.isOnlineAIReady ? 'Gemini AI + Live DB' : 'Local Verified DB', color: 'purple' },
      ];

      if (lang === 'tanglish') {
        textResponse = `Naan **WEXA AI** — Powered by **WeEngineerTech**, unga **ANANTHA STORES** supermarket business intelligence assistant! Supermarket sales, stock status, profit analysis, Code 128 barcode labels, supplier purchases, matrum customer loyalty pathi real-time database details oda ungalukku udhavi seiven. Enkitta English, Tamil, alladhu Tanglish la ethu venaalum kelunga!`;
      } else if (lang === 'ta') {
        textResponse = `நான் **WEXA AI** — **WeEngineerTech**-ஆல் இயக்கப்படும் உங்கள் **ஆனந்தா ஸ்டோர்ஸ்** வணிக நுண்ணறிவு உதவியாளர்! விற்பனை, சரக்கு இருப்பு, லாபம், பார் கோடுகள், சப்ளையர்கள் மற்றும் வாடிக்கையாளர் விசுவாசப் புள்ளிகள் பற்றிய துல்லியமான தரவுகளை உடனுக்குடன் உங்களுக்கு வழங்குகிறேன். நீங்கள் தமிழ், ஆங்கிலம் அல்லது தங்கிலீஷில் என்னிடம் எந்த கேள்வியும் கேட்கலாம்.`;
      } else {
        textResponse = `I am **WEXA AI** — Powered by **WeEngineerTech**, the dedicated supermarket business assistant for **ANANTHA STORES**.\n\nI connect directly to your live supermarket records to provide verified answers on:\n• **Sales & Billing:** Daily/weekly/monthly revenue, hourly peaks, and bill counts.\n• **Inventory & Stock:** Low-stock items, safety reorders, and stock valuation.\n• **Profits & Margins:** Gross profit, profit margins, and purchase costs.\n• **Barcodes & Labels:** Missing barcodes, duplicates, and 85mm / label printing.\n• **Suppliers & Dues:** Outstanding vendor invoices and purchase history.\n• **Customers & Loyalty:** Registered customers and active loyalty points.\n\nAsk me anything in **English, Tamil (தமிழ்), or Tanglish**!`;
      }

      suggestedFollowUps = [
        'Inniku evlo sales aachu?',
        'Which product made the highest profit this month?',
        'Which items are running out of stock?',
        'Give me business recommendations',
      ];
      break;
    }

    case 'AI_SETUP_GUIDE': {
      const providerStatus = getAIProviderStatus();
      cards = [
        { label: 'Current Provider', value: providerStatus.provider, highlight: true },
        { label: 'Cloud AI Ready', value: providerStatus.isOnlineAIReady ? 'YES' : 'OFFLINE (Local Engine)' },
        { label: 'Config Key', value: 'GEMINI_API_KEY' },
        { label: 'Engine', value: 'WEXA AI Core' },
      ];

      textResponse = `### ⚙️ WEXA AI Configuration & Setup\n\n**Current Status:** ${providerStatus.setupMessage}\n\n**How to configure cloud AI capabilities:**\n1. Open your project environment file: \`.env\` (located in \`Anatha-stores-main/.env\`).\n2. Add your Google Gemini API Key:\n   \`\`\`env\n   GEMINI_API_KEY="your-google-gemini-api-key"\n   GEMINI_MODEL="gemini-2.5-flash"\n   \`\`\`\n3. Restart the backend server (\`npm run dev:server\`).\n\n*Note: WEXA AI works 100% reliably in offline mode using the local database engine if an external API key is not provided.*`;

      suggestedFollowUps = [
        'Who are you?',
        "What are today's sales?",
        'Which items are running out of stock?',
      ];
      break;
    }

    case 'BUSINESS_RECOMMENDATIONS': {
      verifiedData = await aiData.getStoreSummary({ userRole });
      const inventoryData = await aiData.getInventoryIntelligence({ userRole });
      const alertCount = (inventoryData.outOfStockCount || 0) + (inventoryData.lowStockCount || 0);

      cards = [
        { label: 'Actionable Alerts', value: `${alertCount} Low-Stock Items`, highlight: true, color: 'amber' },
        { label: 'Today Revenue', value: `₹${verifiedData.todaySales.toLocaleString('en-IN')}`, color: 'blue' },
        { label: 'Active Catalog', value: `${verifiedData.totalActiveProducts} Products`, color: 'purple' },
        { label: 'Loyalty Retention', value: `${verifiedData.totalRegisteredCustomers} Customers`, color: 'emerald' },
      ];

      if (lang === 'tanglish') {
        textResponse = `### 💡 WEXA AI — Supermarket Business Recommendations for ANANTHA STORES\n\n1. **Reorder Fast-Moving Essentials:** Currently **${alertCount} items** are running low or out of stock. Immediate replenishment will prevent revenue loss.\n2. **Promote High-Margin Categories:** Bundle personal care and spices with grocery staples (rice, atta) at billing counter for impulse purchase increase.\n3. **Leverage Customer Loyalty:** Reach out to your **${verifiedData.totalRegisteredCustomers} registered customers** with weekend SMS or WhatsApp offers on their loyalty points.\n4. **Optimize POS Peak Hours:** Schedule your fastest cashiers during peak evening sales hours to minimize checkout wait times.`;
      } else if (lang === 'ta') {
        textResponse = `### 💡 WEXA AI — ஆனந்தா ஸ்டோர்ஸ் வணிக முன்னேற்ற ஆலோசனைகள்\n\n1. **சரக்கு கையிருப்பு மேலாண்மை:** தற்போது **${alertCount} பொருட்கள்** குறைந்த இருப்பில் உள்ளன. வாடிக்கையாளர் திருப்தியை தக்கவைக்க உடனடியாக மீள் ஆர்டர் செய்யுங்கள்.\n2. **அதிக லாப வரம்பு பொருட்கள்:** மளிகைப் பொருட்களுடன் (அரிசி, ஆட்டா) லாபம் அதிகம் தரும் சிற்றுண்டிகள் மற்றும் வீட்டு உபயோகப் பொருட்களை பில்லிங் கவுண்டரில் காட்சிப்படுத்துங்கள்.\n3. **வாடிக்கையாளர் விசுவாச திட்டம்:** பதிவு செய்துள்ள **${verifiedData.totalRegisteredCustomers} வாடிக்கையாளர்களுக்கு** விசுவாச புள்ளிகளைப் பயன்படுத்த சிறப்பு சலுகைகளை அளியுங்கள்.\n4. **நெரிசல் நேர பில்லிங்:** மாலை நேர நெரிசலில் கூடுதல் பில்லிங் ஆட்களை நியமித்து வாடிக்கையாளர் காத்திருப்பு நேரத்தைக் குறையுங்கள்.`;
      } else {
        textResponse = `### 💡 WEXA AI — Strategic Supermarket Business Recommendations for ANANTHA STORES\n\nBased on your verified supermarket database metrics, here are key operational recommendations:\n\n1. **Restock Priority Items:** There are **${alertCount} items** critically low or out of stock. Replenishing these immediately will avoid lost walk-ins.\n2. **Basket Size Expansion (Cross-Selling):** Display high-margin packaged snacks, spices, and confectionery near the checkout counter to capture impulse purchases.\n3. **Customer Retention:** Activate promotional campaigns targeting your **${verifiedData.totalRegisteredCustomers} registered customers** with point redemption reminders.\n4. **Checkout Speed:** Review peak sales hours to ensure adequate cashier staff allocation during rush periods.`;
      }

      suggestedFollowUps = [
        'Which items are running out of stock?',
        'Which product made the highest profit this month?',
        'Show peak sales hours today',
        'How many registered customers do we have?',
      ];
      break;
    }

    case 'SALES_BILLING': {
      const period = intent.period || 'today';
      verifiedData = await aiData.getSalesIntelligence({ period, userRole, userId });
      session.lastContext = { lastDataType: 'SALES', lastPeriod: period, data: verifiedData };

      cards = [
        { label: 'Net Sales', value: `₹${verifiedData.netSales.toLocaleString('en-IN')}`, highlight: true, color: 'blue' },
        { label: 'Total Bills', value: `${verifiedData.totalBills}`, color: 'emerald' },
        { label: 'Avg Bill Value', value: `₹${verifiedData.averageBillValue.toLocaleString('en-IN')}`, color: 'purple' },
        { label: 'Discounts', value: `₹${verifiedData.discountsGiven.toLocaleString('en-IN')}`, color: 'amber' },
      ];

      if (verifiedData.hourlyDistribution.length > 0) {
        chart = {
          type: 'bar',
          title: `Sales by Hour (${verifiedData.period})`,
          xKey: 'hour',
          yKey: 'amount',
          data: verifiedData.hourlyDistribution,
          unit: '₹',
        };
      }

      if (lang === 'tanglish') {
        textResponse = `**${verifiedData.period}** la moththa Net Sales **₹${verifiedData.netSales.toLocaleString('en-IN')}** aagi irukku (${verifiedData.totalBills} bills). Average bill value **₹${verifiedData.averageBillValue}**. Peak hours: ${verifiedData.peakHours.map(p => `${p.hour} (₹${p.amount})`).join(', ') || 'N/A'}.`;
      } else if (lang === 'ta') {
        textResponse = `**${verifiedData.period}**-ல் மொத்த நிகர விற்பனை **₹${verifiedData.netSales.toLocaleString('en-IN')}** (${verifiedData.totalBills} ரசீதுகள்). சராசரி ரசீது மதிப்பு **₹${verifiedData.averageBillValue}**. வழங்கப்பட்ட தள்ளுபடி: ₹${verifiedData.discountsGiven}.`;
      } else {
        textResponse = `For **${verifiedData.period}**, the total net sales reached **₹${verifiedData.netSales.toLocaleString('en-IN')}** across **${verifiedData.totalBills} bills**, with an average bill value of **₹${verifiedData.averageBillValue}**. Total discounts applied were ₹${verifiedData.discountsGiven}.`;
      }

      suggestedFollowUps = [
        'Which product made the highest profit this month?',
        'Show payment method breakdown',
        'Compare yesterday with today',
        'Generate sales report as PDF',
      ];
      break;
    }

    case 'TOP_SELLING': {
      const period = intent.period || 'this_month';
      verifiedData = await aiData.getTopSellingProducts({ period, limit: 10, userRole });
      session.lastContext = {
        lastDataType: 'PRODUCTS',
        lastProductList: verifiedData.products,
        lastPeriod: period,
      };

      cards = [
        { label: 'Analyzed Period', value: verifiedData.period, color: 'blue' },
        { label: 'Top Products', value: `${verifiedData.products.length} items`, color: 'emerald' },
      ];

      if (verifiedData.products.length > 0) {
        chart = {
          type: 'bar',
          title: `Top Selling Products by Revenue (${verifiedData.period})`,
          xKey: 'name',
          yKey: 'revenue',
          data: verifiedData.products.slice(0, 7),
          unit: '₹',
        };

        table = {
          title: `Top Selling Products (${verifiedData.period})`,
          columns: [
            { key: 'name', label: 'Product Name' },
            { key: 'category', label: 'Category' },
            { key: 'quantitySold', label: 'Qty Sold' },
            { key: 'revenue', label: 'Revenue (₹)' },
            ...(userRole !== 'CASHIER' ? [{ key: 'grossProfit', label: 'Profit (₹)' }] : []),
          ],
          rows: verifiedData.products,
        };
      }

      const topItem = verifiedData.products[0];
      if (lang === 'tanglish') {
        textResponse = topItem 
          ? `**${verifiedData.period}** la highest selling item: **${topItem.name}** (Revenue: ₹${topItem.revenue.toLocaleString('en-IN')}, Qty: ${topItem.quantitySold} ${topItem.unit}). Full top 10 list keela table & chart la paarkalaam.`
          : 'Indha period la sales records edhum kidaikala.';
      } else if (lang === 'ta') {
        textResponse = topItem
          ? `**${verifiedData.period}**-ல் அதிக வருவாய் தந்த பொருள்: **${topItem.name}** (விற்பனை: ₹${topItem.revenue.toLocaleString('en-IN')}, அளவு: ${topItem.quantitySold} ${topItem.unit}). விவரங்களை கீழே உள்ள வரைபடம் மற்றும் அட்டவணையில் காண்க.`
          : 'இந்த காலத்தில் விற்பனை விவரங்கள் இல்லை.';
      } else {
        textResponse = topItem
          ? `The highest-performing product for **${verifiedData.period}** is **${topItem.name}**, generating **₹${topItem.revenue.toLocaleString('en-IN')}** in revenue with **${topItem.quantitySold} ${topItem.unit}** sold.`
          : 'No product sales recorded in this period.';
      }

      suggestedFollowUps = [
        'Which product made the highest profit this month?',
        'Export this product list to Excel',
        'Which items are running out of stock?',
        'Compare them with last month',
      ];
      break;
    }

    case 'INVENTORY_ALERT': {
      verifiedData = await aiData.getInventoryIntelligence({ userRole });
      session.lastContext = {
        lastDataType: 'LOW_STOCK',
        lastProductList: [...verifiedData.outOfStockProducts, ...verifiedData.lowStockProducts],
      };

      cards = [
        { label: 'Out of Stock', value: `${verifiedData.outOfStockCount} items`, color: 'red', highlight: verifiedData.outOfStockCount > 0 },
        { label: 'Low Stock Alert', value: `${verifiedData.lowStockCount} items`, color: 'amber', highlight: verifiedData.lowStockCount > 0 },
        { label: 'Healthy Stock', value: `${verifiedData.healthyStockCount} items`, color: 'emerald' },
      ];

      const urgentItems = [...verifiedData.outOfStockProducts, ...verifiedData.lowStockProducts];
      if (urgentItems.length > 0) {
        table = {
          title: 'Immediate Reorder & Stock Depletion List',
          columns: [
            { key: 'name', label: 'Product Name' },
            { key: 'currentStock', label: 'Current Stock' },
            { key: 'minStock', label: 'Min Safety Stock' },
            { key: 'recommendedReorderQty', label: 'Reorder Qty' },
            { key: 'supplier', label: 'Supplier' },
          ],
          rows: urgentItems.slice(0, 10),
        };
      }

      if (lang === 'tanglish') {
        textResponse = `Supermarket la **${verifiedData.outOfStockCount} items out-of-stock** aagi irukku, **${verifiedData.lowStockCount} items low-stock** la irukku. Urgent reorder suggestions keela table la kuduthirukken.`;
      } else if (lang === 'ta') {
        textResponse = `கடையில் **${verifiedData.outOfStockCount} பொருட்கள் முற்றிலுமாக தீர்ந்துவிட்டன**, **${verifiedData.lowStockCount} பொருட்கள் குறைந்த இருப்பு நிலையில் உள்ளன**. உடனடியாக கொள்முதல் செய்ய வேண்டிய பொருட்கள் கீழே பட்டியலிடப்பட்டுள்ளன.`;
      } else {
        textResponse = `Currently, **${verifiedData.outOfStockCount} products are completely out of stock** and **${verifiedData.lowStockCount} products are below safety stock threshold**. Check the reorder recommendations below.`;
      }

      suggestedFollowUps = [
        'Generate a report for these',
        'Which suppliers should I contact for these items?',
        'Export this month\'s low-stock products to Excel',
        'Show stock valuation',
      ];
      break;
    }

    case 'PROFIT_FINANCIAL': {
      if (userRole === 'CASHIER') {
        textResponse = 'Access Restricted: Profit margin and wholesale purchase cost analysis requires Manager or Admin authorization. As a cashier, you can view product selling prices, stock levels, and your own shift sales.';
        break;
      }

      const period = intent.period || 'this_month';
      verifiedData = await aiData.getFinancialIntelligence({ period, userRole });
      session.lastContext = { lastDataType: 'FINANCIAL', lastPeriod: period, data: verifiedData };

      cards = [
        { label: 'Net Sales Revenue', value: `₹${verifiedData.netSales.toLocaleString('en-IN')}`, color: 'blue' },
        { label: 'Cost of Goods Sold (COGS)', value: `₹${verifiedData.costOfGoodsSold.toLocaleString('en-IN')}`, color: 'slate' },
        { label: 'Gross Profit', value: `₹${verifiedData.grossProfit.toLocaleString('en-IN')}`, highlight: true, color: 'emerald' },
        { label: 'Gross Profit Margin', value: `${verifiedData.grossProfitMarginPercent}%`, color: 'purple' },
      ];

      chart = {
        type: 'pie',
        title: `Revenue vs Cost Distribution (${verifiedData.period})`,
        data: [
          { name: 'Cost of Goods Sold', value: verifiedData.costOfGoodsSold },
          { name: 'Gross Profit', value: Math.max(verifiedData.grossProfit, 0) },
        ],
      };

      if (lang === 'tanglish') {
        textResponse = `**${verifiedData.period}** la Gross Profit **₹${verifiedData.grossProfit.toLocaleString('en-IN')}** (Margin: **${verifiedData.grossProfitMarginPercent}%**). Verified Net Sales: ₹${verifiedData.netSales.toLocaleString('en-IN')}, Cost of Goods Sold: ₹${verifiedData.costOfGoodsSold.toLocaleString('en-IN')}. *Note: Operating expenses (rent/EB) store database la register aagalai, adhunaal idhu Gross Profit aagum.*`;
      } else if (lang === 'ta') {
        textResponse = `**${verifiedData.period}**-ல் மொத்த லாபம் (Gross Profit) **₹${verifiedData.grossProfit.toLocaleString('en-IN')}** (லாப விகிதம்: **${verifiedData.grossProfitMarginPercent}%**). நிகர விற்பனை: ₹${verifiedData.netSales.toLocaleString('en-IN')}, சரக்கு அடக்கவிலை (COGS): ₹${verifiedData.costOfGoodsSold.toLocaleString('en-IN')}.`;
      } else {
        textResponse = `For **${verifiedData.period}**, Gross Profit stands at **₹${verifiedData.grossProfit.toLocaleString('en-IN')}** with a Gross Margin of **${verifiedData.grossProfitMarginPercent}%**. Revenue (Net Sales) is ₹${verifiedData.netSales.toLocaleString('en-IN')} against Cost of Goods Sold (COGS) of ₹${verifiedData.costOfGoodsSold.toLocaleString('en-IN')}. Operating expenses (rent, utilities) are not tracked separately in the store database.`;
      }

      suggestedFollowUps = [
        'Which product made the highest profit this month?',
        'Compare revenue and purchases',
        'Export profit report to Excel',
        'Show last week\'s sales compared with this week',
      ];
      break;
    }

    case 'BARCODE_PRINTING': {
      verifiedData = await aiData.getBarcodeIntelligence({ currentSelectionState: selectionState });
      session.lastContext = { lastDataType: 'BARCODES', data: verifiedData };

      cards = [
        { label: 'Total Products', value: `${verifiedData.totalProducts}`, color: 'blue' },
        { label: 'Valid Barcodes', value: `${verifiedData.validBarcodesCount}`, color: 'emerald' },
        { label: 'Missing Barcodes', value: `${verifiedData.missingBarcodesCount}`, color: 'amber', highlight: verifiedData.missingBarcodesCount > 0 },
        { label: 'Duplicate Barcodes', value: `${verifiedData.duplicateBarcodesCount}`, color: 'red', highlight: verifiedData.duplicateBarcodesCount > 0 },
      ];

      if (verifiedData.duplicateBarcodes.length > 0) {
        table = {
          title: 'Duplicate Barcodes Detected (Action Required)',
          columns: [
            { key: 'barcode', label: 'Barcode' },
            { key: 'count', label: 'Conflict Count' },
            { key: 'products', label: 'Affected Products' },
          ],
          rows: verifiedData.duplicateBarcodes.map(d => ({
            barcode: d.barcode,
            count: d.count,
            products: d.products.join(', '),
          })),
        };
      }

      if (lang === 'tanglish') {
        textResponse = `Store la moththam **${verifiedData.totalProducts} products** irukku. Idhula **${verifiedData.validBarcodesCount} items ku valid barcode** irukku, **${verifiedData.missingBarcodesCount} items ku barcode missing**. Duplicate barcodes: **${verifiedData.duplicateBarcodesCount}**. Barcode Management tab la 'Generate Missing Barcodes' click panni auto-generate pannalaam.`;
      } else if (lang === 'ta') {
        textResponse = `மொத்த பொருட்களில் **${verifiedData.validBarcodesCount} பொருட்களுக்கு முறையான பார்கோடுகள்** உள்ளன. **${verifiedData.missingBarcodesCount} பொருட்களுக்கு பார்கோடு இல்லை**. நகல் பார்கோடுகள்: **${verifiedData.duplicateBarcodesCount}**. பார்கோடு மேலாண்மை பக்கத்தில் ஒரே கிளிக்கில் விடுபட்ட பார்கோடுகளை உருவாக்கலாம்.`;
      } else {
        textResponse = `Out of **${verifiedData.totalProducts} active products**, **${verifiedData.validBarcodesCount} have valid Code 128 barcodes**, **${verifiedData.missingBarcodesCount} have missing barcodes**, and **${verifiedData.duplicateBarcodesCount} duplicate barcodes** were detected. You can auto-generate all missing barcodes in the Barcode Management tab.`;
      }

      suggestedFollowUps = [
        'How many barcode labels are pending?',
        'Which products have duplicate barcodes?',
        'How to optimize barcode print job?',
        'Export barcode status to Excel',
      ];
      break;
    }

    case 'SUPPLIERS': {
      if (userRole === 'CASHIER') {
        textResponse = 'Access Restricted: Supplier ledger and purchase information requires Manager or Admin authorization.';
        break;
      }

      verifiedData = await aiData.getSupplierIntelligence({ userRole });
      session.lastContext = { lastDataType: 'SUPPLIERS', data: verifiedData };

      cards = [
        { label: 'Active Suppliers', value: `${verifiedData.totalSuppliers}`, color: 'blue' },
        { label: 'Outstanding Dues', value: `₹${verifiedData.totalOutstandingDues.toLocaleString('en-IN')}`, color: 'amber', highlight: verifiedData.totalOutstandingDues > 0 },
      ];

      table = {
        title: 'Supplier Portfolio & Payment Status',
        columns: [
          { key: 'name', label: 'Supplier Name' },
          { key: 'contactPerson', label: 'Contact' },
          { key: 'phone', label: 'Phone' },
          { key: 'totalSpend', label: 'Total Purchases (₹)' },
          { key: 'pendingDues', label: 'Pending Dues (₹)' },
        ],
        rows: verifiedData.suppliers,
      };

      if (lang === 'tanglish') {
        textResponse = `Store la **${verifiedData.totalSuppliers} registered suppliers** irukaanga. Moththa outstanding purchase dues: **₹${verifiedData.totalOutstandingDues.toLocaleString('en-IN')}**. Contact details & purchase history keela table la irukku.`;
      } else {
        textResponse = `Found **${verifiedData.totalSuppliers} registered suppliers** with **₹${verifiedData.totalOutstandingDues.toLocaleString('en-IN')} in outstanding dues**. See full contact and invoice summary below.`;
      }

      suggestedFollowUps = [
        'Which suppliers are associated with out of stock items?',
        'Show purchase invoice history',
        'Which products should I reorder?',
      ];
      break;
    }

    case 'CUSTOMERS': {
      verifiedData = await aiData.getCustomerIntelligence({ userRole });
      session.lastContext = { lastDataType: 'CUSTOMERS', data: verifiedData };

      cards = [
        { label: 'Registered Customers', value: `${verifiedData.totalRegisteredCustomers}`, color: 'blue' },
        { label: 'Loyalty Points Balance', value: `${verifiedData.totalPointsInCirculation} pts`, color: 'purple' },
        { label: 'Earn Rule', value: verifiedData.loyaltySettings.earnRule, color: 'emerald' },
      ];

      if (verifiedData.topCustomers.length > 0) {
        table = {
          title: 'Top Loyal Customers',
          columns: [
            { key: 'name', label: 'Customer Name' },
            { key: 'maskedPhone', label: 'Phone' },
            { key: 'loyaltyBalance', label: 'Points Balance' },
            { key: 'visitCount', label: 'Visits' },
            { key: 'totalPurchases', label: 'Total Spend (₹)' },
          ],
          rows: verifiedData.topCustomers,
        };
      }

      textResponse = `ANANTHA STORES has **${verifiedData.totalRegisteredCustomers} registered customers** with a circulating loyalty balance of **${verifiedData.totalPointsInCirculation} points** (${verifiedData.loyaltySettings.redemptionRule}). Top customer records are summarized below.`;
      suggestedFollowUps = [
        'Show loyalty program performance',
        'What is our average customer spend?',
        'Today sales summary',
      ];
      break;
    }

    case 'STAFF_CASHIER': {
      if (userRole === 'CASHIER') {
        textResponse = 'Access Restricted: Multi-cashier shift reconciliation requires Manager or Admin authorization.';
        break;
      }

      verifiedData = await aiData.getStaffCashierIntelligence({ userRole });
      session.lastContext = { lastDataType: 'STAFF', data: verifiedData };

      cards = [
        { label: 'Total Active Staff', value: `${verifiedData.totalStaff}`, color: 'blue' },
      ];

      table = {
        title: 'Cashier-Wise Billing & Collection Summary',
        columns: [
          { key: 'fullName', label: 'Cashier Name' },
          { key: 'username', label: 'Username' },
          { key: 'role', label: 'Role' },
          { key: 'totalBillsHandled', label: 'Bills Handled' },
          { key: 'totalSalesRevenue', label: 'Total Revenue (₹)' },
          { key: 'averageBillValue', label: 'Avg Bill (₹)' },
        ],
        rows: verifiedData.staff,
      };

      textResponse = `Here is the verified cashier performance breakdown across **${verifiedData.totalStaff} staff accounts**.`;
      suggestedFollowUps = [
        'Today sales collection by payment method',
        'Show audit log summary',
        'Overview of supermarket',
      ];
      break;
    }

    case 'PERIOD_COMPARISON': {
      const periodA = intent.periodA || 'this_week';
      const periodB = intent.periodB || 'last_week';
      verifiedData = await aiData.comparePeriods({ periodA, periodB, userRole });
      session.lastContext = { lastDataType: 'COMPARISON', data: verifiedData };

      cards = [
        { label: verifiedData.periodA.label, value: `₹${verifiedData.periodA.totalSales.toLocaleString('en-IN')}`, color: 'blue' },
        { label: verifiedData.periodB.label, value: `₹${verifiedData.periodB.totalSales.toLocaleString('en-IN')}`, color: 'slate' },
        { 
          label: 'Change', 
          value: `${verifiedData.difference >= 0 ? '+' : ''}₹${verifiedData.difference.toLocaleString('en-IN')} (${verifiedData.percentageChange}%)`, 
          color: verifiedData.difference >= 0 ? 'emerald' : 'red', 
          highlight: true 
        },
      ];

      chart = {
        type: 'bar',
        title: `Period Comparison: ${verifiedData.periodA.label} vs ${verifiedData.periodB.label}`,
        xKey: 'period',
        yKey: 'sales',
        data: [
          { period: verifiedData.periodA.label, sales: verifiedData.periodA.totalSales },
          { period: verifiedData.periodB.label, sales: verifiedData.periodB.totalSales },
        ],
        unit: '₹',
      };

      const direction = verifiedData.difference >= 0 ? 'increased' : 'decreased';
      if (lang === 'tanglish') {
        textResponse = `**${verifiedData.periodA.label}** sales (₹${verifiedData.periodA.totalSales.toLocaleString('en-IN')}) **${verifiedData.periodB.label}** (₹${verifiedData.periodB.totalSales.toLocaleString('en-IN')}) oda compare pannumpothu **${Math.abs(verifiedData.percentageChange)}% ${direction}** aagi irukku (Difference: ₹${verifiedData.difference.toLocaleString('en-IN')}).`;
      } else {
        textResponse = `Sales for **${verifiedData.periodA.label}** (₹${verifiedData.periodA.totalSales.toLocaleString('en-IN')}) **${direction} by ${Math.abs(verifiedData.percentageChange)}%** compared to **${verifiedData.periodB.label}** (₹${verifiedData.periodB.totalSales.toLocaleString('en-IN')}), representing a net change of ₹${verifiedData.difference.toLocaleString('en-IN')}.`;
      }

      suggestedFollowUps = [
        'Why did today\'s sales decrease?',
        'Which product made the highest profit this month?',
        'Generate comparison report',
      ];
      break;
    }

    case 'SALES_DECLINE_ANALYSIS': {
      const todaySales = await aiData.getSalesIntelligence({ period: 'today', userRole, userId });
      const yesterdaySales = await aiData.getSalesIntelligence({ period: 'yesterday', userRole, userId });
      verifiedData = { today: todaySales, yesterday: yesterdaySales };

      const diff = todaySales.netSales - yesterdaySales.netSales;
      const billDiff = todaySales.totalBills - yesterdaySales.totalBills;

      cards = [
        { label: 'Today Sales', value: `₹${todaySales.netSales.toLocaleString('en-IN')}`, color: 'blue' },
        { label: 'Yesterday Sales', value: `₹${yesterdaySales.netSales.toLocaleString('en-IN')}`, color: 'slate' },
        { label: 'Bill Volume Diff', value: `${billDiff >= 0 ? '+' : ''}${billDiff} bills`, color: billDiff >= 0 ? 'emerald' : 'amber' },
      ];

      if (diff < 0) {
        textResponse = `Today's net sales (₹${todaySales.netSales.toLocaleString('en-IN')}) are lower than yesterday (₹${yesterdaySales.netSales.toLocaleString('en-IN')}) by ₹${Math.abs(diff).toLocaleString('en-IN')}. Key drivers:\n1. **Footfall & Bill Count**: Today saw ${todaySales.totalBills} bills vs ${yesterdaySales.totalBills} bills yesterday (${Math.abs(billDiff)} fewer checkouts).\n2. **Average Basket Size**: Today's average basket is ₹${todaySales.averageBillValue} vs ₹${yesterdaySales.averageBillValue} yesterday.\n3. Peak evening hours may still bring additional volume before closing.`;
      } else {
        textResponse = `Today's sales (₹${todaySales.netSales.toLocaleString('en-IN')}) are actually **higher** than yesterday (₹${yesterdaySales.netSales.toLocaleString('en-IN')}) by **+₹${diff.toLocaleString('en-IN')}**, driven by strong bill volume (${todaySales.totalBills} bills today vs ${yesterdaySales.totalBills} yesterday).`;
      }

      suggestedFollowUps = [
        'Show today\'s peak sales hours',
        'Top selling products today',
        'Which items are running out of stock?',
      ];
      break;
    }

    case 'REPORT_GENERATION': {
      const reportType = session.lastContext.lastDataType || 'SALES';
      const format = intent.format || 'PDF';

      reportAction = {
        action: 'EXPORT_REPORT',
        reportType,
        format,
        period: session.lastContext.lastPeriod || 'this_month',
        title: `ANANTHA_STORES_${reportType}_REPORT`,
        rows: session.lastContext.lastProductList || session.lastContext.data?.products || [],
      };

      textResponse = `Ready! I have prepared the **${reportType} Report in ${format} format**. Click the download button below to export your verified report directly.`;
      break;
    }

    case 'STORE_SUMMARY':
    default: {
      verifiedData = await aiData.getStoreSummary({ userRole });
      session.lastContext = { lastDataType: 'SUMMARY', data: verifiedData };

      cards = [
        { label: 'Today Sales', value: `₹${verifiedData.todaySales.toLocaleString('en-IN')}`, highlight: true, color: 'blue' },
        { label: 'This Month Sales', value: `₹${verifiedData.monthSales.toLocaleString('en-IN')}`, color: 'emerald' },
        { label: 'Active Catalog', value: `${verifiedData.totalActiveProducts} Products`, color: 'purple' },
        { label: 'Low Stock Alerts', value: `${verifiedData.lowStockAlerts}`, color: verifiedData.lowStockAlerts > 0 ? 'amber' : 'slate' },
      ];

      if (lang === 'tanglish') {
        textResponse = `ANANTHA STORES Status Summary: Inniku sales **₹${verifiedData.todaySales.toLocaleString('en-IN')}** (${verifiedData.todayBills} bills), Indha maasam total sales **₹${verifiedData.monthSales.toLocaleString('en-IN')}**. Active catalog la **${verifiedData.totalActiveProducts} products** irukku, **${verifiedData.lowStockAlerts} items ku low-stock alert** irukku.`;
      } else if (lang === 'ta') {
        textResponse = `ஆனந்தா ஸ்டோர்ஸ் சுருக்கம்: இன்றைய விற்பனை **₹${verifiedData.todaySales.toLocaleString('en-IN')}** (${verifiedData.todayBills} பில்கள்), இந்த மாத விற்பனை **₹${verifiedData.monthSales.toLocaleString('en-IN')}**. கடையில் **${verifiedData.totalActiveProducts} பொருட்கள்** விற்பனையில் உள்ளன. **${verifiedData.lowStockAlerts} பொருட்கள் குறைந்த இருப்பில்** உள்ளன.`;
      } else {
        textResponse = `ANANTHA STORES Operational Summary: Today's sales stand at **₹${verifiedData.todaySales.toLocaleString('en-IN')}** across **${verifiedData.todayBills} bills**, bringing month-to-date sales to **₹${verifiedData.monthSales.toLocaleString('en-IN')}**. The catalog contains **${verifiedData.totalActiveProducts} active products** with **${verifiedData.lowStockAlerts} items requiring stock replenishment**.`;
      }

      suggestedFollowUps = [
        'Inniku evlo sales aachu?',
        'Which product made the highest profit this month?',
        'Which items are running out of stock?',
        'Show last week\'s sales compared with this week',
      ];
      break;
    }
  }

  // ==========================================
  // LLM ENHANCEMENT (IF GEMINI API KEY IS SET)
  // ==========================================
  const providerStatus = getAIProviderStatus();
  if (providerStatus.isOnlineAIReady && verifiedData) {
    try {
      const llmText = await generateLLMExplanation({
        prompt,
        verifiedData,
        conversationHistory: session.history,
        language: lang,
      });
      if (llmText && llmText.trim().length > 10) {
        textResponse = llmText;
      }
    } catch (e) {
      // Fallback kept to verified deterministic text
    }
  }

  // Update conversation history
  session.history.push({ role: 'user', content: prompt });
  session.history.push({ role: 'assistant', content: textResponse });
  if (session.history.length > 20) session.history = session.history.slice(-20);

  return {
    text: textResponse,
    cards,
    chart,
    table,
    reportAction,
    suggestedFollowUps,
    provider: providerStatus.provider,
    model: providerStatus.model,
    executionTimeMs: Date.now() - startTime,
  };
}

/**
 * Suggested questions based on active page context.
 */
export function getContextualSuggestions(pageContext = 'dashboard', role = 'ADMIN') {
  switch (pageContext) {
    case 'cashier_pos':
      return [
        'Check stock for Rice',
        'What is my cash collected today?',
        'How do I override a price?',
        'Look up customer loyalty points',
        'How do I hold or resume a bill?',
      ];

    case 'barcodes':
      return [
        'How many products have missing barcodes?',
        'Which products have duplicate barcodes?',
        'How many labels will be printed for current selection?',
        'What is the recommended barcode standard?',
        'How do I fix a barcode that cannot be scanned?',
      ];

    case 'inventory':
      return [
        'Which items are running out of stock?',
        'Show stock valuation by purchase cost',
        'Which products should I reorder?',
        'Show slow-moving products with zero sales',
        'Export low-stock products to Excel',
      ];

    case 'reports':
      return [
        'Inniku evlo sales aachu?',
        'Which product made the highest profit this month?',
        'Show last week\'s sales compared with this week',
        'Generate last week\'s sales report as PDF',
        'Compare payment methods breakdown',
      ];

    case 'suppliers':
      return [
        'How much total dues do we owe to suppliers?',
        'List all active suppliers and contacts',
        'Which suppliers provide frequently out-of-stock items?',
      ];

    case 'dashboard':
    default:
      return [
        'Inniku evlo sales aachu?',
        'Which product made the highest profit this month?',
        'Which items are running out of stock?',
        'Show last week\'s sales compared with this week',
        'Why did today\'s sales decrease?',
        'Give me a summary of the supermarket',
      ];
  }
}
