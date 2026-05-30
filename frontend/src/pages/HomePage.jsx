import { MessageSquare } from "lucide-react";
import Button from '../components/ui/Button'
import Header from "../partials/Header";
import Footer from "../partials/Footer";

export function HomePage() {
    return (
        <div className="flex flex-col min-h-screen transition-colors duration-300">
            <Header />

            <main className="flex-grow flex flex-col items-center justify-center px-6 text-center mt-5">
                {/* Animated Chat Icon */}
                <div className="mb-8 p-5 bg-blue-50 dark:bg-blue-900/20 rounded-full animate-bounce shadow-sm">
                    <MessageSquare
                        size={56}
                        strokeWidth={1.5}
                        className="text-[var(--color-primary)]"
                    />
                </div>

                {/* Main Content */}
                <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6">
                    Welcome to <span className="text-[var(--color-secondary)]">Paradise Chat</span>
                </h1>

                <p className="max-w-2xl text-lg md:text-xl text-[var(--color-text-muted)] dark:text-[var(--color-secondary-text)] mb-10 leading-relaxed">
                    A minimal, secure, and modern platform for your seamless communications.
                    Connect with your friends and team effortlessly, anywhere and anytime.
                </p>

                {/* Call to Action Buttons (Responsive) */}
                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                    <Button text="Start Chatting" url="/chat" className="px-8 py-3.5 w-full sm:w-auto rounded font-medium shadow-lg hover:shadow-blue-500/30 transition-all duration-300 transform hover:-translate-y-1 btn-primary" />
                </div>
            </main>

            <Footer />
        </div>
    );
}
