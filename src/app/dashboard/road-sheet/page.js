'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../lib/AuthContext';
import { getUpcomingGigs, addGig, deleteGig, updateGig } from '../../../lib/firestoreUtils';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { normalizeText } from '../../../lib/utils';

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

// La previsió meteorològica ara és un simple enllaç per estalviar recursos i evitar errors de CORS

const AddressAutocomplete = ({ value, onChange }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (value && value.length > 3 && isOpen) {
        setLoading(true);
        fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&addressdetails=1&limit=5&countrycodes=es,ad,fr`)
          .then(res => res.json())
          .then(data => {
            setSuggestions(data);
            setLoading(false);
          })
          .catch(() => setLoading(false));
      } else {
        setSuggestions([]);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [value, isOpen]);

  return (
    <div style={{ position: 'relative' }}>
      <input 
        type="text" 
        className="input-field" 
        value={value} 
        onChange={e => { onChange(e.target.value); setIsOpen(true); }} 
        onFocus={() => setIsOpen(true)}
        placeholder="Carrer Major 12, Barcelona..." 
        autoComplete="off"
      />
      {isOpen && suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'var(--color-background-soft)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', zIndex: 100, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          {suggestions.map((s, i) => (
            <div 
              key={i} 
              style={{ padding: '0.8rem', cursor: 'pointer', borderBottom: i === suggestions.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.1)' }}
              onClick={() => {
                onChange(s.display_name);
                setIsOpen(false);
              }}
              onMouseEnter={e => e.target.style.backgroundColor = 'rgba(255,255,255,0.1)'}
              onMouseLeave={e => e.target.style.backgroundColor = 'transparent'}
            >
              {s.display_name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function RoadSheetPage() {
  const { user, loading, isAdmin } = useAuth();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const returnTo = searchParams.get('returnTo');

  const [gigs, setGigs] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingGigId, setEditingGigId] = useState(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [searchYear, setSearchYear] = useState('');
  const [viewedGig, setViewedGig] = useState(null);
  const [justEditedId, setJustEditedId] = useState(null);

  // Form state
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [showTime, setShowTime] = useState('');
  const [title, setTitle] = useState('');
  const [locationName, setLocationName] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [address, setAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [scheduleDetails, setScheduleDetails] = useState('');
  const [status, setStatus] = useState('Pendent');

  const loadGigs = async () => {
    const data = await getUpcomingGigs();
    
    // Auto-fix per separar Municipi i Sala dels bolos antics importats
    let updatedAny = false;
    for (const g of data) {
      if (!g.municipality && g.locationName && g.locationName.includes('(') && g.locationName.includes(')')) {
        const match = g.locationName.match(/^(.*?)\s*\((.*?)\)\s*$/);
        if (match) {
          const newMunicipality = match[1].trim();
          const newLocation = match[2].trim();
          await updateGig(g.id, { ...g, municipality: newMunicipality, locationName: newLocation });
          updatedAny = true;
        }
      }
    }
    
    if (updatedAny) {
      const freshData = await getUpcomingGigs();
      setGigs(freshData);
    } else {
      setGigs(data);
    }
  };

  useEffect(() => {
    if (user) {
      loadGigs();
    }
  }, [user]);

  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (highlightId && gigs.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`gig-card-${highlightId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }, [searchParams, gigs]);

  const handleEditClick = (gig) => {
    setEditingGigId(gig.id);
    setDate(gig.date || '');
    setShowTime(gig.showTime || (gig.date && gig.date !== 'a determinar' ? 'a determinar' : ''));
    setTitle(gig.title || '');
    setLocationName(gig.locationName || '');
    setMunicipality(gig.municipality || '');
    setAddress(gig.address || '');
    setContactPerson(gig.contactPerson || '');
    setContactPhone(gig.contactPhone || '');
    setScheduleDetails(gig.scheduleDetails || '');
    setStatus(gig.status || 'Pendent');
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditingGigId(null);
    setDate(new Date().toISOString().split('T')[0]);
    setShowTime(''); setTitle(''); setLocationName(''); setMunicipality(''); setAddress(''); setContactPerson(''); setContactPhone(''); setScheduleDetails('');
    setStatus('Pendent');
  }

  const handleAddGig = async (e) => {
    e.preventDefault();
    try {
      const finalShowTime = date === 'a determinar' ? '' : (showTime || 'a determinar');
      const rawData = { date, showTime: finalShowTime, title, locationName, municipality, address, contactPerson, contactPhone, scheduleDetails, status };
      // Firebase odia els camps 'undefined'. Ens assegurem que tot sigui com a mínim un string buit o s'elimini:
      const gigData = JSON.parse(JSON.stringify(rawData));
      
      let targetId = editingGigId;
      if (editingGigId) {
        await updateGig(editingGigId, gigData);
      } else {
        const docRef = await addGig(gigData);
        if (docRef && docRef.id) targetId = docRef.id;
      }
      setIsAdding(false);
      resetForm();
      await loadGigs();

      if (targetId) {
        setJustEditedId(targetId);
        setTimeout(() => {
          const el = document.getElementById(`gig-card-${targetId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 200);
        setTimeout(() => {
          setJustEditedId(null);
        }, 3000);
      }
    } catch (err) {
      console.error("Error guardant bolo:", err);
      alert("No s'ha pogut guardar el bolo. Revisa que tinguis connexió i que tots els camps siguin correctes.");
    }
  };

  const handleRemoveGig = async (id, title) => {
    if (confirm(`Estàs segur que vols esborrar el bolo "${title}"?`)) {
      await deleteGig(id);
      loadGigs();
    }
  };



  if (loading || !user) return <div className="container mt-xl text-center">Carregant Road-sheet...</div>;

  return (
    <div className="container mt-xl animate-fade-in-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Link href={returnTo || '/dashboard'} className="btn-back no-print" title={returnTo ? "Tornar a la fitxa" : "Tornar al Dashboard"} style={{ marginRight: '1rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </Link>
          <h1 style={{ marginTop: '0.5rem', marginBottom: 0, display: 'inline-block', verticalAlign: 'middle' }}>Road-sheet 🚐</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap', width: '100%', justifyContent: 'flex-end' }}>
          <input 
            type="text" 
            placeholder="🔍 Cerca per municipi, sala o espectacle..." 
            className="input-field" 
            style={{ flex: '1 1 200px', minWidth: '150px', marginBottom: 0 }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {(() => {
            const allYears = Array.from(new Set(gigs.filter(g => g.date).map(g => g.date.split('-')[0]))).sort().reverse();
            return (
              <select 
                className="input-field" 
                style={{ flex: '1 1 120px', minWidth: '100px', marginBottom: 0 }}
                value={searchYear}
                onChange={(e) => setSearchYear(e.target.value)}
              >
                <option value="">Tots els anys</option>
                {allYears.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
            );
          })()}
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => {
              const nextVal = !isAdding;
              setIsAdding(nextVal);
              if (!nextVal) resetForm();
              else window.scrollTo({ top: 0, behavior: 'smooth' });
            }}>
              {isAdding ? 'Cancel·lar' : '+ Afegir Bolo'}
            </button>
          )}
        </div>
      </div>

      {isAdding && (
        <div className="glass-panel animate-fade-in-up" style={{ marginBottom: 'var(--space-lg)' }}>
          <form onSubmit={handleAddGig} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
            <div className="grid-2col-responsive">
              <div className="input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ marginBottom: 0 }}>Data del bolo</label>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'normal', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', margin: 0, userSelect: 'none' }}>
                    <input 
                      type="checkbox" 
                      checked={date === 'a determinar'} 
                      onChange={e => {
                        if (e.target.checked) {
                          setDate('a determinar');
                        } else {
                          setDate(new Date().toISOString().split('T')[0]);
                        }
                      }} 
                    />
                    A determinar
                  </label>
                </div>
                <input 
                  type="date" 
                  className="input-field" 
                  value={date === 'a determinar' ? '' : date} 
                  onChange={e => setDate(e.target.value)} 
                  disabled={date === 'a determinar'}
                  required={date !== 'a determinar'} 
                />
              </div>
              <div className="input-group">
                <label style={{ marginBottom: '0.5rem', display: 'block' }}>Hora del concert</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <button 
                    type="button" 
                    className={`btn ${showTime !== 'a determinar' ? 'btn-primary' : 'btn-glass'}`}
                    style={{ 
                      padding: '0.4rem 0.8rem', 
                      fontSize: '0.85rem', 
                      flex: 1, 
                      borderColor: showTime !== 'a determinar' ? 'var(--color-primary)' : 'var(--color-border)',
                      fontWeight: showTime !== 'a determinar' ? 'bold' : 'normal'
                    }}
                    disabled={date === 'a determinar'}
                    onClick={() => {
                      if (showTime === 'a determinar') setShowTime('');
                    }}
                  >
                    🕒 Especificar hora
                  </button>
                  <button 
                    type="button" 
                    className={`btn ${showTime === 'a determinar' ? 'btn-primary' : 'btn-glass'}`}
                    style={{ 
                      padding: '0.4rem 0.8rem', 
                      fontSize: '0.85rem', 
                      flex: 1,
                      backgroundColor: showTime === 'a determinar' ? 'rgba(255, 183, 3, 0.25)' : 'transparent',
                      color: showTime === 'a determinar' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                      borderColor: showTime === 'a determinar' ? 'var(--color-accent)' : 'var(--color-border)',
                      fontWeight: showTime === 'a determinar' ? 'bold' : 'normal'
                    }}
                    disabled={date === 'a determinar'}
                    onClick={() => setShowTime('a determinar')}
                  >
                    ❓ A determinar
                  </button>
                </div>
                {showTime === 'a determinar' ? (
                  <div style={{ 
                    padding: '0.6rem 0.8rem', 
                    backgroundColor: 'rgba(255, 183, 3, 0.15)', 
                    border: '1px solid rgba(255, 183, 3, 0.3)', 
                    borderRadius: 'var(--radius-md)', 
                    fontSize: '0.85rem', 
                    color: 'var(--color-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span>📆</span>
                    <span>Hora pendent de confirmar. Apareixerà al calendari com a <strong>esdeveniment de tot el dia</strong>.</span>
                  </div>
                ) : (
                  <input 
                    type="time" 
                    className="input-field" 
                    value={date === 'a determinar' ? '' : showTime} 
                    onChange={e => setShowTime(e.target.value)} 
                    disabled={date === 'a determinar'}
                  />
                )}
              </div>
            </div>
            <div className="input-group">
              <label>Títol / Espectacle</label>
              <input list="shows-list" className="input-field" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Tria o escriu l'espectacle..." />
              <datalist id="shows-list">
                <option value="Layla, un viatge d'esperança" />
                <option value="Layla, el contacontes" />
                <option value="Cavernus, una evolució musical" />
                <option value="Un Nadal Màgic" />
                <option value="Silencis Trencats" />
                <option value="Marcel, cartes des del front" />
                <option value="El petit Leonardo" />
                <option value="Simfonia Corporativa" />
                <option value="Concert Duo Hemiòlia" />
                <option value="Concert Trio Hemiòlia" />
              </datalist>
            </div>
            <div className="input-group">
              <label>Lloc de l'actuació (Teatre/Sala)</label>
              <input type="text" className="input-field" value={locationName} onChange={e => setLocationName(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Municipi (Per la meteorologia)</label>
              <input type="text" className="input-field" value={municipality} onChange={e => setMunicipality(e.target.value)} placeholder="Ex: Barcelona" />
            </div>
            <div className="input-group">
              <label>Adreça completa (Per al GPS)</label>
              <AddressAutocomplete value={address} onChange={setAddress} />
            </div>
            <div className="grid-2col-responsive">
              <div className="input-group">
                <label>Persona de contacte / Obre sala</label>
                <input type="text" className="input-field" value={contactPerson} onChange={e => setContactPerson(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Telèfon contacte</label>
                <input type="tel" className="input-field" value={contactPhone} onChange={e => setContactPhone(e.target.value)} />
              </div>
            </div>
            <div className="input-group">
              <label>Horaris (Arribada, Proves, Concert)</label>
              <textarea className="input-field" rows="4" value={scheduleDetails} onChange={e => setScheduleDetails(e.target.value)} placeholder={"16:00 - Arribada\n17:30 - Proves de so\n20:00 - Concert"}></textarea>
            </div>
            <div className="input-group">
              <label>Estat del Bolo</label>
              <select className="input-field" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="Pendent">⏳ Pendent</option>
                <option value="Facturat">🧾 Facturat</option>
                <option value="Cobrat">💰 Cobrat</option>
                <option value="No remunerat">🆓 No remunerat</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>{editingGigId ? 'Desar Canvis' : 'Guardar Bolo'}</button>
          </form>
        </div>
      )}

      {!isAdding && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {(() => {
            const today = new Date().toISOString().split('T')[0];
            const upcomingGigs = gigs.filter(g => g.date && g.date >= today).sort((a, b) => a.date.localeCompare(b.date));
            const pastGigs = gigs.filter(g => !g.date || g.date < today).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            
            const combinedGigs = [...upcomingGigs, ...pastGigs];
            const filteredGigs = combinedGigs.filter(g => {
              const q = normalizeText(searchQuery);
              const matchesText = normalizeText(g.title || '').includes(q) || 
                                  normalizeText(g.locationName || '').includes(q) ||
                                  normalizeText(g.municipality || '').includes(q);
              const matchesYear = searchYear === '' || (g.date && g.date.startsWith(searchYear));
              return matchesText && matchesYear;
            });
            
            if (filteredGigs.length === 0) {
              return <div className="glass-panel text-center" style={{ padding: '2rem' }}>No hi ha cap bolo que coincideixi amb la cerca.</div>;
            }

            return filteredGigs.map(gig => {
              const isUpcoming = gig.date && gig.date >= today;
              const gigStatus = gig.status || 'Pendent';
              const statusIcons = {
                'Pendent': '⏳ Pendent',
                'Facturat': '🧾 Facturat',
                'Cobrat': '💰 Cobrat',
                'No remunerat': '🆓 No remunerat'
              };
              const statusColors = {
                'Pendent': 'rgba(255, 165, 0, 0.2)',
                'Facturat': 'rgba(52, 152, 219, 0.2)',
                'Cobrat': 'rgba(46, 204, 113, 0.2)',
                'No remunerat': 'rgba(149, 165, 166, 0.2)'
              };
              const statusTextColors = {
                'Pendent': '#ffa500',
                'Facturat': '#3498db',
                'Cobrat': '#2ecc71',
                'No remunerat': '#95a5a6'
              };
               const isHighlighted = highlightId === gig.id || justEditedId === gig.id;
               return (
                 <div 
                   id={`gig-card-${gig.id}`}
                   key={gig.id} 
                   className="glass-panel" 
                   style={{ 
                     padding: 'var(--space-md)',
                     border: isHighlighted ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                     boxShadow: isHighlighted ? '0 0 20px rgba(255, 183, 3, 0.45)' : 'none',
                     transition: 'all 0.3s ease-in-out'
                   }}
                 >
                   <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--color-primary)' }}>{gig.title}</h3>
                        <span style={{ 
                          fontSize: '0.7rem', 
                          padding: '0.2rem 0.5rem', 
                          borderRadius: '4px', 
                          backgroundColor: isUpcoming ? 'rgba(46, 204, 113, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                          color: isUpcoming ? '#2ecc71' : 'var(--color-text-secondary)',
                          border: `1px solid ${isUpcoming ? '#27ae60' : 'rgba(255, 255, 255, 0.2)'}`
                        }}>
                          {isUpcoming ? 'PROPER' : 'REALITZAT'}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {(!isUpcoming || (gigStatus !== 'Pendent' && gigStatus !== 'No remunerat')) && (() => {
                          const bgColor = statusColors[gigStatus] || 'rgba(200, 200, 200, 0.2)';
                          const textColor = statusTextColors[gigStatus] || '#999';
                          const icon = statusIcons[gigStatus] || gigStatus;
                          return (
                            <span style={{ 
                              fontSize: '0.7rem', 
                              padding: '0.2rem 0.5rem', 
                              borderRadius: '4px', 
                              fontWeight: 'bold',
                              letterSpacing: '0.5px',
                              backgroundColor: bgColor,
                              color: textColor,
                              border: `1px solid ${bgColor.replace('0.2', '0.5')}`
                            }}>
                              {icon}
                            </span>
                          );
                        })()}
                        <button 
                          onClick={() => setViewedGig(gig)}
                          className="btn btn-glass"
                          style={{ padding: '0.4rem', border: 'none', background: 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Visualitzar fitxa del bolo"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        </button>
                        {isAdmin && (
                          <>
                            <button 
                              onClick={() => handleEditClick(gig)}
                              className="btn btn-glass"
                              style={{ padding: '0.4rem', border: 'none', background: 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)' }}
                              title="Editar Bolo"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                                <path d="m15 5 4 4"></path>
                              </svg>
                            </button>
                            <button 
                              onClick={() => handleRemoveGig(gig.id, gig.title)}
                              className="btn btn-glass"
                              style={{ padding: '0.4rem', border: 'none', background: 'transparent', color: '#ff6b6b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Eliminar Bolo"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', fontWeight: 'bold', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span>📅 {gig.date === 'a determinar' ? 'a determinar' : formatDateDDMMYYYY(gig.date)}{gig.showTime && gig.showTime !== 'a determinar' ? ` a les ${gig.showTime}` : (gig.date !== 'a determinar' ? ' (Hora a determinar)' : '')} | 📍 {gig.municipality && gig.locationName ? `${gig.municipality} (${gig.locationName})` : (gig.municipality || gig.locationName)}</span>
                      {isUpcoming && gig.municipality && (
                        <a 
                          href={`https://www.google.com/search?q=temps+${encodeURIComponent(gig.municipality)}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="btn btn-glass" 
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderColor: 'transparent', color: 'var(--color-text-primary)' }}
                        >
                          🌤️ Previsió del temps
                        </a>
                      )}
                    </div>
                  </div>
                  
                  {(gig.address || gig.contactPerson || gig.contactPhone || gig.scheduleDetails) && (
                    <details style={{ marginTop: '1rem', cursor: 'pointer' }}>
                      <summary style={{ fontWeight: 'bold', color: 'var(--color-accent)', userSelect: 'none' }}>📋 Horaris i Logística</summary>
                      <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', cursor: 'default' }}>
                        {(gig.address || gig.municipality) && (
                          <div>
                            <strong>Ubicació:</strong><br />
                            {gig.address && <span>{gig.address}<br /></span>}
                            {gig.municipality}
                            {gig.address && (
                              <div style={{ marginTop: '0.5rem' }}>
                                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(gig.locationName + ' ' + gig.address + ' ' + gig.municipality)}`} target="_blank" rel="noopener noreferrer" className="btn btn-glass" style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}>📍 Obrir GPS</a>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {(gig.contactPerson || gig.contactPhone) && (
                          <div>
                            <strong>Contacte:</strong><br />
                            {gig.contactPerson}<br />
                            {gig.contactPhone && (
                              <div style={{ marginTop: '0.5rem' }}>
                                <a href={`tel:${gig.contactPhone.replace(/\s+/g, '')}`} className="btn btn-glass" style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}>📞 Trucar {gig.contactPhone}</a>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {gig.scheduleDetails && (
                          <div style={{ gridColumn: '1 / -1' }}>
                            <strong>Horaris / Notes:</strong><br />
                            <div style={{ whiteSpace: 'pre-line', marginTop: '0.5rem', backgroundColor: 'var(--color-background-soft)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                              {gig.scheduleDetails}
                            </div>
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* DETAILED VIEW GIG MODAL */}
      {viewedGig && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.75)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(5px)'
        }} className="no-print">
          <div className="glass-panel animate-fade-in-up" style={{
            width: '90%',
            maxWidth: '600px',
            padding: '2rem',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
            border: '1px solid var(--color-accent)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ color: 'var(--color-accent)', marginTop: 0, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              👁️ Fitxa del Bolo
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '2rem' }}>
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block' }}>Títol / Espectacle</span>
                <strong style={{ fontSize: '1.2rem', color: 'var(--color-primary)' }}>{viewedGig.title}</strong>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block' }}>Data</span>
                  <span>{viewedGig.date === 'a determinar' ? 'a determinar' : formatDateDDMMYYYY(viewedGig.date)}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block' }}>Hora</span>
                  <span>{viewedGig.showTime && viewedGig.showTime !== 'a determinar' ? `${viewedGig.showTime} h` : (viewedGig.date !== 'a determinar' ? 'Hora a determinar' : '-')}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block' }}>Municipi</span>
                  <span>{viewedGig.municipality || '-'}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block' }}>Lloc (Teatre/Sala)</span>
                  <span>{viewedGig.locationName || '-'}</span>
                </div>
              </div>

              {viewedGig.address && (
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block' }}>Adreça completa</span>
                  <span>{viewedGig.address}</span>
                  <div style={{ marginTop: '0.5rem' }}>
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(viewedGig.locationName + ' ' + viewedGig.address + ' ' + viewedGig.municipality)}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn btn-glass" 
                      style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}
                    >
                      📍 Obrir a Google Maps
                    </a>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block' }}>Persona de contacte</span>
                  <span>{viewedGig.contactPerson || '-'}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block' }}>Telèfon de contacte</span>
                  <span>
                    {viewedGig.contactPhone || '-'}
                    {viewedGig.contactPhone && (
                      <span style={{ marginLeft: '0.5rem' }}>
                        <a href={`tel:${viewedGig.contactPhone.replace(/\s+/g, '')}`} className="btn btn-glass" style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', textDecoration: 'none' }}>📞 Trucar</a>
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {viewedGig.scheduleDetails && (
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block' }}>Horaris / Notes logistics</span>
                  <div style={{ whiteSpace: 'pre-line', marginTop: '0.5rem', backgroundColor: 'var(--color-background-soft)', padding: '1rem', borderRadius: 'var(--radius-md)', fontSize: '0.9rem' }}>
                    {viewedGig.scheduleDetails}
                  </div>
                </div>
              )}

              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'block' }}>Estat del bolo</span>
                <span style={{
                  display: 'inline-block',
                  marginTop: '0.3rem',
                  fontSize: '0.85rem',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                  backgroundColor: viewedGig.status === 'Pendent' ? 'rgba(255, 165, 0, 0.2)' :
                                   viewedGig.status === 'Facturat' ? 'rgba(52, 152, 219, 0.2)' :
                                   viewedGig.status === 'Cobrat' ? 'rgba(46, 204, 113, 0.2)' :
                                   'rgba(149, 165, 166, 0.2)',
                  color: viewedGig.status === 'Pendent' ? '#ffa500' :
                         viewedGig.status === 'Facturat' ? '#3498db' :
                         viewedGig.status === 'Cobrat' ? '#2ecc71' :
                         '#95a5a6'
                }}>
                  {viewedGig.status === 'Pendent' ? '⏳ Pendent' :
                   viewedGig.status === 'Facturat' ? '🧾 Facturat' :
                   viewedGig.status === 'Cobrat' ? '💰 Cobrat' :
                   '🆓 ' + (viewedGig.status || 'Pendent')}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button 
                onClick={() => setViewedGig(null)}
                className="btn btn-primary"
                style={{ padding: '0.5rem 1.5rem' }}
              >
                Tancar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
