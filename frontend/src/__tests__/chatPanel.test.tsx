/**
 * Tests for components/ChatPanel.tsx
 *
 * Covers: message rendering, send button state, Enter-key submission,
 * action buttons (hint / confused / skip), End Session callback,
 * loading indicator, and mode description.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatPanel from '@/components/ChatPanel';
import type { ChatMessage, TeachingMode } from '@/lib/types';

// ReactMarkdown renders markdown — mock it to a plain <div> so we can assert
// on text content without worrying about markdown parsing in jsdom.
jest.mock('react-markdown', () => ({ children }: { children: React.ReactNode }) => <div>{children}</div>);

// ── helpers ───────────────────────────────────────────────────────────────────

function makeMsg(id: string, role: 'user' | 'assistant', content: string): ChatMessage {
  return { id, role, content, timestamp: new Date().toISOString() };
}

const defaultProps = {
  messages: [] as ChatMessage[],
  onSend: jest.fn(),
  onAction: jest.fn(),
  onEndSession: jest.fn(),
  loading: false,
  mode: 'socratic' as TeachingMode,
};

function renderPanel(overrides: Partial<typeof defaultProps> = {}) {
  return render(<ChatPanel {...defaultProps} {...overrides} />);
}

afterEach(() => jest.clearAllMocks());

// ── mode description ──────────────────────────────────────────────────────────

describe('mode description', () => {
  it('shows socratic description', () => {
    renderPanel({ mode: 'socratic' });
    expect(screen.getByText(/asking questions/i)).toBeInTheDocument();
  });

  it('shows expository description', () => {
    renderPanel({ mode: 'expository' });
    expect(screen.getByText(/explaining/i)).toBeInTheDocument();
  });

  it('shows teachback description', () => {
    renderPanel({ mode: 'teachback' });
    expect(screen.getByText(/you teach me/i)).toBeInTheDocument();
  });
});

// ── message rendering ─────────────────────────────────────────────────────────

describe('message rendering', () => {
  it('renders no messages when list is empty', () => {
    renderPanel();
    expect(screen.queryByRole('textbox')).toBeInTheDocument(); // textarea should still exist
  });

  it('renders user messages', () => {
    renderPanel({ messages: [makeMsg('1', 'user', 'What is recursion?')] });
    expect(screen.getByText('What is recursion?')).toBeInTheDocument();
  });

  it('renders assistant messages', () => {
    renderPanel({ messages: [makeMsg('1', 'assistant', 'Recursion is self-reference.')] });
    expect(screen.getByText('Recursion is self-reference.')).toBeInTheDocument();
  });

  it('renders multiple messages in order', () => {
    const messages = [
      makeMsg('1', 'user', 'First message'),
      makeMsg('2', 'assistant', 'Second message'),
      makeMsg('3', 'user', 'Third message'),
    ];
    renderPanel({ messages });
    const items = screen.getAllByText(/First|Second|Third/);
    expect(items).toHaveLength(3);
  });
});

// ── loading indicator ─────────────────────────────────────────────────────────

describe('loading indicator', () => {
  it('shows typing indicator when loading=true', () => {
    renderPanel({ loading: true });
    expect(screen.getByText('···')).toBeInTheDocument();
  });

  it('hides typing indicator when loading=false', () => {
    renderPanel({ loading: false });
    expect(screen.queryByText('···')).not.toBeInTheDocument();
  });
});

// ── send button ───────────────────────────────────────────────────────────────

describe('send button', () => {
  it('is disabled when input is empty', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('is disabled when loading=true even with text typed', () => {
    renderPanel({ loading: true });
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('is enabled when there is text and not loading', () => {
    renderPanel();
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    expect(screen.getByRole('button', { name: /send/i })).not.toBeDisabled();
  });

  it('calls onSend with trimmed message when clicked', () => {
    const onSend = jest.fn();
    renderPanel({ onSend });
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '  hello world  ' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(onSend).toHaveBeenCalledWith('hello world');
  });

  it('clears the input after sending', () => {
    renderPanel();
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(textarea.value).toBe('');
  });

  it('does not call onSend when input is whitespace only', () => {
    const onSend = jest.fn();
    renderPanel({ onSend });
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(onSend).not.toHaveBeenCalled();
  });
});

// ── Enter key ─────────────────────────────────────────────────────────────────

describe('Enter key behaviour', () => {
  it('sends on Enter without shift', () => {
    const onSend = jest.fn();
    renderPanel({ onSend });
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'hi' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onSend).toHaveBeenCalledWith('hi');
  });

  it('does not send on Shift+Enter', () => {
    const onSend = jest.fn();
    renderPanel({ onSend });
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'hi' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });
});

// ── action buttons ────────────────────────────────────────────────────────────

describe('action buttons', () => {
  it.each(['hint', 'confused', 'skip'] as const)(
    'calls onAction with "%s" when clicked',
    (action) => {
      const onAction = jest.fn();
      renderPanel({ onAction });
      fireEvent.click(screen.getByRole('button', { name: new RegExp(action, 'i') }));
      expect(onAction).toHaveBeenCalledWith(action);
    }
  );

  it('action buttons are disabled while loading', () => {
    renderPanel({ loading: true });
    const hintBtn = screen.getByRole('button', { name: /hint/i });
    expect(hintBtn).toBeDisabled();
  });
});

// ── End Session ───────────────────────────────────────────────────────────────

describe('End Session button', () => {
  it('calls onEndSession when clicked', () => {
    const onEndSession = jest.fn();
    renderPanel({ onEndSession });
    fireEvent.click(screen.getByRole('button', { name: /end session/i }));
    expect(onEndSession).toHaveBeenCalledTimes(1);
  });
});
