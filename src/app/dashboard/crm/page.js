'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../lib/AuthContext';
import { getContacts, addContact, deleteContact, updateContact, addInteraction } from '../../../lib/firestoreUtils';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { normalizeText } from '../../../lib/utils';
import { auth } from '../../../lib/firebase';

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
  const highlightId = searchParams.get('highlight');
  const [contacts, setContacts] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingContactId, setEditingContactId] = useState(null);
  const [justEditedId, setJustEditedId] = useState(null);
  
  // Form state
  const [entity, setEntity] = useState(''); // Teatre o Ajuntament
  const [municipality, setMunicipality] = useState('');
  const [province, setProvince] = useState('');
  const [status, setStatus] = useState('');

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
  const [filterPerformed, setFilterPerformed] = useState(() => searchParams.get('performed') === '1');

  // AI Filter states
  const [aiQuery, setAiQuery] = useState(() => searchParams.get('aiQuery') || '');
  const [isAiFiltering, setIsAiFiltering] = useState(false);
  const [aiFilteredIds, setAiFilteredIds] = useState(() => {
    const ai = searchParams.get('ai');
    return ai ? ai.split(',') : null;
  });

  // AI Campaign states
  const [isAiCampaignOpen, setIsAiCampaignOpen] = useState(false);
  const [aiCampaignPrompt, setAiCampaignPrompt] = useState('');
  const [isGeneratingAiCampaign, setIsGeneratingAiCampaign] = useState(false);
  const [aiCampaignSubject, setAiCampaignSubject] = useState('');
  const [aiCampaignBody, setAiCampaignBody] = useState('');
  const [aiCampaignRecipients, setAiCampaignRecipients] = useState([]);
  const [aiCampaignStep, setAiCampaignStep] = useState('prompt'); // 'prompt' | 'review'
  const [isSendingAiCampaign, setIsSendingAiCampaign] = useState(false);
  const [aiCampaignProgress, setAiCampaignProgress] = useState(0);
  const [addRecipientSearch, setAddRecipientSearch] = useState('');
  const [isAddRecipientDropdownOpen, setIsAddRecipientDropdownOpen] = useState(false);
  
  // AI Campaign Attachments
  const [aiCampaignAttachments, setAiCampaignAttachments] = useState([]);
  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [isAddingAttachmentManual, setIsAddingAttachmentManual] = useState(false);
  const [aiCampaignIncludeOtherContacts, setAiCampaignIncludeOtherContacts] = useState(false);

  // Sincronitza els filtres amb la URL (silent replace, sense recàrrega)
  const updateUrl = useCallback((sq, fp, fs, fsh, fr, fprm, aiQ, aiIds) => {
    const params = new URLSearchParams();
    if (sq) params.set('search', sq);
    if (fp && fp !== 'Tots') params.set('province', fp);
    if (fs && fs !== 'Tots') params.set('status', fs);
    if (fsh && fsh !== 'Tots') params.set('show', fsh);
    if (fr) params.set('reminder', '1');
    if (fprm) params.set('performed', '1');
    if (aiQ) params.set('aiQuery', aiQ);
    if (aiIds) params.set('ai', aiIds);
    const qs = params.toString();
    router.replace(`/dashboard/crm${qs ? '?' + qs : ''}`, { scroll: false });
  }, [router]);

  const loadContacts = async () => {
    const data = await getContacts();
    setContacts(data);
  };

  useEffect(() => {
    if (user) {
      loadContacts();
    }
  }, [user]);

  useEffect(() => {
    if (highlightId && contacts.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`contact-row-${highlightId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }, [highlightId, contacts]);

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
    let targetId = editingContactId;
    if (editingContactId) {
      await updateContact(editingContactId, contactData);
    } else {
      const docRef = await addContact({
        ...contactData,
        performedShows: [],
        interestedShows: [],
        feedbackSummary: '',
        notes: '',
        nextActionDate: '',
        nextActionNotes: ''
      });
      if (docRef && docRef.id) targetId = docRef.id;
    }
    setIsAdding(false);
    resetForm();
    await loadContacts();

    if (targetId) {
      setJustEditedId(targetId);
      setTimeout(() => {
        const el = document.getElementById(`contact-row-${targetId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);
      setTimeout(() => {
        setJustEditedId(null);
      }, 3000);
    }
  };

  const resetForm = () => {
    setEditingContactId(null);
    setEntity(''); setMunicipality(''); setProvince(''); setStatus('');
    setC1Name(''); setC1Role(''); setC1Email(''); setC1Phone('');
    setC2Name(''); setC2Role(''); setC2Email(''); setC2Phone('');
    setC3Name(''); setC3Role(''); setC3Email(''); setC3Phone('');
    setC4Name(''); setC4Role(''); setC4Email(''); setC4Phone('');
  };

  const handleOpenAiCampaignModal = () => {
    setIsAiCampaignOpen(true);
    setAiCampaignStep('prompt');
    setAiCampaignPrompt('');
    setAiCampaignSubject('');
    setAiCampaignBody('');
    setAiCampaignRecipients([]);
    setAiCampaignAttachments([]);
    setNewAttachmentName('');
    setNewAttachmentUrl('');
    setIsAddingAttachmentManual(false);
    setIsGeneratingAiCampaign(false);
    setIsSendingAiCampaign(false);
    setAiCampaignProgress(0);
    setAddRecipientSearch('');
    setAiCampaignIncludeOtherContacts(false);
  };

  const processAiCampaignFiles = (files) => {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Content = event.target.result.split(',')[1];
        setAiCampaignAttachments(prev => {
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

  const handleAiCampaignFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processAiCampaignFiles(e.target.files);
    }
  };

  const handleGenerateAiCampaign = async (e) => {
    e.preventDefault();
    if (!aiCampaignPrompt.trim()) return alert("Si us plau, indica a la IA el contingut o instruccions del correu.");

    setIsGeneratingAiCampaign(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/crm/ai-campaign', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userPrompt: aiCampaignPrompt,
          contacts
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error de la IA");
      }

      const data = await res.json();
      
      // Filter list of contacts using matchedContactIds
      const matchedContacts = contacts.filter(c => 
        data.matchedContactIds.includes(c.id) && (c.contact1?.email || c.email)
      );

      // Format and append default signature if missing
      let bodyText = data.body || '';
      const signatureText = "Atentament,\n\nHEMIÒLIA\nPaula Martí i Jordi Bonilla\n619579935 - 639966697";
      const hasSignature = /HEMIÒ?LIA\s*\n\s*Paula\s+Martí?\s+i\s+Jordi\s+Bonilla/i.test(bodyText);
      if (!hasSignature) {
        bodyText = bodyText.trim() + "\n\n" + signatureText;
      }

      const recipientsList = [];
      matchedContacts.forEach(c => {
        const emails = [];
        const primaryEmail = c.contact1?.email || c.email;
        if (primaryEmail) {
          emails.push({
            email: primaryEmail,
            name: c.contact1?.name || c.name || c.entity
          });
        }

        if (aiCampaignIncludeOtherContacts) {
          if (c.contact2?.email) emails.push({ email: c.contact2.email, name: c.contact2.name || c.entity });
          if (c.contact3?.email) emails.push({ email: c.contact3.email, name: c.contact3.name || c.entity });
          if (c.contact4?.email) emails.push({ email: c.contact4.email, name: c.contact4.name || c.entity });
        }

        // Deduplicate unique emails for this contact
        const uniqueEmailsForContact = [];
        emails.forEach(item => {
          if (!uniqueEmailsForContact.some(x => x.email.trim().toLowerCase() === item.email.trim().toLowerCase())) {
            uniqueEmailsForContact.push(item);
          }
        });

        uniqueEmailsForContact.forEach((item, idx) => {
          recipientsList.push({
            id: `${c.id}-${idx}-${item.email}`,
            contactId: c.id,
            entity: c.entity || c.municipality || 'municipi',
            contactName: item.name,
            email: item.email.trim()
          });
        });
      });

      setAiCampaignSubject(data.subject);
      setAiCampaignBody(bodyText);
      setAiCampaignRecipients(recipientsList);
      setAiCampaignAttachments(data.suggestedAttachments || []);
      setAiCampaignStep('review');
    } catch (err) {
      console.error(err);
      alert("Error al generar la campanya: " + err.message);
    } finally {
      setIsGeneratingAiCampaign(false);
    }
  };

  const handleRemoveRecipient = (id) => {
    setAiCampaignRecipients(prev => prev.filter(c => c.id !== id));
  };

  const handleAddRecipient = (contactToAdd) => {
    const emails = [];
    const primaryEmail = contactToAdd.contact1?.email || contactToAdd.email;
    if (primaryEmail) {
      emails.push({
        email: primaryEmail,
        name: contactToAdd.contact1?.name || contactToAdd.name || contactToAdd.entity
      });
    }
    
    if (aiCampaignIncludeOtherContacts) {
      if (contactToAdd.contact2?.email) emails.push({ email: contactToAdd.contact2.email, name: contactToAdd.contact2.name || contactToAdd.entity });
      if (contactToAdd.contact3?.email) emails.push({ email: contactToAdd.contact3.email, name: contactToAdd.contact3.name || contactToAdd.entity });
      if (contactToAdd.contact4?.email) emails.push({ email: contactToAdd.contact4.email, name: contactToAdd.contact4.name || contactToAdd.entity });
    }
    
    const newRecipients = [];
    emails.forEach((item, idx) => {
      const recId = `${contactToAdd.id}-${idx}-${item.email}`;
      if (!aiCampaignRecipients.some(r => r.email.toLowerCase() === item.email.toLowerCase())) {
        newRecipients.push({
          id: recId,
          contactId: contactToAdd.id,
          entity: contactToAdd.entity || contactToAdd.municipality || 'municipi',
          contactName: item.name,
          email: item.email.trim()
        });
      }
    });
    
    if (newRecipients.length === 0) {
      alert("Aquest correu o contactes ja estan afegits.");
      return;
    }
    
    setAiCampaignRecipients(prev => [...prev, ...newRecipients]);
    setIsAddRecipientDropdownOpen(false);
    setAddRecipientSearch('');
  };

  const handleAddAttachment = () => {
    if (!newAttachmentName.trim() || !newAttachmentUrl.trim()) {
      alert("Si us plau, omple el nom i l'enllaç del fitxer adjunt.");
      return;
    }
    setAiCampaignAttachments(prev => [...prev, { name: newAttachmentName, url: newAttachmentUrl }]);
    setNewAttachmentName('');
    setNewAttachmentUrl('');
    setIsAddingAttachmentManual(false);
  };

  const handleRemoveAttachment = (idxToRemove) => {
    setAiCampaignAttachments(prev => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const handleSendAiCampaign = async () => {
    if (aiCampaignRecipients.length === 0) {
      return alert("No hi ha cap destinatari a la llista.");
    }
    if (!confirm(`Es procedirà a enviar ${aiCampaignRecipients.length} correus electrònics individuals. Vols continuar?`)) return;

    setIsSendingAiCampaign(true);
    setAiCampaignProgress(0);

    // Prepare attachments payload for Nodemailer
    const attachmentsPayload = aiCampaignAttachments.map(a => {
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

    let sentCount = 0;
    for (let i = 0; i < aiCampaignRecipients.length; i++) {
      const r = aiCampaignRecipients[i];
      const email = r.email;
      const contactName = r.contactName || r.entity;

      // Replace variables
      const personalizedBody = aiCampaignBody
        .replace(/{nom}/g, contactName)
        .replace(/{entitat}/g, r.entity || 'municipi');

      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch('/api/emails/send', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            to: email,
            subject: aiCampaignSubject,
            text: personalizedBody,
            attachments: attachmentsPayload
          })
        });

        if (res.ok) {
          sentCount++;
          await addInteraction({
            contactId: r.contactId,
            date: new Date().toISOString().split('T')[0],
            showId: 'Campanya IA',
            interestLevel: 3,
            technicalFeedback: `Assumpte: ${aiCampaignSubject}`,
            otherInterests: `Correu de campanya enviat per IA a: ${email}.\n\nFitxers adjunts: ${aiCampaignAttachments.length > 0 ? aiCampaignAttachments.map(a => a.name).join(', ') : 'cap'}`
          });
        }
      } catch (err) {
        console.error(`Error enviant campanya IA a ${email}:`, err);
      }

      setAiCampaignProgress(Math.round(((i + 1) / aiCampaignRecipients.length) * 100));
    }

    setIsSendingAiCampaign(false);
    setIsAiCampaignOpen(false);
    alert(`Campanya finalitzada. S'han enviat correctament ${sentCount} de ${aiCampaignRecipients.length} correus.`);
  };

  const handleEditClick = (contact) => {
    setEditingContactId(contact.id);
    setEntity(contact.entity || '');
    setMunicipality(contact.municipality || '');
    setProvince(contact.province || '');
    setStatus(contact.status || '');
    
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    setFilterPerformed(false);
    setAiQuery('');
    setAiFilteredIds(null);
    router.replace('/dashboard/crm', { scroll: false });
  };

  const handleAiFilter = async () => {
    if (!aiQuery.trim()) return;
    setIsAiFiltering(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/crm/ai-filter', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query: aiQuery, contacts })
      });
      if (res.ok) {
        const data = await res.json();
        const matched = data.matchedIds || [];
        setAiFilteredIds(matched);
        updateUrl(searchQuery, filterProvince, filterStatus, filterShow, filterReminder, filterPerformed, aiQuery, matched.join(','));
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || "Error en la cerca intel·ligent.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de connexió en fer la cerca.");
    } finally {
      setIsAiFiltering(false);
    }
  };

  const handleClearAiFilter = () => {
    setAiQuery('');
    setAiFilteredIds(null);
    updateUrl(searchQuery, filterProvince, filterStatus, filterShow, filterReminder, filterPerformed, '', '');
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
      (filterStatus === 'Sense estat' ? (!contact.status || contact.status === '' || contact.status === 'Sense estat') : contact.status === filterStatus);
    
    const matchesShow = filterShow === 'Tots' || 
      (contact.interestedShows && contact.interestedShows.includes(filterShow)) ||
      (contact.performedShows && contact.performedShows.includes(filterShow));
      
    let matchesReminder = true;
    if (filterReminder) {
      const today = new Date().toISOString().split('T')[0];
      matchesReminder = contact.nextActionDate && contact.nextActionDate <= today;
    }
    
    let matchesPerformed = true;
    if (filterPerformed) {
      const actualPerformedShows = (contact.performedShows || []).filter(s => 
        s && 
        s.trim() !== '' && 
        !['cap', 'cap espectacle', 'ningú', 'ningu', 'none', 'sense especificar', 'sense'].includes(s.trim().toLowerCase())
      );
      matchesPerformed = actualPerformedShows.length > 0;
    }
    let matchesAi = true;
    if (aiFilteredIds !== null) {
      matchesAi = aiFilteredIds.includes(contact.id);
    }
    
    return matchesSearch && matchesProvince && matchesStatus && matchesShow && matchesReminder && matchesPerformed && matchesAi;
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
            Contactes <span style={{ fontSize: '1.2rem', color: 'var(--color-text-secondary)', marginLeft: '0.5rem', fontWeight: 'normal' }}>({filteredContacts.length})</span>
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn btn-glass no-print" onClick={() => window.print()} title="Imprimir llista filtrada">
            🖨️ Imprimir
          </button>
          {(isAdmin || isCrm) && (
            <button className="btn btn-glass no-print" onClick={handleOpenAiCampaignModal} title="Redactar i filtrar una campanya de correus fent servir la IA">
              ✨ Campanya IA
            </button>
          )}
          {(isAdmin || isCrm) && (
            <button className="btn btn-primary no-print" onClick={() => {
              const nextVal = !isAdding;
              setIsAdding(nextVal);
              if (!nextVal) resetForm();
              else window.scrollTo({ top: 0, behavior: 'smooth' });
            }}>
              {isAdding ? 'Cancel·lar' : '+ Nou Contacte'}
            </button>
          )}
        </div>
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
                  <option value="Sense estat">Sense estat</option>
                  <option value="Entrevista feta">Entrevista feta</option>
                  <option value="Instància feta">Instància feta</option>
                  <option value="Entrevista pendent">Entrevista pendent</option>
                  <option value="Entrevista rebutjada">Entrevista rebutjada</option>
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

      {/* Resum de filtratge per a la impressió */}
      <div className="print-only" style={{ 
        marginBottom: '1.2rem', 
        padding: '0.8rem 1rem', 
        border: '1px solid #000000', 
        borderRadius: '6px', 
        backgroundColor: '#f8fafc',
        fontSize: '0.75rem',
        color: '#000000'
      }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#000000', borderBottom: '1px solid #000000', paddingBottom: '0.2rem', fontWeight: 'bold' }}>
          Llista de Contactes (CRM) - Filtres Aplicats
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.3rem 1rem' }}>
          {searchQuery && (
            <div><strong>Cerca de text:</strong> "{searchQuery}"</div>
          )}
          {filterProvince !== 'Tots' && (
            <div><strong>Província:</strong> {filterProvince}</div>
          )}
          {filterStatus !== 'Tots' && (
            <div><strong>Estat:</strong> {filterStatus}</div>
          )}
          {filterShow !== 'Tots' && (
            <div><strong>Espectacle vinculat:</strong> {filterShow}</div>
          )}
          {filterReminder && (
            <div><strong>Recordatoris:</strong> Només pendents</div>
          )}
          {filterPerformed && (
            <div><strong>Espectacles:</strong> Només amb espectacles representats</div>
          )}
          {aiQuery && (
            <div><strong>Cerca IA:</strong> "{aiQuery}"</div>
          )}
          {!searchQuery && filterProvince === 'Tots' && filterStatus === 'Tots' && filterShow === 'Tots' && !filterReminder && !filterPerformed && !aiQuery && (
            <div>Sense filtres actius (es mostra la llista completa).</div>
          )}
        </div>
        <div style={{ marginTop: '0.6rem', fontSize: '0.68rem', color: '#555555', textAlign: 'right', borderTop: '1px dotted #cccccc', paddingTop: '0.3rem' }}>
          Generat el: {new Date().toLocaleDateString('ca-ES')} a les {new Date().toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' })} | Total registres filtrats: <strong>{filteredContacts.length}</strong>
        </div>
      </div>

      {/* Filtres */}
      <div className="glass-panel no-print" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ margin: 0, color: 'var(--color-accent)' }}>🔍 Filtres i Cerca</h4>
          {(searchQuery || filterProvince !== 'Tots' || filterStatus !== 'Tots' || filterShow !== 'Tots' || filterReminder || filterPerformed) && (
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
              onChange={e => { setSearchQuery(e.target.value); updateUrl(e.target.value, filterProvince, filterStatus, filterShow, filterReminder, filterPerformed, aiQuery, aiFilteredIds ? aiFilteredIds.join(',') : ''); }} 
            />
          </div>
          
          <div className="input-group" style={{ margin: 0 }}>
            <label>Província / Regió</label>
            <select 
              className="input-field" 
              value={filterProvince} 
              onChange={e => { setFilterProvince(e.target.value); updateUrl(searchQuery, e.target.value, filterStatus, filterShow, filterReminder, filterPerformed, aiQuery, aiFilteredIds ? aiFilteredIds.join(',') : ''); }}
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
              onChange={e => { setFilterStatus(e.target.value); updateUrl(searchQuery, filterProvince, e.target.value, filterShow, filterReminder, filterPerformed, aiQuery, aiFilteredIds ? aiFilteredIds.join(',') : ''); }}
              style={{ background: 'var(--color-background-input)', color: 'var(--color-text-primary)' }}
            >
              <option value="Tots">Tots els estats</option>
              <option value="Sense estat">Sense estat</option>
              <option value="Entrevista feta">Entrevista feta</option>
              <option value="Instància feta">Instància feta</option>
              <option value="Entrevista pendent">Entrevista pendent</option>
              <option value="Entrevista rebutjada">Entrevista rebutjada</option>
              <option value="Error / No possible">Error / No possible</option>
            </select>
          </div>
          
          <div className="input-group" style={{ margin: 0 }}>
            <label>Espectacle d'Interès</label>
            <select 
              className="input-field" 
              value={filterShow} 
              onChange={e => { setFilterShow(e.target.value); updateUrl(searchQuery, filterProvince, filterStatus, e.target.value, filterReminder, filterPerformed, aiQuery, aiFilteredIds ? aiFilteredIds.join(',') : ''); }}
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
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1.2rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}>
              <input 
                type="checkbox" 
                checked={filterReminder} 
                onChange={e => { setFilterReminder(e.target.checked); updateUrl(searchQuery, filterProvince, filterStatus, filterShow, e.target.checked, filterPerformed, aiQuery, aiFilteredIds ? aiFilteredIds.join(',') : ''); }} 
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ color: filterReminder ? 'var(--color-accent)' : 'var(--color-text-primary)', fontWeight: filterReminder ? 'bold' : 'normal' }}>
                🔔 Recordatoris actius
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}>
              <input 
                type="checkbox" 
                checked={filterPerformed} 
                onChange={e => { setFilterPerformed(e.target.checked); updateUrl(searchQuery, filterProvince, filterStatus, filterShow, filterReminder, e.target.checked, aiQuery, aiFilteredIds ? aiFilteredIds.join(',') : ''); }} 
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ color: filterPerformed ? 'var(--color-accent)' : 'var(--color-text-primary)', fontWeight: filterPerformed ? 'bold' : 'normal' }}>
                🎭 Espectacles fets
              </span>
            </label>
          </div>

          {/* AI Filter section */}
          <div className="input-group" style={{ margin: 0, gridColumn: '1 / -1', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem', marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-accent)', fontWeight: 'bold' }}>
              <span>🤖 Cerca Intel·ligent amb IA</span>
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input 
                className="input-field" 
                placeholder="Ex: llistam aquelles entrevistes fetes on hagi agradat l'espectacle cavernus..." 
                value={aiQuery} 
                onChange={e => setAiQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAiFilter(); }}
                style={{ flex: 1, minWidth: '280px' }}
              />
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleAiFilter}
                disabled={isAiFiltering}
                style={{ whiteSpace: 'nowrap', padding: '0.5rem 1.2rem' }}
              >
                {isAiFiltering ? '🤖 Cercant...' : 'Cercar'}
              </button>
              {aiFilteredIds !== null && (
                <button 
                  type="button" 
                  className="btn btn-glass" 
                  onClick={handleClearAiFilter}
                  style={{ color: '#ff6b6b', borderColor: 'rgba(255,107,107,0.3)', whiteSpace: 'nowrap' }}
                >
                  Netejar Cerca IA
                </button>
              )}
            </div>
            {aiFilteredIds !== null && (
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '0.4rem' }}>
                ✨ S'han trobat {filteredContacts.length} entitats coincidents amb la cerca intel·ligent.
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .contact-highlight-row {
          border: 2px solid var(--color-accent) !important;
          background-color: rgba(212, 175, 55, 0.15) !important;
          box-shadow: 0 0 25px rgba(255, 183, 3, 0.45) !important;
        }
      `}</style>

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
                <th style={{ padding: '1rem' }} className="no-print">Accions</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map(contact => {
                const today = new Date().toISOString().split('T')[0];
                const hasOverdueReminder = contact.nextActionDate && contact.nextActionDate <= today;
                const contact1 = contact.contact1 || { name: contact.name || 'Sense especificar', role: '' };
                const actualPerformedShows = (contact.performedShows || []).filter(s => 
                  s && 
                  s.trim() !== '' && 
                  !['cap', 'cap espectacle', 'ningú', 'ningu', 'none', 'sense especificar', 'sense'].includes(s.trim().toLowerCase())
                );
                const isHighlighted = highlightId === contact.id || justEditedId === contact.id;
                
                return (
                  <tr 
                    id={`contact-row-${contact.id}`}
                    key={contact.id} 
                    className={isHighlighted ? 'contact-highlight-row' : ''}
                    style={{ 
                      borderBottom: isHighlighted ? '2px solid var(--color-accent)' : '1px solid rgba(255,255,255,0.05)',
                      backgroundColor: isHighlighted ? 'rgba(212, 175, 55, 0.15)' : undefined,
                      boxShadow: isHighlighted ? '0 0 25px rgba(255, 183, 3, 0.45)' : undefined,
                      transition: 'all 0.3s ease-in-out'
                    }}
                  >
                    <td data-label="Entitat" style={{ padding: '1rem', fontWeight: 'bold' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>{contact.entity}</span>
                        {actualPerformedShows.length > 0 && (() => {
                          const numGigs = contact.linkedGigIds && contact.linkedGigIds.length > 0 
                            ? contact.linkedGigIds.length 
                            : actualPerformedShows.length;
                          return (
                            <span 
                              title={`Espectacles realitzats (${numGigs}): ${actualPerformedShows.join(', ')}`}
                              style={{ 
                                cursor: 'pointer', 
                                fontSize: '1rem', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '0.2rem' 
                              }}
                            >
                              <span>🎭</span>
                              <span style={{ fontSize: '0.72rem', opacity: 0.8, color: 'var(--color-accent)', fontWeight: 'bold' }}>
                                {numGigs}
                              </span>
                            </span>
                          );
                        })()}
                      </div>
                    </td>
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
                    <td data-label="Accions" style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }} className="no-print">
                      <Link 
                        href={`/dashboard/crm/${contact.id}${
                          (() => {
                            const params = new URLSearchParams();
                            if (searchQuery) params.set('search', searchQuery);
                            if (filterProvince !== 'Tots') params.set('province', filterProvince);
                            if (filterStatus !== 'Tots') params.set('status', filterStatus);
                            if (filterShow !== 'Tots') params.set('show', filterShow);
                            if (filterReminder) params.set('reminder', '1');
                            if (filterPerformed) params.set('performed', '1');
                            if (aiFilteredIds !== null) params.set('ai', aiFilteredIds.join(','));
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
                          <button 
                            onClick={() => handleEditClick(contact)} 
                            className="btn btn-glass" 
                            style={{ padding: '0.4rem 0.8rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)' }} 
                            title="Editar Contacte"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                              <path d="m15 5 4 4"></path>
                            </svg>
                          </button>
                          <button 
                            onClick={() => handleRemoveContact(contact.id, contact.entity || contact.name)} 
                            className="btn btn-glass" 
                            style={{ padding: '0.4rem 0.8rem', color: '#ff6b6b', borderColor: '#ff6b6b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} 
                            title="Esborrar Contacte"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              <line x1="10" y1="11" x2="10" y2="17"></line>
                              <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
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

      {/* Modal de Campanya de Correus amb IA */}
      {isAiCampaignOpen && (
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
          <div className="glass-panel animate-fade-in-up" style={{
            width: '90%',
            maxWidth: '650px',
            padding: '2rem',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
            border: '1px solid var(--color-accent)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ color: 'var(--color-accent)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ✨ Campanya de Correus amb IA
            </h3>

            {aiCampaignStep === 'prompt' ? (
              <form onSubmit={handleGenerateAiCampaign}>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
                  Descriu què vols enviar i a qui. La IA redactarà el correu i seleccionarà els contactes de la base de dades automàticament.
                </p>

                <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                  <label>Instruccions per a la IA</label>
                  <textarea 
                    className="input-field" 
                    rows="5" 
                    placeholder="Exemple: Vull enviar una felicitació de Nadal a tots els contactes de Girona que estiguin en estat 'Entrevista feta' i hagin contractat 'Cavernus'. Agraeix la seva col·laboració i ofereix-los un descompte." 
                    value={aiCampaignPrompt} 
                    onChange={e => setAiCampaignPrompt(e.target.value)}
                    disabled={isGeneratingAiCampaign}
                    required
                    style={{ fontFamily: 'inherit', resize: 'vertical' }}
                  />
                </div>

                <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="ai-campaign-prompt-include-other-contacts"
                    checked={aiCampaignIncludeOtherContacts}
                    onChange={e => setAiCampaignIncludeOtherContacts(e.target.checked)}
                    disabled={isGeneratingAiCampaign}
                    style={{ width: 'auto', margin: 0, cursor: 'pointer' }}
                  />
                  <label htmlFor="ai-campaign-prompt-include-other-contacts" style={{ fontSize: '0.82rem', cursor: 'pointer', userSelect: 'none', color: 'var(--color-text-primary)', margin: 0 }}>
                    Incloure els correus secundaris (Contacte 2, 3 i 4) de cada fitxa a la llista de destinataris
                  </label>
                </div>

                {isGeneratingAiCampaign && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-accent)', marginBottom: '1.5rem', fontWeight: 'bold' }}>
                    🔄 La IA està analitzant els contactes i escrivint el correu, espera un moment...
                  </p>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button 
                    type="button" 
                    className="btn btn-glass" 
                    onClick={() => setIsAiCampaignOpen(false)}
                    disabled={isGeneratingAiCampaign}
                  >
                    Cancel·lar
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={isGeneratingAiCampaign}
                  >
                    {isGeneratingAiCampaign ? 'Generant...' : 'Generar Campanya'}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '1.2rem' }}>
                  Revisa el contingut del correu i gestiona els destinataris abans d'iniciar l'enviament massiu.
                </p>

                <div className="input-group" style={{ marginBottom: '1.2rem' }}>
                  <label>Assumpte del Correu</label>
                  <input 
                    className="input-field" 
                    type="text" 
                    value={aiCampaignSubject} 
                    onChange={e => setAiCampaignSubject(e.target.value)} 
                    disabled={isSendingAiCampaign}
                    required
                  />
                </div>

                <div className="input-group" style={{ marginBottom: '0.5rem' }}>
                  <label>Plantilla del Missatge</label>
                  <textarea 
                    className="input-field" 
                    rows="8" 
                    value={aiCampaignBody} 
                    onChange={e => setAiCampaignBody(e.target.value)} 
                    disabled={isSendingAiCampaign}
                    required
                    style={{ fontFamily: 'inherit', resize: 'vertical' }}
                  />
                </div>
                
                <p style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem', fontStyle: 'italic' }}>
                  Pots utilitzar les etiquetes <strong>{"{nom}"}</strong> per al nom del contacte, i <strong>{"{entitat}"}</strong> per al nom de l'entitat. Es reemplaçaran dinàmicament per a cada destinatari.
                </p>

                {/* Attachment manager */}
                <div style={{ 
                  background: 'rgba(0,0,0,0.3)', 
                  padding: '1rem', 
                  borderRadius: '8px', 
                  border: '1px solid var(--color-border)',
                  marginBottom: '1.5rem'
                }}>
                  <strong style={{ fontSize: '0.82rem', display: 'block', marginBottom: '0.6rem', color: 'var(--color-text-primary)' }}>
                    📎 Fitxers adjunts ({aiCampaignAttachments.length}):
                  </strong>
                  
                  {aiCampaignAttachments.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '0.5rem 0' }}>
                      Cap fitxer adjunt.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
                      {aiCampaignAttachments.map((att, idx) => (
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
                            disabled={isSendingAiCampaign}
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

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-glass"
                        onClick={() => document.getElementById('ai-campaign-file-uploader').click()}
                        disabled={isSendingAiCampaign}
                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                      >
                        📁 Pujar Fitxer Local
                      </button>
                      <input
                        type="file"
                        id="ai-campaign-file-uploader"
                        style={{ display: 'none' }}
                        onChange={handleAiCampaignFileSelect}
                        multiple
                      />
                      
                      {/* Predefined show list attachments shortcuts */}
                      <select 
                        onChange={e => {
                          if (e.target.value) {
                            const selected = JSON.parse(e.target.value);
                            setAiCampaignAttachments(prev => {
                              if (prev.some(a => a.url === selected.url)) return prev;
                              return [...prev, selected];
                            });
                            e.target.value = "";
                          }
                        }}
                        disabled={isSendingAiCampaign}
                        className="input-field"
                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', width: 'auto', flex: 1, minWidth: '150px' }}
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
                </div>

                {/* Recipient manager */}
                <div style={{ 
                  background: 'rgba(0,0,0,0.3)', 
                  padding: '1rem', 
                  borderRadius: '8px', 
                  border: '1px solid var(--color-border)',
                  marginBottom: '1.5rem'
                }}>
                  <strong style={{ fontSize: '0.82rem', display: 'block', marginBottom: '0.6rem', color: 'var(--color-text-primary)' }}>
                    Destinataris seleccionats ({aiCampaignRecipients.length}):
                  </strong>
                  
                  {aiCampaignRecipients.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-error)', margin: '0.5rem 0' }}>
                      No hi ha cap destinatari seleccionat per enviar.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '130px', overflowY: 'auto', marginBottom: '1rem', paddingRight: '0.2rem' }}>
                      {aiCampaignRecipients.map(r => (
                        <span key={r.id} style={{ 
                          fontSize: '0.72rem', 
                          padding: '0.15rem 0.4rem', 
                          background: 'rgba(212, 175, 55, 0.1)', 
                          border: '1px solid rgba(212, 175, 55, 0.25)', 
                          borderRadius: '4px',
                          color: 'var(--color-accent)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}>
                          {r.entity} {r.contactName ? `- ${r.contactName} ` : ''}({r.email})
                          <button 
                            type="button" 
                            onClick={() => handleRemoveRecipient(r.id)}
                            disabled={isSendingAiCampaign}
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

                  {/* Add manual recipient dropdown */}
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="🔍 Cerca i afegeix un altre contacte..." 
                      value={addRecipientSearch}
                      onChange={e => {
                        setAddRecipientSearch(e.target.value);
                        setIsAddRecipientDropdownOpen(e.target.value.trim().length > 0);
                      }}
                      disabled={isSendingAiCampaign}
                      style={{ fontSize: '0.8rem', padding: '0.5rem 0.8rem' }}
                    />
                    
                    {isAddRecipientDropdownOpen && (
                      <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: 0,
                        width: '100%',
                        background: '#121216',
                        border: '1px solid var(--color-accent)',
                        borderRadius: '8px',
                        zIndex: 1100,
                        maxHeight: '150px',
                        overflowY: 'auto',
                        boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
                        marginBottom: '4px'
                      }}>
                        {contacts
                          .filter(c => {
                            const name = (c.entity || '') + ' ' + (c.municipality || '') + ' ' + (c.contact1?.name || c.name || '');
                            return name.toLowerCase().includes(addRecipientSearch.toLowerCase()) && 
                                   !aiCampaignRecipients.some(existing => existing.id === c.id);
                          })
                          .slice(0, 10)
                          .map(c => (
                            <div 
                              key={c.id} 
                              onClick={() => handleAddRecipient(c)}
                              style={{
                                padding: '0.5rem 0.8rem',
                                cursor: 'pointer',
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                fontSize: '0.8rem',
                                color: '#ffffff',
                                textAlign: 'left'
                              }}
                              onMouseEnter={e => e.target.style.background = 'rgba(212, 175, 55, 0.15)'}
                              onMouseLeave={e => e.target.style.background = 'transparent'}
                            >
                              <strong>{c.entity}</strong> - {c.municipality} ({c.contact1?.email || c.email || 'sense email'})
                            </div>
                          ))
                        }
                        {contacts.filter(c => {
                          const name = (c.entity || '') + ' ' + (c.municipality || '') + ' ' + (c.contact1?.name || c.name || '');
                          return name.toLowerCase().includes(addRecipientSearch.toLowerCase()) && 
                                 !aiCampaignRecipients.some(existing => existing.id === c.id);
                        }).length === 0 && (
                          <div style={{ padding: '0.5rem 0.8rem', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                            Cap contacte trobat
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {isSendingAiCampaign && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                      <span>S'estan enviant els correus de la campanya...</span>
                      <strong>{aiCampaignProgress}%</strong>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${aiCampaignProgress}%`, height: '100%', background: 'var(--color-accent)', transition: 'width 0.2s ease' }} />
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between' }}>
                  <button 
                    type="button" 
                    className="btn btn-glass" 
                    onClick={() => setAiCampaignStep('prompt')}
                    disabled={isSendingAiCampaign}
                  >
                    ⬅️ Tornar
                  </button>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      type="button" 
                      className="btn btn-glass" 
                      onClick={() => setIsAiCampaignOpen(false)}
                      disabled={isSendingAiCampaign}
                    >
                      Tancar
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      onClick={handleSendAiCampaign}
                      disabled={isSendingAiCampaign || aiCampaignRecipients.length === 0}
                    >
                      {isSendingAiCampaign ? 'Enviant...' : `Enviar a ${aiCampaignRecipients.length} destinataris`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
