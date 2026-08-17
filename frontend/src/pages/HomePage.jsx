import { MessageSquare } from "lucide-react";
import Button from "../components/ui/Button";
import Header from "../partials/Header";
import Footer from "../partials/Footer";

export function HomePage() {
    return (
        <div className="flex flex-col min-h-screen bg-[var(--bg-primary)] text-[var(--color-text)] transition-colors duration-300">
            <Header />

            <main className="flex-grow flex flex-col items-center justify-center px-6 text-center py-12">

                <div className="mb-8 p-5 bg-[var(--color-primary)]/10 dark:bg-[var(--color-primary)]/20 border border-[var(--color-primary)]/20 dark:border-[var(--color-primary)]/30 rounded-full animate-bounce motion-reduce:animate-none shadow-sm">
                    <MessageSquare
                        size={56}
                        strokeWidth={1.5}
                        className="text-[var(--color-primary)]"
                    />
                </div>

                <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6">
                    Welcome to <span className="text-[var(--color-secondary)]">Paradise Chat</span>
                </h1>

                <p className="max-w-2xl text-lg md:text-xl text-[var(--color-text-muted)] mb-10 leading-relaxed">
                    A minimal, secure, and modern platform for your seamless communications.
                    Connect with your friends and team effortlessly, anywhere and anytime.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                    <Button
                        text="Start Chatting"
                        url="/chat"
                        className="btn-primary px-8 py-3.5 w-full sm:w-auto shadow-lg transition-transform duration-300 hover:-translate-y-0.5"
                    />
                </div>
            </main>

            <Footer />
        </div>
    );
}