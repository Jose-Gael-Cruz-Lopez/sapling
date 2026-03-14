'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/context/UserContext';

export default function SignInCallback() {
  const router = useRouter();
  const params = useSearchParams();
  const { setActiveUser } = useUser();

  useEffect(() => {
    const userId = params.get('user_id');
    const name = params.get('name');
    const error = params.get('error');

    if (error || !userId || !name) {
      router.replace('/signin?error=signin_failed');
      return;
    }

    setActiveUser(userId, name);
    router.replace('/');
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      color: 'var(--text-muted)',
      fontSize: '15px',
    }}>
      Signing you in…
    </div>
  );
}
