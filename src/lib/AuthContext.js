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
            let currentRole = userDocSnap.data().role || 'viewer';
            let needsUpdate = false;
            // Sync with default roles for specific emails
            if (currentUser.email === 'jordibonillajulia@gmail.com' || currentUser.email === 'info@hemiolia.cat' || currentUser.email === 'admin@hemiolia.cat') {
              if (currentRole !== 'admin') {
                currentRole = 'admin';
                needsUpdate = true;
              }
            } else if (currentUser.email === 'unaonadapetitona@gmail.com') {
              if (currentRole !== 'crm') {
                currentRole = 'crm';
                needsUpdate = true;
              }
            }
            if (needsUpdate) {
              await setDoc(userDocRef, { role: currentRole }, { merge: true });
            }
            setRole(currentRole);
          } else {
            // First login or registration
            let defaultRole = 'viewer';
            if (currentUser.email === 'jordibonillajulia@gmail.com' || currentUser.email === 'info@hemiolia.cat' || currentUser.email === 'admin@hemiolia.cat') {
              defaultRole = 'admin';
            } else if (currentUser.email === 'unaonadapetitona@gmail.com') {
              defaultRole = 'crm';
            }
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
          let fallbackRole = 'viewer';
          if (currentUser.email === 'jordibonillajulia@gmail.com' || currentUser.email === 'info@hemiolia.cat' || currentUser.email === 'admin@hemiolia.cat') {
            fallbackRole = 'admin';
          } else if (currentUser.email === 'unaonadapetitona@gmail.com') {
            fallbackRole = 'crm';
          }
          setRole(fallbackRole);
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
  const isCrm = role === 'crm' || role === 'admin';

  return (
    <AuthContext.Provider value={{ user, role, isAdmin, isCrm, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
