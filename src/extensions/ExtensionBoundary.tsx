'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureException } from '@sentry/nextjs';
import { ErrorState } from '@/ui/ErrorState';

interface ExtensionBoundaryProps {
  /** 'bookingWindow:finance' — для консоли */
  name: string;
  children: ReactNode;
}

interface ExtensionBoundaryState {
  failed: boolean;
}

/**
 * Граница ошибок вклада (arch-a1 №9): упавший вклад показывает компактную ошибку с «Повторить»
 * и НЕ роняет хост (окно записи, карточку клиента).
 */
export class ExtensionBoundary extends Component<ExtensionBoundaryProps, ExtensionBoundaryState> {
  state: ExtensionBoundaryState = { failed: false };

  static getDerivedStateFromError(): ExtensionBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(`[ext] вклад ${this.props.name} упал`, error, info.componentStack);
    captureException(error, { tags: { extension: this.props.name }, contexts: { react: { componentStack: info.componentStack ?? '' } } });
  }

  private retry = () => this.setState({ failed: false });

  render() {
    if (this.state.failed) return <ErrorState compact onRetry={this.retry} />;
    return this.props.children;
  }
}
