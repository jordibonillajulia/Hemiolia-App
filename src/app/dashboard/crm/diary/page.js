'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../../lib/AuthContext';
import { 
  getContacts, 
  getAllInteractions, 
  getPromotionSessions, 
  addPromotionSession, 
  updatePromotionSession, 
  deletePromotionSession, 
  getShows 
} from '../../../../lib/firestoreUtils';
import Link from 'next/link';
import { normalizeText } from '../../../../lib/utils';

// Helper to format date as DD/MM/YYYY
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
  return dateStr;
};

// Helper for human readable Catalan day format (e.g. "Divendres, 18 de Setembre de 2026")
const formatCatalanLongDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const [yyyy, mm, dd] = dateStr.split(/[ T]/)[0].split('-');
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (isNaN(d.getTime())) return dateStr;
    const formatted = new Intl.DateTimeFormat('ca-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(d);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch (e) {
    return dateStr;
  }
};

const INTERACTION_TYPE_MAP = {
  call: { label: 'Trucada', icon: '📞', color: '#34d399', bg: 'rgba(52, 211, 153, 0.12)', border: 'rgba(52, 211, 153, 0.35)' },
  email: { label: 'Correu', icon: '✉️', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.12)', border: 'rgba(96, 165, 250, 0.35)' },
  meeting: { label: 'Reunió', icon: '🤝', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.12)', border: 'rgba(167, 139, 250, 0.35)' },
  instance: { label: 'Instància', icon: '📝', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.35)' },
  proposal: { label: 'Proposta', icon: '📄', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.35)' },
  show: { label: 'Funció', icon: '🎭', color: '#f472b6', bg: 'rgba(244, 114, 182, 0.12)', border: 'rgba(244, 114, 182, 0.35)' },
  note: { label: 'Nota', icon: '📌', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.35)' },
};

