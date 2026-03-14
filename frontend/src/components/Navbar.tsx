'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { getRecommendations } from '@/lib/api';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/learn', label: 'Learn' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/social', label: 'Social' },
  { href: '/tree', label: 'Tree' },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { userId, userName, userReady, isAuthenticated, signOut } = useUser();
  const [suggesting, setSuggesting] = useState(false);
  const [, startTransition] = useTransition();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auth guard — redirect to /signin if not authenticated
  useEffect(() => {
    if (!userReady) return;
    const onSigninPage = pathname.startsWith('/signin');
    if (!isAuthenticated && !onSigninPage) {
      router.replace('/signin');
    }
  }, [userReady, isAuthenticated, pathname]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSignOut = () => {
    signOut();
    setDropdownOpen(false);
    router.push('/signin');
  };

  const handleSuggest = async () => {
    setSuggesting(true);
    try {
      const res = await getRecommendations(userId);
      const top = res.recommendations[0];
      if (top) {
        const encoded = encodeURIComponent(top.concept_name);
        const base = pathname === '/calendar' ? '/learn' : pathname;
        startTransition(() => {
          router.push(`${base}?suggest=${encoded}`);
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSuggesting(false);
    }
  };

  // On signin page show minimal navbar
  if (pathname.startsWith('/signin')) {
    return (
      <nav style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(107,114,128,0.12)',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        height: '48px',
      }}>
        <Link href="/signin" style={{ display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
          <img src="/sapling-icon.svg" alt="Sapling" style={{ width: '32px', height: '32px' }} />
          <span style={{ fontFamily: "var(--font-spectral), 'Spectral', Georgia, serif", fontWeight: 700, fontSize: '20px', color: '#1a5c2a', letterSpacing: '-0.02em' }}>
            Sapling
          </span>
        </Link>
      </nav>
    );
  }

  return (
    <nav style={{
      background: 'rgba(255, 255, 255, 0.92)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(107, 114, 128, 0.12)',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '32px',
      height: '48px',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
        <img src="/sapling-icon.svg" alt="Sapling" style={{ width: '32px', height: '32px' }} />
        <span style={{
          fontFamily: "var(--font-spectral), 'Spectral', Georgia, serif",
          fontWeight: 700,
          fontSize: '20px',
          color: '#1a5c2a',
          letterSpacing: '-0.02em',
          textShadow: '0 0 12px rgba(26, 92, 42, 0.2)',
        }}>
          Sapling
        </span>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        {LINKS.map(link => {
          const active = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className="nav-link"
              style={{
                padding: '4px 12px',
                fontSize: '13px',
                color: active ? '#1a5c2a' : '#9ca3af',
                fontWeight: active ? 600 : 400,
                textDecoration: 'none',
                borderRadius: '5px',
                background: active ? 'rgba(26, 92, 42, 0.10)' : 'transparent',
                fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                letterSpacing: '0.2px',
                transition: 'color 0.15s, background 0.15s',
              }}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={handleSuggest}
          disabled={suggesting}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 13px',
            background: 'rgba(26,92,42,0.08)',
            color: '#1a5c2a',
            border: '1px solid rgba(26,92,42,0.22)',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 500,
            fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
            cursor: suggesting ? 'default' : 'pointer',
            opacity: suggesting ? 0.5 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          What should I study next?
        </button>

        {/* User dropdown */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(o => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '5px 12px',
              background: 'transparent',
              border: '1px solid rgba(107,114,128,0.2)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              color: '#374151',
              fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
            }}
          >
            <span style={{
              width: '22px', height: '22px',
              borderRadius: '50%',
              background: 'rgba(26,92,42,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 700, color: '#1a5c2a',
            }}>
              {userName ? userName[0].toUpperCase() : '?'}
            </span>
            {userName || 'Account'}
            <span style={{ fontSize: '10px', color: '#9ca3af' }}>▾</span>
          </button>

          {dropdownOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              background: '#fff',
              border: '1px solid rgba(107,114,128,0.15)',
              borderRadius: '8px',
              boxShadow: '0 4px 16px rgba(15,23,42,0.10)',
              minWidth: '160px',
              overflow: 'hidden',
              zIndex: 100,
            }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(107,114,128,0.1)' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>Signed in as</p>
                <p style={{ margin: '2px 0 0', fontSize: '13px', fontWeight: 600, color: '#111827' }}>{userName}</p>
              </div>
              <button
                onClick={handleSignOut}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#dc2626',
                  fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
