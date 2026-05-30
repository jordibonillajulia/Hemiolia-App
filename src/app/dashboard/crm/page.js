'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../lib/AuthContext';
import { getContacts, addContact, deleteContact, updateContact } from '../../../lib/firestoreUtils';
import Link from 'next/link';

const getStatusBadgeStyle = (status) => {
  const base = {
    padding: '0.25rem 0.6rem',
    borderRadius: '4px',
    fontSize: '0.8rem',
    fontWeight: 'bold',
    display: 'inline-block'
  };
  
  switch(status) {
    case 'Entrevista feta':
      return { ...base, backgroundColor: 'rgba(25, 135, 84, 0.15)', color: '#2ec4b6', border: '1px solid rgba(25, 135, 84, 0.3)' };
    case 'Entrevista pendent':
      return { ...base, backgroundColor: 'rgba(255, 193, 7, 0.15)', color: '#ffb703', border: '1px solid rgba(255, 193, 7, 0.3)' };
    case 'Instància feta':
      return { ...base, backgroundColor: 'rgba(13, 110, 253, 0.15)', color: '#3a86c8', border: '1px solid rgba(13, 110, 253, 0.3)' };
    case 'Error / No possible':
      return { ...base, backgroundColor: 'rgba(220, 53, 69, 0.15)', color: '#ff6b6b', border: '1px solid rgba(220, 53, 69, 0.3)' };
    default:
      return { ...base, backgroundColor: 'rgba(108, 117, 125, 0.15)', color: '#adb5bd', border: '1px solid rgba(108, 117, 125, 0.3)' };
  }
};

