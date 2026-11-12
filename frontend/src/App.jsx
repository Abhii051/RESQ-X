import React, { useState, useEffect, Component } from 'react';
import Header from './components/Header';
import { fetchState, subscribeToWebSocket } from './services/api';

// 8 Unified Command Centre Modules
import CommandCentreView from './views/CommandCentreView';
import ReportingView from './views/ReportingView';
import OptimizerView from './views/OptimizerView';
import HospitalView from './views/HospitalView';
import PredictionHotspotsView from './views/PredictionHotspotsView';
import DisruptionRippleView from './views/DisruptionRippleView';
import ComparisonView from './views/ComparisonView';
import AuditDecisionView from './views/AuditDecisionView';

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

export default function App() {
  const [currentTab, setCurrentTab] = useState('command');
  const [state, setState] = useState(null);
  const [wsStatus, setWsStatus] = useState('connecting');

  const loadData = async () => {
    try {
      const data = await fetchState();
      setState(data);
    } catch (e) {
      console.error("Failed to load state", e);
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
          <h2 className="text-sm font-bold text-[#17324D]">Initializing RESQ-X Hyderabad Network Mesh...</h2>
          <p className="text-xs text-slate-400">Connecting to Municipal Emergency Telemetry Stream</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen w-screen flex flex-col bg-[#F4F7FA] text-[#243447]">
        {/* Top Header with the Unified Command Modules */}
        <Header
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          state={state}
          wsStatus={wsStatus}
          onRefresh={loadData}
        />

        {/* Full-Width Module Workspace */}
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          {currentTab === 'command' && (
            <CommandCentreView
              state={state}
              onSelectTab={setCurrentTab}
            />
          )}

          {currentTab === 'ingestion' && (
            <ReportingView
              state={state}
              onRefresh={loadData}
              onSelectTab={setCurrentTab}
            />
          )}

          {currentTab === 'allocation' && (
            <OptimizerView
              state={state}
            />
          )}

          {currentTab === 'hospitals' && (
            <HospitalView
              state={state}
              onRefresh={loadData}
            />
          )}

          {currentTab === 'prediction' && (
            <PredictionHotspotsView
              state={state}
              onRefresh={loadData}
            />
          )}

          {currentTab === 'disruptions' && (
            <DisruptionRippleView
              state={state}
              onRefresh={loadData}
            />
          )}

          {currentTab === 'comparison' && (
            <ComparisonView
              state={state}
            />
          )}

          {currentTab === 'audit' && (
            <AuditDecisionView
              state={state}
            />
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
}
