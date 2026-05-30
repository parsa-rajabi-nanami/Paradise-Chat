export function TextAreaField({
    label,
    value,
    onChange,
    id,
    placeholder,
    error,
    register,
    rows = 4,
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
            <textarea
                {...(register || {})}
                id={id}
                value={register ? undefined : value}
                onChange={register ? undefined : (e => onChange?.(e.target.value))}
                className="input resize-none"
                placeholder={placeholder}
                rows={rows}
                {...rest}
            />
            {error && (
                <p className="mt-1 text-sm text-[var(--color-danger)]">
                    {error}
                </p>
            )}
        </div>
    );
}