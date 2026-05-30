import { Link } from "react-router-dom"

const Button = ({
    text,
    url,
    onClick,
    className = "",
    type = "button",
}) => {
    const baseClasses =
        "px-4 py-2 rounded font-medium transition text-center inline-flex items-center justify-center"

    const finalClasses = `${className} ${baseClasses}`

    if (onClick && !url) {
        return (
            <button onClick={onClick} type={type} className={finalClasses}>
                {text}
            </button>
        )
    }

    return (
        <Link
            to={url}
            onClick={onClick}
            className={finalClasses}
        >
            {text}
        </Link>
    )
}

export default Button