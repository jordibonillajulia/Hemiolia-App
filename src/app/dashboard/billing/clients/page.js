'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../../lib/AuthContext';
import { getBillingClients, addBillingClient, updateBillingClient, deleteBillingClient, formatClientName } from '../../../../lib/firestoreUtils';
import Link from 'next/link';
import Papa from 'papaparse';
import { DIR3_DB } from '../../../../lib/dir3Database';

export default function BillingClientsPage() {
  const { user, loading, isAdmin } = useAuth();
  const [clients, setClients] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form State
  const [type, setType] = useState('Jurídica');
  const [name, setName] = useState('');
  const [nif, setNif] = useState('');
  const [nifType, setNifType] = useState('NIF');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [province, setProvince] = useState('');
  const [country, setCountry] = useState('Espanya');
  const [countryCode, setCountryCode] = useState('ES');
  const [dir3OficinaContable, setDir3OficinaContable] = useState('');
  const [dir3OrganoGestor, setDir3OrganoGestor] = useState('');
  const [dir3UnidadTramitadora, setDir3UnidadTramitadora] = useState('');

  const handleSelectPublicAdmin = (e) => {
    const nifVal = e.target.value;
    if (!nifVal) return;
    const found = DIR3_DB.find(admin => admin.nif === nifVal);
    if (found) {
      setName(formatClientName(found.name));
      setNif(found.nif);
      setType('Jurídica');
      setMunicipality(found.municipality);
      setProvince(found.province);
      setPostalCode(found.postalCode || '');
      setCountry('Espanya');
      setCountryCode('ES');
      setDir3OficinaContable(found.dir3OficinaContable || '');
      setDir3OrganoGestor(found.dir3OrganoGestor || '');
      setDir3UnidadTramitadora(found.dir3UnidadTramitadora || '');
    }
  };

  useEffect(() => {
    if (user) loadClients();
  }, [user]);

  const loadClients = async () => {
    const data = await getBillingClients();
    setClients(data);
  };

  const resetForm = () => {
    setType('Jurídica');
    setName('');
    setNif('');
    setNifType('NIF');
    setAddress('');
    setPostalCode('');
    setMunicipality('');
    setProvince('');
    setCountry('Espanya');
    setCountryCode('ES');
    setDir3OficinaContable('');
    setDir3OrganoGestor('');
    setDir3UnidadTramitadora('');
    setEditingId(null);
    setIsAdding(false);
  };

  const handleEdit = (client) => {
    setType(client.type || 'Jurídica');
    setName(client.name || '');
    setNif(client.nif || '');
    setNifType(client.nifType || 'NIF');
    setAddress(client.address || '');
    setPostalCode(client.postalCode || '');
    setMunicipality(client.municipality || '');
    setProvince(client.province || '');
    setCountry(client.country || 'Espanya');
    setCountryCode(client.countryCode || 'ES');
    setDir3OficinaContable(client.dir3OficinaContable || '');
    setDir3OrganoGestor(client.dir3OrganoGestor || '');
    setDir3UnidadTramitadora(client.dir3UnidadTramitadora || '');
    setEditingId(client.id);
    setIsAdding(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = { 
      type, 
      name: formatClientName(name), 
      nif, 
      nifType, 
      address, 
      postalCode, 
      municipality, 
      province, 
      country, 
      countryCode: countryCode.toUpperCase().trim(),
      dir3OficinaContable: dir3OficinaContable.toUpperCase().trim(),
      dir3OrganoGestor: dir3OrganoGestor.toUpperCase().trim(),
      dir3UnidadTramitadora: dir3UnidadTramitadora.toUpperCase().trim()
    };
    if (editingId) {
      await updateBillingClient(editingId, data);
    } else {
      await addBillingClient(data);
    }
    resetForm();
    loadClients();
  };

  const handleDelete = async (id, name) => {
    if (confirm(`Segur que vols esborrar el client ${formatClientName(name)}?`)) {
      await deleteBillingClient(id);
      loadClients();
    }
  };

  const handleExportCSV = () => {
    if (clients.length === 0) return;

    // Prepare data for export
    const exportData = clients.map(client => ({
      'Nom o Raó Social': client.name || '',
      'NIF / CIF': client.nif || '',
      'Tipus': client.type || '',
      'Adreça': client.address || '',
      'Codi Postal': client.postalCode || '',
      'Població': client.municipality || '',
      'Província': client.province || '',
      'País': client.country || ''
    }));

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `clients_hemiolia_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          <h1 style={{ marginTop: '0.5rem', marginBottom: 0, display: 'inline-block', verticalAlign: 'middle' }}>Clients</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button 
            className="btn btn-glass" 
            onClick={handleExportCSV} 
            disabled={clients.length === 0}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.85rem', height: '38px', fontWeight: '500', boxSizing: 'border-box', lineHeight: 'normal' }}
          >
            📤 Exportar CSV
          </button>
          {isAdmin && (
            <>
              <Link 
                href="/dashboard/billing/clients/import" 
                className="btn btn-glass"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.85rem', height: '38px', fontWeight: '500', boxSizing: 'border-box', textDecoration: 'none', lineHeight: 'normal' }}
              >
                📥 Importar CSV
              </Link>
              <button 
                className="btn btn-primary" 
                onClick={() => setIsAdding(!isAdding)}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.85rem', height: '38px', fontWeight: '500', boxSizing: 'border-box', lineHeight: 'normal' }}
              >
                {isAdding ? 'Cancel·lar' : '+ Nou Client'}
              </button>
            </>
          )}
        </div>
      </div>

      {isAdding && (
        <div className="glass-panel animate-fade-in-up" style={{ marginBottom: 'var(--space-lg)' }}>
          <form onSubmit={handleSubmit} className="grid-2col-responsive">
            <div className="input-group grid-span-all-desktop" style={{ borderBottom: '1px dashed var(--color-border)', paddingBottom: '1rem', marginBottom: '0.5rem' }}>
              <label style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>⚡ Autocompletar des de DIR3 (Administracions Públiques)</label>
              <select 
                className="input-field" 
                value="" 
                onChange={handleSelectPublicAdmin} 
                style={{ background: 'rgba(212, 175, 55, 0.05)', borderColor: 'var(--color-accent)', cursor: 'pointer' }}
              >
                <option value="">-- Clica per triar un Ajuntament/Ens i autocompletar --</option>
                {DIR3_DB.map((admin, idx) => (
                  <option key={idx} value={admin.nif}>
                    {admin.name} ({admin.nif})
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>Tipus de Client</label>
              <select className="input-field" value={type} onChange={e => setType(e.target.value)}>
                <option value="Física">Persona Física</option>
                <option value="Jurídica">Persona Jurídica (Empresa/Ens)</option>
              </select>
            </div>
            <div className="input-group">
              <label>Nom o Raó Social</label>
              <input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>NIF / CIF / DNI</label>
              <input 
                type="text" 
                className="input-field" 
                value={nif} 
                onChange={e => {
                  const val = e.target.value.toUpperCase().trim();
                  setNif(val);
                  const found = DIR3_DB.find(admin => admin.nif === val);
                  if (found) {
                    setName(formatClientName(found.name));
                    setType('Jurídica');
                    setMunicipality(found.municipality);
                    setProvince(found.province);
                    setPostalCode(found.postalCode || '');
                    setCountry('Espanya');
                    setCountryCode('ES');
                    setDir3OficinaContable(found.dir3OficinaContable || '');
                    setDir3OrganoGestor(found.dir3OrganoGestor || '');
                    setDir3UnidadTramitadora(found.dir3UnidadTramitadora || '');
                  }
                }} 
                required 
              />
            </div>
            <div className="input-group">
              <label>Tipus d'Identificació (Veri*Factu)</label>
              <select className="input-field" value={nifType} onChange={e => setNifType(e.target.value)}>
                <option value="NIF">NIF/NIE/CIF espanyol</option>
                <option value="02">02 - NIF-IVA intracomunitari (UE)</option>
                <option value="03">03 - Passaport</option>
                <option value="04">04 - Document oficial país d'origen</option>
                <option value="05">05 - Certificat de residència</option>
                <option value="06">06 - Altre document probatori</option>
              </select>
            </div>
            <div className="input-group">
              <label>Adreça</label>
              <input type="text" className="input-field" value={address} onChange={e => setAddress(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Codi Postal</label>
              <input type="text" className="input-field" value={postalCode} onChange={e => setPostalCode(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Població</label>
              <input type="text" className="input-field" value={municipality} onChange={e => setMunicipality(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Província</label>
              <input type="text" className="input-field" value={province} onChange={e => setProvince(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>País</label>
              <input type="text" className="input-field" value={country} onChange={e => setCountry(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Codi de País ISO (ex: ES, FR, US)</label>
              <input type="text" className="input-field" maxLength="2" value={countryCode} onChange={e => setCountryCode(e.target.value.toUpperCase())} required />
            </div>
            <div className="input-group">
              <label>Oficina Comptable (DIR3)</label>
              <input type="text" className="input-field" value={dir3OficinaContable} onChange={e => setDir3OficinaContable(e.target.value)} placeholder="Ex: A09000000" />
            </div>
            <div className="input-group">
              <label>Òrgan Gestor (DIR3)</label>
              <input type="text" className="input-field" value={dir3OrganoGestor} onChange={e => setDir3OrganoGestor(e.target.value)} placeholder="Ex: A09000000" />
            </div>
            <div className="input-group grid-span-all-desktop">
              <label>Unitat Tramitadora (DIR3)</label>
              <input type="text" className="input-field" value={dir3UnidadTramitadora} onChange={e => setDir3UnidadTramitadora(e.target.value)} placeholder="Ex: A09000000" />
            </div>
            <div className="grid-span-all-desktop" style={{ marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                {editingId ? 'Guardar Canvis' : 'Crear Client'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-panel table-container-responsive" style={{ padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--color-border)' }}>
            <tr>
              <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.88rem', whiteSpace: 'nowrap' }}>Nom / Raó Social</th>
              <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.88rem', whiteSpace: 'nowrap' }}>NIF (Tipus)</th>
              <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.88rem', whiteSpace: 'nowrap' }}>Població (País)</th>
              <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.88rem', whiteSpace: 'nowrap' }}>Tipus Client</th>
              <th style={{ padding: '0.6rem 0.8rem', fontSize: '0.88rem', whiteSpace: 'nowrap', textAlign: 'center' }}>Accions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(client => (
              <tr key={client.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td data-label="Nom / Raó Social" style={{ padding: '0.6rem 0.8rem', fontSize: '0.88rem', whiteSpace: 'normal', maxWidth: '300px' }}>
                  {formatClientName(client.name)}
                  {(client.dir3OficinaContable || client.dir3OrganoGestor || client.dir3UnidadTramitadora) && (
                    <span className="efact-badge">
                      ⚡ e-Fact (DIR3)
                    </span>
                  )}
                </td>
                <td data-label="NIF (Tipus)" style={{ padding: '0.6rem 0.8rem', fontSize: '0.88rem', whiteSpace: 'nowrap' }}>
                  {client.nif} {client.nifType && client.nifType !== 'NIF' ? `(${client.nifType})` : ''}
                </td>
                <td data-label="Població (País)" style={{ padding: '0.6rem 0.8rem', fontSize: '0.88rem', whiteSpace: 'nowrap' }}>
                  {client.municipality} {client.countryCode ? `(${client.countryCode})` : ''}
                </td>
                <td data-label="Tipus Client" style={{ padding: '0.6rem 0.8rem', fontSize: '0.88rem', whiteSpace: 'nowrap' }}>{client.type}</td>
                <td data-label="Accions" style={{ padding: '0.6rem 0.8rem', verticalAlign: 'middle', whiteSpace: 'nowrap', textAlign: 'center' }}>
                  {isAdmin ? (
                    <>
                      <button onClick={() => handleEdit(client)} className="btn btn-glass" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', marginRight: '0.35rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>✏️</button>
                      <button onClick={() => handleDelete(client.id, client.name)} className="btn btn-glass" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#ff6b6b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>🗑️</button>
                    </>
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Només lectura</span>
                  )}
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr><td colSpan="5" style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>No hi ha clients registrats.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
