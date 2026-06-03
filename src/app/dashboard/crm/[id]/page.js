'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../../lib/AuthContext';
import { getContactById, getInteractionsByContact, addInteraction, getShows, updateContact, getUpcomingGigs, getContacts } from '../../../../lib/firestoreUtils';
import Link from 'next/link';
import { normalizeText, formatNotesWithLineBreaks } from '../../../../lib/utils';

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
    case 'Entrevista rebutjada':
      return { ...base, backgroundColor: 'rgba(248, 113, 113, 0.15)', color: '#f87171', border: '1px solid rgba(248, 113, 113, 0.3)' }; // Soft red badge
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

const detectMoodFromNotes = (notes, feedbackSummary) => {
  if (!notes && !feedbackSummary) return null;
  const text = ((notes || '') + ' ' + (feedbackSummary || '')).toLowerCase();

  const veryGoodKw = ['molt bé', 'molt be', 'excel·lent', 'excel.lent', 'fantàstic', 'fantastic', 'molt interessat', 'molt interessada', 'entusiasta', 'genial', 'perfecte', 'molt positiu', 'encantats', 'encantat', 'encantada', 'molt favorable', 'molt content', 'molt contenta', 'molt entusiasta'];
  const badKw     = ['no interessa', 'no li interessa', 'no els interessa', 'malament', 'negatiu', 'negativa', 'impossible', 'no pot', 'no vol', 'rebutja', 'rebutjat', 'difícil de convèncer', 'molest', 'molesta', 'enfadat', 'enfadada', 'no ho veu', 'no els va', 'fora de pressupost', 'no els agrada'];
  const goodKw    = ['bé', 'interessat', 'interessada', 'positiu', 'positiva', 'favorable', 'obert', 'oberta', 'disposat', 'disposada', 'considera', 'podria', 'content', 'contenta', 'ha agradat'];
  const neutralKw = ['potser', 'possiblement', 'a veure', 'no sap', 'pendent', 'dubte', 'dubtes', 'pensarà', 'consultarà', 'ho mirarà', 'ho consultarà', 'sense confirmar'];

  if (veryGoodKw.some(kw => text.includes(kw))) return 'molt_be';
  if (badKw.some(kw => text.includes(kw)))      return 'malament';
  if (goodKw.some(kw => text.includes(kw)))     return 'be';
  if (neutralKw.some(kw => text.includes(kw)))  return 'neutral';
  return null;
};