export default function CRMPage() {
  const { user, loading, isAdmin, isCrm } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingContactId, setEditingContactId] = useState(null);
  
  // Form state
  const [name, setName] = useState('');
  const [entity, setEntity] = useState(''); // Teatre o Ajuntament
  const [municipality, setMunicipality] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [province, setProvince] = useState('');
  const [status, setStatus] = useState('Pendent');

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProvince, setFilterProvince] = useState('Tots');
  const [filterStatus, setFilterStatus] = useState('Tots');
  const [filterShow, setFilterShow] = useState('Tots');
  const [filterReminder, setFilterReminder] = useState(false);

  useEffect(() => {
    if (user) {
      loadContacts();
    }
  }, [user]);

  const loadContacts = async () => {
    const data = await getContacts();
    setContacts(data);
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    const contactData = { 
      name, 
      entity, 
      municipality, 
      email, 
      phone,
      province,
      status
    };
    if (editingContactId) {
      await updateContact(editingContactId, contactData);
    } else {
      await addContact({
        ...contactData,
        performedShows: [],
        interestedShows: [],
        feedbackSummary: '',
        notes: '',
        nextActionDate: '',
        nextActionNotes: ''
      });
    }
    setIsAdding(false);
    resetForm();
    loadContacts();
  };

  const resetForm = () => {
    setEditingContactId(null);
    setName(''); setEntity(''); setMunicipality(''); setEmail(''); setPhone('');
    setProvince(''); setStatus('Pendent');
  };

  const handleEditClick = (contact) => {
    setEditingContactId(contact.id);
    setName(contact.name || '');
    setEntity(contact.entity || '');
    setMunicipality(contact.municipality || '');
    setEmail(contact.email || '');
    setPhone(contact.phone || '');
    setProvince(contact.province || '');
    setStatus(contact.status || 'Pendent');
    setIsAdding(true);
  };

  const handleRemoveContact = async (id, contactName) => {
    if (confirm(`Estàs segur que vols esborrar el contacte "${contactName}"? Aquesta acció no es pot desfer.`)) {
      await deleteContact(id);
      loadContacts();
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setFilterProvince('Tots');
    setFilterStatus('Tots');
    setFilterShow('Tots');
    setFilterReminder(false);
  };

  // Filter logic
  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = 
      (contact.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (contact.entity || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (contact.municipality || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (contact.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (contact.phone || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (contact.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (contact.feedbackSummary || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (contact.nextActionNotes || '').toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesProvince = filterProvince === 'Tots' || (contact.province || '') === filterProvince;
    const matchesStatus = filterStatus === 'Tots' || (contact.status || 'Pendent') === filterStatus;
    
    const matchesShow = filterShow === 'Tots' || 
      (contact.interestedShows && contact.interestedShows.includes(filterShow)) ||
      (contact.performedShows && contact.performedShows.includes(filterShow));
      
    let matchesReminder = true;
    if (filterReminder) {
      const today = new Date().toISOString().split('T')[0];
      matchesReminder = contact.nextActionDate && contact.nextActionDate <= today;
    }
    
    return matchesSearch && matchesProvince && matchesStatus && matchesShow && matchesReminder;
  });

  if (loading || !user) return <div className="container mt-xl">Carregant CRM...</div>;

  return (
    <div className="container" style={{ paddingTop: 'var(--space-md)' }}>
      <div className="header-bar-responsive" style={{ marginBottom: '1.5rem' }}>
        <div>
          <Link href="/dashboard" className="btn-back no-print" title="Tornar al panell" style={{ marginRight: '1rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </Link>
          <h1 style={{ marginTop: '0.5rem', marginBottom: 0, display: 'inline-block', verticalAlign: 'middle' }}>CRM i Contactes</h1>
        </div>
        {(isAdmin || isCrm) && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link href="/dashboard/crm/import" className="btn btn-glass">
              Importar CSV
            </Link>
            <button className="btn btn-primary" onClick={() => {
              setIsAdding(!isAdding);
              if (isAdding) resetForm();
            }}>
              {isAdding ? 'Cancel·lar' : '+ Nou Contacte'}
            </button>
          </div>
        )}
      </div>

      {isAdding && (
        <div className="glass-panel animate-fade-in-up" style={{ marginBottom: 'var(--space-lg)' }}>
          <h3 style={{ color: 'var(--color-accent)' }}>{editingContactId ? 'Editar Contacte' : 'Afegir Nou Contacte'}</h3>
          <form onSubmit={handleAddContact} className="grid-2col-responsive" style={{ marginTop: '1rem' }}>
            <div className="input-group">
              <label>Nom del programador / contacte</label>
              <input className="input-field" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Entitat (Teatre, Festival...)</label>
              <input className="input-field" value={entity} onChange={e => setEntity(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Municipi</label>
              <input className="input-field" value={municipality} onChange={e => setMunicipality(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Província / Regió</label>
              <select 
                className="input-field" 
                value={province} 
                onChange={e => setProvince(e.target.value)}
                style={{ background: 'var(--color-background-input)', color: 'var(--color-text-primary)' }}
              >
                <option value="">Tria província...</option>
                <option value="Barcelona">Barcelona</option>
                <option value="Girona">Girona</option>
                <option value="Lleida">Lleida</option>
                <option value="Tarragona">Tarragona</option>
                <option value="Ses Illes">Ses Illes</option>
                <option value="El Mataranya">El Mataranya</option>
                <option value="València">València</option>
              </select>
            </div>
            <div className="input-group">
              <label>Estat de la sol·licitud</label>
              <select 
                className="input-field" 
                value={status} 
                onChange={e => setStatus(e.target.value)}
                style={{ background: 'var(--color-background-input)', color: 'var(--color-text-primary)' }}
              >
                <option value="Pendent">Pendent</option>
                <option value="Instància feta">Instància feta</option>
                <option value="Entrevista pendent">Entrevista pendent</option>
                <option value="Entrevista feta">Entrevista feta</option>
                <option value="Error / No possible">Error / No possible</option>
              </select>
            </div>
            <div className="input-group">
              <label>Correu</label>
              <input type="email" className="input-field" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="input-group">
              <label>Telèfon</label>
              <input className="input-field" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn btn-primary">{editingContactId ? 'Desar Canvis' : 'Desar Contacte'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Filtres */}
      <div className="glass-panel" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
        <h4 style={{ marginBottom: '1rem', color: 'var(--color-accent)' }}>🔍 Filtres i Cerca</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div className="input-group" style={{ margin: 0 }}>
            <label>Cerca text</label>
            <input 
              className="input-field" 
              placeholder="Nom, municipi, notes, telèfon..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
            />
          </div>
          
          <div className="input-group" style={{ margin: 0 }}>
            <label>Província / Regió</label>
            <select 
              className="input-field" 
              value={filterProvince} 
              onChange={e => setFilterProvince(e.target.value)}
              style={{ background: 'var(--color-background-input)', color: 'var(--color-text-primary)' }}
            >
              <option value="Tots">Totes les províncies</option>
              <option value="Barcelona">Barcelona</option>
              <option value="Girona">Girona</option>
              <option value="Lleida">Lleida</option>
              <option value="Tarragona">Tarragona</option>
              <option value="Ses Illes">Ses Illes</option>
              <option value="El Mataranya">El Mataranya</option>
              <option value="València">València</option>
            </select>
          </div>
          
          <div className="input-group" style={{ margin: 0 }}>
            <label>Estat</label>
            <select 
              className="input-field" 
              value={filterStatus} 
              onChange={e => setFilterStatus(e.target.value)}
              style={{ background: 'var(--color-background-input)', color: 'var(--color-text-primary)' }}
            >
              <option value="Tots">Tots els estats</option>
              <option value="Entrevista feta">Entrevista feta</option>
              <option value="Instància feta">Instància feta</option>
              <option value="Entrevista pendent">Entrevista pendent</option>
              <option value="Error / No possible">Error / No possible</option>
              <option value="Pendent">Pendent</option>
            </select>
          </div>
          
          <div className="input-group" style={{ margin: 0 }}>
            <label>Espectacle d'Interès</label>
            <select 
              className="input-field" 
              value={filterShow} 
              onChange={e => setFilterShow(e.target.value)}
              style={{ background: 'var(--color-background-input)', color: 'var(--color-text-primary)' }}
            >
              <option value="Tots">Tots els espectacles</option>
              <option value="Layla, un viatge d'esperança">Layla, un viatge d'esperança</option>
              <option value="Layla, el contacontes">Layla, el contacontes</option>
              <option value="Cavernus, una evolució musical">Cavernus, una evolució musical</option>
              <option value="Un Nadal Màgic">Un Nadal Màgic</option>
              <option value="Silencis Trencats">Silencis Trencats</option>
              <option value="Marcel, cartes des del front">Marcel, cartes des del front (en creació)</option>
              <option value="El petit Leonardo">El petit Leonardo (en creació)</option>
              <option value="Simfonia Corporativa">Simfonia Corporativa (en creació)</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '1.2rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}>
              <input 
                type="checkbox" 
                checked={filterReminder} 
                onChange={e => setFilterReminder(e.target.checked)} 
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ color: filterReminder ? 'var(--color-accent)' : 'var(--color-text-primary)', fontWeight: filterReminder ? 'bold' : 'normal' }}>
                🔔 Recordatoris actius
              </span>
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', marginTop: '1.2rem' }}>
            {(searchQuery || filterProvince !== 'Tots' || filterStatus !== 'Tots' || filterShow !== 'Tots' || filterReminder) && (
              <button 
                type="button" 
                onClick={handleClearFilters} 
                className="btn btn-glass"
                style={{ width: '100%', fontSize: '0.85rem', padding: '0.5rem', borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
              >
                🧹 Netejar Filtres
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="glass-panel table-container-responsive" style={{ padding: 0 }}>
        {filteredContacts.length === 0 ? (
          <p style={{ padding: 'var(--space-lg)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            No s'ha trobat cap contacte amb els filtres actius.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--color-border)' }}>
              <tr>
                <th style={{ padding: '1rem' }}>Nom</th>
                <th style={{ padding: '1rem' }}>Entitat</th>
                <th style={{ padding: '1rem' }}>Municipi</th>
                <th style={{ padding: '1rem' }}>Província</th>
                <th style={{ padding: '1rem' }}>Estat</th>
                <th style={{ padding: '1rem' }}>Accions</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map(contact => {
                const today = new Date().toISOString().split('T')[0];
                const hasOverdueReminder = contact.nextActionDate && contact.nextActionDate <= today;
                
                return (
                  <tr key={contact.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td data-label="Nom" style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>{contact.name}</span>
                        {contact.nextActionDate && (
                          <span 
                            title={`Recordatori: ${contact.nextActionNotes || ''} (Límit: ${contact.nextActionDate})`}
                            style={{ 
                              fontSize: '1rem', 
                              cursor: 'pointer',
                              animation: hasOverdueReminder ? 'pulse 2s infinite' : 'none'
                            }}
                          >
                            {hasOverdueReminder ? '🔔' : '📅'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td data-label="Entitat" style={{ padding: '1rem' }}>{contact.entity}</td>
                    <td data-label="Municipi" style={{ padding: '1rem' }}>{contact.municipality}</td>
                    <td data-label="Província" style={{ padding: '1rem' }}>{contact.province || '-'}</td>
                    <td data-label="Estat" style={{ padding: '1rem' }}>
                      <span style={getStatusBadgeStyle(contact.status || 'Pendent')}>
                        {contact.status || 'Pendent'}
                      </span>
                    </td>
                    <td data-label="Accions" style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                      <Link href={`/dashboard/crm/${contact.id}`} className="btn btn-glass" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                        Veure &rarr;
                      </Link>
                      {(isAdmin || isCrm) && (
                        <>
                          <button onClick={() => handleEditClick(contact)} className="btn btn-glass" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} title="Editar Contacte">
                            ✏️
                          </button>
                          <button onClick={() => handleRemoveContact(contact.id, contact.name)} className="btn btn-glass" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: '#ff6b6b', borderColor: '#ff6b6b' }} title="Esborrar Contacte">
                            🗑️
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
