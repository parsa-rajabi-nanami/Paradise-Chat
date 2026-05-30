import { useState, useEffect } from 'react'
import { Sun, Moon } from "lucide-react"

const ToggleThemeBtn = ({
    className = ""
}) => {
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem("theme") || "light"
    })
    const finalClasses = `${className} btn btn-icon`

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light')
    }

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }

        localStorage.setItem("theme", theme)
    }, [theme])

    return (
        <button
            onClick={toggleTheme}
            className={finalClasses}
            aria-label="Toggle theme"
        >
            {theme === "light" ? (
                <Moon className="w-6 h-6" />
            ) : (
                <Sun className="w-6 h-6" />
            )}
        </button>
    )
}

export default ToggleThemeBtn