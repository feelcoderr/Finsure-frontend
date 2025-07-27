import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Home, DollarSign, CreditCard, TrendingUp, Target, Briefcase, MessageSquare, Mic, StopCircle, User, LogOut, Moon, Sun
} from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

// --- Backend URL Configuration ---
// IMPORTANT: Replace this with the URL of your locally running Node.js backend.
// Default for local Express app is usually http://localhost:8080
const BACKEND_BASE_URL = 'http://localhost:8000'; // <--- CHANGE THIS TO YOUR LOCAL BACKEND URL

// --- Helper Functions ---
const formatCurrency = (value) => {
  if (!value || typeof value.units === 'undefined') return 'N/A';
  const units = parseInt(value.units, 10);
  const nanos = value.nanos ? value.nanos / 1_000_000_000 : 0;
  const total = units + nanos;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: value.currencyCode || 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(total);
};

const calculateTotal = (items) => {
  return items.reduce((sum, item) => {
    const units = parseInt(item.value.units, 10) || 0;
    const nanos = item.value.nanos ? item.value.nanos / 1_000_000_000 : 0;
    return sum + units + nanos;
  }, 0);
};

const getAssetLiabilityData = (netWorthResponse) => {
  const assets = netWorthResponse.assetValues.map(a => ({
    label: a.netWorthAttribute.replace('ASSET_TYPE_', '').replace('_', ' '),
    value: parseInt(a.value.units, 10) || 0
  }));
  const liabilities = netWorthResponse.liabilityValues.map(l => ({
    label: l.netWorthAttribute.replace('LIABILITY_TYPE_', '').replace('_', ' '),
    value: parseInt(l.value.units, 10) || 0
  }));

  const assetLabels = assets.map(a => a.label);
  const assetValues = assets.map(a => a.value);
  const liabilityLabels = liabilities.map(l => l.label);
  const liabilityValues = liabilities.map(l => l.value);

  return { assetLabels, assetValues, liabilityLabels, liabilityValues };
};

// --- Real Backend API Calls ---
// This function now makes actual fetch calls to your Node.js backend.
const callBackendApi = async (endpoint, data = {}) => {
  console.log(`Making API call to ${BACKEND_BASE_URL}${endpoint} with data:`, data);
  try {
    const response = await fetch(`${BACKEND_BASE_URL}${endpoint}`, {
      method: 'POST', // Both your backend endpoints are POST
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    // Check for 401 Unauthorized specifically for login redirection from backend
    if (response.status === 401) {
      const errorData = await response.json();
      if (errorData.error === 'Authentication required' && errorData.login_url) {
        // Throw a specific error that App component can catch for redirection
        throw { type: 'login_required', login_url: errorData.login_url };
      }
    }

    if (!response.ok) {
      const errorData = await response.json();
      // Check for specific "Invalid session ID" error from backend
      if (errorData.error && errorData.error.includes('Invalid session ID')) {
        throw { type: 'invalid_session', message: errorData.error };
      }
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error during backend API call:', error);
    throw error; // Re-throw the error, including the structured errors
  }
};

// --- Glass Card Component ---
const GlassCard = ({ children, className = "" }) => (
  <div className={`
    backdrop-blur-xl bg-gray-800/30 border border-gray-600/30 rounded-xl shadow-lg
    ${className}
  `}>
    {children}
  </div>
);

// --- FinancialSummaryCard Component ---
const FinancialSummaryCard = ({ title, value, icon: Icon, description, trend }) => (
  <GlassCard className="p-4 flex flex-col items-center text-center">
    <div className="p-3 bg-gray-700/40 rounded-lg mb-3">
      <Icon className="text-gray-300" size={24} />
    </div>
    <h3 className="text-sm font-medium text-gray-400 mb-1">{title}</h3>
    <p className="text-xl font-semibold text-gray-200 mb-1">
      {value}
    </p>
    <p className="text-xs text-gray-500">{description}</p>
    {trend && (
      <div className="mt-2 flex items-center">
        <TrendingUp className="text-gray-400 mr-1" size={12} />
        <span className="text-gray-400 text-xs">{trend}</span>
      </div>
    )}
  </GlassCard>
);

// --- AssetLiabilityChart Component ---
const AssetLiabilityChart = ({ assetData, liabilityData }) => {
  const data = {
    labels: assetData.labels.concat(liabilityData.labels),
    datasets: [
      {
        label: 'Assets',
        data: assetData.values,
        backgroundColor: 'rgba(156, 163, 175, 0.6)',
        borderColor: 'rgba(156, 163, 175, 1)',
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'Liabilities',
        data: liabilityData.values,
        backgroundColor: 'rgba(107, 114, 128, 0.6)',
        borderColor: 'rgba(107, 114, 128, 1)',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            family: 'Inter',
            size: 12,
          },
          color: '#d1d5db',
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(31, 41, 55, 0.9)',
        titleColor: '#f3f4f6',
        bodyColor: '#f3f4f6',
        borderColor: 'rgba(107, 114, 128, 0.3)',
        borderWidth: 1,
        cornerRadius: 8,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += formatCurrency({ units: String(context.parsed.y), currencyCode: 'INR' });
            }
            return label;
          }
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            family: 'Inter',
            size: 11,
          },
          color: '#9ca3af',
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(107, 114, 128, 0.2)',
        },
        ticks: {
          callback: function(value) {
            return formatCurrency({ units: String(value), currencyCode: 'INR' });
          },
          font: {
            family: 'Inter',
            size: 11,
          },
          color: '#9ca3af',
        },
      },
    },
  };

  return (
    <GlassCard className="p-4 h-80">
      <h3 className="text-md font-medium text-gray-300 mb-3 text-center">Assets vs. Liabilities Overview</h3>
      <Bar data={data} options={options} />
    </GlassCard>
  );
};

