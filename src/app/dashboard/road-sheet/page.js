'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const [searchStatus, setSearchStatus] = useState('');
  const [viewedGig, setViewedGig] = useState(null);
  const [justEditedId, setJustEditedId] = useState(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setViewedGig(null);
      }
    };
    if (viewedGig) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewedGig]);

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
    setShowTime(gig.showTime || '');
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
      const finalShowTime = date === 'a determinar' ? '' : showTime;
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
          <select 
            className="input-field" 
            style={{ flex: '1 1 140px', minWidth: '120px', marginBottom: 0 }}
            value={searchStatus}
            onChange={(e) => setSearchStatus(e.target.value)}
          >
            <option value="">Tots els estats</option>
            <option value="Pendent">⏳ Pendent</option>
            <option value="Facturat">🧾 Facturat</option>
            <option value="Cobrat">💰 Cobrat</option>
            <option value="No remunerat">🆓 No remunerat</option>
          </select>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ marginBottom: 0 }}>Hora del concert</label>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'normal', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', margin: 0, userSelect: 'none' }}>
                    <input 
                      type="checkbox" 
                      checked={showTime === 'a determinar'} 
                      disabled={date === 'a determinar'}
                      onChange={e => {
                        if (e.target.checked) {
                          setShowTime('a determinar');
                        } else {
                          setShowTime('');
                        }
                      }} 
                    />
                    A determinar
                  </label>
                </div>
                <input 
                  type="time" 
                  className="input-field" 
                  value={date === 'a determinar' || showTime === 'a determinar' ? '' : showTime} 
                  onChange={e => setShowTime(e.target.value)} 
                  disabled={date === 'a determinar' || showTime === 'a determinar'}
                />
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
              const gigStatus = g.status || 'Pendent';
              const matchesText = normalizeText(g.title || '').includes(q) || 
                                  normalizeText(g.locationName || '').includes(q) ||
                                  normalizeText(g.municipality || '').includes(q) ||
                                  normalizeText(gigStatus).includes(q);
              const matchesYear = searchYear === '' || (g.date && g.date.startsWith(searchYear));
              const matchesStatus = searchStatus === '' || gigStatus === searchStatus;
              return matchesText && matchesYear && matchesStatus;
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
                   <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.6rem', marginBottom: '0.6rem' }}>
                    {/* FILA 1: Títol i Botons d'acció */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', marginBottom: '0.45rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--color-primary)', lineHeight: 1.25, wordBreak: 'break-word' }}>
                        {gig.title}
                      </h3>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                        <button 
                          onClick={() => setViewedGig(gig)}
                          className="btn btn-glass"
                          style={{ padding: '0.35rem', border: 'none', background: 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
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
                              style={{ padding: '0.35rem', border: 'none', background: 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)' }}
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
                              style={{ padding: '0.35rem', border: 'none', background: 'transparent', color: '#ff6b6b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
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

                    {/* FILA 2: Fila d'etiquetes (Badges) alineades horitzontalment */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.45rem' }}>
                      <span style={{ 
                        fontSize: '0.7rem', 
                        padding: '0.2rem 0.55rem', 
                        borderRadius: '4px', 
                        fontWeight: '600',
                        letterSpacing: '0.3px',
                        backgroundColor: isUpcoming ? 'rgba(46, 204, 113, 0.18)' : 'rgba(255, 255, 255, 0.08)',
                        color: isUpcoming ? '#2ecc71' : 'var(--color-text-secondary)',
                        border: `1px solid ${isUpcoming ? '#27ae60' : 'rgba(255, 255, 255, 0.15)'}`
                      }}>
                        {isUpcoming ? '🟢 PROPER' : '⚪ REALITZAT'}
                      </span>

                      {(() => {
                        const bgColor = statusColors[gigStatus] || 'rgba(200, 200, 200, 0.2)';
                        const textColor = statusTextColors[gigStatus] || '#999';
                        const icon = statusIcons[gigStatus] || gigStatus;
                        return (
                          <span style={{ 
                            fontSize: '0.7rem', 
                            padding: '0.2rem 0.55rem', 
                            borderRadius: '4px', 
                            fontWeight: 'bold',
                            letterSpacing: '0.3px',
                            backgroundColor: bgColor,
                            color: textColor,
                            border: `1px solid ${bgColor.replace('0.2', '0.45')}`
                          }}>
                            {icon}
                          </span>
                        );
                      })()}
                    </div>
                    
                    {/* FILA 3: Data, Lloc i Previsió */}
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.35rem 0.8rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}>
                        📅 {gig.date === 'a determinar' ? 'a determinar' : formatDateDDMMYYYY(gig.date)}{gig.showTime && gig.showTime !== 'a determinar' ? ` a les ${gig.showTime}` : (gig.showTime === 'a determinar' ? ' (Hora a determinar)' : '')}
                      </span>
                      
                      {(gig.municipality || gig.locationName) && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span>
                            📍 <span style={{ fontWeight: '600', color: 'var(--color-text-primary)' }}>{gig.municipality && gig.locationName ? `${gig.municipality} (${gig.locationName})` : (gig.municipality || gig.locationName)}</span>
                          </span>
                          {isUpcoming && gig.municipality && (
                            <a 
                              href={`https://www.google.com/search?q=temps+${encodeURIComponent(gig.municipality)}`} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="btn btn-glass" 
                              style={{ padding: '0.15rem 0.45rem', fontSize: '0.72rem', borderColor: 'rgba(255,255,255,0.15)', color: 'var(--color-text-primary)' }}
                            >
                              🌤️ Previsió del temps
                            </a>
                          )}
                        </span>
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
      {isMounted && viewedGig && createPortal(
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.75)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 99999,
            backdropFilter: 'blur(6px)',
            padding: '1rem'
          }} 
          className="no-print"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewedGig(null);
          }}
        >
          <style>{`
            .gig-modal-sheet {
              border-radius: var(--radius-lg) !important;
              max-height: 90vh !important;
              width: 100% !important;
              max-width: 580px !important;
              border: 2px solid var(--color-accent) !important;
              box-shadow: 0 0 30px rgba(212, 175, 55, 0.35), 0 12px 40px rgba(0, 0, 0, 0.7) !important;
            }
            .gig-modal-notes {
              max-height: 120px;
              overflow-y: auto;
            }
          `}</style>
          <div 
            className="glass-panel animate-fade-in-up gig-modal-sheet" 
            style={{
              padding: '1.25rem 1.25rem 1rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >

            {/* HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
              <h3 style={{ color: 'var(--color-accent)', margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold' }}>
                👁️ Fitxa del Bolo
              </h3>
              <button
                onClick={() => setViewedGig(null)}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', fontSize: '1.3rem', cursor: 'pointer', padding: '0.2rem 0.5rem', lineHeight: 1, borderRadius: '4px' }}
                title="Tancar"
              >✕</button>
            </div>

            {/* TÍTOL */}
            <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-md)', padding: '0.7rem 0.9rem', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.2rem' }}>Espectacle</span>
              <strong style={{ fontSize: '1.05rem', color: 'var(--color-primary)', lineHeight: 1.3 }}>{viewedGig.title}</strong>
            </div>

            {/* DATA + HORA + ESTAT (fila compacta) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.8rem', border: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.15rem' }}>Data</span>
                <span style={{ fontWeight: '500', fontSize: '0.85rem' }}>{viewedGig.date === 'a determinar' ? 'A det.' : formatDateDDMMYYYY(viewedGig.date)}</span>
              </div>
              <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.8rem', border: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.15rem' }}>Hora</span>
                <span style={{ fontWeight: '500', fontSize: '0.85rem' }}>
                  {viewedGig.showTime && viewedGig.showTime !== 'a determinar'
                    ? `${viewedGig.showTime}h`
                    : viewedGig.showTime === 'a determinar' ? 'A det.' : '—'}
                </span>
              </div>
              <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.8rem', border: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.15rem' }}>Estat</span>
                <span style={{
                  fontWeight: 'bold', fontSize: '0.8rem',
                  color: viewedGig.status === 'Pendent' ? '#ffa500' :
                         viewedGig.status === 'Facturat' ? '#3498db' :
                         viewedGig.status === 'Cobrat' ? '#2ecc71' : '#95a5a6'
                }}>
                  {viewedGig.status === 'Pendent' ? '⏳ Pend.' :
                   viewedGig.status === 'Facturat' ? '🧾 Fact.' :
                   viewedGig.status === 'Cobrat' ? '💰 Cobrat' :
                   '🆓 ' + (viewedGig.status || 'Pendent')}
                </span>
              </div>
            </div>

            {/* LLOC */}
            <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.8rem', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Lloc</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.4rem' }}>
                <div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', display: 'block' }}>Municipi</span>
                  <span style={{ fontWeight: '500', fontSize: '0.85rem' }}>{viewedGig.municipality || '—'}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', display: 'block' }}>Teatre / Sala</span>
                  <span style={{ fontWeight: '500', fontSize: '0.85rem' }}>{viewedGig.locationName || '—'}</span>
                </div>
              </div>
              {viewedGig.address && (
                <div style={{ marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', display: 'block' }}>Adreça</span>
                  <span style={{ fontWeight: '500', fontSize: '0.85rem' }}>{viewedGig.address}</span>
                </div>
              )}
              {/* Botons d'acció del lloc */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                {viewedGig.municipality && (
                  <a href={`https://www.google.com/search?q=temps+${encodeURIComponent(viewedGig.municipality)}`} target="_blank" rel="noopener noreferrer" className="btn btn-glass" style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}>
                    🌤️ Previsió del temps
                  </a>
                )}
                {viewedGig.address && (
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((viewedGig.locationName ? viewedGig.locationName + ' ' : '') + viewedGig.address + (viewedGig.municipality ? ' ' + viewedGig.municipality : ''))}`} target="_blank" rel="noopener noreferrer" className="btn btn-glass" style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}>
                    📍 Google Maps
                  </a>
                )}
              </div>
            </div>

            {/* CONTACTE */}
            <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.8rem', border: '1px solid rgba(255,255,255,0.07)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.15rem' }}>Contacte</span>
                <span style={{ fontWeight: '500', fontSize: '0.85rem' }}>{viewedGig.contactPerson || '—'}</span>
              </div>
              <div>
                <span style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.2rem' }}>Telèfon</span>
                {viewedGig.contactPhone ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: '500', fontSize: '0.85rem' }}>{viewedGig.contactPhone}</span>
                    <a 
                      href={`tel:${viewedGig.contactPhone.replace(/\s+/g, '')}`} 
                      className="btn btn-glass" 
                      style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      title={`Trucar al ${viewedGig.contactPhone}`}
                    >
                      📞 <span>Trucar</span>
                    </a>
                  </div>
                ) : (
                  <span style={{ fontWeight: '500', fontSize: '0.85rem' }}>—</span>
                )}
              </div>
            </div>

            {/* HORARIS / NOTES */}
            {viewedGig.scheduleDetails && (
              <div style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.8rem', border: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', display: 'block', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.3rem' }}>Horaris / Notes logístiques</span>
                <div className="gig-modal-notes" style={{ whiteSpace: 'pre-line', fontSize: '0.85rem', lineHeight: '1.5' }}>
                  {viewedGig.scheduleDetails}
                </div>
              </div>
            )}

            {/* TANCAR */}
            <div style={{ paddingTop: '0.2rem' }}>
              <button
                onClick={() => setViewedGig(null)}
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.6rem' }}
              >
                Tancar
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
