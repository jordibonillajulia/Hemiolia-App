'use client';

import { useAuth } from '../../lib/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import Link from 'next/link';

export default function DashboardLayout({ children }) {
  const { user, loading, isAdmin, isCrm } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return <div className="container mt-xl text-center">Carregant...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Global Navigation Bar */}
      <nav className="glass-panel no-print nav-bar-responsive" style={{ 
        borderRadius: '0', 
        borderLeft: 'none', 
        borderRight: 'none', 
        borderTop: 'none', 
        padding: '0.5rem 2.5rem', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        zIndex: 100,
        position: 'relative',
        background: 'rgba(10, 10, 12, 0.8)'
      }}>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img src="/logo-hemiolia-light.png" alt="Hemiòlia Logo" style={{ maxHeight: '80px', width: 'auto', objectFit: 'contain' }} />
          <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-accent)', letterSpacing: '0.5px', marginTop: '4px' }}>App</span>
        </Link>
        <button 
          className="btn btn-glass" 
          style={{ padding: '0.45rem 1.15rem', fontSize: '0.88rem', borderColor: 'rgba(255,255,255,0.15)', transition: 'var(--transition-fast)' }}
          onClick={() => signOut(auth)}
        >
          Tancar sessió
        </button>
      </nav>

      {!isAdmin && (
        <div style={{
          background: 'rgba(212, 175, 55, 0.1)',
          borderBottom: '1px solid rgba(212, 175, 55, 0.3)',
          color: 'var(--color-accent)',
          padding: '0.5rem 2.5rem',
          fontSize: '0.88rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          justifyContent: 'center',
          fontWeight: '500'
        }}>
          <span>
            {isCrm 
              ? '📝 Tens accés per editar el CRM i Contactes. La resta de seccions són de només lectura.' 
              : '👁️ Mode de visualització (Només lectura). No pots modificar camps ni dades.'}
          </span>
        </div>
      )}
      
      {/* Page Content */}
      <div style={{ flex: 1 }}>
        {children}
      </div>
    </div>
  );
}
