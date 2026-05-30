export function ToggleField({
    label,
    value,
    onChange,
    id,
    error,
    register
}) {
    return (
        <div>
            <div className="flex items-center justify-between">
                <label
                    htmlFor={id}
                    className="text-sm font-medium text-[var(--color-text)]"
                >
                    {label}
                </label>
                <input
                    {...(register || {})}
                    type="checkbox"
                    id={id}
                    checked={register ? undefined : value}
                    onChange={register ? undefined : (e => onChange?.(e.target.checked))}
                    className="w-5 h-5 accent-[var(--color-primary)] cursor-pointer"
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
