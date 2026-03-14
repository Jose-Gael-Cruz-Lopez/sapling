'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

interface UserOption {
  id: string;
  name: string;
}

interface UserContextValue {
  userId: string;
  userName: string;
  users: UserOption[];
  userReady: boolean;
  isAuthenticated: boolean;
  setActiveUser: (id: string, name: string) => void;
  signOut: () => void;
}

const UserContext = createContext<UserContextValue>({
  userId: '',
  userName: '',
  users: [],
  userReady: false,
  isAuthenticated: false,
  setActiveUser: () => {},
  signOut: () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userReady, setUserReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sapling_user');
    if (saved) {
      try {
        const { id, name } = JSON.parse(saved);
        setUserId(id);
        setUserName(name);
      } catch {}
    }
    setUserReady(true);
  }, []);

  useEffect(() => {
    fetch('http://localhost:5000/api/users')
      .then(r => r.json())
      .then((data: { users: UserOption[] }) => {
        setUsers(data.users ?? []);
      })
      .catch(() => {});
  }, []);

  const setActiveUser = (id: string, name: string) => {
    setUserId(id);
    setUserName(name);
    localStorage.setItem('sapling_user', JSON.stringify({ id, name }));
  };

  const signOut = () => {
    setUserId('');
    setUserName('');
    localStorage.removeItem('sapling_user');
  };

  const isAuthenticated = userId.startsWith('guser_');

  const value = useMemo(
    () => ({ userId, userName, users, userReady, isAuthenticated, setActiveUser, signOut }),
    [userId, userName, users, userReady, isAuthenticated]
  );

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
