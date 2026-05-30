import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ChatPage } from './pages/ChatPage';
import { UserSettings } from './pages/UserSettings';
import { ChatSettings } from "./pages/ChatSettings";
import { ProtectedRoute } from './components/ProtectedRoute';


function App() {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const savedTheme = localStorage.getItem('theme') || 'light';

  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  }

  return (
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
  );
}
export default App;