'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../lib/AuthContext';
import { getInvoices, deleteInvoice, formatDisplayInvoiceNumber, getBillingClients, formatClientName } from '../../../lib/firestoreUtils';
import Link from 'next/link';
import Papa from 'papaparse';
import { normalizeText } from '../../../lib/utils';

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

export default function BillingPage() {
  const { user, loading, isAdmin } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  
  // Filtres
  const [filterClient, setFilterClient] = useState('');
  const [filterInvoiceNumber, setFilterInvoiceNumber] = useState('');
  const [filterIssuer, setFilterIssuer] = useState('Tots');

  useEffect(() => {
    if (user) {
      getInvoices().then(data => {
        setInvoices(data);
      });
      getBillingClients().then(data => {
        setClients(data);
      });
    }
  }, [user]);

  // Llista única de clients per al filtre desplegable (combinant els desats i els existents a les factures)
  const dropdownClients = (() => {
    const map = new Map();
    clients.forEach(c => {
      const formattedName = formatClientName(c.name);
      map.set(formattedName.toLowerCase(), { name: formattedName, nif: c.nif });
    });
    invoices.forEach(inv => {
      if (inv.clientName) {
        const formattedName = formatClientName(inv.clientName);
        if (!map.has(formattedName.toLowerCase())) {
          map.set(formattedName.toLowerCase(), { name: formattedName, nif: inv.clientNif || '' });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  })();

  const filteredInvoices = invoices.filter(inv => {
    const cleanClient = normalizeText(filterClient);
    const matchClient = !filterClient || 
      normalizeText(inv.clientName).includes(cleanClient) || 
      normalizeText(inv.clientNif).includes(cleanClient);
      
    const displayNum = formatDisplayInvoiceNumber(inv.invoiceNumber, inv.issuerId);
    const cleanNum = normalizeText(filterInvoiceNumber);
    const matchNumber = !filterInvoiceNumber || 
      normalizeText(inv.invoiceNumber).includes(cleanNum) ||
      normalizeText(displayNum).includes(cleanNum);
      
    const matchIssuer = filterIssuer === 'Tots' || 
      inv.issuerId === filterIssuer;
      
    return matchClient && matchNumber && matchIssuer;
  }).sort((a, b) => {
    const d1 = new Date(b.operationDate || b.date).getTime();
    const d2 = new Date(a.operationDate || a.date).getTime();
    if (d1 !== d2) return d1 - d2;
    // Tie-break by invoice number descending
    return (b.invoiceNumber || '').localeCompare(a.invoiceNumber || '');
  });

  const handleDelete = async (id, invoiceNumber) => {
    const inv = invoices.find(i => i.id === id);
    if (inv && inv.status === 'Enviada') {
      alert('No es pot esborrar una factura que ja ha estat enviada a l\'AEAT.');
      return;
    }
    const displayNum = formatDisplayInvoiceNumber(invoiceNumber, inv?.issuerId);
    if (confirm(`Estàs segur que vols esborrar la factura ${displayNum}? Aquesta acció no es pot desfer.`)) {
      await deleteInvoice(id);
      getInvoices().then(data => {
        setInvoices(data);
      });
    }
  };

  const handleExportCSV = () => {
    const dataToExport = filteredInvoices;
    if (dataToExport.length === 0) return;
    
    // Prepare data for export
    const exportData = dataToExport.map(inv => ({
      'Número Factura': formatDisplayInvoiceNumber(inv.invoiceNumber, inv.issuerId),
      'Número AEAT (Oficial)': inv.invoiceNumber,
      'Data': formatDateDDMMYYYY(inv.date),
      'Client': inv.clientName,
      'NIF': inv.clientNif,
      'Base Imposable': `${(parseFloat(inv.totals?.baseImposable) || 0).toFixed(2)} €`,
      'Total a Cobrar': `${(parseFloat(inv.totals?.total) || 0).toFixed(2)} €`,
      'IRPF %': inv.irpfPercent || 0,
      'Estat': inv.status,
      'ID VeriFactu': inv.verifactuId || ''
    }));

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `factures_hemiolia_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading || !user) return <div className="container mt-xl text-center">Carregant Facturació...</div>;

  return (
    <div className="container" style={{ paddingTop: 'var(--space-md)' }}>
      <div className="header-bar-responsive">
        <div>
          <Link href="/dashboard" className="btn-back no-print" title="Tornar al panell" style={{ marginRight: '1rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </Link>
          <h1 style={{ marginTop: '0.5rem', marginBottom: 0, display: 'inline-block', verticalAlign: 'middle' }}>Facturació</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href="/dashboard/billing/clients" className="btn btn-glass">
            👥 Clients
          </Link>
          <Link href="/dashboard/billing/products" className="btn btn-glass">
            🎭 Espectacles
          </Link>
          <Link href="/dashboard/billing/budgets" className="btn btn-glass">
            📄 Pressupostos
          </Link>
          {isAdmin && (
            <Link href="/dashboard/billing/new" className="btn btn-primary">
              + Nova Factura
            </Link>
          )}
        </div>
      </div>

      {/* Barra de Filtres */}
      <div className="glass-panel" style={{ padding: '1.2rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '2', minWidth: '220px' }}>
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
        <div style={{ flex: '1', minWidth: '150px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '0.4rem', fontWeight: '500' }}>Nº Factura</label>
          <input 
            type="text" 
            placeholder="Ex: JB-202600000001..." 
            className="input-field" 
            value={filterInvoiceNumber} 
            onChange={(e) => setFilterInvoiceNumber(e.target.value)} 
            style={{ width: '100%', padding: '0.5rem 0.8rem' }}
          />
        </div>
        <div style={{ flex: '1', minWidth: '150px' }}>
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
        {(filterClient || filterInvoiceNumber || filterIssuer !== 'Tots') && (
          <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', paddingTop: '1.2rem' }}>
            <button 
              className="btn btn-glass" 
              onClick={() => {
                setFilterClient('');
                setFilterInvoiceNumber('');
                setFilterIssuer('Tots');
              }}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', color: '#ff6b6b' }}
            >
              Netejar 🧹
            </button>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-text-secondary)', fontWeight: 'normal' }}>
          Factures emeses ({filteredInvoices.length})
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link 
            href="/dashboard/billing/ledgers" 
            className="btn btn-glass" 
            style={{ 
              padding: '0.35rem 0.7rem', 
              fontSize: '0.75rem', 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.3rem', 
              color: 'var(--color-accent)', 
              borderColor: 'var(--color-accent)',
              textDecoration: 'none'
            }}
          >
            📊 Llibres de registre
          </Link>
          <button 
            className="btn btn-glass" 
            onClick={handleExportCSV} 
            disabled={filteredInvoices.length === 0}
            style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
          >
            📥 Exportar CSV
          </button>
        </div>
      </div>

      <div className="glass-panel table-container-responsive" style={{ padding: 0 }}>
        {invoices.length === 0 ? (
          <p style={{ padding: 'var(--space-lg)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            Encara no hi ha cap factura registrada.
          </p>
        ) : filteredInvoices.length === 0 ? (
          <p style={{ padding: 'var(--space-lg)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            No s&apos;ha trobat cap factura amb els filtres aplicats.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--color-border)' }}>
              <tr>
                <th style={{ padding: '1rem', whiteSpace: 'nowrap' }}>Data d'Emissió</th>
                <th style={{ padding: '1rem', whiteSpace: 'nowrap' }}>Nº Factura</th>
                <th style={{ padding: '1rem', whiteSpace: 'nowrap' }}>Client</th>
                <th style={{ padding: '1rem', whiteSpace: 'nowrap' }}>Base Imposable</th>
                <th style={{ padding: '1rem', whiteSpace: 'nowrap' }}>Estat</th>
                <th style={{ padding: '1rem', whiteSpace: 'nowrap' }}>Accions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map(inv => (
                <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td data-label="Data d'Emissió" style={{ padding: '1rem', whiteSpace: 'nowrap' }}>{formatDateDDMMYYYY(inv.date)}</td>
                  <td data-label="Nº Factura" style={{ padding: '1rem', whiteSpace: 'nowrap' }}>{formatDisplayInvoiceNumber(inv.invoiceNumber, inv.issuerId)}</td>
                  <td data-label="Client" style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                    <span className="text-right-mobile">
                      {formatClientName(inv.clientName)}
                    </span>
                  </td>
                  <td data-label="Base Imposable" style={{ padding: '1rem', whiteSpace: 'nowrap' }}>{(parseFloat(inv.totals?.baseImposable) || 0).toFixed(2)} €</td>
                  <td data-label="Estat" style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                    <span style={{ 
                      padding: '0.2rem 0.5rem', 
                      borderRadius: 'var(--radius-full)', 
                      fontSize: '0.8rem',
                      background: inv.status === 'Enviada' ? 'rgba(46, 204, 113, 0.2)' : 'rgba(241, 196, 15, 0.2)',
                      color: inv.status === 'Enviada' ? 'var(--color-success)' : 'var(--color-accent)',
                      whiteSpace: 'nowrap'
                    }}>
                      {inv.status}
                    </span>
                  </td>
                  <td data-label="Accions" style={{ padding: '1rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                    <Link href={`/dashboard/billing/${inv.id}`} className="btn btn-glass" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', marginRight: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      Veure &rarr;
                    </Link>
                    {isAdmin && inv.status !== 'Enviada' && (
                      <>
                        <Link href={`/dashboard/billing/new?edit=${inv.id}`} className="btn btn-glass" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', marginRight: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          ✏️ Editar
                        </Link>
                        <button onClick={() => handleDelete(inv.id, inv.invoiceNumber)} className="btn btn-glass" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: '#ff6b6b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          🗑️ Esborrar
                        </button>
                      </>
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
