import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupApi } from './api/setup';
import { useAuthStore } from './store/auth';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SetupWizard } from './pages/setup/SetupWizard';
import { LoginPage } from './pages/auth/LoginPage';
import { UsersPage } from './pages/users/UsersPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { JobBoardPage } from './pages/jobs/JobBoardPage';
import { TravelerPage } from './pages/traveler/TravelerPage';
import { Spinner } from './components/ui/Spinner';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function AppRoutes() {
  const { user, setTenantId } = useAuthStore();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    setupApi
      .status()
      .then((s) => {
        if (!s.needsSetup && s.tenantId) setTenantId(s.tenantId);
        setNeedsSetup(s.needsSetup);
      })
      .catch(() => setNeedsSetup(false));
  }, [setTenantId]);

  if (needsSetup === null) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (needsSetup) {
    return (
      <Routes>
        <Route path="*" element={<SetupWizard />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/jobs" replace /> : <LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/jobs" replace />} />
        <Route path="jobs" element={<JobBoardPage />} />
        <Route path="jobs/:jobId/traveler" element={<TravelerPage />} />
        <Route
          path="users"
          element={
            <ProtectedRoute requiredRoles={['SUPER_ADMIN', 'ADMIN']}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings"
          element={
            <ProtectedRoute requiredRoles={['SUPER_ADMIN']}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to={user ? '/jobs' : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
