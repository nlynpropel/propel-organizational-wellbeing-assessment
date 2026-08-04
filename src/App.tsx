import { useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Loader2, Clock, ShieldAlert, Sparkles, AlertTriangle, RotateCcw, LogOut } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FEATURE_FLAGS } from './lib/featureFlags';
import { AuthProvider, useAuth } from './context/AuthContext';
import { getLabel } from './lib/terminology';
import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import NewClientPage from './pages/NewClientPage';
import ClientDetailPage from './pages/ClientDetailPage';
import ResultsPage from './pages/ResultsPage';
import AssessmentsPage from './pages/AssessmentsPage';
import AssessmentBuilderPage from './pages/AssessmentBuilderPage';
import SendAssessmentPage from './pages/SendAssessmentPage';
import ReusableLinksPage from './pages/ReusableLinksPage';
import IntakePage from './pages/IntakePage';
import AdminAssessmentsPage from './pages/AdminAssessmentsPage';
import AssessmentReportPage from './pages/AssessmentReportPage';
import Assessment360AnalysisPage from './pages/Assessment360AnalysisPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import AssessmentPage from './pages/AssessmentPage';
import AdminPage from './pages/AdminPage';
import NewAccountPage from './pages/NewAccountPage';

function FullScreenLoader() {
  return (
    <div className="min-h-screen bg-neutral-bg flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-green animate-spin" />
    </div>
  );
}

function AccessPendingScreen() {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-neutral-bg flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md border border-neutral-border p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-orange-tint flex items-center justify-center mx-auto mb-4">
          <Clock className="w-7 h-7 text-orange" />
        </div>
        <h1 className="text-xl font-semibold text-navy">Access pending</h1>
        <p className="text-sm text-neutral-secondary mt-2">
          Your account has been created, but a Propel administrator still needs to activate it
          before you can access the platform.
        </p>
        {user?.email && (
          <p className="text-xs text-neutral-muted mt-3">Signed in as {user.email}</p>
        )}
        <button
          onClick={signOut}
          className="mt-6 text-sm font-medium text-navy hover:text-navy-mid transition"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function AccessRestrictedScreen() {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen bg-neutral-bg flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md border border-neutral-border p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-red-tint flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-7 h-7 text-red" />
        </div>
        <h1 className="text-xl font-semibold text-navy">Access restricted</h1>
        <p className="text-sm text-neutral-secondary mt-2">
          Your account has been suspended or archived. Contact your Propel administrator if you
          believe this is an error.
        </p>
        <button
          onClick={signOut}
          className="mt-6 text-sm font-medium text-navy hover:text-navy-mid transition"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function NoProfileScreen() {
  const { signOut, terminology } = useAuth();
  return (
    <div className="min-h-screen bg-neutral-bg flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md border border-neutral-border p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-neutral-bg flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-7 h-7 text-navy/40" />
        </div>
        <h1 className="text-xl font-semibold text-navy">{getLabel(terminology, 'noProfile')}</h1>
        <p className="text-sm text-neutral-secondary mt-2">
          {getLabel(terminology, 'noProfileDescription')}
        </p>
        <button
          onClick={signOut}
          className="mt-6 text-sm font-medium text-navy hover:text-navy-mid transition"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function OrgLoadErrorScreen() {
  const { refreshProfile, signOut } = useAuth();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    await refreshProfile();
    setRetrying(false);
  };

  return (
    <div className="min-h-screen bg-neutral-bg flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md border border-neutral-border p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-red-tint flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7 text-red" />
        </div>
        <h1 className="text-xl font-semibold text-navy">Couldn't load your organization</h1>
        <p className="text-sm text-neutral-secondary mt-2">
          We signed you in but couldn't load your organization data. This may be a temporary issue.
        </p>
        <div className="flex gap-3 justify-center mt-6">
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="inline-flex items-center gap-2 text-sm font-medium text-white bg-navy hover:bg-navy-mid disabled:opacity-60 px-4 py-2 rounded-sm transition"
          >
            {retrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            Retry
          </button>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 text-sm font-medium text-navy hover:text-navy-mid px-4 py-2 rounded-sm border border-neutral-border transition"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function RootRedirect() {
  const { user, profile, status, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <Navigate to="/new-account" replace />;
  if (!profile.account_setup_complete && status === 'invited' && profile.role !== 'superadmin') {
    return <Navigate to="/new-account" replace />;
  }
  if (status === 'active') return <Navigate to="/dashboard" replace />;
  // Invited/suspended/archived users land on new-account or are handled by ProtectedRoute elsewhere.
  return <Navigate to="/dashboard" replace />;
}

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, profile, status, loading, orgLoadError } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  // No profile row — user exists in auth.users but has no profiles entry.
  if (!profile) return <NoProfileScreen />;

  // New users who haven't completed account setup are routed to the setup page.
  // Superadmins skip this — a superadmin's account is created directly by another superadmin.
  if (!profile.account_setup_complete && status === 'invited' && profile.role !== 'superadmin') {
    return <Navigate to="/new-account" replace />;
  }

  // Invited users who completed setup but are still pending activation.
  if (status === 'invited') return <AccessPendingScreen />;

  // Suspended or archived — access restricted.
  if (status === 'suspended' || status === 'archived') return <AccessRestrictedScreen />;

  // Active users only from here.
  if (status !== 'active') return <AccessRestrictedScreen />;

  // Organization data failed to load — show recoverable error instead of crashing.
  if (orgLoadError) return <OrgLoadErrorScreen />;

  // Superadmin-only routes: block non-superadmin users.
  if (adminOnly && profile.role !== 'superadmin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <ErrorBoundary>{children}</ErrorBoundary>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      {/* Account setup for new users */}
      <Route path="/new-account" element={<NewAccountPage />} />

      {/* Authenticated user */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute><ClientsPage /></ProtectedRoute>} />
      <Route path="/clients/new" element={<ProtectedRoute><NewClientPage /></ProtectedRoute>} />
      <Route path="/clients/:id" element={<ProtectedRoute><ClientDetailPage /></ProtectedRoute>} />
      <Route path="/clients/:id/results" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />
      <Route path="/assessments" element={<ProtectedRoute><AssessmentsPage /></ProtectedRoute>} />
      <Route path="/assessments/builder" element={FEATURE_FLAGS.ENABLE_CUSTOM_ASSESSMENT_BUILDER ? <ProtectedRoute><AssessmentBuilderPage /></ProtectedRoute> : <Navigate to="/assessments" replace />} />
      <Route path="/assessments/builder/:assessmentId" element={FEATURE_FLAGS.ENABLE_CUSTOM_ASSESSMENT_BUILDER ? <ProtectedRoute><AssessmentBuilderPage /></ProtectedRoute> : <Navigate to="/assessments" replace />} />
      <Route path="/assessments/send" element={<ProtectedRoute><SendAssessmentPage /></ProtectedRoute>} />
      <Route path="/assessments/links" element={<ProtectedRoute><ReusableLinksPage /></ProtectedRoute>} />
      <Route path="/reports/:instanceId" element={<ProtectedRoute><AssessmentReportPage /></ProtectedRoute>} />
      <Route path="/reports/:instanceId/360-analysis" element={<ProtectedRoute><Assessment360AnalysisPage /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
      <Route path="/admin/assessments" element={<ProtectedRoute adminOnly><AdminAssessmentsPage /></ProtectedRoute>} />

      {/* Public respondent assessment (no auth required) */}
      <Route path="/assessment/:token" element={<AssessmentPage />} />
      <Route path="/intake/:token" element={<IntakePage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
