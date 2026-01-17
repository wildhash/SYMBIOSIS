/**
 * @fileoverview Card component
 * @module @symbiosis/ui/components/card
 */

import type { HTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

/**
 * Card props
 */
export interface ICardProps extends HTMLAttributes<HTMLDivElement> {
  readonly variant?: 'default' | 'elevated' | 'outlined';
  readonly padding?: 'none' | 'sm' | 'md' | 'lg';
  readonly children: ReactNode;
}

/**
 * Card header props
 */
export interface ICardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode;
}

/**
 * Card content props
 */
export interface ICardContentProps extends HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode;
}

/**
 * Card footer props
 */
export interface ICardFooterProps extends HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode;
}

/**
 * Card component
 */
export const Card = forwardRef<HTMLDivElement, ICardProps>(
  function Card({ variant = 'default', padding = 'md', children, style, ...props }, ref) {
    const variantStyles: Record<string, React.CSSProperties> = {
      default: {
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      },
      elevated: {
        backgroundColor: 'var(--color-surface-elevated)',
        boxShadow: 'var(--shadow-md)',
      },
      outlined: {
        backgroundColor: 'transparent',
        border: '1px solid var(--color-border)',
      },
    };

    const paddingStyles: Record<string, string> = {
      none: '0',
      sm: 'var(--space-2)',
      md: 'var(--space-4)',
      lg: 'var(--space-6)',
    };

    return (
      <div
        ref={ref}
        style={{
          borderRadius: 'var(--radius-md)',
          padding: paddingStyles[padding],
          ...variantStyles[variant],
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  },
);

/**
 * Card header component
 */
export const CardHeader = forwardRef<HTMLDivElement, ICardHeaderProps>(
  function CardHeader({ children, style, ...props }, ref) {
    return (
      <div
        ref={ref}
        style={{
          padding: 'var(--space-4)',
          borderBottom: '1px solid var(--color-border)',
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  },
);

/**
 * Card content component
 */
export const CardContent = forwardRef<HTMLDivElement, ICardContentProps>(
  function CardContent({ children, style, ...props }, ref) {
    return (
      <div
        ref={ref}
        style={{
          padding: 'var(--space-4)',
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  },
);

/**
 * Card footer component
 */
export const CardFooter = forwardRef<HTMLDivElement, ICardFooterProps>(
  function CardFooter({ children, style, ...props }, ref) {
    return (
      <div
        ref={ref}
        style={{
          padding: 'var(--space-4)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  },
);
