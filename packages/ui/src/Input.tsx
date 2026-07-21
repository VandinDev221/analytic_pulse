import type { InputHTMLAttributes, ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
}

export function Input({
  label,
  hint,
  error,
  id,
  className = '',
  containerClassName = '',
  ...props
}: InputProps) {
  const inputId = id || props.name;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className={['ap-field', containerClassName].filter(Boolean).join(' ')}>
      {label ? (
        <label className="ap-field__label" htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        className={['ap-input', error ? 'ap-input--error' : '', className]
          .filter(Boolean)
          .join(' ')}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        {...props}
      />
      {error ? (
        <span id={`${inputId}-error`} className="ap-field__error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span id={`${inputId}-hint`} className="ap-field__hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export interface FieldProps {
  children: ReactNode;
  className?: string;
}

export function Field({ children, className = '' }: FieldProps) {
  return <div className={['ap-field', className].filter(Boolean).join(' ')}>{children}</div>;
}
