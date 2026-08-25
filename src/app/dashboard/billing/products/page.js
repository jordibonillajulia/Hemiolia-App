'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../../../lib/AuthContext';
import { getBillingProducts, addBillingProduct, updateBillingProduct, deleteBillingProduct } from '../../../../lib/firestoreUtils';
import Link from 'next/link';

export default function BillingProductsPage() {
  const { user, loading, isAdmin } = useAuth();
  const searchParams = useSearchParams();
  const highlightId = searchParams ? searchParams.get('highlight') : null;
  const [products, setProducts] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [justEditedId, setJustEditedId] = useState(null);

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

  useEffect(() => {
    if (highlightId && products.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`product-row-${highlightId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }, [highlightId, products]);

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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    let targetId = editingId;
    if (editingId) {
      await updateBillingProduct(editingId, data);
    } else {
      const docRef = await addBillingProduct(data);
      if (docRef && docRef.id) targetId = docRef.id;
    }
    resetForm();
    await loadProducts();

    if (targetId) {
      setJustEditedId(targetId);
      setTimeout(() => {
        const el = document.getElementById(`product-row-${targetId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);
      setTimeout(() => {
        setJustEditedId(null);
      }, 3000);
    }
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

      <style>{`
        .product-highlight-row {
          border: 2px solid var(--color-accent) !important;
          background-color: rgba(212, 175, 55, 0.15) !important;
          box-shadow: 0 0 25px rgba(255, 183, 3, 0.45) !important;
        }
      `}</style>

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
            {products.map(p => {
              const isHighlighted = highlightId === p.id || justEditedId === p.id;
              return (
                <tr 
                  id={`product-row-${p.id}`}
                  key={p.id} 
                  className={isHighlighted ? 'product-highlight-row' : ''}
                  style={{ 
                    borderBottom: isHighlighted ? '2px solid var(--color-accent)' : '1px solid rgba(255,255,255,0.05)',
                    backgroundColor: isHighlighted ? 'rgba(212, 175, 55, 0.15)' : undefined,
                    boxShadow: isHighlighted ? '0 0 25px rgba(255, 183, 3, 0.45)' : undefined,
                    transition: 'all 0.3s ease-in-out'
                  }}
                >
                  <td data-label="Descripció" style={{ padding: '1rem' }}>{p.description}</td>
                  <td data-label="Import" style={{ padding: '1rem' }}>{p.unitPrice.toFixed(2)} €</td>
                  <td data-label="IVA" style={{ padding: '1rem' }}>{`${p.vatType}%`}</td>
                  <td data-label="Accions" style={{ padding: '1rem' }}>
                    {isAdmin ? (
                      <>
                        <button 
                          onClick={() => handleEdit(p)} 
                          className="btn btn-glass" 
                          style={{ padding: '0.3rem 0.6rem', marginRight: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)' }}
                          title="Editar espectacle"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                            <path d="m15 5 4 4"></path>
                          </svg>
                        </button>
                        <button 
                          onClick={() => handleDelete(p.id, p.description)} 
                          className="btn btn-glass" 
                          style={{ padding: '0.3rem 0.6rem', color: '#ff6b6b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Esborrar espectacle"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                          </svg>
                        </button>
                      </>
                    ) : (
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Només lectura</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr><td colSpan="4" style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>No hi ha productes registrats.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

