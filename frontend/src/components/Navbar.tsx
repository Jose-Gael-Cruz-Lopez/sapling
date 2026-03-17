'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { getRecommendations } from '@/lib/api';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/learn', label: 'Learn' },
  { href: '/library', label: 'Library' },
  { href: '/study', label: 'Study' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/social', label: 'Social' },
  { href: '/tree', label: 'Tree' },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { userId, userName, avatarUrl, userReady, isAuthenticated, signOut } = useUser();
  const [suggesting, setSuggesting] = useState(false);
  const [, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Redirect unauthenticated users to signin
  useEffect(() => {
    if (userReady && !isAuthenticated && pathname !== '/signin' && pathname !== '/signin/callback') {
      router.push('/signin');
    }
  }, [userReady, isAuthenticated, pathname, router]);

  const handleSuggest = async () => {
    setSuggesting(true);
    try {
      const res = await getRecommendations(userId);
      const top = res.recommendations[0];
      if (top) {
        const encoded = encodeURIComponent(top.concept_name);
        // Calendar has no graph — redirect to Learn; all other pages stay in place
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

  const handleSignOut = () => {
    setMenuOpen(false);
    signOut();
    router.push('/signin');
  };

  return (
    <nav
      style={{
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
      }}
    >
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
                borderBottom: 'none',
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
            transition: 'opacity 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          What should I study next?
        </button>

        {/* User avatar/name dropdown */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 10px',
              background: 'transparent',
              border: '1px solid rgba(107,114,128,0.18)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif",
              color: '#374151',
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                style={{ width: '24px', height: '24px', borderRadius: '50%' }}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'rgba(26,92,42,0.12)',
                color: '#1a5c2a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 600,
              }}>
                {userName?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
            <span style={{ fontWeight: 500 }}>{userName || 'User'}</span>
          </button>

          {menuOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '4px',
              background: '#ffffff',
              border: '1px solid rgba(107,114,128,0.15)',
              borderRadius: '8px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
              minWidth: '160px',
              zIndex: 100,
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '10px 14px',
                borderBottom: '1px solid rgba(107,114,128,0.1)',
                fontSize: '12px',
                color: '#9ca3af',
              }}>
                Signed in as <strong style={{ color: '#374151' }}>{userName}</strong>
              </div>
              <button
                onClick={handleSignOut}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  fontSize: '13px',
                  color: '#dc2626',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
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
