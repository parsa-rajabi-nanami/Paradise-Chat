import { lazy, Suspense, useEffect, useState } from 'react';
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
  const isInitialized = useAuthStore(state => state.isInitialized);
  const fetchProfile = useAuthStore(state => state.fetchProfile);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    if (!isInitialized) return undefined;

    if (!isAuthenticated) {
      setProfileReady(true);
      return undefined;
    }

    let active = true;
    setProfileReady(false);

    // The persisted profile can contain URLs from an older deployment. Fetch
    // the server representation once after hydration so all profile fields
    // and protected media URLs are canonical before they reach the UI.
    fetchProfile().catch(() => {
      // Keep the existing session on transient network failures. The API
      // interceptor handles an expired access token and auth failures.
    }).finally(() => {
      if (active) setProfileReady(true);
    });

    return () => {
      active = false;
    };
  }, [isInitialized, isAuthenticated, fetchProfile]);

  if (!isInitialized || !profileReady) {
    return <PageLoader />;
  }

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
