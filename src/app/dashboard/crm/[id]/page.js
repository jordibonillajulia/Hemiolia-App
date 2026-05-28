'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '../../../../lib/AuthContext';
import { getContactById, getInteractionsByContact, addInteraction, getShows } from '../../../../lib/firestoreUtils';
import Link from 'next/link';

// Helper to format date as DD/MM/YYYY with padding
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

export default function ContactDetailPage() {
  const params = useParams();
  const contactId = params.id;
  const { user, loading, isAdmin } = useAuth();
  
  const [contact, setContact] = useState(null);
  const [interactions, setInteractions] = useState([]);
  const [shows, setShows] = useState([]);
  const [isAdding, setIsAdding] = useState(false);

  // Interaction form
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [showId, setShowId] = useState('');
  const [interestLevel, setInterestLevel] = useState(3);
  const [technicalFeedback, setTechnicalFeedback] = useState('');
  const [otherInterests, setOtherInterests] = useState('');

  useEffect(() => {
    if (user && contactId) {
      loadData();
    }
  }, [user, contactId]);

  const loadData = async () => {
    const c = await getContactById(contactId);
    setContact(c);
    const i = await getInteractionsByContact(contactId);
    setInteractions(i);
    const s = await getShows();
    setShows(s);
  };

  const handleAddInteraction = async (e) => {
    e.preventDefault();
    await addInteraction({
      contactId,
      date,
      showId,
      interestLevel: parseInt(interestLevel, 10),
      technicalFeedback,
      otherInterests
    });
    setIsAdding(false);
    setDate(new Date().toISOString().split('T')[0]);
    setShowId('');
    setInterestLevel(3);
    setTechnicalFeedback('');
    setOtherInterests('');
    loadData();
  };

  const handleSendEmail = async () => {
    if (!contact.email) return alert("Aquest contacte no té correu electrònic.");
    
    if (!confirm(`Vols enviar un correu automàtic de seguiment a ${contact.email}?`)) return;

    try {
      const res = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: contact.email,
          subject: 'Salutacions des d\'Hemiòlia Produccions',
          text: `Hola ${contact.name},\n\nEns posem en contacte amb tu per fer el seguiment de les nostres propostes per al vostre municipi (${contact.municipality}).\n\nQualsevol cosa estem a la teva disposició.\n\nAtentament,\nL'equip d'Hemiòlia Produccions.`
        })
      });

      if (res.ok) {
        alert("Correu enviat (o simulat correctament si no has configurat l'SMTP)!");
      } else {
        alert("Error a l'enviar el correu.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de xarxa en enviar el correu.");
    }
  };

  if (loading || !user || !contact) return <div className="container mt-xl">Carregant fitxa...</div>;

  return (
    <div className="container" style={{ paddingTop: 'var(--space-md)' }}>
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <Link href="/dashboard/crm" className="btn-back no-print" title="Tornar a CRM">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </Link>
        <div className="glass-panel" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ marginBottom: '0.5rem', color: 'var(--color-accent)', marginTop: 0 }}>{contact.name}</h1>
              <p style={{ margin: 0 }}><strong>{contact.entity}</strong> | {contact.municipality}</p>
            </div>
            {contact.email && isAdmin && (
              <button 
                className="btn btn-glass" 
                onClick={handleSendEmail} 
                style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
              >
                ✉️ Enviar Correu de Seguiment
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', flexWrap: 'wrap' }}>
            {contact.email && <span>📧 {contact.email}</span>}
            {contact.phone && <span>📞 {contact.phone}</span>}
          </div>
        </div>
      </div>

      <div className="header-bar-responsive" style={{ marginBottom: '1rem' }}>
        <h2>Històric d'Interaccions</h2>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setIsAdding(!isAdding)}>
            {isAdding ? 'Cancel·lar' : '+ Nova Interacció'}
          </button>
        )}
      </div>

      {isAdding && (
        <div className="glass-panel animate-fade-in-up" style={{ marginBottom: 'var(--space-lg)' }}>
          <form onSubmit={handleAddInteraction} className="grid-2col-responsive">
            <div className="input-group">
              <label>Data</label>
              <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            
            <div className="input-group">
              <label>Nivell d'Interès (1-5)</label>
              <input type="range" min="1" max="5" className="input-field" value={interestLevel} onChange={e => setInterestLevel(e.target.value)} />
              <div style={{ textAlign: 'center', color: 'var(--color-accent)', fontWeight: 'bold' }}>{interestLevel} ⭐</div>
            </div>

            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label>Espectacle presentat (opcional)</label>
              <input list="shows-list" className="input-field" value={showId} onChange={e => setShowId(e.target.value)} placeholder="Tria o escriu l'espectacle..." />
              <datalist id="shows-list">
                {shows.map(s => <option key={s.id} value={s.title} />)}
                <option value="Layla, un viatge d'esperança" />
                <option value="Layla, el contacontes" />
                <option value="Cavernus, una evolució musical" />
                <option value="Un Nadal Màgic" />
                <option value="Silencis Trencats" />
              </datalist>
            </div>

            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label>Feedback Tècnic</label>
              <textarea className="input-field" rows="3" value={technicalFeedback} onChange={e => setTechnicalFeedback(e.target.value)} placeholder="Ex: L'escenari fa 6x4m i no tenen llums frontals..."></textarea>
            </div>

            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label>Interès en altres espectacles</label>
              <input type="text" className="input-field" value={otherInterests} onChange={e => setOtherInterests(e.target.value)} placeholder="Han preguntat pel format quartet..." />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn btn-primary">Desar Interacció</button>
            </div>
          </form>
        </div>
      )}

      <div>
        {interactions.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>No hi ha interaccions registrades.</p>
        ) : (
          interactions.map(interaction => (
            <div key={interaction.id} className="glass-panel" style={{ marginBottom: '1rem', borderLeft: `4px solid var(--color-accent)` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <strong>{formatDateDDMMYYYY(interaction.date)}</strong>
                <span style={{ color: 'var(--color-accent)' }}>
                  {'★'.repeat(interaction.interestLevel)}{'☆'.repeat(5 - interaction.interestLevel)}
                </span>
              </div>
              {interaction.showId && <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}><strong>Espectacle:</strong> {interaction.showId}</p>}
              {interaction.technicalFeedback && <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}><strong>Tècnic:</strong> {interaction.technicalFeedback}</p>}
              {interaction.otherInterests && <p style={{ fontSize: '0.9rem', marginBottom: '0' }}><strong>Altres Interessos:</strong> {interaction.otherInterests}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
