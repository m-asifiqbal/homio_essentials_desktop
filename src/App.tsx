import React from 'react';
import { AlertTriangle, Copy, RotateCw, FlaskConical } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { LoginScreen } from './views/LoginScreen';
import { HmLogo } from './components/common/ui';
import { isDemo, backups } from './services/api';

const DashboardView = React.lazy(() => import('./views/DashboardView'));
const MedicinesView = React.lazy(() => import('./views/MedicinesView'));
const RemedyEditorView = React.lazy(() => import('./views/RemedyEditorView'));
const BrandsView = React.lazy(() => import('./views/BrandsView'));
const RequestsView = React.lazy(() => import('./views/RequestsView'));
const PromotionsView = React.lazy(() => import('./views/PromotionsView'));
const ContactView = React.lazy(() => import('./views/ContactView'));
const AppSettingsView = React.lazy(() => import('./views/AppSettingsView'));
const BackupsView = React.lazy(() => import('./views/BackupsView'));
const TeamView = React.lazy(() => import('./views/TeamView'));
const SettingsView = React.lazy(() => import('./views/SettingsView'));

interface ErrorBoundaryProps { resetKey: string; children: React.ReactNode; t: (key: string, fallback?: string) => string }
interface ErrorBoundaryState { error: Error | null; copied: boolean }

/** Keeps one broken screen from blanking the whole app. Resets when the user opens another screen. */
class ViewErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, copied: false };
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> { return { error, copied: false }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('View crashed:', error, info.componentStack); }
  componentDidUpdate(prev: ErrorBoundaryProps) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null, copied: false }); }
  private copy = () => {
    const e = this.state.error;
    const done = () => this.setState({ copied: true });
    navigator.clipboard?.writeText(`${e?.message || 'Unknown error'}\n\n${e?.stack || ''}`).then(done, done);
  };
  render() {
    const { error, copied } = this.state;
    const { t } = this.props;
    if (!error) return this.props.children;
    return (
      <div className="p-8 flex justify-center">
        <div className="card-base max-w-xl w-full p-6 text-xs">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle size={20} className="text-rose-600" />
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">{t('shell.crash_title', 'This screen ran into a problem')}</h2></div>
          <p className="text-slate-600 dark:text-slate-400 mb-3">{t('shell.crash_body', 'Nothing was lost. Open another screen from the sidebar, or reload the app.')}</p>
          <pre className="whitespace-pre-wrap break-words select-text bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900 rounded-xl p-3 font-mono text-[11px] max-h-48 overflow-auto">{error.message || String(error)}</pre>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={this.copy} className="btn btn-outline"><Copy size={13} />{copied ? t('shell.copied', 'Copied!') : t('common.copy', 'Copy')}</button>
            <button onClick={() => window.location.reload()} className="btn btn-primary"><RotateCw size={13} />{t('shell.reload', 'Reload')}</button>
          </div>
        </div>
      </div>
    );
  }
}

const MainLayout: React.FC = () => {
  const { activeTab, params, t, showToast } = useApp();
  // the owner's daily automatic backup reports back when it finishes
  React.useEffect(() => backups.onDone(() => showToast(t('backup.daily_done', 'Daily backup saved on this PC and in the cloud.'))), [showToast, t]);

  const view = () => {
    switch (activeTab) {
      case 'medicines': return <MedicinesView />;
      case 'editor': return <RemedyEditorView key={params.id || 'new'} />;
      case 'brands': return <BrandsView />;
      case 'requests': return <RequestsView />;
      case 'promotions': return <PromotionsView />;
      case 'contact': return <ContactView />;
      case 'appsettings': return <AppSettingsView />;
      case 'backups': return <BackupsView />;
      case 'team': return <TeamView />;
      case 'settings': return <SettingsView />;
      default: return <DashboardView />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-daybg dark:bg-night-0b1317 text-slate-800 dark:text-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain bg-daybg dark:bg-night-0b1317">
          {isDemo && (
            <div className="sticky top-0 z-30 px-6 lg:px-8 py-2 bg-[var(--hm-pe)] border-b border-[#FFC9B5] dark:border-[#5a3426] text-[11px] font-bold text-[var(--hm-peink)] flex items-center gap-2">
              <FlaskConical size={13} />{t('shell.demo_bar', 'Demo preview with sample data. Nothing you change here reaches the server.')}
            </div>
          )}
          <ViewErrorBoundary resetKey={activeTab} t={t}>
            <React.Suspense fallback={<div className="p-8 flex items-center gap-2 text-xs text-slate-500"><RotateCw size={14} className="animate-spin" />{t('common.loading', 'Loading…')}</div>}>
              <div key={activeTab + (params.id || '')} className="view-enter">{view()}</div>
            </React.Suspense>
          </ViewErrorBoundary>
        </main>
      </div>
    </div>
  );
};

/** Sign-in gate: nothing behind it is rendered (or requested) without a session. */
const AuthGate: React.FC = () => {
  const { session, sessionChecked } = useApp();
  if (!sessionChecked) {
    return <div className="h-screen w-screen flex flex-col gap-4 items-center justify-center bg-daybg dark:bg-night-0b1317"><HmLogo size={52} className="animate-pulse" /><RotateCw size={16} className="animate-spin text-slate-400" /></div>;
  }
  return session ? <MainLayout /> : <LoginScreen />;
};

export function App() {
  return (
    <AppProvider>
      <AuthGate />
    </AppProvider>
  );
}

export default App;
