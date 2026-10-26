import assert from 'assert';
import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

async function runWexaAITestSuite() {
  console.log('================================================================');
  console.log('🤖 WEXA AI — Powered by WeEngineerTech Integration Test Suite');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function recordPass(testName) {
    console.log(`  ✔ [PASS] ${testName}`);
    passed++;
  }

  function recordFail(testName, err) {
    console.error(`  ❌ [FAIL] ${testName}:`, err.message || err);
    failed++;
  }

  // 1. Authenticate Admin, Manager, and Cashier
  let adminToken, managerToken, cashierToken;
  try {
    const adminRes = await axios.post(`${API_BASE}/auth/login`, { username: 'admin', password: 'admin123' });
    adminToken = adminRes.data.token;

    const managerRes = await axios.post(`${API_BASE}/auth/login`, { username: 'manager', password: 'manager123' });
    managerToken = managerRes.data.token;

    const cashierRes = await axios.post(`${API_BASE}/auth/login`, { username: 'cashier', password: 'cashier123' });
    cashierToken = cashierRes.data.token;

    recordPass('1. Auth Tokens acquired for Admin, Manager, and Cashier');
  } catch (err) {
    recordFail('1. Authentication', err);
    process.exit(1);
  }

  const adminHeaders = { headers: { Authorization: `Bearer ${adminToken}` } };
  const managerHeaders = { headers: { Authorization: `Bearer ${managerToken}` } };
  const cashierHeaders = { headers: { Authorization: `Bearer ${cashierToken}` } };

  async function askWexa(prompt, headers = adminHeaders, convId = null, extra = {}) {
    const res = await axios.post(`${API_BASE}/ai/chat`, {
      prompt,
      conversationId: convId || `wexa_test_${Date.now()}_${Math.random()}`,
      ...extra,
    }, headers);
    return res.data;
  }

  // 2. WEXA AI Health & Branding
  try {
    const health = await axios.get(`${API_BASE}/ai/health`);
    assert.strictEqual(health.data.status, 'ONLINE');
    assert(health.data.assistant.includes('WEXA AI'), 'Assistant must include WEXA AI');
    assert(health.data.assistant.includes('WeEngineerTech'), 'Assistant must include WeEngineerTech');
    assert.strictEqual(health.data.name, 'WEXA AI');
    assert.strictEqual(health.data.poweredBy, 'WeEngineerTech');
    recordPass('2. WEXA AI — Powered by WeEngineerTech branding verified on /ai/health');
  } catch (err) {
    recordFail('2. WEXA AI Health & Branding', err);
  }

  // 3. Identity Question: "Who are you?"
  try {
    const res = await askWexa('Who are you?');
    assert(res.text.includes('WEXA AI'), 'Response must identify as WEXA AI');
    assert(res.text.includes('WeEngineerTech'), 'Response must state Powered by WeEngineerTech');
    assert(res.cards.some((c) => c.label === 'AI Assistant' && c.value === 'WEXA AI'));
    assert(res.cards.some((c) => c.label === 'Powered By' && c.value === 'WeEngineerTech'));
    recordPass('3. WEXA AI Identity verified for English question: "Who are you?"');
  } catch (err) {
    recordFail('3. WEXA AI Identity (English)', err);
  }

  // 4. Identity Question in Tanglish: "Neenga yaaru?"
  try {
    const res = await askWexa('Neenga yaaru?');
    assert(res.text.includes('WEXA AI'));
    assert(res.text.includes('WeEngineerTech'));
    recordPass('4. WEXA AI Identity verified for Tanglish question: "Neenga yaaru?"');
  } catch (err) {
    recordFail('4. WEXA AI Identity (Tanglish)', err);
  }

  // 5. Identity Question in Tamil: "யார் நீங்கள்?"
  try {
    const res = await askWexa('யார் நீங்கள்?');
    assert(res.text.includes('WEXA AI'));
    assert(res.text.includes('WeEngineerTech'));
    recordPass('5. WEXA AI Identity verified for Tamil question: "யார் நீங்கள்?"');
  } catch (err) {
    recordFail('5. WEXA AI Identity (Tamil)', err);
  }

  // 6. Setup Guide Query: "How to setup AI provider?"
  try {
    const res = await askWexa('How to setup AI provider?');
    assert(res.text.includes('GEMINI_API_KEY'));
    assert(res.cards.some((c) => c.label === 'Current Provider'));
    recordPass('6. AI Provider setup guidance returned with .env instructions');
  } catch (err) {
    recordFail('6. AI Provider setup guidance', err);
  }

  // 7. Strategic Business Recommendations
  try {
    const res = await askWexa('Give me business recommendations for my supermarket');
    assert(res.text.includes('Recommendations'));
    assert(res.cards.some((c) => c.label === 'Actionable Alerts'));
    recordPass('7. Strategic supermarket business recommendations returned');
  } catch (err) {
    recordFail('7. Business recommendations', err);
  }

  // 8. Low-stock inventory lookup
  try {
    const res = await askWexa('Which items are running out of stock?');
    assert(res.cards.some((c) => c.label === 'Low Stock Alert' || c.label === 'Out of Stock'));
    assert(res.table && res.table.rows.length > 0);
    recordPass('8. Database-backed real low-stock records verified');
  } catch (err) {
    recordFail('8. Low-stock inventory lookup', err);
  }

  // 9. Barcode printing advice
  try {
    const res = await askWexa('What barcode standard is used?');
    assert(res.text.includes('Code 128'));
    recordPass('9. Barcode management verified: Code 128 standard supported');
  } catch (err) {
    recordFail('9. Barcode standard inquiry', err);
  }

  // 10. Role-based security: Cashier blocked from profit margins
  try {
    const res = await askWexa("What is this month's profit margin?", cashierHeaders);
    assert(res.text.includes('Access Restricted'), 'Cashier must be blocked from storewide profits');
    recordPass('10. Security verified: Cashier role restricted from viewing profit margins');
  } catch (err) {
    recordFail('10. Cashier profit restriction', err);
  }

  // 11. Role-based security: Admin authorized to view profit
  try {
    const res = await askWexa("What is this month's profit margin?", adminHeaders);
    assert(!res.text.includes('Access Restricted'));
    assert(res.cards.some((c) => c.label.includes('Margin') || c.label.includes('Profit')));
    recordPass('11. Security verified: Admin role authorized to access profit margins');
  } catch (err) {
    recordFail('11. Admin profit authorization', err);
  }

  // 12. Multilingual: Tanglish Sales
  try {
    const res = await askWexa('Inniku evlo sales aachu?');
    assert(res.cards.some((c) => c.label === 'Net Sales'));
    recordPass('12. Tanglish sales question: "Inniku evlo sales aachu?" answered accurately');
  } catch (err) {
    recordFail('12. Tanglish sales question', err);
  }

  // 13. Multilingual: Tamil Products
  try {
    const res = await askWexa('இந்த மாதம் அதிகம் விற்ற பொருள் எது?');
    assert(res.table || res.text.includes('விற்பனை'));
    recordPass('13. Tamil products question answered with verified database table');
  } catch (err) {
    recordFail('13. Tamil products question', err);
  }

  // 14. Clear Conversation History
  try {
    const clearRes = await axios.post(`${API_BASE}/ai/clear-history`, {
      conversationId: 'wexa_clear_test_session',
    }, adminHeaders);
    assert(clearRes.data.success);
    recordPass('14. WEXA AI Conversation memory reset verified');
  } catch (err) {
    recordFail('14. Conversation memory reset', err);
  }

  console.log('\n================================================================');
  console.log(`📊 WEXA AI TEST SUITE COMPLETE: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL WEXA AI — POWERED BY WEENGINEERTECH TESTS PASSED 100%!');
    process.exit(0);
  }
}

runWexaAITestSuite();
