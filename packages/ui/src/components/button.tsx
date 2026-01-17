/**
 * @fileoverview Button component
 * @module @symbiosis/ui/components/button
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

/**
 * Button variants
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/**
 * Button sizes
 */
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Button props
 */
export interface IButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly isLoading?: boolean;
  readonly leftIcon?: ReactNode;
  readonly rightIcon?: ReactNode;
  readonly children: ReactNode;
}

/**
 * Get variant styles
 */
function getVariantStyles(variant: ButtonVariant): string {
  const styles: Record<ButtonVariant, string> = {
    primary: `
      background-color: var(--color-primary);
      color: var(--color-background);
      border: none;
    `,
    secondary: `
      background-color: transparent;
      color: var(--color-primary);
      border: 1px solid var(--color-primary);
    `,
    ghost: `
      background-color: transparent;
      color: var(--color-text);
      border: none;
    `,
    danger: `
      background-color: var(--color-error);
      color: var(--color-text);
      border: none;
    `,
  };
  return styles[variant];
}

/**
 * Get size styles
 */
function getSizeStyles(size: ButtonSize): string {
  const styles: Record<ButtonSize, string> = {
    sm: 'padding: 0.25rem 0.5rem; font-size: 0.75rem;',
    md: 'padding: 0.5rem 1rem; font-size: 0.875rem;',
    lg: 'padding: 0.75rem 1.5rem; font-size: 1rem;',
  };
  return styles[size];
}

/**
 * Button component with brutalist-futuristic styling
 */
export const Button = forwardRef<HTMLButtonElement, IButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      style,
      ...props
    },
    ref,
  ) {
    const baseStyles = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      font-family: var(--font-mono);
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition-fast);
      border-radius: var(--radius-sm);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    `;

    const disabledStyles = disabled === true || isLoading
      ? 'opacity: 0.5; cursor: not-allowed;'
      : '';

    const hoverStyles = disabled !== true && !isLoading
      ? `
        &:hover {
          transform: translateY(-1px);
          box-shadow: var(--shadow-glow);
        }
      `
      : '';

    const combinedStyles = [
      baseStyles,
      getVariantStyles(variant),
      getSizeStyles(size),
      disabledStyles,
    ].join('');

    return (
      <button
        ref={ref}
        disabled={disabled === true || isLoading}
        style={{
          ...Object.fromEntries(
            combinedStyles
              .split(';')
              .filter(Boolean)
              .map((s) => {
                const [key, value] = s.split(':').map((x) => x.trim());
                return [
                  key?.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()) ?? '',
                  value ?? '',
                ];
              })
              .filter(([k]) => k !== '' && !k.startsWith('&')),
          ),
          ...style,
        }}
        {...props}
      >
        {isLoading ? (
          <span>Loading...</span>
        ) : (
          <>
            {leftIcon}
            {children}
            {rightIcon}
          </>
        )}
      </button>
    );
  },
);
