import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, MessageSquare } from 'lucide-react';
import Button from '../components/ui/Button';
import ToggleThemeBtn from '../components/ui/ToggleThemeBtn';
import { useAuthStore } from '../stores/authStore';

const Header = () => {
  const { logout, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setIsMobileMenuOpen(false);
    navigate('/login');
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // کلاس پایه یکسان برای تمامی دکمه‌ها
  const baseBtnClass = "h-10 inline-flex items-center justify-center px-4 rounded-lg font-medium transition-all text-sm";

  return (
    <header className="w-full border-b border-[var(--color-border)] bg-[var(--color-surface)] transition-colors duration-300 sticky top-0 z-40">
      <nav className="container mx-auto flex items-center justify-between p-3 md:p-4">
        {/* Brand Logo */}
        <Link
          to="/"
          onClick={closeMobileMenu}
          className="flex items-center space-x-3 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] rounded-lg p-1"
        >
          <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)] flex items-center justify-center shadow-sm">
            <MessageSquare className="w-5 h-5 text-[var(--color-secondary-text)]" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight text-[var(--color-text)]">
              ParadiseChat
            </h1>
            <p className="text-xs text-[var(--color-text-muted)]">Real-time messaging</p>
          </div>
        </Link>

        {/* Right Navigation Controls */}
        <div className="flex items-center gap-2 md:gap-3">
          <ToggleThemeBtn />

          {/* Desktop Links */}
          {isAuthenticated ? (
            <div className="hidden md:flex items-center gap-2">
              <Button
                text="Chat"
                url="/chat"
                className={`${baseBtnClass} btn-primary border border-transparent gap-1.5`}
              />
              <Button
                text="Settings"
                url="/settings"
                className={`${baseBtnClass} btn-outline border border-[var(--color-border)] gap-1.5`}
              />
              <Button
                text="Logout"
                onClick={handleLogout}
                className={`${baseBtnClass} btn-outline gap-1.5 text-[var(--color-danger)] border border-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white`}
              />
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <Button
                text="Login"
                url="/login"
                className={`${baseBtnClass} btn-primary border border-transparent`}
              />
              <Button
                text="Register"
                url="/register"
                className={`${baseBtnClass} btn-secondary border border-transparent`}
              />
            </div>
          )}

          {/* Mobile Hamburger Button */}
          <button
            className="h-10 w-10 flex items-center justify-center border border-transparent rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] md:hidden"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            aria-label={isMobileMenuOpen ? 'Close main menu' : 'Open main menu'}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div
          id="mobile-navigation"
          className="md:hidden border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 flex flex-col gap-2 shadow-lg animate-in slide-in-from-top-2 duration-200"
        >
          {isAuthenticated ? (
            <>
              <Button
                text="Chat"
                url="/chat"
                onClick={closeMobileMenu}
                className={`${baseBtnClass} w-full btn-primary border border-transparent gap-2`}
              />
              <Button
                text="Settings"
                url="/settings"
                onClick={closeMobileMenu}
                className={`${baseBtnClass} w-full btn-outline border border-[var(--color-border)] gap-2`}
              />
              <Button
                text="Logout"
                onClick={handleLogout}
                className={`${baseBtnClass} w-full btn-outline gap-2 text-[var(--color-danger)] border border-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white`}
              />
            </>
          ) : (
            <>
              <Button
                text="Login"
                url="/login"
                onClick={closeMobileMenu}
                className={`${baseBtnClass} w-full btn-primary border border-transparent`}
              />
              <Button
                text="Register"
                url="/register"
                onClick={closeMobileMenu}
                className={`${baseBtnClass} w-full btn-secondary border border-transparent`}
              />
            </>
          )}
        </div>
      )}
    </header>
  );
};

export default Header;