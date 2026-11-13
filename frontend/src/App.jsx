import React, { useState, useEffect, Component } from 'react';
import Header from './components/Header';
import { fetchState, subscribeToWebSocket } from './services/api';
import { AuthProvider } from './context/AuthContext';

// 4 Completely Distinct Role-Based Dashboards
import CitizenPortalView from './views/CitizenPortalView';
import AmbulancePortalView from './views/AmbulancePortalView';
import HospitalPortalView from './views/HospitalPortalView';
import CommandCentreView from './views/CommandCentreView';

// Error Boundary for stability
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-xl mx-auto my-12 bg-white rounded-2xl border border-red-200 shadow-md text-xs space-y-3">
          <div className="text-red-700 font-bold text-sm">Application Runtime Recovery</div>
          <p className="text-slate-600">A view encountered an issue rendering. You can switch to another tab or refresh.</p>
          <pre className="p-3 bg-slate-50 text-red-600 rounded-lg overflow-x-auto text-[11px] font-mono">
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            className="px-4 py-2 bg-[#17324D] text-white font-bold rounded-lg"
          >
            Reload RESQ-X
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function MainLayout() {
  const [currentTab, setCurrentTab] = useState('citizen');
  const [state, setState] = useState(null);
  const [wsStatus, setWsStatus] = useState('connecting');

  const loadData = async () => {
    try {
      const data = await fetchState();
      setState(data);
    } catch (e) {
      console.warn("Backend API not reachable directly, attempting static fallback telemetry:", e.message);
      try {
        const fallbackRes = await fetch('/initial_state.json');
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          setState(fallbackData);
        }
      } catch (err) {
        console.error("Fallback load failed", err);
      }
    }
  };

  useEffect(() => {
    loadData();

    const unsubscribe = subscribeToWebSocket(
      (message) => {
        if (message.type === 'INIT_STATE' || message.type === 'STATE_UPDATE') {
          setState(message.data);
        }
      },
      (status) => {
        setWsStatus(status);
      }
    );

    const pollInterval = setInterval(() => {
      loadData();
    }, 4000);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, []);

  // Graceful loading screen
  if (!state) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#F4F7FA]">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#0F9D91] to-[#2563A6] flex items-center justify-center mx-auto shadow-md animate-pulse">
            <span className="text-white font-black text-xl">X</span>
          </div>
          <h2 className="text-sm font-bold text-[#17324D]">Connecting to RESQ-X SQLite & Telemetry Mesh...</h2>
          <p className="text-xs text-slate-400">Loading Hyderabad Emergency Network Database</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen w-screen flex flex-col bg-[#F4F7FA] text-[#243447]">
        {/* Top Header with Role Switcher & Database Status */}
        <Header
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          state={state}
          wsStatus={wsStatus}
          onRefresh={loadData}
        />

        {/* Full-Width Role Workspace */}
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          {currentTab === 'citizen' && (
            <CitizenPortalView
              state={state}
              onRefresh={loadData}
            />
          )}

          {currentTab === 'ambulance' && (
            <AmbulancePortalView
              state={state}
              onRefresh={loadData}
            />
          )}

          {currentTab === 'hospital' && (
            <HospitalPortalView
              state={state}
              onRefresh={loadData}
            />
          )}

          {currentTab === 'command' && (
            <CommandCentreView
              state={state}
              onRefresh={loadData}
              onSelectTab={setCurrentTab}
            />
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
