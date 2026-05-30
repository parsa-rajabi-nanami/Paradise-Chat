export function InputField({
    label,
    value,
    onChange,
    type = "text",
    id,
    placeholder,
    icon: Icon,
    error,
    register,
    ...rest
}) {
    return (
        <div>
            <label
                htmlFor={id}
                className="block text-sm font-medium mb-2 text-[var(--color-text)]"
            >
                {label}
            </label>
            <div className="relative">
                {Icon && (
                    <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
                )}
                <input
                    {...(register || {})}
                    type={type}
                    id={id}
                    value={register ? undefined : value}
                    onChange={register ? undefined : (e => onChange?.(e.target.value))}
                    className={`input ${Icon ? 'pl-10' : ''}`}
                    placeholder={placeholder}
                    {...rest}
                />
            </div>
            {error && (
                <p className="mt-1 text-sm text-[var(--color-danger)]">
                    {error}
                </p>
            )}
        </div>
    );
}
