'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../../lib/AuthContext';
import { getBudgets, deleteBudget, getBillingClients, formatClientName } from '../../../../lib/firestoreUtils';
import Link from 'next/link';
import { normalizeText } from '../../../../lib/utils';

// Helper to format a date string as DD/MM/YYYY with zero-padding
const formatDateDDMMYYYY = (dateStr) => {
  if (!dateStr) return '';
  
  const cleanDate = dateStr.split(/[ T]/)[0];
  
  if (cleanDate.includes('-')) {
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      const [yyyy, mm, dd] = parts;
      return `${dd.padStart(2, '0')}/${mm.padStart(2, '0')}/${yyyy}`;
    }
  }
  
  if (cleanDate.includes('/')) {
    const parts = cleanDate.split('/');
    if (parts.length === 3) {
      let day, month, year;
      if (parts[2].length === 4) {
        [day, month, year] = parts;
      } else if (parts[0].length === 4) {
        [year, month, day] = parts;
      } else {
        [day, month, year] = parts;
      }
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
  }

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

export default function BudgetsPage() {
  const { user, loading, isAdmin } = useAuth();
  const [budgets, setBudgets] = useState([]);
  const [clients, setClients] = useState([]);
  
  // Filtres
  const [filterClient, setFilterClient] = useState('');
  const [filterBudgetNumber, setFilterBudgetNumber] = useState('');
  const [filterIssuer, setFilterIssuer] = useState('Tots');
  const [filterStatus, setFilterStatus] = useState('Tots');

  useEffect(() => {
    if (user) {
      getBudgets().then(data => {
        setBudgets(data);
      });
      getBillingClients().then(data => {
        setClients(data);
      });
    }
  }, [user]);

  // Llista única de clients per al filtre desplegable (combinant els desats i els existents als pressupostos)
  const dropdownClients = (() => {
    const map = new Map();
    clients.forEach(c => {
      const formattedName = formatClientName(c.name);
      map.set(formattedName.toLowerCase(), { name: formattedName, nif: c.nif });
    });
    budgets.forEach(b => {
      if (b.clientName) {
        const formattedName = formatClientName(b.clientName);
        if (!map.has(formattedName.toLowerCase())) {
          map.set(formattedName.toLowerCase(), { name: formattedName, nif: b.clientNif || '' });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  })();

  const filteredBudgets = budgets.filter(b => {
    const cleanClient = normalizeText(filterClient);
    const matchClient = !filterClient || 
      normalizeText(b.clientName).includes(cleanClient) || 
      normalizeText(b.clientNif).includes(cleanClient);
      
    const cleanNum = normalizeText(filterBudgetNumber);
    const matchNumber = !filterBudgetNumber || 
      normalizeText(b.budgetNumber).includes(cleanNum);
      
    const matchIssuer = filterIssuer === 'Tots' || 
      b.issuerId === filterIssuer;

    const matchStatus = filterStatus === 'Tots' || 
      b.status === filterStatus;
      
    return matchClient && matchNumber && matchIssuer && matchStatus;
  });

  const handleDelete = async (id, budgetNumber) => {
    if (confirm(`Estàs segur que vols esborrar el pressupost ${budgetNumber}? Aquesta acció no es pot desfer.`)) {
      await deleteBudget(id);
      getBudgets().then(data => {
        setBudgets(data);
      });
    }
  };

  if (loading || !user) return <div className="container mt-xl text-center">Carregant Pressupostos...</div>;

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
          <h1 style={{ marginTop: '0.5rem', marginBottom: 0, display: 'inline-block', verticalAlign: 'middle' }}>Pressupostos</h1>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link href="/dashboard/billing/budgets/new" className="btn btn-primary">
              + Nou Pressupost
            </Link>
          </div>
        )}
      </div>

      {/* Barra de Filtres */}
      <div className="glass-panel" style={{ padding: '1.2rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '2', minWidth: '200px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '0.4rem', fontWeight: '500' }}>Cerca per Client</label>
          <select 
            className="input-field" 
            value={filterClient} 
            onChange={(e) => setFilterClient(e.target.value)} 
            style={{ width: '100%', padding: '0.5rem 0.8rem' }}
          >
            <option value="">Tots els clients</option>
            {dropdownClients.map((client, idx) => (
              <option key={idx} value={client.name}>
                {client.name} {client.nif ? `(${client.nif})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1', minWidth: '130px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '0.4rem', fontWeight: '500' }}>Nº Pressupost</label>
          <input 
            type="text" 
            placeholder="Ex: PRJB-2026001..." 
            className="input-field" 
            value={filterBudgetNumber} 
            onChange={(e) => setFilterBudgetNumber(e.target.value)} 
            style={{ width: '100%', padding: '0.5rem 0.8rem' }}
          />
        </div>
        <div style={{ flex: '1', minWidth: '130px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '0.4rem', fontWeight: '500' }}>Emissor</label>
          <select 
            className="input-field" 
            value={filterIssuer} 
            onChange={(e) => setFilterIssuer(e.target.value)} 
            style={{ width: '100%', padding: '0.5rem 0.8rem' }}
          >
            <option value="Tots">Tots els emissors</option>
            <option value="JB">Jordi Bonilla Julià</option>
            <option value="PM">Paula Martí Fandos</option>
          </select>
        </div>
        <div style={{ flex: '1', minWidth: '130px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '0.4rem', fontWeight: '500' }}>Estat</label>
          <select 
            className="input-field" 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)} 
            style={{ width: '100%', padding: '0.5rem 0.8rem' }}
          >
            <option value="Tots">Tots els estats</option>
            <option value="Pendent">Pendent</option>
            <option value="Acceptat">Acceptat</option>
            <option value="Rebutjat">Rebutjat</option>
          </select>
        </div>
        {(filterClient || filterBudgetNumber || filterIssuer !== 'Tots' || filterStatus !== 'Tots') && (
          <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', paddingTop: '1.2rem' }}>
            <button 
              className="btn btn-glass" 
              onClick={() => {
                setFilterClient('');
                setFilterBudgetNumber('');
                setFilterIssuer('Tots');
                setFilterStatus('Tots');
              }}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', color: '#ff6b6b' }}
            >
              Netejar 🧹
            </button>
          </div>
        )}
      </div>

      <div className="glass-panel table-container-responsive" style={{ padding: 0 }}>
        {budgets.length === 0 ? (
          <p style={{ padding: 'var(--space-lg)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            Encara no hi ha cap pressupost registrat.
          </p>
        ) : filteredBudgets.length === 0 ? (
          <p style={{ padding: 'var(--space-lg)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            No s&apos;ha trobat cap pressupost amb els filtres aplicats.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--color-border)' }}>
              <tr>
                <th style={{ padding: '1rem', whiteSpace: 'nowrap' }}>Data</th>
                <th style={{ padding: '1rem', whiteSpace: 'nowrap' }}>Nº Pressupost</th>
                <th style={{ padding: '1rem', whiteSpace: 'nowrap' }}>Client</th>
                <th style={{ padding: '1rem', whiteSpace: 'nowrap' }}>Base Imposable</th>
                <th style={{ padding: '1rem', whiteSpace: 'nowrap' }}>Estat</th>
                <th style={{ padding: '1rem', whiteSpace: 'nowrap' }}>Accions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBudgets.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td data-label="Data" style={{ padding: '1rem', whiteSpace: 'nowrap' }}>{formatDateDDMMYYYY(b.date)}</td>
                  <td data-label="Nº Pressupost" style={{ padding: '1rem', whiteSpace: 'nowrap' }}>{b.budgetNumber}</td>
                  <td data-label="Client" style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                    <span className="text-right-mobile">
                      {formatClientName(b.clientName)}
                    </span>
                  </td>
                  <td data-label="Base Imposable" style={{ padding: '1rem', whiteSpace: 'nowrap' }}>{(parseFloat(b.totals?.baseImposable) || 0).toFixed(2)} €</td>
                  <td data-label="Estat" style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                    <span style={{ 
                      padding: '0.2rem 0.5rem', 
                      borderRadius: 'var(--radius-full)', 
                      fontSize: '0.8rem',
                      background: b.status === 'Acceptat' 
                        ? 'rgba(46, 204, 113, 0.2)' 
                        : b.status === 'Rebutjat' 
                        ? 'rgba(231, 76, 60, 0.2)' 
                        : 'rgba(241, 196, 15, 0.2)',
                      color: b.status === 'Acceptat' 
                        ? 'var(--color-success)' 
                        : b.status === 'Rebutjat' 
                        ? '#ff6b6b' 
                        : 'var(--color-accent)',
                      whiteSpace: 'nowrap'
                    }}>
                      {b.status}
                    </span>
                  </td>
                  <td data-label="Accions" style={{ padding: '1rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                    <Link 
                      href={`/dashboard/billing/budgets/${b.id}`} 
                      className="btn btn-glass" 
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', marginRight: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Veure pressupost"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    </Link>
                    {isAdmin ? (
                      <>
                        <Link 
                          href={`/dashboard/billing/budgets/new?edit=${b.id}`} 
                          className="btn btn-glass" 
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', marginRight: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)' }}
                          title="Editar pressupost"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                            <path d="m15 5 4 4"></path>
                          </svg>
                        </Link>
                        <button 
                          onClick={() => handleDelete(b.id, b.budgetNumber)} 
                          className="btn btn-glass" 
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: '#ff6b6b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Esborrar pressupost"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