// --- ChatInterface Component ---
const ChatInterface = ({ userId }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (input.trim() === '') return;

    const userMessage = { sender: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      const response = await callBackendApi('/chat', { message: input, userId });
      const aiMessage = { sender: 'ai', text: response.response };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message to AI:', error);
      let displayMessage = 'Oops! Something went wrong. Please try again.';
      if (error && error.type === 'login_required' && error.login_url) {
        displayMessage = `Authentication required with Fi Money. Please log in using this link: ${error.login_url}`;
        // For chat, we display the link, not redirect, as it might interrupt flow
      } else if (error && error.type === 'invalid_session') {
        displayMessage = `Session invalid. Please refresh the page and log in to Fi Money again. Error: ${error.message}`;
      }
      else if (error.message) {
        displayMessage = `Error: ${error.message}`;
      }
      setMessages(prev => [...prev, { sender: 'ai', text: displayMessage }]);
    } finally {
      setIsSending(false);
    }
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Speech recognition is not supported in your browser. Please use Chrome for this feature.');
      return;
    }

    const SpeechRecognition = window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false; // Listen for a single utterance
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = 'en-IN'; // Indian English

    recognitionRef.current.onstart = () => {
      setIsListening(true);
      setMessages(prev => [...prev, { sender: 'system', text: 'Listening...' }]);
    };

    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setMessages(prev => [...prev, { sender: 'system', text: `You said: "${transcript}"` }]);
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setMessages(prev => [...prev, { sender: 'system', text: `Speech recognition error: ${event.error}. Please try again.` }]);
      setIsListening(false);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
      if (input.trim() !== '') {
        handleSendMessage(); // Automatically send message after speech ends
      }
    };

    recognitionRef.current.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  return (
    <GlassCard className="flex flex-col h-full p-4">
      <h2 className="text-md font-medium text-gray-300 mb-3 text-center">Chat with your AI Financial Agent</h2>
      <div className="flex-grow overflow-y-auto space-y-3 p-3 rounded-lg bg-gray-900/40 border border-gray-600/30 mb-3 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 italic text-sm">
            Start by asking me about your finances! Try: "How's my net worth?", "What's my credit score?", or "Can I afford a ₹50L home loan?"
          </div>
        )}
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] p-2 rounded-lg border shadow-sm ${
                msg.sender === 'user'
                  ? 'bg-gray-700/60 text-gray-200 border-gray-600/40 rounded-br-none'
                  : msg.sender === 'ai'
                  ? 'bg-gray-800/60 text-gray-300 border-gray-600/40 rounded-bl-none'
                  : 'bg-gray-600/40 text-gray-400 text-xs italic border-gray-500/40'
              }`}
            >
              <span className="text-sm">{msg.text}</span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex items-center space-x-2">
        <input
          type="text"
          className="flex-grow p-2 bg-gray-800/40 border border-gray-600/40 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-500 focus:bg-gray-800/60 text-gray-300 placeholder-gray-500 text-sm"
          placeholder="Ask your financial question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !isSending && !isListening) {
              handleSendMessage();
            }
          }}
          disabled={isSending || isListening}
        />
        <button
          onClick={isListening ? stopListening : startListening}
          className={`p-2 rounded-lg border ${
            isListening 
              ? 'bg-gray-700/60 text-gray-400 border-gray-600/40' 
              : 'bg-gray-800/60 text-gray-400 border-gray-600/40'
          } focus:outline-none focus:ring-1 focus:ring-gray-500`}
          title={isListening ? "Stop Listening" : "Start Voice Input"}
          disabled={isSending}
        >
          {isListening ? <StopCircle size={18} /> : <Mic size={18} />}
        </button>
        <button
          onClick={handleSendMessage}
          className={`p-2 rounded-lg border ${
            isSending 
              ? 'bg-gray-700/40 text-gray-500 border-gray-600/30 cursor-not-allowed' 
              : 'bg-gray-800/60 text-gray-400 border-gray-600/40'
          } focus:outline-none focus:ring-1 focus:ring-gray-500`}
          disabled={isSending || input.trim() === '' || isListening}
        >
          <MessageSquare size={18} />
        </button>
      </div>
    </GlassCard>
  );
};

// --- Main App Component ---
export default function App() {
  const [userId, setUserId] = useState(null);
  const [loadingFinancials, setLoadingFinancials] = useState(true);
  const [financialData, setFinancialData] = useState(null);
  const [error, setError] = useState(null);

  // Generate a unique ID for the session on component mount
  useEffect(() => {
    setUserId(crypto.randomUUID());

    // Check if we are returning from an MCP login redirect
    const wasRedirecting = localStorage.getItem('mcpRedirecting');
    if (wasRedirecting === 'true') {
      localStorage.removeItem('mcpRedirecting'); // Clear the flag
      // No need to explicitly re-fetch here, as the userId dependency will trigger fetchFinancialData
    }
  }, []);

  // Fetch Financial Data Effect
  useEffect(() => {
    const fetchFinancialData = async () => {
      if (!userId) {
        setLoadingFinancials(true);
        return; // Wait for userId to be generated
      }

      setLoadingFinancials(true);
      setError(null);
      try {
        const data = await callBackendApi('/getFinancialSummary', { userId: userId });
        setFinancialData(data);
      } catch (err) {
        console.error("Error fetching financial data:", err);
        if (err && err.type === 'login_required' && err.login_url) {
          // Store a flag in localStorage before redirecting
          localStorage.setItem('mcpRedirecting', 'true');
          // Redirect the user to the MCP login page
          window.location.href = err.login_url;
          // Prevent further execution of this useEffect until redirected back
          return;
        } else if (err && err.type === 'invalid_session') {
          // Handle specific "Invalid session ID" error from backend
          setError(`Session invalid. Please log in to Fi Money again. You might need to restart your backend server if it generated a new session ID. Error: ${err.message}`);
        } else {
          setError(`Failed to load financial data: ${err.message || 'Unknown error'}`);
        }
      } finally {
        setLoadingFinancials(false);
      }
    };

    if (userId) { // Only fetch data once userId is generated
      fetchFinancialData();
    }
  }, [userId]); // Re-fetch when userId changes (should only happen once per session)

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 font-inter text-gray-400 p-4 text-center">
        <GlassCard className="p-6">
          <h2 className="text-lg font-medium mb-3 text-gray-300">Error Loading Dashboard</h2>
          <p className="mb-4 text-gray-400 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-700/60 text-gray-300 rounded-lg border border-gray-600/40 text-sm"
          >
            Reload Page
          </button>
        </GlassCard>
      </div>
    );
  }

  if (!userId || loadingFinancials || !financialData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 font-inter">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-gray-500"></div>
          <div className="absolute inset-0 animate-pulse rounded-full h-16 w-16 bg-gray-600/20"></div>
        </div>
        <p className="mt-4 text-md text-gray-400">Loading your personalized financial dashboard...</p>
        <div className="mt-1 text-xs text-gray-500">Connecting to Fi Money MCP...</div>
      </div>
    );
  }

  const netWorth = financialData?.netWorth?.totalNetWorthValue;
  const creditScore = financialData?.creditReport?.creditScore?.score;
  const epfBalance = financialData?.epfDetails?.currentBalance;

  const { assetLabels, assetValues, liabilityLabels, liabilityValues } = getAssetLiabilityData(financialData.netWorth);

  const totalAssets = calculateTotal(financialData.netWorth.assetValues);
  const totalLiabilities = calculateTotal(financialData.netWorth.liabilityValues);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 font-inter text-gray-300 p-4 sm:p-6 lg:p-8">
      {/* Subtle background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gray-700/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gray-600/5 rounded-full blur-3xl"></div>
        <div className="absolute top-3/4 left-3/4 w-64 h-64 bg-gray-500/5 rounded-full blur-2xl"></div>
      </div>

      {/* Header */}
      <header className="relative z-10">
        <GlassCard className="flex flex-col sm:flex-row justify-between items-center p-4 mb-4">
          <div className="flex items-center mb-3 sm:mb-0">
            <div className="p-2 bg-gray-700/40 rounded-lg mr-3">
              <img src="./logo.jpg" width={30}/>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-200">
              FinSure.Ai
            </h1>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center text-xs text-gray-400 bg-gray-800/40 px-3 py-1 rounded-lg border border-gray-600/30">
              <User size={14} className="mr-1" />
              <span className="font-medium">Session: {userId.substring(0, 8)}...</span>
            </div>
          </div>
        </GlassCard>
      </header>

      {/* Main Content Grid */}
      <main className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Financial Summary Cards (Left Column) */}
        <section className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 lg:mb-0">
          <FinancialSummaryCard
            title="Total Net Worth"
            value={formatCurrency(netWorth)}
            icon={DollarSign}
            description="Your overall financial health"
            trend="+12.5% this year"
          />
          <FinancialSummaryCard
            title="Credit Score"
            value={creditScore || 'N/A'}
            icon={CreditCard}
            description="Excellent credit standing"
            trend="Improved +15 pts"
          />
          <FinancialSummaryCard
            title="EPF Balance"
            value={formatCurrency(epfBalance)}
            icon={Briefcase}
            description="Your retirement corpus"
            trend="+8.2% annually"
          />

          {/* Asset/Liability Breakdown */}
          <div className="md:col-span-3">
            <GlassCard className="p-4">
              <h2 className="text-md font-medium text-gray-300 mb-4 text-center">Your Financial Breakdown</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center">
                    <TrendingUp className="mr-1" size={16} />
                    Assets ({formatCurrency({units: String(totalAssets), currencyCode: 'INR'})})
                  </h3>
                  <ul className="space-y-2">
                    {financialData.netWorth.assetValues.map((asset, index) => (
                      <li key={index} className="flex justify-between items-center p-2 bg-gray-800/40 rounded-lg border border-gray-600/30">
                        <span className="font-medium text-gray-400 text-sm">{asset.netWorthAttribute.replace('ASSET_TYPE_', '').replace('_', ' ')}</span>
                        <span className="font-medium text-gray-300 text-sm">{formatCurrency(asset.value)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center">
                    <CreditCard className="mr-1" size={16} />
                    Liabilities ({formatCurrency({units: String(totalLiabilities), currencyCode: 'INR'})})
                  </h3>
                  <ul className="space-y-2">
                    {financialData.netWorth.liabilityValues.map((liability, index) => (
                      <li key={index} className="flex justify-between items-center p-2 bg-gray-800/40 rounded-lg border border-gray-600/30">
                        <span className="font-medium text-gray-400 text-sm">{liability.netWorthAttribute.replace('LIABILITY_TYPE_', '').replace('_', ' ')}</span>
                        <span className="font-medium text-gray-300 text-sm">{formatCurrency(liability.value)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Assets vs Liabilities Chart */}
          <div className="md:col-span-3">
            <AssetLiabilityChart
              assetData={{ labels: assetLabels, values: assetValues }}
              liabilityData={{ labels: liabilityLabels, values: liabilityValues }}
            />
          </div>

          {/* Investment Performance */}
          <div className="md:col-span-3">
            <GlassCard className="p-4">
              <h2 className="text-md font-medium text-gray-300 mb-3 text-center">Investment Performance Overview</h2>
              <p className="text-gray-500 mb-4 text-center text-sm">Monitor your mutual fund performance and get AI-powered insights</p>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-600/30">
                      <th className="py-3 px-3 text-left text-xs font-medium text-gray-400">Fund Name</th>
                      <th className="py-3 px-3 text-left text-xs font-medium text-gray-400">Invested</th>
                      <th className="py-3 px-3 text-left text-xs font-medium text-gray-400">Current Value</th>
                      <th className="py-3 px-3 text-left text-xs font-medium text-gray-400">XIRR (%)</th>
                      <th className="py-3 px-3 text-left text-xs font-medium text-gray-400">Returns</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financialData.mfTransactions.mfSchemeAnalytics.map((mf, index) => (
                      <tr key={index} className="border-b border-gray-600/20">
                        <td className="py-3 px-3 text-xs text-gray-300 font-medium">{mf.schemeDetail.nameData.longName}</td>
                        <td className="py-3 px-3 text-xs text-gray-400">{formatCurrency(mf.enrichedAnalytics.analytics.schemeDetails.investedValue)}</td>
                        <td className="py-3 px-3 text-xs text-gray-400">{formatCurrency(mf.enrichedAnalytics.analytics.schemeDetails.currentValue)}</td>
                        <td className="py-3 px-3 text-xs font-medium">
                          <span className={`px-2 py-1 rounded text-xs ${
                            mf.enrichedAnalytics.analytics.schemeDetails.XIRR < 0 
                              ? 'bg-gray-700/40 text-gray-400 border border-gray-600/30' 
                              : 'bg-gray-600/40 text-gray-300 border border-gray-500/30'
                          }`}>
                            {mf.enrichedAnalytics.analytics.schemeDetails.XIRR ? mf.enrichedAnalytics.analytics.schemeDetails.XIRR.toFixed(2) : 'N/A'}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-xs font-medium">
                          <span className={
                            mf.enrichedAnalytics.analytics.schemeDetails.absoluteReturns?.units?.startsWith('-') 
                              ? 'text-gray-400' 
                              : 'text-gray-300'
                          }>
                            {formatCurrency(mf.enrichedAnalytics.analytics.schemeDetails.absoluteReturns)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {financialData.mfTransactions.mfSchemeAnalytics.length === 0 && (
                      <tr>
                        <td colSpan="5" className="py-6 text-center text-gray-500 text-sm">No mutual fund data available.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* Chat Interface (Right Column) */}
        <section className="lg:col-span-1 h-[75vh] flex flex-col">
          <ChatInterface userId={userId} />
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 mt-6 text-center">
        <GlassCard className="p-3">
          <p className="text-gray-500 text-xs">
            &copy; {new Date().getFullYear()} Fi AI Dashboard. Powered by Fi Money MCP and Google AI.
          </p>
          <div className="mt-1 flex justify-center space-x-3 text-xs text-gray-600">
            <span>Secure</span>
            <span>•</span>
            <span>Real-time</span>
            <span>•</span>
            <span>AI-Powered</span>
          </div>
        </GlassCard>
      </footer>

      {/* Custom styles for scrollbar */}
      <style jsx>{`
        .scrollbar-thin::-webkit-scrollbar {
          width: 4px;
        }
        .scrollbar-thumb-gray-600::-webkit-scrollbar-thumb {
          background-color: rgba(75, 85, 99, 0.6);
          border-radius: 2px;
        }
        .scrollbar-track-transparent::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background-color: rgba(75, 85, 99, 0.8);
        }
      `}</style>
    </div>
  );
}