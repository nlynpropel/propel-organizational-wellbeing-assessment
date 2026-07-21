import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Loader2, Clock, ShieldAlert, Sparkles } from 'lucide-react';
import { FEATURE_FLAGS } from './lib/featureFlags';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import AdminAssessmentsPage from './pages/AdminAssessmentsPage';
import AssessmentReportPage from './pages/AssessmentReportPage';
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
          before you can access the broker portal.
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
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen bg-neutral-bg flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md border border-neutral-border p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-neutral-bg flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-7 h-7 text-navy/40" />
        </div>
        <h1 className="text-xl font-semibold text-navy">No broker profile</h1>
        <p className="text-sm text-neutral-secondary mt-2">
          You're signed in, but no Propel broker profile is linked to your account. An
          administrator must create and activate your profile.
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

function RootRedirect() {
  const { user, profile, status, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <Navigate to="/new-account" replace />;
  if (!profile.account_setup_complete && status === 'invited' && profile.role !== 'admin') {
    return <Navigate to="/new-account" replace />;
  }
  if (status === 'active') return <Navigate to="/dashboard" replace />;
  // Invited/suspended/archived users land on new-account or are handled by ProtectedRoute elsewhere.
  return <Navigate to="/dashboard" replace />;
}

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, profile, status, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  // No profile row — user exists in auth.users but has no profiles entry.
  if (!profile) return <NoProfileScreen />;

  // New users who haven't completed account setup are routed to the setup page.
  // Admins skip this — an admin's account is created directly by another admin.
  if (!profile.account_setup_complete && status === 'invited' && profile.role !== 'admin') {
    return <Navigate to="/new-account" replace />;
  }

  // Invited users who completed setup but are still pending activation.
  if (status === 'invited') return <AccessPendingScreen />;

  // Suspended or archived — access restricted.
  if (status === 'suspended' || status === 'archived') return <AccessRestrictedScreen />;

  // Active users only from here.
  if (status !== 'active') return <AccessRestrictedScreen />;

  // Admin-only routes: block brokers.
  if (adminOnly && profile.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
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

      {/* Authenticated broker */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute><ClientsPage /></ProtectedRoute>} />
      <Route path="/clients/new" element={<ProtectedRoute><NewClientPage /></ProtectedRoute>} />
      <Route path="/clients/:id" element={<ProtectedRoute><ClientDetailPage /></ProtectedRoute>} />
      <Route path="/clients/:id/results" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />
      <Route path="/assessments" element={<ProtectedRoute><AssessmentsPage /></ProtectedRoute>} />
      <Route path="/assessments/builder" element={FEATURE_FLAGS.ENABLE_CUSTOM_ASSESSMENT_BUILDER ? <ProtectedRoute><AssessmentBuilderPage /></ProtectedRoute> : <Navigate to="/assessments" replace />} />
      <Route path="/assessments/builder/:assessmentId" element={FEATURE_FLAGS.ENABLE_CUSTOM_ASSESSMENT_BUILDER ? <ProtectedRoute><AssessmentBuilderPage /></ProtectedRoute> : <Navigate to="/assessments" replace />} />
      <Route path="/assessments/send" element={<ProtectedRoute><SendAssessmentPage /></ProtectedRoute>} />
      <Route path="/reports/:instanceId" element={<ProtectedRoute><AssessmentReportPage /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
      <Route path="/admin/assessments" element={<ProtectedRoute adminOnly><AdminAssessmentsPage /></ProtectedRoute>} />

      {/* Public respondent assessment (no auth required) */}
      <Route path="/assessment/:token" element={<AssessmentPage />} />

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
