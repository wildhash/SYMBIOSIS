/**
 * @fileoverview Button component
 * @module @symbiosis/ui/components/button
 */

import type { ButtonHTMLAttributes, ReactNode, CSSProperties } from 'react';
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
function getVariantStyles(variant: ButtonVariant): CSSProperties {
  const styles: Record<ButtonVariant, CSSProperties> = {
    primary: {
      backgroundColor: 'var(--color-primary)',
      color: 'var(--color-background)',
      border: 'none',
    },
    secondary: {
      backgroundColor: 'transparent',
      color: 'var(--color-primary)',
      border: '1px solid var(--color-primary)',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--color-text)',
      border: 'none',
    },
    danger: {
      backgroundColor: 'var(--color-error)',
      color: 'var(--color-text)',
      border: 'none',
    },
  };
  return styles[variant];
}

/**
 * Get size styles
 */
function getSizeStyles(size: ButtonSize): CSSProperties {
  const styles: Record<ButtonSize, CSSProperties> = {
    sm: { padding: '0.25rem 0.5rem', fontSize: '0.75rem' },
    md: { padding: '0.5rem 1rem', fontSize: '0.875rem' },
    lg: { padding: '0.75rem 1.5rem', fontSize: '1rem' },
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
    const baseStyles: CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      fontFamily: 'var(--font-mono)',
      fontWeight: 600,
      cursor: disabled === true || isLoading ? 'not-allowed' : 'pointer',
      transition: 'all var(--transition-fast)',
      borderRadius: 'var(--radius-sm)',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      opacity: disabled === true || isLoading ? 0.5 : 1,
    };

    const combinedStyles: CSSProperties = {
      ...baseStyles,
      ...getVariantStyles(variant),
      ...getSizeStyles(size),
      ...style,
    };

    return (
      <button
        ref={ref}
        disabled={disabled === true || isLoading}
        style={combinedStyles}
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
