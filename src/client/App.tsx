import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { RequireAuth } from './auth/RequireAuth';
import { DesignPreviewPage } from './design-preview/DesignPreviewPage';
import { AppLayout } from './layout/AppLayout';
import { ChartsPage } from './pages/ChartsPage';
import { HistoryPage } from './pages/HistoryPage';
import { LogPage } from './pages/LogPage';
import { LoginPage } from './pages/LoginPage';

export function MvpApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<LogPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/charts" element={<ChartsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export function App() {
  if (import.meta.env.DEV) {
    return (
      <Routes>
        <Route path="/design-preview" element={<DesignPreviewPage />} />
        <Route path="*" element={<MvpApp />} />
      </Routes>
    );
  }

  return <MvpApp />;
}
