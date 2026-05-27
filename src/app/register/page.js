'use client';

import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.push('/dashboard');
    } catch (err) {
      setError('Error al crear el compte. Assegura\'t que la contrasenya té 6 caràcters com a mínim i que has habilitat Correu/Contrasenya a Firebase.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="container flex flex-col items-center justify-center" style={{ minHeight: '100vh' }}>
      <div className="glass-panel animate-fade-in-up" style={{ maxWidth: '400px', width: '100%' }}>
        <div className="text-center mb-lg">
          <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
            <img src="/logo-hemiolia-light.png" alt="Hemiòlia Logo" style={{ maxHeight: '110px', objectFit: 'contain' }} />
          </div>
          <p style={{ fontSize: '0.95rem', color: 'var(--color-text-secondary)' }}>Crear compte d'administrador</p>
        </div>
        
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="input-group">
            <label htmlFor="email">Correu electrònic (Inventa'n un)</label>
            <input 
              type="email" 
              id="email" 
              className="input-field" 
              placeholder="admin@hemiolia.cat"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="input-group">
            <label htmlFor="password">Contrasenya (Mínim 6 caràcters)</label>
            <input 
              type="password" 
              id="password" 
              className="input-field" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength="6"
            />
          </div>

          {error && (
            <div style={{ color: 'var(--color-error)', fontSize: '0.9rem', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }} disabled={isLoading}>
            {isLoading ? 'Creant...' : 'Crear compte'}
          </button>
        </form>
        
        <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>
          <Link href="/" style={{ color: 'var(--color-text-secondary)' }}>
            Ja tens compte? Inicia sessió
          </Link>
        </div>
      </div>
    </main>
  );
}
