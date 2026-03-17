'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  style?: React.CSSProperties;
  compact?: boolean;
}

export default function CustomSelect({ value, onChange, options, placeholder, style, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [dropRect, setDropRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);

  const handleToggle = () => {
    if (!open && triggerRef.current) {
      setDropRect(triggerRef.current.getBoundingClientRect());
    }
    setOpen(o => !o);
  };

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    const handleScroll = () => {
      if (triggerRef.current) setDropRect(triggerRef.current.getBoundingClientRect());
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open]);

  const padding = compact ? '2px 8px' : '5px 10px';
  const fontSize = compact ? '12px' : '13px';

  const dropdown =
    open && dropRect
      ? createPortal(
          <div
            ref={dropRef}
            style={{
              position: 'fixed',
              top: dropRect.bottom + 4,
              left: dropRect.left,
              minWidth: Math.max(dropRect.width, compact ? 120 : 140),
              background: '#ffffff',
              border: '1px solid rgba(107,114,128,0.18)',
              borderRadius: '10px',
              overflow: 'hidden',
              zIndex: 2147483647,
              boxShadow: '0 8px 24px rgba(0,0,0,0.1), 0 0 0 1px rgba(107,114,128,0.08)',
            }}
          >
            {options.map(opt => (
              <button
                key={opt.value}
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: compact ? '6px 10px' : '8px 12px',
                  background: opt.value === value ? 'rgba(26,92,42,0.08)' : 'transparent',
                  color: opt.value === value ? '#1a5c2a' : '#374151',
                  fontSize,
                  cursor: 'pointer',
                  border: 'none',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.12s, color 0.12s',
                }}
                onMouseEnter={e => {
                  if (opt.value !== value) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(26,92,42,0.05)';
                    (e.currentTarget as HTMLButtonElement).style.color = '#111827';
                  }
                }}
                onMouseLeave={e => {
                  if (opt.value !== value) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    (e.currentTarget as HTMLButtonElement).style.color = '#374151';
                  }
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <div style={{ position: 'relative', display: 'inline-block', ...style }}>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        style={{
          width: '100%',
          padding,
          background: '#ffffff',
          border: `1px solid rgba(107,114,128,${open ? '0.35' : '0.2'})`,
          borderRadius: '8px',
          color: selected ? '#111827' : '#9ca3af',
          fontSize,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          outline: 'none',
          fontFamily: 'inherit',
          transition: 'border-color 0.15s',
          boxShadow: open ? '0 0 0 3px rgba(26,92,42,0.1)' : 'none',
        }}
      >
        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {selected?.label ?? placeholder ?? ''}
        </span>
        <span
          style={{
            fontSize: '8px',
            color: '#9ca3af',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            display: 'inline-block',
            flexShrink: 0,
          }}
        >
          ▼
        </span>
      </button>
      {dropdown}
    </div>
  );
}