export default function PromotionDiaryPage() {
  const { user, loading: authLoading, isAdmin, isCrm } = useAuth();
  const [contactsMap, setContactsMap] = useState({});
  const [interactions, setInteractions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [shows, setShows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAuthor, setFilterAuthor] = useState('Tots');
  const [filterPeriod, setFilterPeriod] = useState('all'); // 'all', 'today', 'this_week', 'this_month', 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Expanded days state
  const [expandedDays, setExpandedDays] = useState(new Set());

  // Session modal / form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formAuthor, setFormAuthor] = useState('Jordi');
  const [formObjective, setFormObjective] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formNextSteps, setFormNextSteps] = useState('');

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [allC, allI, allS, allShows] = await Promise.all([
        getContacts(),
        getAllInteractions(),
        getPromotionSessions(),
        getShows()
      ]);

      const map = {};
      (allC || []).forEach(c => {
        map[c.id] = c;
      });
      setContactsMap(map);
      setInteractions(allI || []);
      setSessions(allS || []);
      setShows(allShows || []);
      
      const uniqueDates = Array.from(new Set([
        ...(allI || []).map(i => (i.date || '').split('T')[0]),
        ...(allS || []).map(s => (s.date || '').split('T')[0])
      ].filter(Boolean))).sort().reverse();
      
      setExpandedDays(new Set(uniqueDates.slice(0, 3)));
    } catch (err) {
      console.error("Error loading diary data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadAllData();
    }
  }, [user]);

  // Handle open session form
  const handleOpenNewSession = (presetDate = '') => {
    setEditingSessionId(null);
    setFormDate(presetDate || new Date().toISOString().split('T')[0]);
    setFormAuthor('Jordi');
    setFormObjective('');
    setFormNotes('');
    setFormNextSteps('');
    setIsFormOpen(true);
  };

  const handleEditSession = (session) => {
    setEditingSessionId(session.id);
    setFormDate(session.date || new Date().toISOString().split('T')[0]);
    setFormAuthor(session.author || 'Jordi');
    setFormObjective(session.objective || '');
    setFormNotes(session.notes || '');
    setFormNextSteps(session.nextSteps || '');
    setIsFormOpen(true);
  };

  const handleDeleteSession = async (sessionId) => {
    if (confirm("Segur que vols eliminar aquesta nota de sessió?")) {
      await deletePromotionSession(sessionId);
      await loadAllData();
    }
  };

  const handleSaveSession = async (e) => {
    e.preventDefault();
    const payload = {
      date: formDate,
      author: formAuthor,
      objective: formObjective.trim(),
      notes: formNotes.trim(),
      nextSteps: formNextSteps.trim()
    };

    if (editingSessionId) {
      await updatePromotionSession(editingSessionId, payload);
    } else {
      await addPromotionSession(payload);
    }

    setIsFormOpen(false);
    await loadAllData();
  };

  const toggleDayExpanded = (dateStr) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dateStr)) {
        next.delete(dateStr);
      } else {
        next.add(dateStr);
      }
      return next;
    });
  };

  const expandAllDays = () => {
    const allDates = dailyGroups.map(g => g.dateStr);
    setExpandedDays(new Set(allDates));
  };

  const collapseAllDays = () => {
    setExpandedDays(new Set());
  };

  const getInteractionShows = (interaction) => {
    if (Array.isArray(interaction?.shows) && interaction.shows.length > 0) {
      return interaction.shows;
    }
    if (interaction?.showId) {
      return interaction.showId.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const dailyGroups = useMemo(() => {
    const dateSet = new Set();

    interactions.forEach(i => {
      const d = (i.date || '').split('T')[0];
      if (d) dateSet.add(d);
    });

    sessions.forEach(s => {
      const d = (s.date || '').split('T')[0];
      if (d) dateSet.add(d);
    });

    let dates = Array.from(dateSet).sort().reverse();

    if (filterPeriod === 'today') {
      dates = dates.filter(d => d === todayStr);
    } else if (filterPeriod === 'this_week') {
      const now = new Date();
      const firstDayOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 1)).toISOString().split('T')[0];
      dates = dates.filter(d => d >= firstDayOfWeek);
    } else if (filterPeriod === 'this_month') {
      const currentMonth = todayStr.substring(0, 7);
      dates = dates.filter(d => d.startsWith(currentMonth));
    } else if (filterPeriod === 'custom') {
      if (startDate) dates = dates.filter(d => d >= startDate);
      if (endDate) dates = dates.filter(d => d <= endDate);
    }

    const normQuery = normalizeText(searchQuery.trim().toLowerCase());

    const groups = dates.map(dateStr => {
      let dayInteractions = interactions.filter(i => (i.date || '').split('T')[0] === dateStr);
      let daySessions = sessions.filter(s => (s.date || '').split('T')[0] === dateStr);

      if (filterAuthor !== 'Tots') {
        daySessions = daySessions.filter(s => (s.author || 'Jordi') === filterAuthor);
      }

      if (normQuery) {
        dayInteractions = dayInteractions.filter(i => {
          const contact = contactsMap[i.contactId] || {};
          const fullText = [
            contact.entity || '',
            contact.municipality || '',
            contact.province || '',
            i.title || '',
            i.notes || '',
            i.contactPerson || '',
            i.showId || '',
            (i.shows || []).join(' ')
          ].join(' ');
          return normalizeText(fullText.toLowerCase()).includes(normQuery);
        });

        daySessions = daySessions.filter(s => {
          const fullText = [
            s.author || '',
            s.objective || '',
            s.notes || '',
            s.nextSteps || ''
          ].join(' ');
          return normalizeText(fullText.toLowerCase()).includes(normQuery);
        });
      }

      const countsByType = { call: 0, email: 0, meeting: 0, instance: 0, proposal: 0, show: 0, note: 0 };
      const uniqueEntitiesSet = new Set();
      const showsSet = new Set();

      dayInteractions.forEach(i => {
        const t = i.type || (i.showId ? 'meeting' : 'call');
        if (countsByType[t] !== undefined) countsByType[t]++;
        if (i.contactId) uniqueEntitiesSet.add(i.contactId);
        getInteractionShows(i).forEach(s => showsSet.add(s));
      });

      return {
        dateStr,
        interactions: dayInteractions,
        sessions: daySessions,
        totalActions: dayInteractions.length,
        uniqueEntitiesCount: uniqueEntitiesSet.size,
        countsByType,
        showsMoved: Array.from(showsSet),
        hasContent: dayInteractions.length > 0 || daySessions.length > 0
      };
    }).filter(g => g.hasContent);

    return groups;
  }, [interactions, sessions, contactsMap, filterPeriod, startDate, endDate, filterAuthor, searchQuery, todayStr]);

  const globalMetrics = useMemo(() => {
    let totalDays = dailyGroups.length;
    let totalActions = 0;
    let allEntities = new Set();
    let totalCalls = 0;
    let totalEmails = 0;
    let totalMeetings = 0;
    let totalProposals = 0;

    dailyGroups.forEach(g => {
      totalActions += g.totalActions;
      g.interactions.forEach(i => {
        if (i.contactId) allEntities.add(i.contactId);
        const t = i.type || (i.showId ? 'meeting' : 'call');
        if (t === 'call') totalCalls++;
        if (t === 'email') totalEmails++;
        if (t === 'meeting') totalMeetings++;
        if (t === 'proposal') totalProposals++;
      });
    });

    return {
      totalDays,
      totalActions,
      uniqueEntities: allEntities.size,
      totalCalls,
      totalEmails,
      totalMeetings,
      totalProposals
    };
  }, [dailyGroups]);

  if (authLoading || isLoading) {
    return <div className="container mt-xl">Carregant el Diari de Promoció...</div>;
  }

  return (
    <div className="container" style={{ paddingTop: 'var(--space-md)', paddingBottom: '3rem' }}>
      {/* Header Bar */}
      <div className="header-bar-responsive" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Link href="/dashboard/crm" className="btn-back no-print" title="Tornar a la llista de contactes">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </Link>
            <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📓</span> Diari de Promoció & Sessions
            </h1>
          </div>
          <p style={{ margin: '0.35rem 0 0 0', color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
            Registre cronològic de la feina comercial feta a cada jornada i diari de reflexions de l'equip.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-glass no-print" onClick={() => window.print()} title="Imprimir diari">
            🖨️ Imprimir
          </button>
          {(isAdmin || isCrm) && (
            <button 
              className="btn btn-primary no-print" 
              onClick={() => handleOpenNewSession()}
              style={{ fontWeight: 'bold' }}
            >
              + Nova Nota de Sessió
            </button>
          )}
        </div>
      </div>

      {/* Global Metrics Panel */}
      <div className="glass-panel" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', textAlign: 'center' }}>
          <div style={{ padding: '0.5rem' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--color-accent)' }}>{globalMetrics.totalDays}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Jornades / Dies</div>
          </div>
          <div style={{ padding: '0.5rem', borderLeft: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#f0f0f5' }}>{globalMetrics.totalActions}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Accions Totals</div>
          </div>
          <div style={{ padding: '0.5rem', borderLeft: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#a78bfa' }}>{globalMetrics.uniqueEntities}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Entitats Tocades</div>
          </div>
          <div style={{ padding: '0.5rem', borderLeft: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#34d399' }}>{globalMetrics.totalCalls}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📞 Trucades</div>
          </div>
          <div style={{ padding: '0.5rem', borderLeft: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#60a5fa' }}>{globalMetrics.totalEmails}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>✉️ Correus</div>
          </div>
          <div style={{ padding: '0.5rem', borderLeft: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#fbbf24' }}>{globalMetrics.totalProposals}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📄 Propostes</div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="glass-panel no-print" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search Input */}
          <div style={{ flex: '1.5', minWidth: '240px' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="🔍 Cerca per entitat, municipi, espectacle, paraula clau..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ fontSize: '0.9rem' }}
            />
          </div>

          {/* Period Selector */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { id: 'all', label: 'Tot' },
              { id: 'today', label: 'Avui' },
              { id: 'this_week', label: 'Aquesta setmana' },
              { id: 'this_month', label: 'Aquest mes' },
              { id: 'custom', label: 'Personalitzat' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setFilterPeriod(p.id)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '16px',
                  fontSize: '0.8rem',
                  fontWeight: filterPeriod === p.id ? '600' : 'normal',
                  backgroundColor: filterPeriod === p.id ? 'var(--color-accent)' : 'rgba(255, 255, 255, 0.05)',
                  color: filterPeriod === p.id ? 'var(--color-bg)' : 'var(--color-text-secondary)',
                  border: filterPeriod === p.id ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                  cursor: 'pointer'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Author Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Responsable:</span>
            <select 
              className="input-field" 
              value={filterAuthor} 
              onChange={e => setFilterAuthor(e.target.value)}
              style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
            >
              <option value="Tots">Tots</option>
              <option value="Jordi">Jordi</option>
              <option value="Paula">Paula</option>
              <option value="Equip">Equip</option>
            </select>
          </div>
        </div>

        {/* Custom date range picker if 'custom' is selected */}
        {filterPeriod === 'custom' && (
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Des de:</span>
              <input type="date" className="input-field" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Fins a:</span>
              <input type="date" className="input-field" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }} />
            </div>
          </div>
        )}
      </div>

      {/* Expand/Collapse All Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
          Mostrant <strong>{dailyGroups.length}</strong> jornada{dailyGroups.length !== 1 ? 's' : ''} de promoció
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            type="button" 
            onClick={expandAllDays} 
            className="btn btn-glass no-print" 
            style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', borderRadius: '4px' }}
          >
            Desplegar tot
          </button>
          <button 
            type="button" 
            onClick={collapseAllDays} 
            className="btn btn-glass no-print" 
            style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', borderRadius: '4px' }}
          >
            Plegar tot
          </button>
        </div>
      </div>

      {/* Timeline of Days */}
      {dailyGroups.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--color-text-secondary)' }}>
          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>📅</span>
          <h3>No s'han trobat jornades de promoció</h3>
          <p style={{ margin: '0.5rem 0 1.5rem 0' }}>No hi ha activitats ni notes enregistrades amb els filtres seleccionats.</p>
          {(isAdmin || isCrm) && (
            <button className="btn btn-primary" onClick={() => handleOpenNewSession()}>
              + Crear Nota de Sessió
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {dailyGroups.map(group => {
            const isExpanded = expandedDays.has(group.dateStr);
            const isToday = group.dateStr === todayStr;

            return (
              <div 
                key={group.dateStr} 
                className="glass-panel" 
                style={{ 
                  padding: 0,
                  overflow: 'hidden',
                  border: isToday ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                  boxShadow: isToday ? '0 4px 20px rgba(212, 175, 55, 0.15)' : 'none'
                }}
              >
                {/* Day Header */}
                <div 
                  style={{ 
                    padding: '1rem 1.25rem',
                    backgroundColor: isToday ? 'rgba(212, 175, 55, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    cursor: 'pointer'
                  }}
                  onClick={() => toggleDayExpanded(group.dateStr)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.2rem' }}>📅</span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', color: isToday ? 'var(--color-accent)' : 'var(--color-text-primary)' }}>
                        {formatCatalanLongDate(group.dateStr)}
                        {isToday && (
                          <span style={{ 
                            marginLeft: '0.6rem', 
                            fontSize: '0.75rem', 
                            backgroundColor: 'var(--color-accent)', 
                            color: 'var(--color-bg)', 
                            padding: '0.15rem 0.5rem', 
                            borderRadius: '10px', 
                            fontWeight: 'bold', 
                            verticalAlign: 'middle' 
                          }}>
                            AVUI
                          </span>
                        )}
                      </h3>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                        {group.totalActions} acci{group.totalActions !== 1 ? 'ons' : 'ó'} comercial{group.totalActions !== 1 ? 's' : ''} en {group.uniqueEntitiesCount} entitat{group.uniqueEntitiesCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Summary Chips for the Day */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {group.countsByType.call > 0 && (
                      <span style={{ fontSize: '0.78rem', backgroundColor: 'rgba(52, 211, 153, 0.15)', color: '#34d399', padding: '0.2rem 0.5rem', borderRadius: '12px', border: '1px solid rgba(52, 211, 153, 0.3)' }}>
                        📞 {group.countsByType.call}
                      </span>
                    )}
                    {group.countsByType.email > 0 && (
                      <span style={{ fontSize: '0.78rem', backgroundColor: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa', padding: '0.2rem 0.5rem', borderRadius: '12px', border: '1px solid rgba(96, 165, 250, 0.3)' }}>
                        ✉️ {group.countsByType.email}
                      </span>
                    )}
                    {group.countsByType.meeting > 0 && (
                      <span style={{ fontSize: '0.78rem', backgroundColor: 'rgba(167, 139, 250, 0.15)', color: '#a78bfa', padding: '0.2rem 0.5rem', borderRadius: '12px', border: '1px solid rgba(167, 139, 250, 0.3)' }}>
                        🤝 {group.countsByType.meeting}
                      </span>
                    )}
                    {group.countsByType.proposal > 0 && (
                      <span style={{ fontSize: '0.78rem', backgroundColor: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', padding: '0.2rem 0.5rem', borderRadius: '12px', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                        📄 {group.countsByType.proposal}
                      </span>
                    )}
                    {group.countsByType.instance > 0 && (
                      <span style={{ fontSize: '0.78rem', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '0.2rem 0.5rem', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                        📝 {group.countsByType.instance}
                      </span>
                    )}

                    <button 
                      type="button" 
                      className="btn-glass no-print" 
                      style={{ padding: '0.25rem 0.55rem', fontSize: '0.85rem', borderRadius: '4px', marginLeft: '0.5rem' }}
                      title={isExpanded ? "Plegar detalls" : "Desplegar detalls"}
                    >
                      {isExpanded ? '▲' : '▼'}
                    </button>
                  </div>
                </div>

                {/* Day Body */}
                <div style={{ padding: '1.25rem' }}>
                  {/* Shows touched that day */}
                  {group.showsMoved.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px dashed var(--color-border)' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: '600' }}>Espectacles moguts avui:</span>
                      {group.showsMoved.map(s => (
                        <span 
                          key={s} 
                          style={{
                            background: 'rgba(212, 175, 55, 0.12)',
                            color: 'var(--color-accent)',
                            border: '1px solid rgba(212, 175, 55, 0.25)',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.78rem',
                            fontWeight: '500'
                          }}
                        >
                          🎭 {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Promotion Session Notes / Reflections of the day */}
                  <div style={{ marginBottom: group.interactions.length > 0 ? '1.25rem' : 0 }}>
                    {group.sessions.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {group.sessions.map(sess => (
                          <div 
                            key={sess.id}
                            style={{
                              background: 'rgba(212, 175, 55, 0.06)',
                              border: '1px solid rgba(212, 175, 55, 0.3)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '1rem',
                              position: 'relative'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span style={{ 
                                  backgroundColor: 'var(--color-accent)', 
                                  color: 'var(--color-bg)', 
                                  fontWeight: 'bold', 
                                  fontSize: '0.75rem', 
                                  padding: '0.2rem 0.55rem', 
                                  borderRadius: '12px' 
                                }}>
                                  👤 {sess.author || 'Jordi'}
                                </span>
                                {sess.objective && (
                                  <strong style={{ fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>
                                    🎯 Objectiu: {sess.objective}
                                  </strong>
                                )}
                              </div>

                              {(isAdmin || isCrm) && (
                                <div style={{ display: 'flex', gap: '0.35rem' }} className="no-print">
                                  <button 
                                    type="button" 
                                    onClick={() => handleEditSession(sess)} 
                                    className="btn btn-glass" 
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px' }}
                                    title="Editar nota de sessió"
                                  >
                                    ✏️ Editar
                                  </button>
                                  <button 
                                    type="button" 
                                    onClick={() => handleDeleteSession(sess.id)} 
                                    className="btn btn-glass" 
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', color: 'var(--color-error)' }}
                                    title="Eliminar nota"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              )}
                            </div>

                            {sess.notes && (
                              <div style={{ 
                                fontSize: '0.92rem', 
                                color: 'var(--color-text-primary)', 
                                lineHeight: '1.6', 
                                whiteSpace: 'pre-wrap', 
                                marginTop: '0.35rem',
                                background: 'rgba(0, 0, 0, 0.25)',
                                padding: '0.75rem',
                                borderRadius: '6px'
                              }}>
                                📝 <strong>Reflexions de la sessió:</strong>
                                <div style={{ marginTop: '0.25rem', color: 'var(--color-text-secondary)' }}>{sess.notes}</div>
                              </div>
                            )}

                            {sess.nextSteps && (
                              <div style={{ fontSize: '0.88rem', color: '#ffb703', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span>⏩</span> <strong>Propers passos / Pendents:</strong> {sess.nextSteps}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      (isAdmin || isCrm) && (
                        <div style={{ 
                          background: 'rgba(255, 255, 255, 0.02)', 
                          border: '1px dashed var(--color-border)', 
                          borderRadius: 'var(--radius-sm)', 
                          padding: '0.75rem 1rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '0.5rem'
                        }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                            No s'han afegit reflexions ni notes globals a aquesta sessió.
                          </span>
                          <button 
                            type="button" 
                            onClick={() => handleOpenNewSession(group.dateStr)}
                            className="btn btn-glass no-print"
                            style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
                          >
                            + Afegir notes de sessió
                          </button>
                        </div>
                      )
                    )}
                  </div>

                  {/* Detailed Actions of the Day (Collapsible) */}
                  {isExpanded && group.interactions.length > 0 && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
                      <h4 style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Detall dels contactes treballats ({group.interactions.length})
                      </h4>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {group.interactions.map(interaction => {
                          const contact = contactsMap[interaction.contactId] || {};
                          const effectiveType = interaction.type || (interaction.showId ? 'meeting' : 'call');
                          const typeInfo = INTERACTION_TYPE_MAP[effectiveType] || INTERACTION_TYPE_MAP.meeting;
                          const showsList = getInteractionShows(interaction);

                          return (
                            <div 
                              key={interaction.id}
                              style={{
                                background: 'rgba(0, 0, 0, 0.25)',
                                border: '1px solid var(--color-border)',
                                borderLeft: `3px solid ${typeInfo.color}`,
                                borderRadius: '6px',
                                padding: '0.75rem 1rem',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                flexWrap: 'wrap',
                                gap: '0.6rem'
                              }}
                            >
                              <div style={{ flex: '1', minWidth: '240px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                                  <span style={{ 
                                    fontSize: '0.75rem', 
                                    fontWeight: 'bold', 
                                    backgroundColor: typeInfo.bg, 
                                    color: typeInfo.color, 
                                    padding: '0.15rem 0.45rem', 
                                    borderRadius: '10px',
                                    border: `1px solid ${typeInfo.border}`
                                  }}>
                                    {typeInfo.icon} {typeInfo.label}
                                  </span>

                                  {interaction.contactId ? (
                                    <Link 
                                      href={`/dashboard/crm/${interaction.contactId}`}
                                      style={{ fontWeight: 'bold', color: 'var(--color-accent)', fontSize: '0.95rem' }}
                                      title="Obrir fitxa del contacte"
                                    >
                                      {contact.entity || 'Entitat sense nom'}
                                      {contact.municipality && <span style={{ color: 'var(--color-text-secondary)', fontWeight: 'normal', fontSize: '0.85rem' }}> ({contact.municipality})</span>}
                                    </Link>
                                  ) : (
                                    <strong style={{ fontSize: '0.95rem' }}>Entitat no especificada</strong>
                                  )}

                                  {interaction.contactPerson && (
                                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                      👤 {interaction.contactPerson}
                                    </span>
                                  )}
                                </div>

                                {interaction.title && (
                                  <div style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)', fontWeight: '500', marginBottom: '0.2rem' }}>
                                    {interaction.title}
                                  </div>
                                )}

                                {showsList.length > 0 && (
                                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', margin: '0.3rem 0' }}>
                                    {showsList.map(s => (
                                      <span key={s} style={{ fontSize: '0.75rem', color: 'var(--color-accent)', background: 'rgba(212, 175, 55, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '3px' }}>
                                        🎭 {s}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {interaction.notes && (
                                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', marginTop: '0.3rem', lineHeight: '1.5' }}>
                                    {interaction.notes}
                                  </div>
                                )}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }} className="no-print">
                                {interaction.interestLevel && Number(interaction.interestLevel) > 0 && (
                                  <span style={{ color: 'var(--color-accent)', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                    {'★'.repeat(interaction.interestLevel)}
                                  </span>
                                )}

                                {interaction.contactId && (
                                  <Link 
                                    href={`/dashboard/crm/${interaction.contactId}`}
                                    className="btn btn-glass"
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', textDecoration: 'none' }}
                                  >
                                    Fitxa ↗
                                  </Link>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal / Form for Session Notes */}
      {isFormOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(6px)',
          padding: '1rem'
        }}>
          <div className="glass-panel animate-fade-in-up" style={{
            width: '100%',
            maxWidth: '620px',
            padding: '2rem',
            border: '1px solid var(--color-accent)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ color: 'var(--color-accent)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📓</span> {editingSessionId ? 'Editar Nota de Sessió' : 'Nova Nota de Sessió de Promoció'}
            </h3>

            <form onSubmit={handleSaveSession} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="grid-2col-responsive" style={{ gap: '1rem' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Data de la sessió *</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={formDate} 
                    onChange={e => setFormDate(e.target.value)} 
                    required 
                  />
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Responsable de la sessió *</label>
                  <select 
                    className="input-field" 
                    value={formAuthor} 
                    onChange={e => setFormAuthor(e.target.value)} 
                    required
                  >
                    <option value="Jordi">Jordi</option>
                    <option value="Paula">Paula</option>
                    <option value="Equip">Equip (Ambdós)</option>
                  </select>
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Objectiu / Campanya de la sessió</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={formObjective} 
                  onChange={e => setFormObjective(e.target.value)} 
                  placeholder="Ex: Campanya Layla Nadal - Teatres de Girona i Osona" 
                />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Reflexions, impressions i notes globals de la feina feta *</label>
                <textarea 
                  className="input-field" 
                  rows="4" 
                  value={formNotes} 
                  onChange={e => setFormNotes(e.target.value)} 
                  placeholder="Ex: Bona rebuda dels programadors per als formats petits. Diversos municipis tancaran pressupost la setmana vinent..."
                  required
                />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Propers passos generals per a la següent sessió</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={formNextSteps} 
                  onChange={e => setFormNextSteps(e.target.value)} 
                  placeholder="Ex: Tornar a trucar a Palafrugell i Blanes dimarts vinent..." 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button 
                  type="button" 
                  className="btn btn-glass" 
                  onClick={() => setIsFormOpen(false)}
                >
                  Cancel·lar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ fontWeight: 'bold' }}
                >
                  {editingSessionId ? 'Desar Canvis' : 'Desar Nota de Sessió'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
