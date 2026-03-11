/**
 * Tests for components/SessionSummary.tsx
 *
 * Covers: concepts covered (list vs empty state), mastery change delta
 * formatting (+/-), time spent (singular/plural), recommended next,
 * and both button callbacks.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SessionSummary from '@/components/SessionSummary';
import type { SessionSummary as SessionSummaryType } from '@/lib/types';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeSummary(overrides: Partial<SessionSummaryType> = {}): SessionSummaryType {
  return {
    concepts_covered: [],
    mastery_changes: [],
    new_connections: [],
    time_spent_minutes: 0,
    recommended_next: [],
    ...overrides,
  };
}

const noop = jest.fn();

afterEach(() => jest.clearAllMocks());

// ── concepts covered ──────────────────────────────────────────────────────────

describe('concepts covered', () => {
  it('renders each concept as a chip', () => {
    const summary = makeSummary({ concepts_covered: ['Recursion', 'Loops', 'Functions'] });
    render(<SessionSummary summary={summary} onDashboard={noop} onNewSession={noop} />);
    expect(screen.getByText('Recursion')).toBeInTheDocument();
    expect(screen.getByText('Loops')).toBeInTheDocument();
    expect(screen.getByText('Functions')).toBeInTheDocument();
  });

  it('shows fallback text when no concepts were covered', () => {
    render(<SessionSummary summary={makeSummary()} onDashboard={noop} onNewSession={noop} />);
    expect(screen.getByText(/no concepts recorded/i)).toBeInTheDocument();
  });
});

// ── mastery changes ───────────────────────────────────────────────────────────

describe('mastery changes', () => {
  it('does not render the section when there are no mastery changes', () => {
    render(<SessionSummary summary={makeSummary()} onDashboard={noop} onNewSession={noop} />);
    expect(screen.queryByText(/mastery changes/i)).not.toBeInTheDocument();
  });

  it('shows concept name and positive delta', () => {
    const summary = makeSummary({
      mastery_changes: [{ concept: 'Recursion', before: 0.4, after: 0.65 }],
    });
    render(<SessionSummary summary={summary} onDashboard={noop} onNewSession={noop} />);
    expect(screen.getByText('Recursion')).toBeInTheDocument();
    expect(screen.getByText('+25%')).toBeInTheDocument();
  });

  it('shows negative delta without extra minus sign', () => {
    const summary = makeSummary({
      mastery_changes: [{ concept: 'Pointers', before: 0.5, after: 0.4 }],
    });
    render(<SessionSummary summary={summary} onDashboard={noop} onNewSession={noop} />);
    expect(screen.getByText('-10%')).toBeInTheDocument();
  });

  it('shows +0% when mastery did not change', () => {
    const summary = makeSummary({
      mastery_changes: [{ concept: 'X', before: 0.5, after: 0.5 }],
    });
    render(<SessionSummary summary={summary} onDashboard={noop} onNewSession={noop} />);
    expect(screen.getByText('+0%')).toBeInTheDocument();
  });

  it('renders multiple mastery change rows', () => {
    const summary = makeSummary({
      mastery_changes: [
        { concept: 'A', before: 0.2, after: 0.5 },
        { concept: 'B', before: 0.7, after: 0.8 },
      ],
    });
    render(<SessionSummary summary={summary} onDashboard={noop} onNewSession={noop} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('+30%')).toBeInTheDocument();
    expect(screen.getByText('+10%')).toBeInTheDocument();
  });
});

// ── time spent ────────────────────────────────────────────────────────────────

describe('time spent', () => {
  it('uses singular "minute" for 1 minute', () => {
    render(
      <SessionSummary
        summary={makeSummary({ time_spent_minutes: 1 })}
        onDashboard={noop}
        onNewSession={noop}
      />
    );
    expect(screen.getByText(/1 minute$/)).toBeInTheDocument();
  });

  it('uses plural "minutes" for 0 minutes', () => {
    render(
      <SessionSummary
        summary={makeSummary({ time_spent_minutes: 0 })}
        onDashboard={noop}
        onNewSession={noop}
      />
    );
    expect(screen.getByText(/0 minutes/)).toBeInTheDocument();
  });

  it('uses plural "minutes" for more than 1 minute', () => {
    render(
      <SessionSummary
        summary={makeSummary({ time_spent_minutes: 25 })}
        onDashboard={noop}
        onNewSession={noop}
      />
    );
    expect(screen.getByText(/25 minutes/)).toBeInTheDocument();
  });
});

// ── recommended next ──────────────────────────────────────────────────────────

describe('recommended next', () => {
  it('does not render the section when list is empty', () => {
    render(<SessionSummary summary={makeSummary()} onDashboard={noop} onNewSession={noop} />);
    expect(screen.queryByText(/recommended next/i)).not.toBeInTheDocument();
  });

  it('renders recommended concepts when present', () => {
    const summary = makeSummary({ recommended_next: ['Linked Lists', 'Trees'] });
    render(<SessionSummary summary={summary} onDashboard={noop} onNewSession={noop} />);
    expect(screen.getByText('Linked Lists')).toBeInTheDocument();
    expect(screen.getByText('Trees')).toBeInTheDocument();
  });
});

// ── buttons ───────────────────────────────────────────────────────────────────

describe('buttons', () => {
  it('calls onDashboard when Dashboard button is clicked', () => {
    const onDashboard = jest.fn();
    render(
      <SessionSummary summary={makeSummary()} onDashboard={onDashboard} onNewSession={noop} />
    );
    fireEvent.click(screen.getByRole('button', { name: /dashboard/i }));
    expect(onDashboard).toHaveBeenCalledTimes(1);
  });

  it('calls onNewSession when New Session button is clicked', () => {
    const onNewSession = jest.fn();
    render(
      <SessionSummary summary={makeSummary()} onDashboard={noop} onNewSession={onNewSession} />
    );
    fireEvent.click(screen.getByRole('button', { name: /new session/i }));
    expect(onNewSession).toHaveBeenCalledTimes(1);
  });
});
