'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../../lib/AuthContext';
import { getBillingProducts, addBillingProduct, updateBillingProduct, deleteBillingProduct } from '../../../../lib/firestoreUtils';
import Link from 'next/link';

export default function BillingProductsPage() {
  const { user, loading, isAdmin } = useAuth();
  const [products, setProducts] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form State
  const [description, setDescription] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [vatType, setVatType] = useState('10'); // 0, 4, 10, 21


  const loadProducts = async () => {
    const data = await getBillingProducts();
    setProducts(data);
  };

  useEffect(() => {
    if (user) loadProducts();
  }, [user]);

  const resetForm = () => {
    setDescription('');
    setUnitPrice('');
    setVatType('10');

    setEditingId(null);
    setIsAdding(false);
  };

  const handleEdit = (product) => {
    setDescription(product.description || '');
    setUnitPrice(product.unitPrice || '');
    setVatType(product.vatType || '10');

    
    setEditingId(product.id);
    setIsAdding(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = { 
      description, 
      unitPrice: parseFloat(unitPrice), 
      vatType: parseFloat(vatType), 
      isVatExempt: false, 
      exemptionCause: '',
      exemptionText: ''
    };
    if (editingId) {
      await updateBillingProduct(editingId, data);
    } else {
      await addBillingProduct(data);
    }
    resetForm();
    loadProducts();
  };

  const handleDelete = async (id, desc) => {
    if (confirm(`Segur que vols esborrar l'espectacle/producte "${desc}"?`)) {
      await deleteBillingProduct(id);
      loadProducts();
    }
  };

  if (loading || !user) return <div className="container mt-xl text-center">Carregant...</div>;

  return (
    <div className="container" style={{ paddingTop: 'var(--space-md)' }}>
      <div className="header-bar-responsive">
        <div>
          <Link href="/dashboard/billing" className="btn-back no-print" title="Tornar a Facturació" style={{ marginRight: '1rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </Link>
          <h1 style={{ marginTop: '0.5rem', marginBottom: 0, display: 'inline-block', verticalAlign: 'middle' }}>Espectacles</h1>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setIsAdding(!isAdding)}>
            {isAdding ? 'Cancel·lar' : '+ Nou Producte'}
          </button>
        )}
      </div>

      {isAdding && (
        <div className="glass-panel animate-fade-in-up" style={{ marginBottom: 'var(--space-lg)' }}>
          <form onSubmit={handleSubmit} className="grid-2col-responsive">
            <div className="input-group grid-span-all-desktop">
              <label>Descripció de l'Espectacle o Servei</label>
              <input type="text" className="input-field" value={description} onChange={e => setDescription(e.target.value)} placeholder="Actuació musical 'Layla, un viatge d'esperança'" required />
            </div>
            <div className="input-group">
              <label>Import Unitari (Base Imposable en €)</label>
              <input type="number" step="0.01" className="input-field" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Tipus d'IVA (%)</label>
              <select className="input-field" value={vatType} onChange={e => setVatType(e.target.value)}>
                <option value="21">21% (General)</option>
                <option value="10">10% (Reduït)</option>
                <option value="4">4% (Superreduït)</option>
                <option value="0">0%</option>
              </select>
            </div>

            <div className="grid-span-all-desktop" style={{ marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                {editingId ? 'Guardar Canvis' : 'Crear Producte'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-panel table-container-responsive" style={{ padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--color-border)' }}>
            <tr>
              <th style={{ padding: '1rem' }}>Descripció</th>
              <th style={{ padding: '1rem' }}>Import</th>
              <th style={{ padding: '1rem' }}>IVA</th>
              <th style={{ padding: '1rem' }}>Accions</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td data-label="Descripció" style={{ padding: '1rem' }}>{p.description}</td>
                <td data-label="Import" style={{ padding: '1rem' }}>{p.unitPrice.toFixed(2)} €</td>
                <td data-label="IVA" style={{ padding: '1rem' }}>{`${p.vatType}%`}</td>
                <td data-label="Accions" style={{ padding: '1rem' }}>
                  {isAdmin ? (
                    <>
                      <button onClick={() => handleEdit(p)} className="btn btn-glass" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', marginRight: '0.5rem' }}>✏️</button>
                      <button onClick={() => handleDelete(p.id, p.description)} className="btn btn-glass" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: '#ff6b6b' }}>🗑️</button>
                    </>
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Només lectura</span>
                  )}
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan="4" style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>No hi ha productes registrats.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