export default function ContactDetailPage() {
  const params = useParams();
  const contactId = params.id;
  const { user, loading, isAdmin, isCrm } = useAuth();
  const router = useRouter();
  const [contact, setContact] = useState(null);
  const [interactions, setInteractions] = useState([]);
  const [shows, setShows] = useState([]);
  const [isAdding, setIsAdding] = useState(false);

  // General contact fields edit state
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [entity, setEntity] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [province, setProvince] = useState('');
  const [status, setStatus] = useState('');
  const [feedbackSummary, setFeedbackSummary] = useState('');
  const [notes, setNotes] = useState('');
  const [mood, setMood] = useState('');

  // Contact 1-4 fields
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
  const [linkedGigIds, setLinkedGigIds] = useState([]);
  const [interestedShows, setInterestedShows] = useState([]);
  const [performedShows, setPerformedShows] = useState([]);
  const [isEditingShows, setIsEditingShows] = useState(false);
  const [allGigs, setAllGigs] = useState([]);
  const [gigSearchQuery, setGigSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [allContacts, setAllContacts] = useState([]);

  // States for email follow-up editing
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailText, setEmailText] = useState('');
  const [emailBcc, setEmailBcc] = useState('');
  const [emailRecipients, setEmailRecipients] = useState([]);
  const [emailAttachments, setEmailAttachments] = useState([]);
  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [isAddingAttachmentManual, setIsAddingAttachmentManual] = useState(false);

  const searchParams = useSearchParams();

  useEffect(() => {
    if (user && contactId) {
      loadData().then(() => {
        if (searchParams.get('edit') === '1') {
          setIsEditingContact(true);
        }
      });
    }
  }, [user, contactId]);

  const loadData = async () => {
    const c = await getContactById(contactId);
    setContact(c);
    setEntity(c?.entity || '');
    setMunicipality(c?.municipality || '');
    setProvince(c?.province || '');
    setStatus(c?.status || '');
    setFeedbackSummary(c?.feedbackSummary || '');
    setNotes(formatNotesWithLineBreaks(c?.notes || ''));
    setMood(c?.mood || '');

    const c1 = c?.contact1 || {};
    setC1Name(c1.name || c?.name || '');
    setC1Role(c1.role || '');
    setC1Email(c1.email || c?.email || '');
    setC1Phone(c1.phone || c?.phone || '');

    const c2 = c?.contact2 || {};
    setC2Name(c2.name || '');
    setC2Role(c2.role || '');
    setC2Email(c2.email || '');
    setC2Phone(c2.phone || '');

    const c3 = c?.contact3 || {};
    setC3Name(c3.name || '');
    setC3Role(c3.role || '');
    setC3Email(c3.email || '');
    setC3Phone(c3.phone || '');

    const c4 = c?.contact4 || {};
    setC4Name(c4.name || '');
    setC4Role(c4.role || '');
    setC4Email(c4.email || '');
    setC4Phone(c4.phone || '');
    
    const showMapping = {
      "cavernus": "Cavernus, una evolució musical",
      "cavernus, una evolució musica": "Cavernus, una evolució musical",
      "layla": "Layla, un viatge d'esperança",
      "concert duo": "Concert Duo Hemiòlia",
      "concert trio": "Concert Trio Hemiòlia",
      "el contacontes, un viatge d'esperança": "Layla, el contacontes",
      "layla, el contacontes, un viatge d'esperança": "Layla, el contacontes",
      "el contacontes": "Layla, el contacontes",
      "un viatge d'esperança": "Layla, un viatge d'esperança",
      "un viatge d’esperança": "Layla, un viatge d'esperança"
    };
    const normalizeShows = (showsArray) => {
      const uniqueNormalized = new Set();
      (showsArray || []).forEach(show => {
        const parts = show.includes(' i ') ? show.split(' i ') : (show.includes(' y ') ? show.split(' y ') : [show]);
        parts.forEach(part => {
          const clean = (part || '').trim().toLowerCase();
          if (!clean) return;
          const target = showMapping[clean] || part.trim();
          uniqueNormalized.add(target);
        });
      });
      return Array.from(uniqueNormalized);
    };

    setNextActionDate(c?.nextActionDate || '');
    setNextActionNotes(c?.nextActionNotes || '');
    setLinkedGigIds(c?.linkedGigIds || []);
    setInterestedShows(normalizeShows(c?.interestedShows));
    setPerformedShows(normalizeShows(c?.performedShows));

    const i = await getInteractionsByContact(contactId);
    setInteractions(i);
    const s = await getShows();
    setShows(s);
    const g = await getUpcomingGigs();
    setAllGigs(g);
    const allC = await getContacts();
    setAllContacts(allC);
  };

  const getSearchQuery = (showTitle) => {
    if (!contact) return '';
    if (showTitle) {
      const s = showTitle.toLowerCase();
      if (s.includes('concert duo')) return 'Concert duo';
      if (s.includes('concert trio')) return 'Concert trio';
      if (s.includes('layla') && s.includes('contacontes')) return 'contacontes';
      if (s.includes('layla')) return 'Layla';
      if (s.includes('cavernus')) return 'Cavernus';
      if (s.includes('nadal')) return 'Nadal';
      if (s.includes('silencis')) return 'Silencis';
      if (s.includes('marcel')) return 'Marcel';
      if (s.includes('leonardo')) return 'Leonardo';
      if (s.includes('simfonia')) return 'Simfonia';
      return showTitle;
    }
    const entityVal = (contact.entity || '').trim();
    const muniVal = (contact.municipality || '').trim();
    if (entityVal.toLowerCase().includes('biblioteques') && entityVal.toLowerCase().includes('ebre')) {
      return 'Biblioteca';
    }
    if (!entityVal || entityVal.toLowerCase() === 'ajuntament') {
      return muniVal;
    }
    return entityVal;
  };

  const getMatchingGigs = () => {
    if (!contact || !allGigs) return [];
    const entityLower = (contact.entity || '').toLowerCase().trim();
    const muniLower = (contact.municipality || '').toLowerCase().trim();
    const isEbreLibs = entityLower.includes('biblioteques') && entityLower.includes('ebre');

    return allGigs.filter(g => {
      const gigLocLower = (g.locationName || '').toLowerCase().trim();
      const gigMuniLower = (g.municipality || '').toLowerCase().trim();
      
      if (isEbreLibs) {
        const ebreTowns = ['tortosa', 'amposta', 'gandesa', "móra d'ebre", 'móra d’ebre', "l'aldea", 'l\'aldea'];
        const isLibrary = gigLocLower.includes('biblioteca') || gigLocLower.includes('biblioteques') || (g.title || '').toLowerCase().includes('biblioteca') || (g.title || '').toLowerCase().includes('biblioteques');
        const isEbreTown = ebreTowns.includes(gigMuniLower);
        return isLibrary && isEbreTown;
      }

      if (entityLower === 'ajuntament') {
        return gigMuniLower === muniLower;
      } else {
        const muniMatch = gigMuniLower === muniLower;
        const nameMatch = gigLocLower.includes(entityLower) || entityLower.includes(gigLocLower);
        return nameMatch && muniMatch;
      }
    });
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
    const linkedTitles = allGigs
      .filter(g => (linkedGigIds || []).includes(g.id))
      .map(g => g.title)
      .filter(Boolean);
    const updatedPerformedShows = Array.from(new Set(linkedTitles));

    await updateContact(contactId, {
      linkedGigIds,
      interestedShows,
      performedShows: updatedPerformedShows
    });
    setIsEditingShows(false);
    loadData();
  };

  const handleSaveContact = async (e) => {
    e.preventDefault();
    await updateContact(contactId, {
      entity,
      municipality,
      province,
      status,
      feedbackSummary,
      notes,
      mood,
      contact1: { name: c1Name, role: c1Role, email: c1Email, phone: c1Phone },
      contact2: { name: c2Name, role: c2Role, email: c2Email, phone: c2Phone },
      contact3: { name: c3Name, role: c3Role, email: c3Email, phone: c3Phone },
      contact4: { name: c4Name, role: c4Role, email: c4Email, phone: c4Phone }
    });
    setIsEditingContact(false);
    loadData();
  };

  const handleSaveMood = async (newMood) => {
    const updated = mood === newMood ? '' : newMood;
    setMood(updated);
    await updateContact(contactId, { mood: updated });
  };

  const handleAutoDetectMood = async () => {
    const detected = detectMoodFromNotes(notes, feedbackSummary);
    if (detected) {
      setMood(detected);
      await updateContact(contactId, { mood: detected });
    } else {
      alert('No s\'ha pogut detectar la valoració automàticament a partir de les notes. Tria-la manualment.');
    }
  };

  const handleToggleShow = (showTitle, listType) => {
    if (listType === 'interested') {
      setInterestedShows(prev => 
        prev.includes(showTitle) ? prev.filter(s => s !== showTitle) : [...prev, showTitle]
      );
    }
  };

  const handleAddAttachment = () => {
    if (!newAttachmentName.trim() || !newAttachmentUrl.trim()) {
      alert("Si us plau, omple el nom i l'enllaç del fitxer adjunt.");
      return;
    }
    setEmailAttachments(prev => [...prev, { name: newAttachmentName, url: newAttachmentUrl }]);
    setNewAttachmentName('');
    setNewAttachmentUrl('');
    setIsAddingAttachmentManual(false);
  };

  const handleRemoveAttachment = (idxToRemove) => {
    setEmailAttachments(prev => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const processFiles = (files) => {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Content = event.target.result.split(',')[1];
        setEmailAttachments(prev => {
          if (prev.some(a => a.name === file.name)) return prev;
          return [
            ...prev, 
            { 
              name: file.name, 
              content: base64Content, 
              encoding: 'base64', 
              isLocalFile: true 
            }
          ];
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveRecipient = (emailToRemove) => {
    setEmailRecipients(prev => prev.filter(e => e !== emailToRemove));
  };

  const handleSendEmail = () => {
    const emails = [];
    if (contact.email) emails.push(contact.email);
    if (contact.contact1?.email) emails.push(contact.contact1.email);
    if (contact.contact2?.email) emails.push(contact.contact2.email);
    if (contact.contact3?.email) emails.push(contact.contact3.email);
    if (contact.contact4?.email) emails.push(contact.contact4.email);
    
    const uniqueEmails = Array.from(new Set(emails.map(e => e.trim()).filter(Boolean)));
    if (uniqueEmails.length === 0) {
      return alert("Aquest contacte no té cap adreça de correu electrònic.");
    }

    const contactName = contact.contact1?.name || contact.name || contact.entity;
    
    // Set default values in local editor states
    setEmailSubject("Salutacions des d'Hemiòlia Produccions");
    setEmailText(`Hola ${contactName},\n\nEns posem en contacte amb tu per fer el seguiment de les nostres propostes per al vostre municipi (${contact.municipality || 'el vostre municipi'}).\n\nQualsevol cosa estem a la teva disposició.\n\nAtentament,\n\nPaula Martí i Jordi Bonilla\nHEMIÒLIA\n619579935 - 639966697`);
    setEmailBcc('');
    setEmailRecipients(uniqueEmails);
    setEmailAttachments([]);
    setNewAttachmentName('');
    setNewAttachmentUrl('');
    setIsAddingAttachmentManual(false);
    
    setIsEditingEmail(true);
  };

  const handleSendEditedEmail = async () => {
    if (emailRecipients.length === 0) {
      return alert("Si us plau, afegeix almenys un destinatari per poder enviar el correu.");
    }

    // Prepare attachments payload for Nodemailer
    const attachmentsPayload = emailAttachments.map(a => {
      if (a.isLocalFile) {
        return {
          filename: a.name,
          content: a.content,
          encoding: 'base64'
        };
      }
      return {
        filename: a.name.endsWith('.pdf') ? a.name : `${a.name}.pdf`,
        path: a.url
      };
    });

    try {
      const res = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailRecipients.join(', '),
          bcc: emailBcc,
          subject: emailSubject,
          text: emailText,
          attachments: attachmentsPayload
        })
      });

      if (res.ok) {
        alert("Correu enviat correctament!");
        setIsEditingEmail(false);
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
  const activeContact1 = contact.contact1 || { name: contact.name || 'Sense especificar', role: '', email: contact.email || '', phone: contact.phone || '' };
  const activeContact2 = contact.contact2 || {};
  const activeContact3 = contact.contact3 || {};
  const activeContact4 = contact.contact4 || {};

  const searchQuery = searchParams.get('search') || '';
  const filterProvince = searchParams.get('province') || 'Tots';
  const filterStatus = searchParams.get('status') || 'Tots';
  const filterShow = searchParams.get('show') || 'Tots';
  const filterReminder = searchParams.get('reminder') === '1';
  const filterPerformed = searchParams.get('performed') === '1';
  const aiParam = searchParams.get('ai');
  const aiFilteredIds = aiParam ? aiParam.split(',') : null;

  const filteredContacts = allContacts.filter(c => {
    const c1 = c.contact1 || { name: c.name, email: c.email, phone: c.phone, role: '' };
    const c2 = c.contact2 || {};
    const c3 = c.contact3 || {};
    const c4 = c.contact4 || {};

    const cleanQuery = normalizeText(searchQuery);
    const matchesSearch = 
      normalizeText(c.entity).includes(cleanQuery) ||
      normalizeText(c.municipality).includes(cleanQuery) ||
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
      normalizeText(c.notes).includes(cleanQuery) ||
      normalizeText(c.feedbackSummary).includes(cleanQuery) ||
      normalizeText(c.nextActionNotes).includes(cleanQuery);
      
    const matchesProvince = filterProvince === 'Tots' || (c.province || '') === filterProvince;
    const matchesStatus = filterStatus === 'Tots' || 
      (filterStatus === 'Sense estat' ? (!c.status || c.status === '') : c.status === filterStatus);
    
    const matchesShow = filterShow === 'Tots' || 
      (c.interestedShows && c.interestedShows.includes(filterShow)) ||
      (c.performedShows && c.performedShows.includes(filterShow));
      
    let matchesReminder = true;
    if (filterReminder) {
      const today = new Date().toISOString().split('T')[0];
      matchesReminder = c.nextActionDate && c.nextActionDate <= today;
    }

    let matchesPerformed = true;
    if (filterPerformed) {
      const actualPerformedShows = (c.performedShows || []).filter(s => 
        s && 
        s.trim() !== '' && 
        !['cap', 'cap espectacle', 'ningú', 'ningu', 'none', 'sense especificar', 'sense'].includes(s.trim().toLowerCase())
      );
      matchesPerformed = actualPerformedShows.length > 0;
    }

    let matchesAi = true;
    if (aiFilteredIds !== null) {
      matchesAi = aiFilteredIds.includes(c.id);
    }
    
    return matchesSearch && matchesProvince && matchesStatus && matchesShow && matchesReminder && matchesPerformed && matchesAi;
  });

  const currentIndex = filteredContacts.findIndex(c => c.id === contactId);
  const prevContact = currentIndex > 0 ? filteredContacts[currentIndex - 1] : null;
  const nextContact = currentIndex !== -1 && currentIndex < filteredContacts.length - 1 ? filteredContacts[currentIndex + 1] : null;

  const getNavigationUrl = (targetId) => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (filterProvince !== 'Tots') params.set('province', filterProvince);
    if (filterStatus !== 'Tots') params.set('status', filterStatus);
    if (filterShow !== 'Tots') params.set('show', filterShow);
    if (filterReminder) params.set('reminder', '1');
    if (filterPerformed) params.set('performed', '1');
    if (aiParam) params.set('ai', aiParam);
    const qs = params.toString();
    return `/dashboard/crm/${targetId}${qs ? '?' + qs : ''}`;
  };

  const getBackUrl = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (filterProvince !== 'Tots') params.set('province', filterProvince);
    if (filterStatus !== 'Tots') params.set('status', filterStatus);
    if (filterShow !== 'Tots') params.set('show', filterShow);
    if (filterReminder) params.set('reminder', '1');
    if (filterPerformed) params.set('performed', '1');
    if (aiParam) params.set('ai', aiParam);
    const qs = params.toString();
    return `/dashboard/crm${qs ? '?' + qs : ''}`;
  };

  const standardShows = [
    "Layla, un viatge d'esperança",
    "Layla, el contacontes",
    "Cavernus, una evolució musical",
    "Un Nadal Màgic",
    "Silencis Trencats",
    "Concert Duo Hemiòlia",
    "Concert Trio Hemiòlia",
    "Marcel, cartes des del front",
    "Simfonia Corporativa",
    "El petit Leonardo"
  ];

  const uniqueGigTitles = Array.from(new Set(allGigs.map(g => g.title).filter(Boolean))).sort();
  const allAvailableShows = Array.from(new Set([...standardShows, ...uniqueGigTitles])).sort();
  const matchingGigs = getMatchingGigs();

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="no-print">
          <Link href={getBackUrl()} className="btn-back" title="Tornar a CRM">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </Link>
          
          {filteredContacts.length > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginRight: '0.4rem' }}>
                {currentIndex + 1} de {filteredContacts.length}
              </span>
              <Link 
                href={prevContact ? getNavigationUrl(prevContact.id) : '#'} 
                className={`btn btn-glass ${!prevContact ? 'disabled' : ''}`}
                style={{ 
                  padding: '0.4rem 0.8rem', 
                  fontSize: '0.82rem', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.3rem',
                  textDecoration: 'none',
                  opacity: prevContact ? 1 : 0.35,
                  pointerEvents: prevContact ? 'auto' : 'none'
                }}
                title={prevContact ? `Anar a ${prevContact.entity || prevContact.name}` : ''}
              >
                ◀ Anterior
              </Link>
              <Link 
                href={nextContact ? getNavigationUrl(nextContact.id) : '#'} 
                className={`btn btn-glass ${!nextContact ? 'disabled' : ''}`}
                style={{ 
                  padding: '0.4rem 0.8rem', 
                  fontSize: '0.82rem', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.3rem',
                  textDecoration: 'none',
                  opacity: nextContact ? 1 : 0.35,
                  pointerEvents: nextContact ? 'auto' : 'none'
                }}
                title={nextContact ? `Anar a ${nextContact.entity || nextContact.name}` : ''}
              >
                Següent ▶
              </Link>
            </div>
          )}
        </div>
        <div className="glass-panel" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {isEditingContact ? (
            <form onSubmit={handleSaveContact} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="grid-2col-responsive" style={{ gap: '1rem' }}>
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
                    <option value="Sense estat">Sense estat</option>
                    <option value="Entrevista feta">Entrevista feta</option>
                    <option value="Instància feta">Instància feta</option>
                    <option value="Entrevista pendent">Entrevista pendent</option>
                    <option value="Entrevista rebutjada">Entrevista rebutjada</option>
                    <option value="Error / No possible">Error / No possible</option>
                  </select>
                </div>
              </div>

              {/* Edit Contacts Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.2rem' }}>
                {/* Contacte 1 */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <h4 style={{ color: 'var(--color-accent)', marginTop: 0, marginBottom: '0.8rem' }}>🟡 Contacte</h4>
                  <div className="input-group" style={{ marginBottom: '0.6rem' }}><label style={{ fontSize: '0.75rem' }}>Nom</label><input className="input-field" value={c1Name} onChange={e => setC1Name(e.target.value)} required /></div>
                  <div className="input-group" style={{ marginBottom: '0.6rem' }}><label style={{ fontSize: '0.75rem' }}>Càrrec</label><input className="input-field" value={c1Role} onChange={e => setC1Role(e.target.value)} /></div>
                  <div className="input-group" style={{ marginBottom: '0.6rem' }}><label style={{ fontSize: '0.75rem' }}>Correu</label><input type="email" className="input-field" value={c1Email} onChange={e => setC1Email(e.target.value)} /></div>
                  <div className="input-group" style={{ marginBottom: 0 }}><label style={{ fontSize: '0.75rem' }}>Telèfon</label><input className="input-field" value={c1Phone} onChange={e => setC1Phone(e.target.value)} /></div>
                </div>
                {/* Contacte 2 */}
                <div style={{ background: 'rgba(255,255,255,0.01)', padding: '1rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <h4 style={{ color: 'rgba(255,255,255,0.7)', marginTop: 0, marginBottom: '0.8rem' }}>👤 Contacte 2</h4>
                  <div className="input-group" style={{ marginBottom: '0.6rem' }}><label style={{ fontSize: '0.75rem' }}>Nom</label><input className="input-field" value={c2Name} onChange={e => setC2Name(e.target.value)} /></div>
                  <div className="input-group" style={{ marginBottom: '0.6rem' }}><label style={{ fontSize: '0.75rem' }}>Càrrec</label><input className="input-field" value={c2Role} onChange={e => setC2Role(e.target.value)} /></div>
                  <div className="input-group" style={{ marginBottom: '0.6rem' }}><label style={{ fontSize: '0.75rem' }}>Correu</label><input type="email" className="input-field" value={c2Email} onChange={e => setC2Email(e.target.value)} /></div>
                  <div className="input-group" style={{ marginBottom: 0 }}><label style={{ fontSize: '0.75rem' }}>Telèfon</label><input className="input-field" value={c2Phone} onChange={e => setC2Phone(e.target.value)} /></div>
                </div>
                {/* Contacte 3 */}
                <div style={{ background: 'rgba(255,255,255,0.01)', padding: '1rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <h4 style={{ color: 'rgba(255,255,255,0.7)', marginTop: 0, marginBottom: '0.8rem' }}>👤 Contacte 3</h4>
                  <div className="input-group" style={{ marginBottom: '0.6rem' }}><label style={{ fontSize: '0.75rem' }}>Nom</label><input className="input-field" value={c3Name} onChange={e => setC3Name(e.target.value)} /></div>
                  <div className="input-group" style={{ marginBottom: '0.6rem' }}><label style={{ fontSize: '0.75rem' }}>Càrrec</label><input className="input-field" value={c3Role} onChange={e => setC3Role(e.target.value)} /></div>
                  <div className="input-group" style={{ marginBottom: '0.6rem' }}><label style={{ fontSize: '0.75rem' }}>Correu</label><input type="email" className="input-field" value={c3Email} onChange={e => setC3Email(e.target.value)} /></div>
                  <div className="input-group" style={{ marginBottom: 0 }}><label style={{ fontSize: '0.75rem' }}>Telèfon</label><input className="input-field" value={c3Phone} onChange={e => setC3Phone(e.target.value)} /></div>
                </div>
                {/* Contacte 4 */}
                <div style={{ background: 'rgba(255,255,255,0.01)', padding: '1rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <h4 style={{ color: 'rgba(255,255,255,0.7)', marginTop: 0, marginBottom: '0.8rem' }}>👤 Contacte 4</h4>
                  <div className="input-group" style={{ marginBottom: '0.6rem' }}><label style={{ fontSize: '0.75rem' }}>Nom</label><input className="input-field" value={c4Name} onChange={e => setC4Name(e.target.value)} /></div>
                  <div className="input-group" style={{ marginBottom: '0.6rem' }}><label style={{ fontSize: '0.75rem' }}>Càrrec</label><input className="input-field" value={c4Role} onChange={e => setC4Role(e.target.value)} /></div>
                  <div className="input-group" style={{ marginBottom: '0.6rem' }}><label style={{ fontSize: '0.75rem' }}>Correu</label><input type="email" className="input-field" value={c4Email} onChange={e => setC4Email(e.target.value)} /></div>
                  <div className="input-group" style={{ marginBottom: 0 }}><label style={{ fontSize: '0.75rem' }}>Telèfon</label><input className="input-field" value={c4Phone} onChange={e => setC4Phone(e.target.value)} /></div>
                </div>
              </div>


              <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                <label>Historial inicial</label>
                <textarea className="input-field" rows="6" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes i resum de trucades o converses..." />
              </div>
              {/* Valoració de l'entrevista (dins edició) */}
              {status === 'Entrevista feta' && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', fontWeight: '500' }}>Valoració:</span>
                  {MOODS.map(m => {
                    const isSelected = mood === m.key;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        title={m.label}
                        onClick={() => handleSaveMood(m.key)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          background: isSelected ? m.bg : 'transparent',
                          border: isSelected ? `2px solid ${m.color}` : '2px solid transparent',
                          borderRadius: '20px',
                          padding: '0.2rem 0.5rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          opacity: mood && !isSelected ? 0.35 : 1,
                          transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                        }}
                      >
                        <MoodIcon moodKey={m.key} size={20} />
                        {isSelected && (
                          <span style={{ fontSize: '0.72rem', fontWeight: '600', color: m.color, whiteSpace: 'nowrap' }}>{m.label}</span>
                        )}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={handleAutoDetectMood}
                    className="btn btn-glass"
                    title="Detecta la valoració automàticament a partir de les notes"
                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', marginLeft: '0.15rem' }}
                  >
                    🤖 Auto
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary">Desar Fitxa</button>
                <button type="button" className="btn btn-glass" onClick={() => { setIsEditingContact(false); loadData(); }}>Cancel·lar</button>
              </div>
            </form>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h1 style={{ marginBottom: '0.5rem', color: 'var(--color-accent)', marginTop: 0 }}>
                    {(() => {
                      if (!activeContact1.name) return '';
                      if (activeContact1.name.toLowerCase().includes('ajuntament')) {
                        return activeContact1.name;
                      }
                      const parts = activeContact1.name.trim().split(/\s+/);
                      if (parts.length >= 3) {
                        const composites = ['maria', 'm.', 'mª', 'angels', 'àngels', 'lluisa', 'lluïsa', 'ramon', 'joan', 'josep', 'josefina', 'antoni', 'francisco'];
                        if (composites.includes(parts[1].toLowerCase()) && parts.length >= 4) {
                          return parts.slice(0, 3).join(' ');
                        }
                        return parts.slice(0, 2).join(' ');
                      }
                      return activeContact1.name;
                    })()}
                  </h1>
                  <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <strong>{contact.entity}</strong> | {contact.municipality}
                    {contact.province && <span>({contact.province})</span>}
                    {contact.status && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={getStatusBadgeStyle(contact.status)}>
                          {contact.status}
                        </span>
                        {contact.status === 'Entrevista feta' && contact.mood && (
                          <span title={MOODS.find(m2 => m2.key === contact.mood)?.label} style={{ display: 'inline-flex', alignItems: 'center' }}>
                            <MoodIcon moodKey={contact.mood} size={20} />
                          </span>
                        )}
                      </span>
                    )}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {activeContact1.email && (isAdmin || isCrm) && (
                    <button 
                      className="btn btn-glass" 
                      onClick={handleSendEmail} 
                      style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                    >
                      ✉️ Enviar Correu de Seguiment
                    </button>
                  )}
                  {(isAdmin || isCrm) && (
                    <button 
                      className="btn btn-glass" 
                      onClick={() => setIsEditingContact(true)} 
                      style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                    >
                      ✏️ Editar Dades
                    </button>
                  )}
                </div>
              </div>
              
              {/* Display Contacts Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                {/* Contact Card 1 */}
                <div style={{ background: 'rgba(255, 183, 3, 0.04)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255, 183, 3, 0.15)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-accent)', textTransform: 'uppercase' }}>🟡 Contacte</span>
                  <div style={{ fontWeight: '600', fontSize: '1rem' }}>{activeContact1.name}</div>
                  {activeContact1.role && <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>💼 {activeContact1.role}</div>}
                  {activeContact1.email && <div style={{ fontSize: '0.85rem' }}>📧 <a href={`mailto:${activeContact1.email}`} style={{ color: 'inherit', textDecoration: 'underline' }}>{activeContact1.email}</a></div>}
                  {activeContact1.phone && <div style={{ fontSize: '0.85rem' }}>📞 <a href={`tel:${activeContact1.phone}`} style={{ color: 'inherit', textDecoration: 'underline' }}>{activeContact1.phone}</a></div>}
                </div>

                {/* Contact Card 2 */}
                {(activeContact2.name || activeContact2.email || activeContact2.phone) && (
                  <div style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>👤 Contacte 2</span>
                    <div style={{ fontWeight: '600', fontSize: '1rem' }}>{activeContact2.name || 'Sense nom'}</div>
                    {activeContact2.role && <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>💼 {activeContact2.role}</div>}
                    {activeContact2.email && <div style={{ fontSize: '0.85rem' }}>📧 <a href={`mailto:${activeContact2.email}`} style={{ color: 'inherit', textDecoration: 'underline' }}>{activeContact2.email}</a></div>}
                    {activeContact2.phone && <div style={{ fontSize: '0.85rem' }}>📞 <a href={`tel:${activeContact2.phone}`} style={{ color: 'inherit', textDecoration: 'underline' }}>{activeContact2.phone}</a></div>}
                  </div>
                )}

                {/* Contact Card 3 */}
                {(activeContact3.name || activeContact3.email || activeContact3.phone) && (
                  <div style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>👤 Contacte 3</span>
                    <div style={{ fontWeight: '600', fontSize: '1rem' }}>{activeContact3.name || 'Sense nom'}</div>
                    {activeContact3.role && <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>💼 {activeContact3.role}</div>}
                    {activeContact3.email && <div style={{ fontSize: '0.85rem' }}>📧 <a href={`mailto:${activeContact3.email}`} style={{ color: 'inherit', textDecoration: 'underline' }}>{activeContact3.email}</a></div>}
                    {activeContact3.phone && <div style={{ fontSize: '0.85rem' }}>📞 <a href={`tel:${activeContact3.phone}`} style={{ color: 'inherit', textDecoration: 'underline' }}>{activeContact3.phone}</a></div>}
                  </div>
                )}

                {/* Contact Card 4 */}
                {(activeContact4.name || activeContact4.email || activeContact4.phone) && (
                  <div style={{ background: 'rgba(255, 255, 255, 0.01)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>👤 Contacte 4</span>
                    <div style={{ fontWeight: '600', fontSize: '1rem' }}>{activeContact4.name || 'Sense nom'}</div>
                    {activeContact4.role && <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>💼 {activeContact4.role}</div>}
                    {activeContact4.email && <div style={{ fontSize: '0.85rem' }}>📧 <a href={`mailto:${activeContact4.email}`} style={{ color: 'inherit', textDecoration: 'underline' }}>{activeContact4.email}</a></div>}
                    {activeContact4.phone && <div style={{ fontSize: '0.85rem' }}>📞 <a href={`tel:${activeContact4.phone}`} style={{ color: 'inherit', textDecoration: 'underline' }}>{activeContact4.phone}</a></div>}
                  </div>
                )}
              </div>

              {/* Historial inicial */}
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
                  <strong style={{ color: 'var(--color-text-primary)' }}>Historial inicial:</strong>
                  <p style={{ margin: '0.4rem 0 0 0', whiteSpace: 'pre-wrap', color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>
                    {(() => {
                      const parts = formatNotesWithLineBreaks(contact.notes).split(/(\b\d{2}\/\d{2}\/\d{2,4}\b)/g);
                      return parts.map((part, index) => {
                        const isDate = /^\d{2}\/\d{2}\/\d{2,4}$/.test(part);
                        if (isDate) {
                          return <span key={index} style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>{part}</span>;
                        }
                        return part;
                      });
                    })()}
                  </p>
                </div>
              )}
            </>
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
                    <button type="button" className="btn btn-glass" onClick={() => { setIsEditingReminder(false); loadData(); }} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Cancel·lar</button>
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
              🎭 Espectacles
            </h3>
            
            {isEditingShows ? (() => {
              const suggestedGigs = getMatchingGigs();
              const suggestedIds = new Set(suggestedGigs.map(m => m.id));
              const linkedGigs = allGigs.filter(g => (linkedGigIds || []).includes(g.id)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
              
              const filteredGigsToLink = allGigs.filter(g => {
                const q = normalizeText(gigSearchQuery);
                return !q || 
                  normalizeText(g.title).includes(q) || 
                  normalizeText(g.locationName).includes(q) || 
                  normalizeText(g.municipality).includes(q);
              });
              
              const sortedGigsToLink = [...filteredGigsToLink].sort((a, b) => {
                const aSuggested = suggestedIds.has(a.id) ? 1 : 0;
                const bSuggested = suggestedIds.has(b.id) ? 1 : 0;
                if (aSuggested !== bSuggested) return bSuggested - aSuggested;
                return (b.date || '').localeCompare(a.date || '');
              });

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div>
                    <h4 style={{ fontSize: '0.82rem', marginBottom: '0.4rem', color: 'var(--color-accent)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.2rem' }}>Vincula bolos (Road-sheet)</h4>
                    
                    {/* Linked gigs as chips */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.8rem', minHeight: '30px' }}>
                      {linkedGigs.map(g => (
                        <span 
                          key={g.id} 
                          style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '0.3rem', 
                            padding: '0.25rem 0.55rem', 
                            background: 'rgba(46, 196, 182, 0.12)', 
                            border: '1px solid rgba(46, 196, 182, 0.25)', 
                            borderRadius: '16px', 
                            color: '#2ec4b6', 
                            fontSize: '0.74rem',
                            fontWeight: '600',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          📅 {formatDateDDMMYYYY(g.date)} - {g.title} ({g.locationName && g.municipality && g.locationName !== g.municipality ? `${g.municipality} (${g.locationName})` : (g.municipality || g.locationName || '')})
                          <button 
                            type="button" 
                            onClick={() => setLinkedGigIds(prev => prev.filter(id => id !== g.id))}
                            style={{ 
                              border: 'none', 
                              background: 'transparent', 
                              color: '#ff6b6b', 
                              cursor: 'pointer', 
                              padding: '0 0.1rem', 
                              fontSize: '0.85rem',
                              fontWeight: 'bold', 
                              display: 'inline-flex', 
                              alignItems: 'center'
                            }}
                            title="Desvincular"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                      {linkedGigs.length === 0 && (
                        <span style={{ fontStyle: 'italic', opacity: 0.5, fontSize: '0.78rem', paddingTop: '0.2rem' }}>Cap bolo vinculat</span>
                      )}
                    </div>

                    {/* Autocomplete search input & dropdown list */}
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="text" 
                        placeholder="🔍 Cerca i afegeix bolos per data, municipi o títol..." 
                        value={gigSearchQuery}
                        onChange={e => setGigSearchQuery(e.target.value)}
                        onFocus={() => setIsDropdownOpen(true)}
                        onBlur={() => {
                          // Delay slightly to allow click events on items to fire first
                          setTimeout(() => setIsDropdownOpen(false), 200);
                        }}
                        className="input-field"
                        style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem', width: '100%', display: 'block', marginBottom: '0.2rem' }}
                      />
                      {/* Dropdown panel, only show when active/focused */}
                      {isDropdownOpen && (
                        <div style={{ 
                          position: 'absolute', 
                          top: '100%', 
                          left: 0, 
                          width: 'max-content',
                          minWidth: '100%',
                          maxWidth: '650px',
                          backgroundColor: 'var(--color-background-soft)', 
                          border: '1px solid var(--color-border)', 
                          borderRadius: 'var(--radius-md)', 
                          zIndex: 100, 
                          maxHeight: '350px', 
                          overflowY: 'auto', 
                          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                          backdropFilter: 'blur(12px)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1px',
                          padding: '0.3rem'
                        }}>
                        {sortedGigsToLink.filter(g => !linkedGigIds.includes(g.id)).map(g => {
                          const isSuggested = suggestedIds.has(g.id);
                          return (
                            <div 
                              key={g.id} 
                              style={{ 
                                padding: '0.45rem 0.55rem', 
                                cursor: 'pointer', 
                                borderRadius: '4px',
                                fontSize: '0.78rem',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '0.5rem',
                                background: isSuggested ? 'rgba(255, 183, 3, 0.03)' : 'transparent',
                                border: isSuggested ? '1px solid rgba(255, 183, 3, 0.1)' : '1px solid transparent',
                              }}
                              onClick={() => {
                                const duplicateShowGig = allGigs.find(linked => 
                                  linkedGigIds.includes(linked.id) && 
                                  linked.title === g.title
                                );
                                if (duplicateShowGig) {
                                  const confirmAdd = window.confirm(
                                    `Avís (Vincula bolos): Ja hi ha un bolo vinculat de l'espectacle "${g.title}" (del dia ${formatDateDDMMYYYY(duplicateShowGig.date)}). Vols vincular aquest nou bolo del mateix espectacle de totes maneres?`
                                  );
                                  if (!confirmAdd) return;
                                }
                                setLinkedGigIds(prev => [...prev, g.id]);
                                setGigSearchQuery('');
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.backgroundColor = isSuggested ? 'rgba(255, 183, 3, 0.03)' : 'transparent';
                                e.currentTarget.style.borderColor = isSuggested ? 'rgba(255, 183, 3, 0.1)' : 'transparent';
                              }}
                            >
                              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                📅 {formatDateDDMMYYYY(g.date)} - {g.title} ({g.locationName && g.municipality && g.locationName !== g.municipality ? `${g.municipality} (${g.locationName})` : (g.municipality || g.locationName || '')})
                              </span>
                              {isSuggested && <span style={{ fontSize: '0.65rem', color: '#ffb703', fontWeight: 'bold', background: 'rgba(255, 183, 3, 0.08)', padding: '0.05rem 0.25rem', borderRadius: '3px', whiteSpace: 'nowrap' }}>💡 Sugerit</span>}
                            </div>
                          );
                        })}
                        {sortedGigsToLink.filter(g => !linkedGigIds.includes(g.id)).length === 0 && (
                          <div style={{ padding: '0.6rem', fontSize: '0.78rem', color: 'var(--color-text-secondary)', textAlign: 'center', fontStyle: 'italic' }}>
                            Cap bolo disponible per vincular
                          </div>
                        )}
                      </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h4 style={{ fontSize: '0.82rem', marginBottom: '0.5rem', color: 'var(--color-accent)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.2rem' }}>Interessats / Oferts</h4>
                    
                    {/* Selected interested shows as chips */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.8rem', minHeight: '30px' }}>
                      {interestedShows.map(s => (
                        <span 
                          key={s} 
                          style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '0.3rem', 
                            padding: '0.25rem 0.55rem', 
                            background: 'rgba(255, 183, 3, 0.12)', 
                            border: '1px solid rgba(255, 183, 3, 0.25)', 
                            borderRadius: '16px', 
                            color: '#ffb703', 
                            fontSize: '0.74rem',
                            fontWeight: '600',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {s}
                          <button 
                            type="button" 
                            onClick={() => setInterestedShows(prev => prev.filter(item => item !== s))}
                            style={{ 
                              border: 'none', 
                              background: 'transparent', 
                              color: '#ff6b6b', 
                              cursor: 'pointer', 
                              padding: '0 0.1rem', 
                              fontSize: '0.85rem',
                              fontWeight: 'bold', 
                              display: 'inline-flex', 
                              alignItems: 'center'
                            }}
                            title="Eliminar"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                      {interestedShows.length === 0 && (
                        <span style={{ fontStyle: 'italic', opacity: 0.5, fontSize: '0.78rem', paddingTop: '0.2rem' }}>Cap espectacle d'interès afegit</span>
                      )}
                    </div>

                    {/* Dropdown select to add show */}
                    <div style={{ maxWidth: '400px' }}>
                      <select
                        value=""
                        onChange={e => {
                          const val = e.target.value;
                          if (val && !interestedShows.includes(val)) {
                            setInterestedShows(prev => [...prev, val]);
                          }
                        }}
                        className="input-field"
                        style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem', width: '100%', display: 'block' }}
                      >
                        <option value="" disabled>➕ Afegeix un espectacle a la llista d'interès...</option>
                        {standardShows.filter(s => !interestedShows.includes(s)).map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })() : (() => {
              const linkedGigs = allGigs.filter(g => (linkedGigIds || []).includes(g.id)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
              
              const showMapping = {
                "cavernus": "Cavernus, una evolució musical",
                "cavernus, una evolució musica": "Cavernus, una evolució musical",
                "layla": "Layla, un viatge d'esperança",
                "concert duo": "Concert Duo Hemiòlia",
                "concert trio": "Concert Trio Hemiòlia",
                "el contacontes, un viatge d'esperança": "Layla, el contacontes",
                "layla, el contacontes, un viatge d'esperança": "Layla, el contacontes",
                "el contacontes": "Layla, el contacontes",
                "un viatge d'esperança": "Layla, un viatge d'esperança",
                "un viatge d’esperança": "Layla, un viatge d'esperança"
              };
              const getNormalizedShowName = (t) => {
                const clean = (t || '')
                  .trim()
                  .toLowerCase()
                  .replace(/’/g, "'")
                  .replace(/\s*-\s*estrena/g, '')
                  .replace(/\s*\(estrena\)/g, '')
                  .replace(/\s*\(.*?\)/g, '')
                  .trim();
                return showMapping[clean] || clean;
              };
               const getReturnUrl = () => {
                const params = new URLSearchParams();
                if (searchQuery) params.set('search', searchQuery);
                if (filterProvince !== 'Tots') params.set('province', filterProvince);
                if (filterStatus !== 'Tots') params.set('status', filterStatus);
                if (filterShow !== 'Tots') params.set('show', filterShow);
                if (filterReminder) params.set('reminder', '1');
                const qs = params.toString();
                return `/dashboard/crm/${contactId}${qs ? '?' + qs : ''}`;
              };

              return (
                <div style={{ marginBottom: '1.2rem', fontSize: '0.92rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--color-text-primary)' }}>Espectacles realitzats:</strong>
                    
                    {/* Linked Gigs from Road-sheet */}
                    {linkedGigs.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.6rem' }}>
                        {linkedGigs.map(g => (
                          <div key={g.id} style={{ fontSize: '0.82rem', padding: '0.4rem', background: 'rgba(46, 196, 182, 0.05)', borderRadius: '4px', border: '1px solid rgba(46, 196, 182, 0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>📅 {formatDateDDMMYYYY(g.date)} - <strong>{g.title}</strong></span>
                            <Link href={`/dashboard/road-sheet?q=${encodeURIComponent(g.municipality || g.locationName || '')}&highlight=${g.id}&returnTo=${encodeURIComponent(getReturnUrl())}`} style={{ color: '#2ec4b6', textDecoration: 'none', fontWeight: 'bold', fontSize: '1.1rem' }} title="Obrir bolo al road-sheet">🚐</Link>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', fontStyle: 'italic' }}>Cap espectacle registrat</span>
                    )}
                  </div>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '0.3rem', color: 'var(--color-text-primary)' }}>Espectacles d'interès:</strong>
                    {interestedShows.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {interestedShows.map(s => (
                          <span 
                            key={s} 
                            style={{ 
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              background: 'rgba(255, 183, 3, 0.12)', 
                              color: '#ffb703', 
                              padding: '0.2rem 0.55rem', 
                              borderRadius: '3px', 
                              fontSize: '0.78rem', 
                              fontWeight: 'bold', 
                              border: '1px solid rgba(255, 183, 3, 0.2)' 
                            }}
                          >
                            {s}
                            <button
                              type="button"
                              onClick={async () => {
                                const newInterested = interestedShows.filter(item => item !== s);
                                await updateContact(contactId, { interestedShows: newInterested });
                                loadData();
                              }}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#ffb703',
                                cursor: 'pointer',
                                padding: '0 0.1rem',
                                fontSize: '0.9rem',
                                fontWeight: 'bold',
                                opacity: 0.6,
                                display: 'inline-flex',
                                alignItems: 'center',
                                transition: 'opacity 0.2s'
                              }}
                              onMouseEnter={e => e.currentTarget.style.opacity = 1}
                              onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
                              title="Eliminar"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', fontStyle: 'italic' }}>Cap interès o proposta pendent</span>
                    )}
                  </div>
                </div>
              );
            })()}
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
                <option value="Concert Duo Hemiòlia" />
                <option value="Concert Trio Hemiòlia" />
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

      {/* Modal d'edició i enviament de correu de seguiment */}
      {isEditingEmail && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(5px)'
        }}>
          <div className="glass-panel" style={{
            width: '90%',
            maxWidth: '600px',
            padding: '2rem',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
            border: '1px solid var(--color-accent)'
          }}>
            <h3 style={{ color: 'var(--color-accent)', marginBottom: '1.5rem' }}>✉️ Redactar Correu de Seguiment</h3>
            
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label>Destinataris ({emailRecipients.length})</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--color-border)', minHeight: '38px', alignItems: 'center' }}>
                {emailRecipients.map((email, idx) => (
                  <span key={idx} style={{ 
                    fontSize: '0.75rem', 
                    padding: '0.2rem 0.5rem', 
                    background: 'rgba(255, 255, 255, 0.05)', 
                    border: '1px solid rgba(255, 255, 255, 0.1)', 
                    borderRadius: '4px',
                    color: 'var(--color-accent)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}>
                    📧 {email}
                    <button 
                      type="button" 
                      onClick={() => handleRemoveRecipient(email)}
                      style={{ 
                        background: 'transparent', 
                        border: 'none', 
                        color: '#ff6b6b', 
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '0.8rem',
                        padding: '0 2px',
                        lineHeight: '1'
                      }}
                      title="Eliminar destinatari"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
            
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label>Còpia oculta (CCO / BCC)</label>
              <input 
                className="input-field" 
                type="text" 
                placeholder="Exemple: info@hemiolia.cat, jordi@example.com"
                value={emailBcc} 
                onChange={e => setEmailBcc(e.target.value)} 
              />
            </div>
            
            <div className="input-group" style={{ marginBottom: '1.5rem' }}>
              <label>Assumpte</label>
              <input 
                className="input-field" 
                type="text" 
                value={emailSubject} 
                onChange={e => setEmailSubject(e.target.value)} 
                required
              />
            </div>
            
            <div className="input-group" style={{ marginBottom: '1.5rem' }}>
              <label>Missatge</label>
              <textarea 
                className="input-field" 
                rows="8" 
                value={emailText} 
                onChange={e => setEmailText(e.target.value)} 
                required
                style={{ fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>

            {/* Attachment manager */}
            <div 
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              style={{ 
                background: 'rgba(0,0,0,0.3)', 
                padding: '1rem', 
                borderRadius: '8px', 
                border: '1px dashed var(--color-accent)',
                marginBottom: '1.5rem'
              }}
              title="Arrossega i deixa anar fitxers aquí per adjuntar-los"
            >
              <strong style={{ fontSize: '0.82rem', display: 'block', marginBottom: '0.6rem', color: 'var(--color-text-primary)' }}>
                📎 Fitxers adjunts ({emailAttachments.length}):
              </strong>
              
              {emailAttachments.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '0.5rem 0' }}>
                  Cap fitxer adjunt. Arrossega fitxers aquí o penja'ls.
                </p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
                  {emailAttachments.map((att, idx) => (
                    <span key={idx} style={{ 
                      fontSize: '0.72rem', 
                      padding: '0.2rem 0.5rem', 
                      background: 'rgba(58, 134, 200, 0.1)', 
                      border: '1px solid rgba(58, 134, 200, 0.25)', 
                      borderRadius: '4px',
                      color: '#60a5fa',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}>
                      📄 {att.name}
                      <button 
                        type="button" 
                        onClick={() => handleRemoveAttachment(idx)}
                        style={{ 
                          background: 'transparent', 
                          border: 'none', 
                          color: '#ff6b6b', 
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: '0.75rem',
                          padding: '0 2px'
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Add manual attachment dropdown/form */}
              {isAddingAttachmentManual ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.8rem', borderRadius: '6px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="Nom del fitxer (ex: Dossier Silencis)" 
                      value={newAttachmentName}
                      onChange={e => setNewAttachmentName(e.target.value)}
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                    />
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="Enllaç al fitxer (URL)" 
                      value={newAttachmentUrl}
                      onChange={e => setNewAttachmentUrl(e.target.value)}
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-glass" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} onClick={() => setIsAddingAttachmentManual(false)}>Cancel·lar</button>
                    <button type="button" className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} onClick={handleAddAttachment}>Afegir</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button 
                    type="button" 
                    className="btn btn-glass" 
                    onClick={() => document.getElementById('local-file-uploader').click()}
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                  >
                    📁 Pujar Fitxer Local
                  </button>
                  <input 
                    type="file" 
                    id="local-file-uploader" 
                    style={{ display: 'none' }} 
                    onChange={handleFileSelect} 
                    multiple
                  />
                  <button 
                    type="button" 
                    className="btn btn-glass" 
                    onClick={() => setIsAddingAttachmentManual(true)}
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                  >
                    ➕ Adjuntar Enllaç Manual
                  </button>
                  
                  {/* Predefined show list attachments shortcuts */}
                  <select 
                    onChange={e => {
                      if (e.target.value) {
                        const selected = JSON.parse(e.target.value);
                        setEmailAttachments(prev => {
                          if (prev.some(a => a.url === selected.url)) return prev;
                          return [...prev, selected];
                        });
                        e.target.value = "";
                      }
                    }}
                    className="input-field"
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', width: 'auto', flex: 1, minWidth: '150px', background: 'var(--color-background-input)', color: 'var(--color-text-primary)' }}
                  >
                    <option value="">📂 Adjuntar Dossier Oficial...</option>
                    {/* Layla, un viatge d'esperança */}
                    <optgroup label="Layla, un viatge d'esperança">
                      <option value={JSON.stringify({ name: 'Layla - +Info (CAT)', url: 'https://hemiolia.cat/+%20INFO%20ESPECTACLE/LAYLA_+INFO_CAT.pdf' })}>Layla - +Info (CAT)</option>
                      <option value={JSON.stringify({ name: 'Layla - +Info (ES)', url: 'https://hemiolia.cat/+%20INFO%20ESPECTACLE/LAYLA_+INFO_CAS.pdf' })}>Layla - +Info (ES)</option>
                      <option value={JSON.stringify({ name: 'Layla - +Info (EN)', url: 'https://hemiolia.cat/+%20INFO%20ESPECTACLE/LAYLA_+INFO_EN.pdf' })}>Layla - +Info (EN)</option>
                    </optgroup>
                    
                    {/* Layla, el contacontes */}
                    <optgroup label="Layla, el contacontes">
                      <option value={JSON.stringify({ name: 'Layla Contacontes - +Info (CAT)', url: 'https://hemiolia.cat/+%20INFO%20ESPECTACLE/LAYLA_CONTACONTES_+INFO_CAT.pdf' })}>Contacontes - +Info (CAT)</option>
                      <option value={JSON.stringify({ name: 'Layla Contacontes - Dossier Pedagògic', url: 'https://hemiolia.cat/DOSSIER%20PEDAGO%CC%80GIC/LAYLA_CONTACONTES%20-%20Dossier%20Pedago%CC%80gic.pdf' })}>Contacontes - Dossier Pedagògic</option>
                      <option value={JSON.stringify({ name: 'Layla Contacontes - Guia Docent', url: 'https://hemiolia.cat/GUIA%20DOCENT/LAYLA_CONTACONTES%20-%20Guia%20docent.pdf' })}>Contacontes - Guia Docent</option>
                    </optgroup>

                    {/* Cavernus */}
                    <optgroup label="Cavernus, una evolució musical">
                      <option value={JSON.stringify({ name: 'Cavernus - +Info (CAT)', url: 'https://hemiolia.cat/+%20INFO%20ESPECTACLE/CAVERNUS_+INFO_CAT.pdf' })}>Cavernus - +Info (CAT)</option>
                      <option value={JSON.stringify({ name: 'Cavernus - Dossier Pedagògic', url: 'https://hemiolia.cat/DOSSIER%20PEDAGO%CC%80GIC/CAVERNUS%20-%20Dossier%20Pedago%CC%80gic.pdf' })}>Cavernus - Dossier Pedagògic</option>
                      <option value={JSON.stringify({ name: 'Cavernus - Guia Docent', url: 'https://hemiolia.cat/GUIA%20DOCENT/CAVERNUS%20-%20Guia%20docent.pdf' })}>Cavernus - Guia Docent</option>
                    </optgroup>

                    {/* Un Nadal Màgic */}
                    <optgroup label="Un Nadal Màgic">
                      <option value={JSON.stringify({ name: 'Un Nadal Màgic - +Info (CAT)', url: 'https://hemiolia.cat/+%20INFO%20ESPECTACLE/UN_NADAL_MAGIC_+INFO_CAT.pdf' })}>Nadal Màgic - +Info (CAT)</option>
                      <option value={JSON.stringify({ name: 'Un Nadal Màgic - Dossier Pedagògic', url: 'https://hemiolia.cat/DOSSIER%20PEDAGO%CC%80GIC/UN_NADAL_MA%CC%80GIC%20-%20Dossier%20Pedago%CC%80gic.pdf' })}>Nadal Màgic - Dossier Pedagògic</option>
                      <option value={JSON.stringify({ name: 'Un Nadal Màgic - Guia Docent', url: 'https://hemiolia.cat/GUIA%20DOCENT/UN_NADAL_MA%CC%80GIC%20-%20Guia%20docent.pdf' })}>Nadal Màgic - Guia Docent</option>
                    </optgroup>

                    {/* Silencis Trencats */}
                    <optgroup label="Silencis Trencats">
                      <option value={JSON.stringify({ name: 'Silencis Trencats - +Info (CAT)', url: 'https://hemiolia.cat/+%20INFO%20ESPECTACLE/SILENCIS%20TRENCATS%20-%20+INFO_CAT-1.pdf' })}>Silencis Trencats - +Info (CAT)</option>
                    </optgroup>
                  </select>
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="btn btn-glass" 
                onClick={() => setIsEditingEmail(false)}
              >
                Cancel·lar
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleSendEditedEmail}
              >
                Enviar Correu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
