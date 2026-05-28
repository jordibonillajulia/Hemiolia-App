'use client';

import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard');
    } catch (err) {
      setError('Correu o contrasenya incorrectes.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) return null; // Avoid flicker

  return (
    <main style={{ minHeight: '100vh', display: 'flex', background: 'var(--color-bg)' }}>
      {/* Left side: Hero Banner (hidden on mobile) */}
      <div className="login-hero" style={{
        flex: '1.2',
        position: 'relative',
        backgroundImage: 'linear-gradient(to bottom, rgba(10, 10, 12, 0.45), rgba(10, 10, 12, 0.9)), url("/hemiolia-trio.jpg")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '3.5rem',
        borderRight: '1px solid var(--color-border)'
      }}>
        <div>
          <img src="/logo-hemiolia-light.png" alt="Hemiòlia Logo" style={{ maxHeight: '170px', objectFit: 'contain' }} />
        </div>
        <div style={{ maxWidth: '520px' }}>
          <h2 style={{ fontSize: '2.8rem', color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)', marginBottom: '1.2rem', lineHeight: '1.15' }}>
            Música, cultura i passió en moviment.
          </h2>
          <p style={{ fontSize: '1.1rem', color: 'var(--color-text-secondary)', lineHeight: '1.75' }}>
            Benvingut a l'espai de gestió interna de la Companyia Hemiòlia. Accedeix per gestionar el CRM de contactes, la facturació electrònica i la logística de gira dels nostres espectacles.
          </p>
        </div>
        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
          © {new Date().getFullYear()} Hemiòlia. Tots els drets reservats.
        </div>
      </div>

      {/* Right side: Login Form */}
      <div className="login-form-container" style={{
        flex: '1',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '2rem',
        position: 'relative',
        zIndex: 2
      }}>
        {/* Subtle background glow */}
        <div style={{
          position: 'absolute',
          width: '350px',
          height: '350px',
          borderRadius: '50%',
          background: 'rgba(212, 175, 55, 0.07)',
          filter: 'blur(100px)',
          zIndex: -1,
          top: '30%',
          left: '30%'
        }} />

        <div className="glass-panel animate-fade-in-up" style={{ maxWidth: '400px', width: '100%', padding: '2.5rem' }}>
          <div className="text-center" style={{ marginBottom: '2rem' }}>
            {/* Logo on mobile only */}
            <div className="mobile-logo-container" style={{ marginBottom: '1.5rem' }}>
              <img src="/logo-hemiolia-light.png" alt="Hemiòlia Logo" style={{ maxHeight: '130px', objectFit: 'contain', margin: '0 auto' }} />
            </div>
            <h2 style={{ color: 'var(--color-accent)', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)', fontSize: '2.1rem' }}>Benvinguts</h2>
          </div>
          
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label htmlFor="email" style={{ fontWeight: '500' }}>Correu electrònic</label>
              <input 
                type="email" 
                id="email" 
                className="input-field" 
                placeholder="admin@hemiolia.cat"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ background: 'rgba(0, 0, 0, 0.5)', borderColor: 'rgba(255, 255, 255, 0.15)' }}
              />
            </div>
            
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label htmlFor="password" style={{ fontWeight: '500' }}>Contrasenya</label>
              <input 
                type="password" 
                id="password" 
                className="input-field" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ background: 'rgba(0, 0, 0, 0.5)', borderColor: 'rgba(255, 255, 255, 0.15)' }}
              />
            </div>

            {error && (
              <div style={{ color: 'var(--color-error)', fontSize: '0.85rem', textAlign: 'center', background: 'rgba(231, 76, 60, 0.1)', padding: '0.5rem', borderRadius: '4px', border: '1px solid rgba(231, 76, 60, 0.2)' }}>
                ⚠️ {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', padding: '0.8rem', fontSize: '1rem', fontWeight: 'bold' }} disabled={isLoading}>
              {isLoading ? 'Iniciant sessió...' : 'Accedir'}
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem' }}>
            <a href="/register" style={{ color: 'var(--color-text-secondary)', textDecoration: 'underline' }}>
              No tens compte? Registra't aquí
            </a>
          </div>
        </div>
      </div>

      {/* Landscape lock overlay for mobile devices */}
      <div className="landscape-lock-overlay">
        <div className="phone-rotate-icon">📱🔄</div>
        <h3>Gira el mòbil en vertical</h3>
        <p>Aquesta pantalla de l'aplicació està dissenyada exclusivament per a orientació vertical.</p>
      </div>

      <style>{`
        .landscape-lock-overlay {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background-color: #0a0a0c;
          z-index: 99999;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          color: #f0f0f5;
          text-align: center;
          padding: 2rem;
          box-sizing: border-box;
        }
        .phone-rotate-icon {
          font-size: 3.5rem;
          margin-bottom: 1.2rem;
          animation: phone-rotate 2.5s ease-in-out infinite;
        }
        .landscape-lock-overlay h3 {
          color: #d4af37;
          font-family: var(--font-heading);
          font-size: 1.8rem;
          margin-bottom: 0.75rem;
          font-weight: 600;
        }
        .landscape-lock-overlay p {
          color: #a0a0b0;
          font-size: 0.95rem;
          max-width: 340px;
          line-height: 1.6;
          margin: 0;
        }
        @media (max-width: 900px) and (orientation: landscape) and (pointer: coarse) {
          .landscape-lock-overlay {
            display: flex !important;
          }
        }
        @keyframes phone-rotate {
          0% { transform: rotate(0deg); }
          30% { transform: rotate(90deg); }
          70% { transform: rotate(90deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>
    </main>
  );
}

