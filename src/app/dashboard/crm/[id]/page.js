'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '../../../../lib/AuthContext';
import { getContactById, getInteractionsByContact, addInteraction, getShows, updateContact } from '../../../../lib/firestoreUtils';
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

export default function ContactDetailPage() {
  const params = useParams();
  const contactId = params.id;
  const { user, loading, isAdmin, isCrm } = useAuth();
  
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

  // Reminder states
  const [nextActionDate, setNextActionDate] = useState('');
  const [nextActionNotes, setNextActionNotes] = useState('');
  const [isEditingReminder, setIsEditingReminder] = useState(false);

  // Show checklist states
  const [performedShows, setPerformedShows] = useState([]);
  const [interestedShows, setInterestedShows] = useState([]);
  const [isEditingShows, setIsEditingShows] = useState(false);

  useEffect(() => {
    if (user && contactId) {
      loadData();
    }
  }, [user, contactId]);

  const loadData = async () => {
    const c = await getContactById(contactId);
    setContact(c);
    setNextActionDate(c?.nextActionDate || '');
    setNextActionNotes(c?.nextActionNotes || '');
    setPerformedShows(c?.performedShows || []);
    setInterestedShows(c?.interestedShows || []);

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

  const handleSaveReminder = async (e) => {
    e.preventDefault();
    await updateContact(contactId, {
      nextActionDate,
      nextActionNotes
    });
    setIsEditingReminder(false);
    loadData();
  };

  const handleClearReminder = async () => {
    if (confirm("Vols eliminar aquest recordatori?")) {
      await updateContact(contactId, {
        nextActionDate: '',
        nextActionNotes: ''
      });
      setNextActionDate('');
      setNextActionNotes('');
      loadData();
    }
  };

  const handleSaveShows = async () => {
    await updateContact(contactId, {
      performedShows,
      interestedShows
    });
    setIsEditingShows(false);
    loadData();
  };

  const handleToggleShow = (showTitle, listType) => {
    if (listType === 'performed') {
      setPerformedShows(prev => 
        prev.includes(showTitle) ? prev.filter(s => s !== showTitle) : [...prev, showTitle]
      );
    } else {
      setInterestedShows(prev => 
        prev.includes(showTitle) ? prev.filter(s => s !== showTitle) : [...prev, showTitle]
      );
    }
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

  const todayStr = new Date().toISOString().split('T')[0];
  const isReminderDue = contact.nextActionDate && contact.nextActionDate <= todayStr;

  return (
    <div className="container" style={{ paddingTop: 'var(--space-md)' }}>
      {/* Alert Banner for Overdue/Pending Reminders */}
      {isReminderDue && (
        <div className="glass-panel" style={{ 
          marginBottom: '1.5rem', 
          borderLeft: '5px solid #ff6b6b', 
          backgroundColor: 'rgba(220, 53, 69, 0.08)',
          padding: '1.2rem'
        }}>
          <h3 style={{ color: '#ff6b6b', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🚨 RECORDATORI DE SEGUIMENT ACTIU
          </h3>
          <p style={{ margin: 0, fontSize: '0.95rem' }}>
            Cal realitzar l'acció planificada per a avui ({formatDateDDMMYYYY(contact.nextActionDate)}):<br/>
            <strong style={{ color: 'var(--color-text-primary)' }}>{contact.nextActionNotes || 'Sense detalls'}</strong>
          </p>
        </div>
      )}

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
              <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <strong>{contact.entity}</strong> | {contact.municipality}
                {contact.province && <span>({contact.province})</span>}
                {contact.status && (
                  <span style={getStatusBadgeStyle(contact.status)}>
                    {contact.status}
                  </span>
                )}
              </p>
            </div>
            {contact.email && (isAdmin || isCrm) && (
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

          {/* Feedback destacat */}
          {contact.feedbackSummary && (
            <div style={{ 
              marginTop: '0.2rem', 
              padding: '0.8rem 1rem', 
              background: 'rgba(255,255,255,0.01)', 
              borderRadius: '4px', 
              borderLeft: '4px solid var(--color-accent)',
              fontSize: '0.9rem',
              color: 'var(--color-text-secondary)',
              fontStyle: 'italic'
            }}>
              <strong>Feedback destacat d'entrevista:</strong> "{contact.feedbackSummary}"
            </div>
          )}

          {/* Historial del Document Word original */}
          {contact.notes && (
            <div style={{ 
              marginTop: '0.2rem', 
              padding: '1rem', 
              background: 'rgba(0,0,0,0.2)', 
              borderRadius: '4px',
              fontSize: '0.88rem',
              border: '1px solid rgba(255,255,255,0.04)',
              maxHeight: '150px',
              overflowY: 'auto'
            }}>
              <strong style={{ color: 'var(--color-text-primary)' }}>Historial d'Interaccions i Notes:</strong>
              <p style={{ margin: '0.4rem 0 0 0', whiteSpace: 'pre-wrap', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>{contact.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Grid for Show Checklist and Follow-ups */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        
        {/* Recordatoris / Proxima Accio */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.5rem' }}>
          <div>
            <h3 style={{ color: 'var(--color-accent)', marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1.2rem' }}>
              📅 Recordatori i Pròxima Acció
            </h3>
            
            {contact.nextActionDate ? (
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem' }}>
                  <strong>Data límit de trucada/mail:</strong> {formatDateDDMMYYYY(contact.nextActionDate)}
                </p>
                <p style={{ margin: 0, background: 'rgba(255,255,255,0.02)', padding: '0.8rem', borderRadius: '4px', borderLeft: '3px solid var(--color-accent)', fontSize: '0.9rem', lineHeight: '1.4' }}>
                  {contact.nextActionNotes || 'Sense notes addicionals'}
                </p>
              </div>
            ) : (
              <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic', margin: '0 0 1rem 0', fontSize: '0.9rem' }}>
                No hi ha cap recordatori de seguiment programat.
              </p>
            )}
          </div>
          
          {(isAdmin || isCrm) && (
            <div style={{ marginTop: '1rem' }}>
              {isEditingReminder ? (
                <form onSubmit={handleSaveReminder} style={{ marginTop: '0.5rem' }}>
                  <div className="input-group" style={{ marginBottom: '0.8rem' }}>
                    <label style={{ fontSize: '0.8rem' }}>Data del recordatori</label>
                    <input type="date" className="input-field" value={nextActionDate} onChange={e => setNextActionDate(e.target.value)} required />
                  </div>
                  <div className="input-group" style={{ marginBottom: '0.8rem' }}>
                    <label style={{ fontSize: '0.8rem' }}>Acció / Tasca a fer</label>
                    <textarea className="input-field" rows="2" value={nextActionNotes} onChange={e => setNextActionNotes(e.target.value)} placeholder="Ex: Enviar correu recordatori de Nadal..." required />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="submit" className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Desar</button>
                    <button type="button" className="btn btn-glass" onClick={() => setIsEditingReminder(false)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Cancel·lar</button>
                  </div>
                </form>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-glass" onClick={() => setIsEditingReminder(true)} style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}>
                    {contact.nextActionDate ? '✏️ Editar Recordatori' : '➕ Crear Recordatori'}
                  </button>
                  {contact.nextActionDate && (
                    <button className="btn btn-glass" onClick={handleClearReminder} style={{ fontSize: '0.8rem', color: '#ff6b6b', borderColor: 'rgba(255, 107, 107, 0.2)', padding: '0.5rem 1rem' }}>
                      🗑️ Eliminar
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Espectacles Contractats / Interessats */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.5rem' }}>
          <div>
            <h3 style={{ color: 'var(--color-accent)', marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1.2rem' }}>
              🎭 Segmentació d'Espectacles
            </h3>
            
            {isEditingShows ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <h4 style={{ fontSize: '0.82rem', marginBottom: '0.5rem', color: 'var(--color-accent)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.2rem' }}>Fets / Bolos</h4>
                  {[
                    "Layla, un viatge d'esperança",
                    "Layla, el contacontes",
                    "Cavernus, una evolució musical",
                    "Un Nadal Màgic",
                    "Silencis Trencats",
                    "Marcel, cartes des del front",
                    "El petit Leonardo",
                    "Simfonia Corporativa"
                  ].map(title => (
                    <label key={title} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', marginBottom: '0.4rem', cursor: 'pointer', userSelect: 'none' }}>
                      <input type="checkbox" checked={performedShows.includes(title)} onChange={() => handleToggleShow(title, 'performed')} />
                      {title}
                    </label>
                  ))}
                </div>
                <div>
                  <h4 style={{ fontSize: '0.82rem', marginBottom: '0.5rem', color: 'var(--color-accent)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.2rem' }}>Interessats / Oferts</h4>
                  {[
                    "Layla, un viatge d'esperança",
                    "Layla, el contacontes",
                    "Cavernus, una evolució musical",
                    "Un Nadal Màgic",
                    "Silencis Trencats",
                    "Marcel, cartes des del front",
                    "El petit Leonardo",
                    "Simfonia Corporativa"
                  ].map(title => (
                    <label key={title} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', marginBottom: '0.4rem', cursor: 'pointer', userSelect: 'none' }}>
                      <input type="checkbox" checked={interestedShows.includes(title)} onChange={() => handleToggleShow(title, 'interested')} />
                      {title}
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: '1.2rem', fontSize: '0.92rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div>
                  <strong style={{ display: 'block', marginBottom: '0.3rem', color: 'var(--color-text-primary)' }}>Espectacles realitzats (Bolo):</strong>
                  {performedShows.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {performedShows.map(s => <span key={s} style={{ background: 'rgba(46, 196, 182, 0.12)', color: '#2ec4b6', padding: '0.2rem 0.5rem', borderRadius: '3px', fontSize: '0.78rem', fontWeight: 'bold', border: '1px solid rgba(46, 196, 182, 0.2)' }}>{s}</span>)}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', fontStyle: 'italic' }}>Cap espectacle contractat encara</span>
                  )}
                </div>
                <div>
                  <strong style={{ display: 'block', marginBottom: '0.3rem', color: 'var(--color-text-primary)' }}>Espectacles d'interès:</strong>
                  {interestedShows.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {interestedShows.map(s => <span key={s} style={{ background: 'rgba(255, 183, 3, 0.12)', color: '#ffb703', padding: '0.2rem 0.5rem', borderRadius: '3px', fontSize: '0.78rem', fontWeight: 'bold', border: '1px solid rgba(255, 183, 3, 0.2)' }}>{s}</span>)}
                    </div>
                  ) : (
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', fontStyle: 'italic' }}>Cap interès o proposta pendent</span>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {(isAdmin || isCrm) && (
            <div style={{ marginTop: '1rem' }}>
              {isEditingShows ? (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary" onClick={handleSaveShows} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Desar</button>
                  <button className="btn btn-glass" onClick={() => { setIsEditingShows(false); loadData(); }} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Cancel·lar</button>
                </div>
              ) : (
                <button className="btn btn-glass" onClick={() => setIsEditingShows(true)} style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}>
                  ✏️ Editar Espectacles
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="header-bar-responsive" style={{ marginBottom: '1rem' }}>
        <h2>Històric d'Interaccions</h2>
        {(isAdmin || isCrm) && (
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
                <option value="Marcel, cartes des del front" />
                <option value="El petit Leonardo" />
                <option value="Simfonia Corporativa" />
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
