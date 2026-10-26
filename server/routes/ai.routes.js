import express from 'express';
import { verifyToken } from '../middleware/auth.middleware.js';
import { processAIQuestion, getContextualSuggestions, clearConversationHistory } from '../ai/aiQueryEngine.js';
import { getAIProviderStatus } from '../ai/aiProvider.js';

const router = express.Router();

/**
 * GET /api/ai/health
 * Returns status of AI subsystems and configured provider.
 */
router.get('/health', async (req, res) => {
  try {
    const status = getAIProviderStatus();
    res.json({
      status: 'ONLINE',
      assistant: 'WEXA AI — Powered by WeEngineerTech (ANANTHA AI Supermarket Business Intelligence)',
      name: 'WEXA AI',
      poweredBy: 'WeEngineerTech',
      ...status,
    });
  } catch (err) {
    res.status(500).json({ error: 'AI health check failed', message: err.message });
  }
});

/**
 * GET /api/ai/suggested-questions
 * Returns dynamic suggestions tailored to the current screen and user role.
 */
router.get('/suggested-questions', verifyToken, async (req, res) => {
  try {
    const { pageContext = 'dashboard' } = req.query;
    const role = req.user?.role || 'CASHIER';
    const suggestions = getContextualSuggestions(pageContext, role);
    res.json({ pageContext, role, suggestions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch suggestions', message: err.message });
  }
});

/**
 * POST /api/ai/chat
 * Primary conversation endpoint.
 */
router.post('/chat', verifyToken, async (req, res) => {
  try {
    const { prompt, conversationId, pageContext, selectionState } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return res.status(400).json({ error: 'Question prompt is required.' });
    }

    const response = await processAIQuestion({
      prompt: prompt.trim(),
      conversationId: conversationId || `session_${req.user.id}`,
      user: req.user,
      pageContext: pageContext || 'dashboard',
      selectionState,
    });

    res.json(response);
  } catch (err) {
    console.error('ANANTHA AI Execution Error:', err);
    res.status(500).json({
      error: 'Failed to process AI question',
      message: err.message,
    });
  }
});

/**
 * POST /api/ai/clear-history
 * Resets conversation context for the active user/session.
 */
router.post('/clear-history', verifyToken, async (req, res) => {
  try {
    const { conversationId } = req.body;
    clearConversationHistory(conversationId || `session_${req.user.id}`);
    res.json({ success: true, message: 'Conversation memory cleared.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear history', message: err.message });
  }
});

export default router;
