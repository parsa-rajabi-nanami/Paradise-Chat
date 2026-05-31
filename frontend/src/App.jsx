import { lazy, Suspense } from 'react';
import { PageLoader } from './components/PageLoader';

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProtectedRoute } from './components/ProtectedRoute';

const ChatPage = lazy(() =>
  import('./pages/ChatPage').then(m => ({
    default: m.ChatPage
  }))
);

const UserSettings = lazy(() =>
  import('./pages/UserSettings').then(m => ({
    default: m.UserSettings
  }))
);

const ChatSettings = lazy(() =>
  import('./pages/ChatSettings').then(m => ({
    default: m.ChatSettings
  }))
);


function App() {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route path="/login" element={isAuthenticated ? <Navigate to="/chat" replace /> : <LoginPage />} />
        <Route path="/register" element={isAuthenticated ? <Navigate to="/chat" replace /> : <RegisterPage />} />

        <Route path="/settings" element={
          <ProtectedRoute>
            <UserSettings />
          </ProtectedRoute>
        } />

        <Route path="/chat" element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        } />

        <Route path="/chat/:roomId" element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        } />

        <Route path="/chat/:roomId/settings" element={
          <ProtectedRoute>
            <ChatSettings />
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to={isAuthenticated ? '/chat' : '/login'} replace />} />
      </Routes>
    </Suspense>
  );
}
export default App;