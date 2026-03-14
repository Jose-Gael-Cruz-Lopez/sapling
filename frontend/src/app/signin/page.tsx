'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser } from '@/context/UserContext';

const ERROR_MESSAGES: Record<string, string> = {
  bu_only: 'Only @bu.edu accounts are allowed.',
  oauth_failed: 'Sign-in failed. Please try again.',
  not_configured: 'Auth is not configured. Contact support.',
};

function SignInInner() {
  const { userId, userName, userReady, setActiveUser } = useUser();
  const params = useSearchParams();
  const error = params.get('error');
  const isSignedIn = userReady && userId.startsWith('guser_');

  const handleSignOut = () => {
    setActiveUser('', '');
    localStorage.removeItem('sapling_user');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '48px 56px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '32px',
        boxShadow: 'var(--shadow-md)',
        minWidth: '320px',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>🌱</div>
          <h1 style={{
            fontFamily: 'Spectral, serif',
            fontSize: '28px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
          }}>
            Sapling
          </h1>
        </div>

        {error && (
          <p style={{ margin: 0, fontSize: '13px', color: '#dc2626', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '6px', padding: '8px 14px' }}>
            {ERROR_MESSAGES[error] ?? 'Something went wrong.'}
          </p>
        )}

        {isSignedIn ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
              Signed in as <strong>{userName}</strong>
            </p>
            <a href="/" style={{ textDecoration: 'none', width: '100%' }}>
              <button style={{
                width: '100%',
                padding: '10px 24px',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                color: '#fff',
              }}>
                Go to Dashboard
              </button>
            </a>
            <button
              onClick={handleSignOut}
              style={{
                width: '100%',
                padding: '10px 24px',
                background: 'transparent',
                border: '1px solid var(--border-mid)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-muted)',
              }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <a href="http://localhost:5000/api/auth/google" style={{ textDecoration: 'none' }}>
            <button style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 24px',
              background: '#fff',
              border: '1px solid var(--border-mid)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: 500,
              color: 'var(--text-primary)',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <GoogleIcon />
              Sign in with Google
            </button>
          </a>
        )}
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInInner />
    </Suspense>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}
