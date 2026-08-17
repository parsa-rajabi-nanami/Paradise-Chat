import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';

import ErrorBoundary from './components/ErrorBoundary';
import { PageLoader } from './components/PageLoader';
import { ProtectedRoute } from './components/ProtectedRoute';

const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const ChatPage = lazy(() => import('./pages/ChatPage').then(m => ({ default: m.ChatPage })));
const UserSettings = lazy(() => import('./pages/UserSettings').then(m => ({ default: m.UserSettings })));
const ChatSettings = lazy(() => import('./pages/ChatSettings').then(m => ({ default: m.ChatSettings })));

function App() {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);

  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}

export default App;