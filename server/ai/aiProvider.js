import dotenv from 'dotenv';
dotenv.config();

let GoogleGenAI = null;
try {
  const genaiModule = await import('@google/genai');
  GoogleGenAI = genaiModule.GoogleGenAI;
} catch (err) {
  // Graceful fallback if module isn't loaded
}

/**
 * Checks whether an external LLM API is configured and available.
 */
export function getAIProviderStatus() {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const isGeminiConfigured = Boolean(geminiKey && geminiKey.trim() !== '');

  return {
    assistantName: 'WEXA AI',
    branding: 'WEXA AI — Powered by WeEngineerTech',
    poweredBy: 'WeEngineerTech',
    provider: isGeminiConfigured ? 'GEMINI' : 'BUILTIN_LOCAL_SEMANTIC',
    model: isGeminiConfigured ? (process.env.GEMINI_MODEL || 'gemini-2.5-flash') : 'WEXA-Local-Semantic-Engine-v1',
    isOnlineAIReady: isGeminiConfigured,
    supportsOffline: true,
    setupMessage: isGeminiConfigured
      ? 'Configured and connected to Google Gemini cloud AI.'
      : 'External AI service key is not configured. WEXA AI is operating using the high-accuracy local database engine. To enable Gemini, set GEMINI_API_KEY in your .env file.',
  };
}

/**
 * Generates an LLM-grounded response using Google Gen AI SDK if key exists.
 */
export async function generateLLMExplanation({ prompt, verifiedData, conversationHistory = [], language = 'en' }) {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiKey || !GoogleGenAI) {
    return null; // Signals engine to use rich local semantic synthesis
  }

  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    const systemInstruction = `
You are WEXA AI — Powered by WeEngineerTech, the intelligent, highly capable business assistant for "ANANTHA STORES" Supermarket.
You help supermarket owners, managers, and cashiers manage their store with real database data.

STRICT RULES:
1. Always base all financial figures, quantities, prices, and stock numbers strictly on the provided VERIFIED_DATA.
2. Never invent or hallucinate sales figures, profit margins, product stock, or customer records.
3. Understand and reply naturally in the language of the user: English, Tamil (தமிழ்), or Tanglish (Tamil in English letters).
4. If the user asked in Tanglish (e.g. "Inniku evlo sales aachu?"), respond in warm, polite, conversational Tanglish mixed with clean English numbers and business terms.
5. If the user asked in Tamil (e.g. "இன்று விற்பனை எவ்வளவு?"), respond in clear, grammatically sound Tamil.
6. Clearly distinguish between Gross Sales, Net Sales, Discounts, and Gross Profit. Note that operating expenses (rent, electricity) are not tracked unless specified.
7. Be concise, direct, professional, and highlight actionable advice.
8. If asked who you are or your name, identify yourself as WEXA AI — Powered by WeEngineerTech.
`;

    const formattedHistory = conversationHistory.slice(-4).map((msg) => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}`).join('\n');

    const contents = `
${formattedHistory ? `PREVIOUS CONVERSATION CONTEXT:\n${formattedHistory}\n\n` : ''}
VERIFIED DATABASE DATA:
${JSON.stringify(verifiedData, null, 2)}

USER QUESTION:
${prompt}

Provide a clear, warm, professional answer grounded exclusively in the verified data above.
`;

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        temperature: 0.2, // Low temperature for high factual accuracy
      },
    });

    return response.text;
  } catch (err) {
    console.warn('Gemini API call failed or timed out, falling back to local semantic synthesis:', err.message);
    return null;
  }
}
