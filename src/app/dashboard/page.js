'use client';

import { useAuth } from '../../lib/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading || !user) return <div className="container mt-xl text-center">Carregant...</div>;

  return (
    <div>
      <main className="container animate-fade-in-up" style={{ paddingTop: 'var(--space-xl)', paddingBottom: 'var(--space-xl)' }}>
        <div style={{ marginBottom: '2.5rem' }}>
          <h1 style={{ fontSize: '2.2rem', color: 'var(--color-text-primary)', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)' }}>
            Benvinguts
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '1.05rem', margin: 0 }}>
            Hola <strong style={{ color: 'var(--color-accent)' }}>{user.email}</strong>. {"Gestiona l'activitat diària de la companyia musical Hemiòlia."}
          </p>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          <Link href="/dashboard/crm" className="glass-panel dashboard-card" style={{
            display: 'block',
            position: 'relative',
            overflow: 'hidden',
            minHeight: '220px',
            padding: '2.5rem 2rem 2rem 2rem',
            backgroundImage: 'linear-gradient(to bottom, rgba(10, 10, 12, 0.55), rgba(10, 10, 12, 0.93)), url("/jordi-paula.jpg")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            border: '1px solid rgba(255,255,255,0.08)'
          }}>
            <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', fontSize: '1.8rem', opacity: 0.65 }}>👥</div>
            <h3 style={{ color: 'var(--color-accent)', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)', fontSize: '1.5rem', letterSpacing: '0.5px' }}>Contactes</h3>
            <p style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem', margin: 0, lineHeight: '1.5' }}>
              {"Gestió d'organitzadors, programadors de cultura, teatres històrics i base de dades de contactes de la companyia."}
            </p>
          </Link>

          <Link href="/dashboard/road-sheet" className="glass-panel dashboard-card" style={{
            display: 'block',
            position: 'relative',
            overflow: 'hidden',
            minHeight: '220px',
            padding: '2.5rem 2rem 2rem 2rem',
            backgroundImage: 'linear-gradient(to bottom, rgba(10, 10, 12, 0.55), rgba(10, 10, 12, 0.93)), url("/silencis-trencats.jpg")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            border: '1px solid rgba(255,255,255,0.08)'
          }}>
            <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', fontSize: '1.8rem', opacity: 0.65 }}>📋</div>
            <h3 style={{ color: 'var(--color-accent)', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)', fontSize: '1.5rem', letterSpacing: '0.5px' }}>Road-sheet</h3>
            <p style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem', margin: 0, lineHeight: '1.5' }}>
              Planificació logística i fitxes per al dia de la funció: horaris de muntatge, hotels, rutes de viatge i fitxes tècniques.
            </p>
          </Link>

          <Link href="/dashboard/billing" className="glass-panel dashboard-card" style={{
            display: 'block',
            position: 'relative',
            overflow: 'hidden',
            minHeight: '220px',
            padding: '2.5rem 2rem 2rem 2rem',
            backgroundImage: 'linear-gradient(to bottom, rgba(10, 10, 12, 0.55), rgba(10, 10, 12, 0.93)), url("/silencis-trencats-billing.jpg")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            border: '1px solid rgba(255,255,255,0.08)'
          }}>
            <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', fontSize: '1.8rem', opacity: 0.65 }}>🪙</div>
            <h3 style={{ color: 'var(--color-accent)', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)', fontSize: '1.5rem', letterSpacing: '0.5px' }}>Facturació i AEAT</h3>
            <p style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem', margin: 0, lineHeight: '1.5' }}>
              Creació i enviament de factures amb registre digital immediat (Veri*Factu i e-Fact) i gestió de pressupostos signats.
            </p>
          </Link>
        </div>
      </main>
    </div>
  );
}
