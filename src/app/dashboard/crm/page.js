'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../lib/AuthContext';
import { getContacts, addContact, deleteContact, updateContact } from '../../../lib/firestoreUtils';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { normalizeText } from '../../../lib/utils';

const getStatusBadgeStyle = (status) => {
  const base = {
    padding: '0.25rem 0.6rem',
    borderRadius: '4px',
    fontSize: '0.8rem',
    fontWeight: 'bold',
    display: 'inline-block',
    whiteSpace: 'nowrap'
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

const MOODS = [
  { key: 'molt_be',  label: 'Ha anat molt bé', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  { key: 'be',       label: 'Ha anat bé',       color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  { key: 'neutral',  label: 'Ni fu ni fa',      color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  { key: 'malament', label: 'No ha agradat',     color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
];

// Custom SVG face icons — small, expressive, colour-coded
const MoodIcon = ({ moodKey, size = 22, ...rest }) => {
  const s = size;
  const cx = s / 2, cy = s / 2, r = s / 2 - 1;
  const common = { width: s, height: s, viewBox: `0 0 ${s} ${s}`, fill: 'none', xmlns: 'http://www.w3.org/2000/svg', ...rest };
  const m = MOODS.find(m => m.key === moodKey);
  if (!m) return null;
  const c = m.color;

  const leyX = cx - s * 0.18, reyX = cx + s * 0.18, eyY = cy - s * 0.08;

  if (moodKey === 'molt_be') {
    return (
      <svg {...common}>
        <circle cx={cx} cy={cy} r={r} stroke={c} strokeWidth="1.5" fill={m.bg} />
        <path d={`M${leyX - 2} ${eyY + 0.5} Q${leyX} ${eyY - 2.5} ${leyX + 2} ${eyY + 0.5}`} stroke={c} strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <path d={`M${reyX - 2} ${eyY + 0.5} Q${reyX} ${eyY - 2.5} ${reyX + 2} ${eyY + 0.5}`} stroke={c} strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <path d={`M${cx - s * 0.25} ${cy + s * 0.08} Q${cx} ${cy + s * 0.36} ${cx + s * 0.25} ${cy + s * 0.08}`} stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
    );
  }
  if (moodKey === 'be') {
    return (
      <svg {...common}>
        <circle cx={cx} cy={cy} r={r} stroke={c} strokeWidth="1.5" fill={m.bg} />
        <circle cx={leyX} cy={eyY} r="1.3" fill={c} />
        <circle cx={reyX} cy={eyY} r="1.3" fill={c} />
        <path d={`M${cx - s * 0.2} ${cy + s * 0.1} Q${cx} ${cy + s * 0.28} ${cx + s * 0.2} ${cy + s * 0.1}`} stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
    );
  }
  if (moodKey === 'neutral') {
    return (
      <svg {...common}>
        <circle cx={cx} cy={cy} r={r} stroke={c} strokeWidth="1.5" fill={m.bg} />
        <circle cx={leyX} cy={eyY} r="1.3" fill={c} />
        <circle cx={reyX} cy={eyY} r="1.3" fill={c} />
        <line x1={cx - s * 0.18} y1={cy + s * 0.14} x2={cx + s * 0.18} y2={cy + s * 0.14} stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx={cx} cy={cy} r={r} stroke={c} strokeWidth="1.5" fill={m.bg} />
      <circle cx={leyX} cy={eyY} r="1.3" fill={c} />
      <circle cx={reyX} cy={eyY} r="1.3" fill={c} />
      <path d={`M${cx - s * 0.2} ${cy + s * 0.22} Q${cx} ${cy + s * 0.06} ${cx + s * 0.2} ${cy + s * 0.22}`} stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
};

export default function CRMPage() {
  const { user, loading, isAdmin, isCrm } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [contacts, setContacts] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingContactId, setEditingContactId] = useState(null);
  
  // Form state
  const [entity, setEntity] = useState(''); // Teatre o Ajuntament
  const [municipality, setMunicipality] = useState('');
  const [province, setProvince] = useState('');
  const [status, setStatus] = useState('Pendent');

  // Contact 1-4 form states
  const [c1Name, setC1Name] = useState('');
  const [c1Role, setC1Role] = useState('');
  const [c1Email, setC1Email] = useState('');
  const [c1Phone, setC1Phone] = useState('');

  const [c2Name, setC2Name] = useState('');
  const [c2Role, setC2Role] = useState('');
  const [c2Email, setC2Email] = useState('');
  const [c2Phone, setC2Phone] = useState('');

  const [c3Name, setC3Name] = useState('');
  const [c3Role, setC3Role] = useState('');
  const [c3Email, setC3Email] = useState('');
  const [c3Phone, setC3Phone] = useState('');

  const [c4Name, setC4Name] = useState('');
  const [c4Role, setC4Role] = useState('');
  const [c4Email, setC4Email] = useState('');
  const [c4Phone, setC4Phone] = useState('');

  // Filter state — inicialitzat des de la URL
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
  const [filterProvince, setFilterProvince] = useState(() => searchParams.get('province') || 'Tots');
  const [filterStatus, setFilterStatus] = useState(() => searchParams.get('status') || 'Tots');
  const [filterShow, setFilterShow] = useState(() => searchParams.get('show') || 'Tots');
  const [filterReminder, setFilterReminder] = useState(() => searchParams.get('reminder') === '1');

  // Sincronitza els filtres amb la URL (silent replace, sense recàrrega)
  const updateUrl = useCallback((sq, fp, fs, fsh, fr) => {
    const params = new URLSearchParams();
    if (sq) params.set('search', sq);
    if (fp && fp !== 'Tots') params.set('province', fp);
    if (fs && fs !== 'Tots') params.set('status', fs);
    if (fsh && fsh !== 'Tots') params.set('show', fsh);
    if (fr) params.set('reminder', '1');
    const qs = params.toString();
    router.replace(`/dashboard/crm${qs ? '?' + qs : ''}`, { scroll: false });
  }, [router]);

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
      entity, 
      municipality, 
      province,
      status,
      contact1: { name: c1Name, role: c1Role, email: c1Email, phone: c1Phone },
      contact2: { name: c2Name, role: c2Role, email: c2Email, phone: c2Phone },
      contact3: { name: c3Name, role: c3Role, email: c3Email, phone: c3Phone },
      contact4: { name: c4Name, role: c4Role, email: c4Email, phone: c4Phone }
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
    setEntity(''); setMunicipality(''); setProvince(''); setStatus('Pendent');
    setC1Name(''); setC1Role(''); setC1Email(''); setC1Phone('');
    setC2Name(''); setC2Role(''); setC2Email(''); setC2Phone('');
    setC3Name(''); setC3Role(''); setC3Email(''); setC3Phone('');
    setC4Name(''); setC4Role(''); setC4Email(''); setC4Phone('');
  };

  const handleEditClick = (contact) => {
    setEditingContactId(contact.id);
    setEntity(contact.entity || '');
    setMunicipality(contact.municipality || '');
    setProvince(contact.province || '');
    setStatus(contact.status || 'Pendent');
    
    // Fallback to older model fields if nested ones are missing
    const c1 = contact.contact1 || {};
    setC1Name(c1.name || contact.name || '');
    setC1Role(c1.role || '');
    setC1Email(c1.email || contact.email || '');
    setC1Phone(c1.phone || contact.phone || '');

    const c2 = contact.contact2 || {};
    setC2Name(c2.name || '');
    setC2Role(c2.role || '');
    setC2Email(c2.email || '');
    setC2Phone(c2.phone || '');

    const c3 = contact.contact3 || {};
    setC3Name(c3.name || '');
    setC3Role(c3.role || '');
    setC3Email(c3.email || '');
    setC3Phone(c3.phone || '');

    const c4 = contact.contact4 || {};
    setC4Name(c4.name || '');
    setC4Role(c4.role || '');
    setC4Email(c4.email || '');
    setC4Phone(c4.phone || '');

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
    router.replace('/dashboard/crm', { scroll: false });
  };

  // Filter logic
  const filteredContacts = contacts.filter(contact => {
    const c1 = contact.contact1 || { name: contact.name, email: contact.email, phone: contact.phone, role: '' };
    const c2 = contact.contact2 || {};
    const c3 = contact.contact3 || {};
    const c4 = contact.contact4 || {};

    const cleanQuery = normalizeText(searchQuery);
    const matchesSearch = 
      normalizeText(contact.entity).includes(cleanQuery) ||
      normalizeText(contact.municipality).includes(cleanQuery) ||
      normalizeText(c1.name).includes(cleanQuery) ||
      normalizeText(c1.role).includes(cleanQuery) ||
      normalizeText(c1.email).includes(cleanQuery) ||
      normalizeText(c1.phone).includes(cleanQuery) ||
      normalizeText(c2.name).includes(cleanQuery) ||
      normalizeText(c2.role).includes(cleanQuery) ||
      normalizeText(c2.email).includes(cleanQuery) ||
      normalizeText(c2.phone).includes(cleanQuery) ||
      normalizeText(c3.name).includes(cleanQuery) ||
      normalizeText(c4.name).includes(cleanQuery) ||
      normalizeText(contact.notes).includes(cleanQuery) ||
      normalizeText(contact.feedbackSummary).includes(cleanQuery) ||
      normalizeText(contact.nextActionNotes).includes(cleanQuery);
      
    const matchesProvince = filterProvince === 'Tots' || (contact.province || '') === filterProvince;
    const matchesStatus = filterStatus === 'Tots' || 
      (filterStatus === 'Sense estat' ? (!contact.status || contact.status === '') : contact.status === filterStatus);
    
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
          <h1 style={{ marginTop: '0.5rem', marginBottom: 0, display: 'inline-block', verticalAlign: 'middle' }}>
            CRM i Contactes <span style={{ fontSize: '1.2rem', color: 'var(--color-text-secondary)', marginLeft: '0.5rem', fontWeight: 'normal' }}>({filteredContacts.length})</span>
          </h1>
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
        <div className="glass-panel animate-fade-in-up" style={{ marginBottom: 'var(--space-lg)', padding: '1.5rem' }}>
          <h3 style={{ color: 'var(--color-accent)', marginBottom: '1.5rem' }}>{editingContactId ? 'Editar Contacte' : 'Afegir Nou Contacte'}</h3>
          <form onSubmit={handleAddContact} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* General Info Row */}
            <div className="grid-2col-responsive" style={{ gap: '1rem' }}>
              <div className="input-group">
                <label>Entitat (Teatre, Festival, Ajuntament...)</label>
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
                  <option value="Castelló">Castelló</option>
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
                  <option value=""></option>
                  <option value="Pendent">Pendent</option>
                  <option value="Instància feta">Instància feta</option>
                  <option value="Entrevista pendent">Entrevista pendent</option>
                  <option value="Entrevista feta">Entrevista feta</option>
                  <option value="Error / No possible">Error / No possible</option>
                </select>
              </div>
            </div>

            {/* Contacts Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.2rem', marginTop: '0.5rem' }}>
              
              {/* Contact 1 */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1.2rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <h4 style={{ color: 'var(--color-accent)', marginTop: 0, marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.3rem' }}>🟡 Contacte 1 (Principal)</h4>
                <div className="input-group" style={{ marginBottom: '0.8rem' }}>
                  <label style={{ fontSize: '0.8rem' }}>Nom</label>
                  <input className="input-field" value={c1Name} onChange={e => setC1Name(e.target.value)} required />
                </div>
                <div className="input-group" style={{ marginBottom: '0.8rem' }}>
                  <label style={{ fontSize: '0.8rem' }}>Càrrec</label>
                  <input className="input-field" value={c1Role} onChange={e => setC1Role(e.target.value)} />
                </div>
                <div className="input-group" style={{ marginBottom: '0.8rem' }}>
                  <label style={{ fontSize: '0.8rem' }}>Correu</label>
                  <input type="email" className="input-field" value={c1Email} onChange={e => setC1Email(e.target.value)} />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.8rem' }}>Telèfon</label>
                  <input className="input-field" value={c1Phone} onChange={e => setC1Phone(e.target.value)} />
                </div>
              </div>

              {/* Contact 2 */}
              <div style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '1.2rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <h4 style={{ color: 'var(--color-text-secondary)', marginTop: 0, marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.3rem' }}>👤 Contacte 2</h4>
                <div className="input-group" style={{ marginBottom: '0.8rem' }}>
                  <label style={{ fontSize: '0.8rem' }}>Nom</label>
                  <input className="input-field" value={c2Name} onChange={e => setC2Name(e.target.value)} />
                </div>
                <div className="input-group" style={{ marginBottom: '0.8rem' }}>
                  <label style={{ fontSize: '0.8rem' }}>Càrrec</label>
                  <input className="input-field" value={c2Role} onChange={e => setC2Role(e.target.value)} />
                </div>
                <div className="input-group" style={{ marginBottom: '0.8rem' }}>
                  <label style={{ fontSize: '0.8rem' }}>Correu</label>
                  <input type="email" className="input-field" value={c2Email} onChange={e => setC2Email(e.target.value)} />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.8rem' }}>Telèfon</label>
                  <input className="input-field" value={c2Phone} onChange={e => setC2Phone(e.target.value)} />
                </div>
              </div>

              {/* Contact 3 */}
              <div style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '1.2rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <h4 style={{ color: 'var(--color-text-secondary)', marginTop: 0, marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.3rem' }}>👤 Contacte 3</h4>
                <div className="input-group" style={{ marginBottom: '0.8rem' }}>
                  <label style={{ fontSize: '0.8rem' }}>Nom</label>
                  <input className="input-field" value={c3Name} onChange={e => setC3Name(e.target.value)} />
                </div>
                <div className="input-group" style={{ marginBottom: '0.8rem' }}>
                  <label style={{ fontSize: '0.8rem' }}>Càrrec</label>
                  <input className="input-field" value={c3Role} onChange={e => setC3Role(e.target.value)} />
                </div>
                <div className="input-group" style={{ marginBottom: '0.8rem' }}>
                  <label style={{ fontSize: '0.8rem' }}>Correu</label>
                  <input type="email" className="input-field" value={c3Email} onChange={e => setC3Email(e.target.value)} />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.8rem' }}>Telèfon</label>
                  <input className="input-field" value={c3Phone} onChange={e => setC3Phone(e.target.value)} />
                </div>
              </div>

              {/* Contact 4 */}
              <div style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '1.2rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <h4 style={{ color: 'var(--color-text-secondary)', marginTop: 0, marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.3rem' }}>👤 Contacte 4</h4>
                <div className="input-group" style={{ marginBottom: '0.8rem' }}>
                  <label style={{ fontSize: '0.8rem' }}>Nom</label>
                  <input className="input-field" value={c4Name} onChange={e => setC4Name(e.target.value)} />
                </div>
                <div className="input-group" style={{ marginBottom: '0.8rem' }}>
                  <label style={{ fontSize: '0.8rem' }}>Càrrec</label>
                  <input className="input-field" value={c4Role} onChange={e => setC4Role(e.target.value)} />
                </div>
                <div className="input-group" style={{ marginBottom: '0.8rem' }}>
                  <label style={{ fontSize: '0.8rem' }}>Correu</label>
                  <input type="email" className="input-field" value={c4Email} onChange={e => setC4Email(e.target.value)} />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.8rem' }}>Telèfon</label>
                  <input className="input-field" value={c4Phone} onChange={e => setC4Phone(e.target.value)} />
                </div>
              </div>

            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary">{editingContactId ? 'Desar Canvis' : 'Desar Contacte'}</button>
              <button type="button" className="btn btn-glass" onClick={() => { setIsAdding(false); resetForm(); }}>Cancel·lar</button>
            </div>
          </form>
        </div>
      )}

      {/* Filtres */}
      <div className="glass-panel" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ margin: 0, color: 'var(--color-accent)' }}>🔍 Filtres i Cerca</h4>
          {(searchQuery || filterProvince !== 'Tots' || filterStatus !== 'Tots' || filterShow !== 'Tots' || filterReminder) && (
            <button 
              type="button" 
              onClick={handleClearFilters} 
              className="btn btn-glass"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem', borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
            >
              🧹 Netejar Filtres
            </button>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div className="input-group" style={{ margin: 0 }}>
            <label>Cerca text</label>
            <input 
              className="input-field" 
              placeholder="Entitat, municipi, contacte..." 
              value={searchQuery} 
              onChange={e => { setSearchQuery(e.target.value); updateUrl(e.target.value, filterProvince, filterStatus, filterShow, filterReminder); }} 
            />
          </div>
          
          <div className="input-group" style={{ margin: 0 }}>
            <label>Província / Regió</label>
            <select 
              className="input-field" 
              value={filterProvince} 
              onChange={e => { setFilterProvince(e.target.value); updateUrl(searchQuery, e.target.value, filterStatus, filterShow, filterReminder); }}
              style={{ background: 'var(--color-background-input)', color: 'var(--color-text-primary)' }}
            >
              <option value="Tots">Totes les províncies</option>
              <option value="Barcelona">Barcelona</option>
              <option value="Girona">Girona</option>
              <option value="Lleida">Lleida</option>
              <option value="Tarragona">Tarragona</option>
              <option value="Ses Illes">Ses Illes</option>
              <option value="El Mataranya">El Mataranya</option>
              <option value="Castelló">Castelló</option>
            </select>
          </div>
          
          <div className="input-group" style={{ margin: 0 }}>
            <label>Estat</label>
            <select 
              className="input-field" 
              value={filterStatus} 
              onChange={e => { setFilterStatus(e.target.value); updateUrl(searchQuery, filterProvince, e.target.value, filterShow, filterReminder); }}
              style={{ background: 'var(--color-background-input)', color: 'var(--color-text-primary)' }}
            >
              <option value="Tots">Tots els estats</option>
              <option value="Sense estat">Sense estat</option>
              <option value="Entrevista feta">Entrevista feta</option>
              <option value="Instància feta">Instància feta</option>
              <option value="Entrevista pendent">Entrevista pendent</option>
              <option value="Error / No possible">Error / No possible</option>
            </select>
          </div>
          
          <div className="input-group" style={{ margin: 0 }}>
            <label>Espectacle d'Interès</label>
            <select 
              className="input-field" 
              value={filterShow} 
              onChange={e => { setFilterShow(e.target.value); updateUrl(searchQuery, filterProvince, filterStatus, e.target.value, filterReminder); }}
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
              <option value="Concert Duo Hemiòlia">Concert Duo Hemiòlia</option>
              <option value="Concert Trio Hemiòlia">Concert Trio Hemiòlia</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '1.2rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}>
              <input 
                type="checkbox" 
                checked={filterReminder} 
                onChange={e => { setFilterReminder(e.target.checked); updateUrl(searchQuery, filterProvince, filterStatus, filterShow, e.target.checked); }} 
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ color: filterReminder ? 'var(--color-accent)' : 'var(--color-text-primary)', fontWeight: filterReminder ? 'bold' : 'normal' }}>
                🔔 Recordatoris actius
              </span>
            </label>
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
                <th style={{ padding: '1rem' }}>Entitat</th>
                <th style={{ padding: '1rem' }}>Municipi</th>
                <th style={{ padding: '1rem' }}>Província</th>
                <th style={{ padding: '1rem' }}>Contacte Principal</th>
                <th style={{ padding: '1rem' }}>Estat</th>
                <th style={{ padding: '1rem' }}>Accions</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map(contact => {
                const today = new Date().toISOString().split('T')[0];
                const hasOverdueReminder = contact.nextActionDate && contact.nextActionDate <= today;
                const contact1 = contact.contact1 || { name: contact.name || 'Sense especificar', role: '' };
                
                return (
                  <tr key={contact.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td data-label="Entitat" style={{ padding: '1rem', fontWeight: 'bold' }}>{contact.entity}</td>
                    <td data-label="Municipi" style={{ padding: '1rem' }}>{contact.municipality}</td>
                    <td data-label="Província" style={{ padding: '1rem' }}>{contact.province || '-'}</td>
                    <td data-label="Contacte Principal" style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>{contact1.name}</span>
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
                    <td data-label="Estat" style={{ padding: '1rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        {contact.status ? (
                          <span style={getStatusBadgeStyle(contact.status)}>
                            {contact.status}
                          </span>
                        ) : null}
                        {contact.status === 'Entrevista feta' && contact.mood && (
                          <span
                            title={MOODS.find(m => m.key === contact.mood)?.label}
                            style={{ display: 'inline-flex', alignItems: 'center' }}
                          >
                            <MoodIcon moodKey={contact.mood} size={18} />
                          </span>
                        )}
                      </span>
                    </td>
                    <td data-label="Accions" style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                      <Link 
                        href={`/dashboard/crm/${contact.id}${
                          (() => {
                            const params = new URLSearchParams();
                            if (searchQuery) params.set('search', searchQuery);
                            if (filterProvince !== 'Tots') params.set('province', filterProvince);
                            if (filterStatus !== 'Tots') params.set('status', filterStatus);
                            if (filterShow !== 'Tots') params.set('show', filterShow);
                            if (filterReminder) params.set('reminder', '1');
                            const qs = params.toString();
                            return qs ? '?' + qs : '';
                          })()
                        }`}
                        className="btn btn-glass" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center' }} 
                        title="Veure fitxa"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                      </Link>
                      {(isAdmin || isCrm) && (
                        <>
                          <button onClick={() => handleEditClick(contact)} className="btn btn-glass" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} title="Editar Contacte">
                            ✏️
                          </button>
                          <button onClick={() => handleRemoveContact(contact.id, contact.entity || contact.name)} className="btn btn-glass" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: '#ff6b6b', borderColor: '#ff6b6b' }} title="Esborrar Contacte">
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
