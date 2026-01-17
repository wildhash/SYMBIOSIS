/**
 * @fileoverview Tests for App component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { App } from './App';

describe('App', () => {
  it('should render boot screen initially', () => {
    render(<App />);

    expect(screen.getByText('SYMBI')).toBeInTheDocument();
    expect(screen.getByText('OS')).toBeInTheDocument();
    expect(screen.getByText('Initializing multi-model kernel...')).toBeInTheDocument();
  });
});
