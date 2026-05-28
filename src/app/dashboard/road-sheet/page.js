'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../lib/AuthContext';
import { getUpcomingGigs, addGig, deleteGig, updateGig } from '../../../lib/firestoreUtils';
import Link from 'next/link';

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
  const [gigs, setGigs] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingGigId, setEditingGigId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchYear, setSearchYear] = useState('');

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

  useEffect(() => {
    if (user) {
      loadGigs();
    }
  }, [user]);

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
      const rawData = { date, showTime: date === 'a determinar' ? '' : showTime, title, locationName, municipality, address, contactPerson, contactPhone, scheduleDetails, status };
      // Firebase odia els camps 'undefined'. Ens assegurem que tot sigui com a mínim un string buit o s'elimini:
      const gigData = JSON.parse(JSON.stringify(rawData));
      
      if (editingGigId) {
        await updateGig(editingGigId, gigData);
      } else {
        await addGig(gigData);
      }
      setIsAdding(false);
      resetForm();
      await loadGigs();
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

  const handleImportWeb = async () => {
    if (!confirm("Això importarà tot l'històric de concerts de la web antiga a l'App. N'estàs segur?")) return;
    try {
      const res = await fetch('/api/import');
      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      const webConcerts = data.concerts;
      
      let count = 0;
      for (const c of webConcerts) {
        if (!c.date || c.date.includes('determinar')) continue; // Saltem dates no definides
        
        // Convertim DD/MM/YYYY a YYYY-MM-DD
        const [d, m, y] = c.date.split('/');
        if (!y || !m || !d) continue;
        const formattedDate = `${y}-${m}-${d}`;
        
        await addGig({
          date: formattedDate,
          title: c.show?.ca || '',
          locationName: c.location || '',
          showTime: '',
          municipality: '',
          address: '',
          contactPerson: '',
          contactPhone: '',
          scheduleDetails: '',
          status: 'Pendent'
        });
        count++;
      }
      
      alert(`S'han importat ${count} concerts exitosament!`);
      await loadGigs();
    } catch (error) {
      console.error(error);
      alert("S'ha produït un error al llegir la web: " + error.message);
    }
  };

  if (loading || !user) return <div className="container mt-xl text-center">Carregant Road-sheet...</div>;

  return (
    <div className="container mt-xl animate-fade-in-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
        <div>
          <Link href="/dashboard" className="btn-back no-print" title="Tornar al Dashboard" style={{ marginRight: '1rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </Link>
          <h1 style={{ marginTop: '0.5rem', marginBottom: 0, display: 'inline-block', verticalAlign: 'middle' }}>Road-sheet 🚐</h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="🔍 Cerca per municipi, sala o espectacle..." 
            className="input-field" 
            style={{ width: '300px', marginBottom: 0 }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {(() => {
            const allYears = Array.from(new Set(gigs.filter(g => g.date).map(g => g.date.split('-')[0]))).sort().reverse();
            return (
              <select 
                className="input-field" 
                style={{ width: '150px', marginBottom: 0 }}
                value={searchYear}
                onChange={(e) => setSearchYear(e.target.value)}
              >
                <option value="">Tots els anys</option>
                {allYears.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
            );
          })()}
          {isAdmin && (
            <>
              <button className="btn btn-glass" onClick={handleImportWeb}>
                ⬇️ Importar Web
              </button>
              <button className="btn btn-primary" onClick={() => {
                setIsAdding(!isAdding);
                if (isAdding) resetForm();
              }}>
                {isAdding ? 'Cancel·lar' : '+ Afegir Bolo'}
              </button>
            </>
          )}
        </div>
      </div>

      {isAdding && (
        <div className="glass-panel animate-fade-in-up" style={{ marginBottom: 'var(--space-lg)' }}>
          <form onSubmit={handleAddGig} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
                <label>Hora del concert</label>
                <input 
                  type="time" 
                  className="input-field" 
                  value={date === 'a determinar' ? '' : showTime} 
                  onChange={e => setShowTime(e.target.value)} 
                  disabled={date === 'a determinar'}
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
              const q = searchQuery.toLowerCase();
              const matchesText = (g.title || '').toLowerCase().includes(q) || 
                                  (g.locationName || '').toLowerCase().includes(q) ||
                                  (g.municipality || '').toLowerCase().includes(q);
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
              
              return (
                <div key={gig.id} className="glass-panel" style={{ padding: 'var(--space-md)' }}>
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
                        {isAdmin && (
                          <>
                            <button 
                              onClick={() => handleEditClick(gig)}
                              className="btn btn-glass"
                              style={{ padding: '0.4rem', border: 'none', background: 'transparent' }}
                              title="Editar Bolo"
                            >
                              ✏️
                            </button>
                            <button 
                              onClick={() => handleRemoveGig(gig.id, gig.title)}
                              className="btn btn-glass"
                              style={{ padding: '0.4rem', border: 'none', background: 'transparent' }}
                              title="Eliminar Bolo"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', fontWeight: 'bold', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span>📅 {gig.date === 'a determinar' ? 'a determinar' : (gig.date ? gig.date.split('-').reverse().join('/') : '')} {gig.showTime ? `a les ${gig.showTime}` : ''} | 📍 {gig.municipality && gig.locationName ? `${gig.municipality} (${gig.locationName})` : (gig.municipality || gig.locationName)}</span>
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
    </div>
  );
}
