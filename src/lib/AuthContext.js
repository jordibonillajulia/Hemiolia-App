'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const AuthContext = createContext({
  user: null,
  role: 'viewer',
  isAdmin: false,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('viewer');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            setRole(userDocSnap.data().role || 'viewer');
          } else {
            // First login or registration
            const defaultRole = currentUser.email === 'info@hemiolia.cat' ? 'admin' : 'viewer';
            await setDoc(userDocRef, {
              email: currentUser.email,
              role: defaultRole,
              createdAt: new Date().toISOString()
            });
            setRole(defaultRole);
          }
        } catch (error) {
          console.error("Error loading user role from Firestore:", error);
          // Fallback based on email
          setRole(currentUser.email === 'info@hemiolia.cat' ? 'admin' : 'viewer');
        }
      } else {
        setRole('viewer');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((reg) => console.log('ServiceWorker registered with scope: ', reg.scope))
          .catch((err) => console.error('ServiceWorker registration failed: ', err));
      });
    }
  }, []);

  const isAdmin = role === 'admin';

  return (
    <AuthContext.Provider value={{ user, role, isAdmin, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
