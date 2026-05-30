import { useState } from 'react'
import Button from '../components/ui/Button'
import ToggleThemeBtn from '../components/ui/ToggleThemeBtn'
import { Link, useNavigate } from 'react-router-dom'
import { Menu, X, MessageSquare } from "lucide-react"
import { useAuthStore } from '../stores/authStore'

const Header = () => {
    const { logout, isAuthenticated } = useAuthStore()
    const navigate = useNavigate();

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    const handleLogout = () => {
        logout();
        console.log('Logged out');
        navigate('/login');
        setIsMobileMenuOpen(false);
    }

    return (
        <>
            <nav className="container mx-auto flex items-center justify-between p-3 md:p-4">
                <Link to="/" className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded bg-[var(--color-secondary)] flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-[var(--color-text)]">ParadiseChat</h1>
                        <p className="text-xs text-[var(--color-text-muted)]">Real-time messaging</p>
                    </div>
                </Link>

                <div className="flex items-stretch gap-3">
                    <ToggleThemeBtn />

                    {isAuthenticated ? (
                        <>
                            <Button text="Chat" url="/chat" className="!hidden md:!inline-flex btn-primary btn" />

                            <Button text="Logout" onClick={handleLogout} className="!hidden md:!inline-flex btn-outline btn" />
                        </>
                    ) : (
                        <>
                            <Button text="Login" url="/login" className="!hidden md:!inline-flex btn-primary btn" />

                            <Button text="Register" url="/register" className="!hidden md:!inline-flex btn-secondary btn" />
                        </>
                    )}

                    <button
                        className="btn btn-icon md:!hidden"
                        onClick={() => setIsMobileMenuOpen(prev => !prev)}
                        aria-label="Open main menu"
                    >
                        {isMobileMenuOpen ? (
                            <X className="w-6 h-6" />
                        ) : (
                            <Menu className="w-6 h-6" />
                        )}
                    </button>
                </div>
            </nav>

            {isMobileMenuOpen && (
                <div className="md:hidden container mx-auto flex flex-col gap-2 px-3 pb-3">
                    {isAuthenticated ? (
                        <>
                            <Button
                                text="Chat"
                                url="/chat"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="w-full btn-primary btn"
                            />

                            <Button text="Logout" onClick={function () {
                                setIsMobileMenuOpen(false);
                                handleLogout();
                            }} className="w-full btn-outline btn" />
                        </>
                    ) : (
                        <>
                            <Button
                                text="Login"
                                url="/login"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="w-full btn-primary btn"
                            />

                            <Button
                                text="Register"
                                url="/register"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="w-full btn-secondary btn"
                            />
                        </>
                    )}
                </div>
            )}
        </>
    )
}

export default Header