import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { ChartsPage } from './pages/ChartsPage';
import { HistoryPage } from './pages/HistoryPage';
import { LogPage } from './pages/LogPage';

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<LogPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/charts" element={<ChartsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
