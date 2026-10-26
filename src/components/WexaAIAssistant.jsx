import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Bot,
  X,
  Maximize2,
  Minimize2,
  Send,
  Trash2,
  RefreshCw,
  Download,
  FileSpreadsheet,
  FileText,
  BarChart3,
  TrendingUp,
  Package,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Tag,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
  Layers,
  ChevronRight,
  Copy,
  Check,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { exportReportToExcel, exportReportToPDF, exportReportToCSV } from '../utils/reportExport';

const PIE_COLORS = ['#F97316', '#17365D', '#16A34A', '#D97706', '#DC2626', '#EA580C'];

/**
 * WEXA AI — Powered by WeEngineerTech
 * Enterprise Supermarket Business Intelligence & Management AI Assistant
 * Theme: Supermarket Navy & Orange (#17365D, #F97316, #FFF1E7, #F3F6FA)
 */
export default function WexaAIAssistant({ pageContext = 'dashboard', barcodeSelection = null }) {
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [providerInfo, setProviderInfo] = useState(null);
  const [showSetupNotice, setShowSetupNotice] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Hi! I'm **WEXA AI** — Powered by **WeEngineerTech**.\n\nAsk me anything about your supermarket in **English, Tamil (தமிழ்), or Tanglish** — sales, stock, profit margins, barcodes, supplier dues, customer loyalty, or business recommendations.",
      timestamp: new Date(),
      cards: [],
      suggestedFollowUps: [
        'Inniku evlo sales aachu?',
        'Which product made the highest profit this month?',
        'Which items are running out of stock?',
        'Show last week\'s sales compared with this week',
        'Give me business recommendations',
      ],
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const [activeDateFilter, setActiveDateFilter] = useState('All');
  const [copiedId, setCopiedId] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      inputRef.current?.focus();
    }
  }, [messages, isOpen]);

  // Listen for explicit header button click to open WEXA AI
  useEffect(() => {
    const handleOpenAi = () => setIsOpen(true);
    window.addEventListener('open-wexa-ai', handleOpenAi);
    return () => window.removeEventListener('open-wexa-ai', handleOpenAi);
  }, []);

  // Load provider health and status on mount
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await api.get('/ai/health');
        setProviderInfo(res.data);
      } catch (err) {
        setProviderInfo({
          provider: 'BUILTIN_LOCAL_SEMANTIC',
          isOnlineAIReady: false,
          setupMessage: 'Running in offline verified database mode.',
        });
      }
    };
    fetchHealth();
  }, []);

  // Load contextual suggestions based on current page
  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const res = await api.get(`/ai/suggested-questions?pageContext=${pageContext}`);
        setSuggestedQuestions(res.data.suggestions || []);
      } catch (err) {
        setSuggestedQuestions([
          'Inniku evlo sales aachu?',
          'Which product made the highest profit this month?',
          'Which items are running out of stock?',
          'Show last week\'s sales compared with this week',
          'Give me business recommendations',
        ]);
      }
    };
    fetchSuggestions();
  }, [pageContext]);

  // Keyboard shortcut Ctrl+/ to toggle WEXA AI
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSendMessage = async (textToSend = null) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt || loading) return;

    const userMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      text: prompt,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputPrompt('');
    setLoading(true);

    try {
      const res = await api.post('/ai/chat', {
        prompt,
        conversationId: `session_${user?.id || 'guest'}`,
        pageContext,
        selectionState: barcodeSelection,
      });

      const aiMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        text: res.data.text,
        timestamp: new Date(),
        cards: res.data.cards || [],
        chart: res.data.chart || null,
        table: res.data.table || null,
        reportAction: res.data.reportAction || null,
        suggestedFollowUps: res.data.suggestedFollowUps || [],
        provider: res.data.provider,
        model: res.data.model,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      const errorMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        isError: true,
        text:
          err.response?.data?.message ||
          err.response?.data?.error ||
          "Unable to connect to WEXA AI. Please check that the backend server is running.",
        timestamp: new Date(),
        suggestedFollowUps: [
          'Retry',
          'Who are you?',
          'Today sales summary',
          'Check stock for Rice',
        ],
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm('Clear conversation history and start a new chat with WEXA AI?')) {
      try {
        await api.post('/ai/clear-history', {
          conversationId: `session_${user?.id || 'guest'}`,
        });
        setMessages([
          {
            id: 'welcome_new',
            role: 'assistant',
            text: "Hi! I'm **WEXA AI** — Powered by **WeEngineerTech**. Conversation refreshed.\n\nWhat would you like to know about your supermarket today?",
            timestamp: new Date(),
            cards: [],
            suggestedFollowUps: suggestedQuestions.slice(0, 4),
          },
        ]);
      } catch (err) {
        console.error('Failed to clear history:', err);
      }
    }
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadReport = (reportAction) => {
    if (!reportAction) return;
    const { reportType, format, rows = [], title } = reportAction;
    const dataToExport = rows.length > 0 ? rows : [
      { Metric: 'Report Type', Value: reportType },
      { Metric: 'Generated At', Value: new Date().toLocaleString('en-IN') },
      { Metric: 'Generated By', Value: user?.fullName || 'WEXA AI' },
    ];

    const columns = Object.keys(dataToExport[0] || {}).map((k) => ({
      key: k,
      label: k.charAt(0).toUpperCase() + k.slice(1),
    }));

    const filename = title || `ANANTHA_STORES_${reportType}_REPORT`;

    try {
      if (format === 'EXCEL') {
        exportReportToExcel(filename, 'WEXA AI Business Intelligence', columns, dataToExport);
      } else if (format === 'CSV') {
        exportReportToCSV(filename, 'WEXA AI Business Intelligence', columns, dataToExport);
      } else {
        exportReportToPDF(filename, 'WEXA AI Business Intelligence', columns, dataToExport);
      }
    } catch (err) {
      alert('Report export error: ' + err.message);
    }
  };

  return (
    <>
      {/* EXPANDABLE WEXA AI CHAT PANEL */}
      {isOpen && (
        <div
          className={`fixed z-50 transition-all duration-300 flex flex-col bg-white border border-[#D9E2EF] shadow-2xl overflow-hidden ${
            isFullScreen
              ? 'inset-4 rounded-2xl md:inset-8'
              : 'bottom-6 right-6 w-full max-w-[460px] h-[660px] max-h-[90vh] rounded-2xl'
          }`}
          style={{ boxShadow: '0 25px 50px -12px rgba(23, 54, 93, 0.28)' }}
          id="wexa-ai-panel"
        >
          {/* HEADER BAR: WEXA AI — Powered by WeEngineerTech */}
          <div className="bg-[#17365D] text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-sm border-b border-[#234A7D]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white p-1.5 flex items-center justify-center shadow-md shrink-0">
                <Sparkles className="w-5 h-5 text-[#F97316]" />
              </div>
              <div className="min-w-0 truncate">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm tracking-wide text-white">WEXA AI</span>
                  <span className="text-[9px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider backdrop-blur-xs">
                    Real-time DB
                  </span>
                </div>
                <p className="text-[10px] text-slate-200 font-medium leading-none mt-0.5 truncate">
                  Powered by <span className="font-bold text-white">WeEngineerTech</span> • Context: <span className="capitalize font-semibold">{pageContext.replace('_', ' ')}</span> • Role: {user?.role || 'CASHIER'}
                </p>
              </div>
            </div>

            {/* Window Controls */}
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <button
                onClick={() => setShowSetupNotice((prev) => !prev)}
                className={`p-1.5 rounded-lg transition ${
                  showSetupNotice ? 'bg-[#F97316] text-white' : 'text-slate-200 hover:text-white hover:bg-white/15'
                }`}
                title="AI Provider Status & Setup"
              >
                <Info className="w-4 h-4" />
              </button>
              <button
                onClick={handleClearHistory}
                className="p-1.5 text-slate-200 hover:text-white hover:bg-white/15 rounded-lg transition cursor-pointer"
                title="Clear conversation history"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsFullScreen((prev) => !prev)}
                className="p-1.5 text-slate-200 hover:text-white hover:bg-white/15 rounded-lg transition cursor-pointer"
                title={isFullScreen ? 'Collapse to panel' : 'Full-screen mode'}
              >
                {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-200 hover:text-white hover:bg-white/15 rounded-lg transition cursor-pointer"
                title="Close Assistant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* SETUP & PROVIDER STATUS ACCORDION (COLLAPSIBLE) */}
          {showSetupNotice && (
            <div className="bg-[#FFF1E7] border-b border-[#FED7AA] px-4 py-2.5 text-xs text-[#17365D] flex flex-col gap-1.5 animate-fadeIn">
              <div className="flex items-center justify-between font-bold text-[11px] text-[#17365D]">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#F97316]" />
                  WEXA AI Engine & Provider Status
                </span>
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-[#FED7AA] text-[#17365D] font-extrabold">
                  {providerInfo?.provider || 'Built-in DB'}
                </span>
              </div>
              <p className="text-[10.5px] leading-relaxed text-[#17365D]">
                {providerInfo?.setupMessage ||
                  'WEXA AI is currently operating using the verified local database engine. To connect external Google Gemini cloud AI, set GEMINI_API_KEY in your .env file.'}
              </p>
              <button
                onClick={() => {
                  setShowSetupNotice(false);
                  handleSendMessage('How to setup AI provider?');
                }}
                className="text-[10px] font-bold text-[#F97316] hover:text-[#EA580C] underline text-left cursor-pointer"
              >
                View setup instructions in chat →
              </button>
            </div>
          )}

          {/* DATE FILTER QUICK BAR */}
          <div className="bg-[#F3F6FA] border-b border-[#D9E2EF] px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0 no-scrollbar">
            <span className="text-[#17365D] font-bold flex items-center gap-1 shrink-0 text-[10.5px]">
              <Calendar className="w-3 h-3 text-[#F97316]" /> Filter:
            </span>
            {['Today', 'Yesterday', 'This Week', 'This Month'].map((filter) => (
              <button
                key={filter}
                onClick={() => {
                  setActiveDateFilter(filter);
                  handleSendMessage(`${filter} sales summary`);
                }}
                className={`px-2.5 py-0.5 rounded-full font-semibold transition shrink-0 cursor-pointer ${
                  activeDateFilter === filter
                    ? 'bg-[#F97316] text-white shadow-xs'
                    : 'bg-white text-[#64748B] hover:bg-[#FFF1E7] border border-[#D9E2EF]'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* CHAT MESSAGES SCROLL CONTAINER */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F3F6FA]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-2`}
              >
                {/* Bubble Container */}
                <div
                  className={`max-w-[92%] md:max-w-[85%] rounded-2xl p-3.5 shadow-xs text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#F97316] text-white rounded-tr-none font-medium'
                      : msg.isError
                      ? 'bg-red-50 border border-red-200 text-red-900 rounded-tl-none'
                      : 'bg-white border border-[#D9E2EF] text-[#17365D] rounded-tl-none'
                  }`}
                >
                  {/* Assistant Branding Header inside Bubble */}
                  {msg.role === 'assistant' && (
                    <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100 text-[10px] text-slate-400">
                      <div className="flex items-center gap-1.5 font-bold text-[#F97316]">
                        <Sparkles className="w-3 h-3 text-[#F97316]" />
                        <span>WEXA AI</span>
                        <span className="text-[8px] bg-[#FFF1E7] text-[#F97316] font-semibold px-1 py-0.2 rounded border border-[#FED7AA]">
                          by WeEngineerTech
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {msg.timestamp && (
                          <span>
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                        <button
                          onClick={() => handleCopy(msg.id, msg.text)}
                          className="hover:text-slate-600 transition cursor-pointer"
                          title="Copy response"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Main Message Text (Markdown-like formatting) */}
                  <div className="whitespace-pre-wrap space-y-1">
                    {msg.text.split('\n').map((line, idx) => {
                      if (line.startsWith('### ')) {
                        return (
                          <h4 key={idx} className="font-extrabold text-sm text-slate-900 mt-2 mb-1">
                            {line.replace('### ', '')}
                          </h4>
                        );
                      }
                      if (line.startsWith('## ')) {
                        return (
                          <h3 key={idx} className="font-black text-base text-slate-900 mt-2.5 mb-1.5">
                            {line.replace('## ', '')}
                          </h3>
                        );
                      }
                      if (line.startsWith('- ') || line.startsWith('• ')) {
                        return (
                          <div key={idx} className="flex items-start gap-1.5 pl-1 my-0.5">
                            <span className="text-[#F97316] font-bold">•</span>
                            <span>{line.replace(/^[-•]\s*/, '')}</span>
                          </div>
                        );
                      }
                      return (
                        <p key={idx} className={line.trim() === '' ? 'h-2' : ''}>
                          {line}
                        </p>
                      );
                    })}
                  </div>

                  {/* Render Visual KPI Cards */}
                  {msg.cards && msg.cards.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100">
                      {msg.cards.map((card, cIdx) => (
                        <div
                          key={cIdx}
                          className="p-2.5 bg-slate-50/80 rounded-xl border border-slate-200/80 hover:border-[#FED7AA] transition flex flex-col justify-between"
                        >
                          <span className="text-[10px] text-[#64748B] font-semibold tracking-wide uppercase truncate">
                            {card.label}
                          </span>
                          <span
                            className={`text-sm font-black mt-0.5 truncate ${
                              card.highlight ? 'text-[#F97316]' : 'text-[#17365D]'
                            }`}
                          >
                            {card.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Render Interactive Charts */}
                  {msg.chart && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-[11px] text-[#17365D] flex items-center gap-1.5">
                          <BarChart3 className="w-3.5 h-3.5 text-[#F97316]" />
                          {msg.chart.title}
                        </span>
                      </div>
                      <div className="h-44 w-full bg-slate-50/60 p-2 rounded-xl border border-slate-100">
                        <ResponsiveContainer width="100%" height="100%">
                          {msg.chart.type === 'pie' ? (
                            <PieChart>
                              <Pie
                                data={msg.chart.data}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={60}
                                label={({ name, percent }) =>
                                  `${name.slice(0, 8)} (${(percent * 100).toFixed(0)}%)`
                                }
                              >
                                {msg.chart.data.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Amount']} />
                            </PieChart>
                          ) : (
                            <BarChart data={msg.chart.data}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                              <XAxis dataKey={msg.chart.xKey} tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={25} />
                              <YAxis tick={{ fontSize: 9 }} width={45} tickFormatter={(val) => `₹${val}`} />
                              <Tooltip formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, msg.chart.title || 'Value']} />
                              <Bar dataKey={msg.chart.yKey} fill="#F97316" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Render Tables */}
                  {msg.table && (
                    <div className="mt-3 pt-3 border-t border-slate-100 overflow-x-auto">
                      <div className="font-bold text-[11px] text-[#17365D] mb-2 flex items-center justify-between">
                        <span>{msg.table.title}</span>
                        <span className="text-[10px] text-[#64748B] font-normal">
                          {msg.table.rows.length} records
                        </span>
                      </div>
                      <table className="w-full text-left text-[10.5px] border border-[#D9E2EF] rounded-lg overflow-hidden">
                        <thead className="bg-[#F3F6FA] text-[#64748B] font-bold uppercase text-[9px]">
                          <tr>
                            {msg.table.columns.map((col) => (
                              <th key={col.key} className="py-1.5 px-2.5">
                                {col.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {msg.table.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-[#FFF1E7]/50">
                              {msg.table.columns.map((col) => (
                                <td key={col.key} className="py-1.5 px-2.5 font-medium text-[#17365D]">
                                  {typeof row[col.key] === 'number' &&
                                  (col.key.toLowerCase().includes('revenue') || col.key.toLowerCase().includes('profit'))
                                    ? `₹${Number(row[col.key]).toLocaleString('en-IN')}`
                                    : String(row[col.key] ?? '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Report Download Action */}
                  {msg.reportAction && (
                    <div className="mt-3 p-3 bg-[#FFF1E7] border border-[#FED7AA] rounded-xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#F97316] text-white flex items-center justify-center shrink-0">
                          {msg.reportAction.format === 'EXCEL' ? <FileSpreadsheet className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        </div>
                        <div className="truncate">
                          <div className="font-bold text-xs text-[#17365D] truncate">
                            {msg.reportAction.title}.{msg.reportAction.format.toLowerCase()}
                          </div>
                          <div className="text-[10px] text-[#F97316]">
                            Verified Database Export
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownloadReport(msg.reportAction)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg text-[11px] font-extrabold shadow-sm transition shrink-0 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Suggested Follow-Ups */}
                {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 max-w-[90%] pl-1">
                    {msg.suggestedFollowUps.map((suggestion, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => handleSendMessage(suggestion)}
                        className="px-2.5 py-1 bg-white hover:bg-[#FFF1E7] text-[#17365D] hover:text-[#F97316] border border-[#D9E2EF] rounded-full text-[10.5px] font-medium transition shadow-2xs flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-[#F97316]" />
                        <span>{suggestion}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {loading && (
              <div className="flex items-start space-x-2">
                <div className="bg-white border border-[#D9E2EF] rounded-2xl rounded-tl-none p-3 shadow-xs flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-[#64748B] font-medium animate-pulse">
                    WEXA AI is analyzing supermarket records...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* QUICK PROMPT SUGGESTIONS (Visible when new conversation) */}
          {messages.length <= 2 && (
            <div className="bg-[#F3F6FA] border-t border-[#D9E2EF] p-2.5">
              <div className="text-[10px] font-bold text-[#17365D] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <HelpCircle className="w-3 h-3 text-[#F97316]" />
                Frequently Asked:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(q)}
                    className="text-[10.5px] px-2.5 py-1 bg-white hover:bg-[#FFF1E7] border border-[#D9E2EF] text-[#17365D] hover:text-[#F97316] rounded-lg transition font-medium text-left truncate max-w-full cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* INPUT FORM */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white border-t border-[#D9E2EF] flex items-center gap-2 shrink-0"
          >
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder="Ask WEXA AI in English, Tamil, or Tanglish (e.g. Inniku evlo sales?)..."
                className="w-full pl-3.5 pr-10 py-2.5 bg-[#F3F6FA] border border-[#D9E2EF] focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316]/20 focus:bg-white rounded-xl text-xs text-[#17365D] placeholder:text-[#64748B] focus:outline-none transition"
                disabled={loading}
              />
              <span className="absolute right-3 top-2.5 text-[10px] text-[#64748B] font-semibold select-none hidden md:inline">
                Ctrl+/
              </span>
            </div>
            <button
              type="submit"
              disabled={loading || !inputPrompt.trim()}
              className="px-4 py-2.5 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-xl text-xs font-bold transition shadow-md disabled:opacity-40 flex items-center justify-center shrink-0 cursor-pointer"
              title="Send question to WEXA AI"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
