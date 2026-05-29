'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../lib/AuthContext';
import { getContacts, addContact, deleteContact, updateContact } from '../../../lib/firestoreUtils';
import Link from 'next/link';

export default function CRMPage() {
  const { user, loading, isAdmin } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingContactId, setEditingContactId] = useState(null);
  
  // Form state
  const [name, setName] = useState('');
  const [entity, setEntity] = useState(''); // Teatre o Ajuntament
  const [municipality, setMunicipality] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

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
    const contactData = { name, entity, municipality, email, phone };
    if (editingContactId) {
      await updateContact(editingContactId, contactData);
    } else {
      await addContact(contactData);
    }
    setIsAdding(false);
    resetForm();
    loadContacts();
  };

  const resetForm = () => {
    setEditingContactId(null);
    setName(''); setEntity(''); setMunicipality(''); setEmail(''); setPhone('');
  };

  const handleEditClick = (contact) => {
    setEditingContactId(contact.id);
    setName(contact.name || '');
    setEntity(contact.entity || '');
    setMunicipality(contact.municipality || '');
    setEmail(contact.email || '');
    setPhone(contact.phone || '');
    setIsAdding(true);
  };

  const handleRemoveContact = async (id, contactName) => {
    if (confirm(`Estàs segur que vols esborrar el contacte "${contactName}"? Aquesta acció no es pot desfer.`)) {
      await deleteContact(id);
      loadContacts();
    }
  };

  if (loading || !user) return <div className="container mt-xl">Carregant CRM...</div>;

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
          <h1 style={{ marginTop: '0.5rem', marginBottom: 0, display: 'inline-block', verticalAlign: 'middle' }}>CRM i Contactes</h1>
        </div>
        {isAdmin && (
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
              <label>Nom del programador</label>
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

      <div className="glass-panel table-container-responsive" style={{ padding: 0 }}>
        {contacts.length === 0 ? (
          <p style={{ padding: 'var(--space-lg)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            Encara no hi ha cap contacte.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--color-border)' }}>
              <tr>
                <th style={{ padding: '1rem' }}>Nom</th>
                <th style={{ padding: '1rem' }}>Entitat</th>
                <th style={{ padding: '1rem' }}>Municipi</th>
                <th style={{ padding: '1rem' }}>Accions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map(contact => (
                <tr key={contact.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td data-label="Nom" style={{ padding: '1rem' }}>{contact.name}</td>
                  <td data-label="Entitat" style={{ padding: '1rem' }}>{contact.entity}</td>
                  <td data-label="Municipi" style={{ padding: '1rem' }}>{contact.municipality}</td>
                  <td data-label="Accions" style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                    <Link href={`/dashboard/crm/${contact.id}`} className="btn btn-glass" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                      Veure &rarr;
                    </Link>
                    {isAdmin && (
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
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
