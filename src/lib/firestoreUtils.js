import { collection, addDoc, getDocs, doc, getDoc, query, where, orderBy, updateDoc, deleteDoc, limit } from 'firebase/firestore';
import { db, auth } from './firebase';

// CONTACTS
export const addContact = async (contactData) => {
  return await addDoc(collection(db, 'contacts'), {
    ...contactData,
    createdAt: new Date().toISOString()
  });
};

export const getContacts = async () => {
  const q = query(collection(db, 'contacts'), orderBy('entity'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getContactById = async (id) => {
  const docRef = doc(db, 'contacts', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
};

export const deleteContact = async (id) => {
  try {
    const docRef = doc(db, 'contacts', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const contact = docSnap.data();
      if (contact.calendarEventId) {
        auth.currentUser?.getIdToken().then(token => {
          fetch('/api/calendar/sync', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ type: 'reminder', action: 'delete', calendarEventId: contact.calendarEventId })
          }).catch(err => console.error("Calendar delete error:", err));
        });
      }
    }
  } catch (e) {
    console.error("Error before deleting contact:", e);
  }
  const docRef = doc(db, 'contacts', id);
  await deleteDoc(docRef);
};

export const updateContact = async (id, data) => {
  const docRef = doc(db, 'contacts', id);
  await updateDoc(docRef, data);
  if (data.nextActionDate !== undefined || data.nextActionNotes !== undefined || data.municipality !== undefined || data.entity !== undefined) {
    auth.currentUser?.getIdToken().then(token => {
      fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type: 'reminder', id })
      }).catch(err => console.error("Calendar sync error:", err));
    });
  }
};

// SHOWS
export const getShows = async () => {
  const snapshot = await getDocs(collection(db, 'shows'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addShow = async (showData) => {
  return await addDoc(collection(db, 'shows'), showData);
};

// INTERACTIONS
export const addInteraction = async (interactionData) => {
  return await addDoc(collection(db, 'interactions'), {
    ...interactionData,
    createdAt: new Date().toISOString()
  });
};

export const getInteractionsByContact = async (contactId) => {
  const q = query(
    collection(db, 'interactions'), 
    where('contactId', '==', contactId)
  );
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  // Ordenem localment per evitar la necessitat de crear un índex compost a Firebase
  return data.sort((a, b) => new Date(b.date) - new Date(a.date));
};

// GIGS (Road-sheet)
export const addGig = async (gigData) => {
  const docRef = await addDoc(collection(db, 'gigs'), {
    ...gigData,
    createdAt: new Date().toISOString()
  });
  auth.currentUser?.getIdToken().then(token => {
    fetch('/api/calendar/sync', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ type: 'gig', id: docRef.id })
    }).catch(err => console.error("Calendar sync error:", err));
  });
  return docRef;
};

export const getUpcomingGigs = async () => {
  const q = query(collection(db, 'gigs'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const deleteGig = async (id) => {
  try {
    const docRef = doc(db, 'gigs', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const gig = docSnap.data();
      if (gig.calendarEventId) {
        auth.currentUser?.getIdToken().then(token => {
          fetch('/api/calendar/sync', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ type: 'gig', action: 'delete', calendarEventId: gig.calendarEventId })
          }).catch(err => console.error("Calendar delete error:", err));
        });
      }
    }
  } catch (e) {
    console.error("Error before deleting gig:", e);
  }
  const docRef = doc(db, 'gigs', id);
  await deleteDoc(docRef);
};

export const updateGig = async (id, data) => {
  const docRef = doc(db, 'gigs', id);
  await updateDoc(docRef, data);
  auth.currentUser?.getIdToken().then(token => {
    fetch('/api/calendar/sync', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ type: 'gig', id })
    }).catch(err => console.error("Calendar sync error:", err));
  });
};

// INVOICES (Facturació)
export const addInvoice = async (invoiceData) => {
  // invoiceData includes: date, invoiceNumber, clientName, clientNif, amount, vat (IVA), irpf, status ('Pendent', 'Enviada', 'Error')
  return await addDoc(collection(db, 'invoices'), {
    ...invoiceData,
    status: 'Pendent',
    createdAt: new Date().toISOString()
  });
};

export const getInvoices = async () => {
  const q = query(collection(db, 'invoices'), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getInvoiceById = async (id) => {
  const docRef = doc(db, 'invoices', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
};

export const updateInvoiceStatus = async (id, statusData) => {
  // statusData can include: status ('Enviada'), verifactuId, sentAt
  const docRef = doc(db, 'invoices', id);
  await updateDoc(docRef, statusData);
};

// BILLING CLIENTS
export const addBillingClient = async (clientData) => {
  return await addDoc(collection(db, 'clients_billing'), {
    ...clientData,
    createdAt: new Date().toISOString()
  });
};

export const getBillingClients = async () => {
  const q = query(collection(db, 'clients_billing'), orderBy('name'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const updateBillingClient = async (id, data) => {
  const docRef = doc(db, 'clients_billing', id);
  await updateDoc(docRef, data);
};

export const deleteBillingClient = async (id) => {
  const docRef = doc(db, 'clients_billing', id);
  await deleteDoc(docRef);
};

// BILLING PRODUCTS
export const addBillingProduct = async (productData) => {
  return await addDoc(collection(db, 'products_billing'), {
    ...productData,
    createdAt: new Date().toISOString()
  });
};

export const getBillingProducts = async () => {
  const snapshot = await getDocs(collection(db, 'products_billing'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const updateBillingProduct = async (id, data) => {
  const docRef = doc(db, 'products_billing', id);
  await updateDoc(docRef, data);
};

export const deleteBillingProduct = async (id) => {
  const docRef = doc(db, 'products_billing', id);
  await deleteDoc(docRef);
};

// FORMAT DISPLAY INVOICE NUMBER
export const formatDisplayInvoiceNumber = (invoiceNumber, issuerId) => {
  if (!invoiceNumber) return '';
  const cleanNumber = String(invoiceNumber).trim();
  if (issuerId) {
    if (cleanNumber.startsWith(`${issuerId}-`)) {
      return cleanNumber;
    }
    const strippedNumber = cleanNumber.replace(/\s*\([A-Z]{2}\)$/, '');
    return `${issuerId}-${strippedNumber}`;
  }
  return cleanNumber;
};

// INVOICE NUMBER GENERATION
export const getNextInvoiceNumber = async (issuerPrefix, tipoFactura = 'F1') => {
  const year = new Date().getFullYear().toString();
  const isRectificativa = tipoFactura.startsWith('R');
  
  // Optimització de rendiment: en lloc de descarregar totes les factures històriques a memòria,
  // només demanem les factures de l'any actual mitjançant una consulta de rang de dates (no requereix indexs compostos).
  const q = query(
    collection(db, 'invoices'),
    where('date', '>=', `${year}-01-01`),
    where('date', '<=', `${year}-12-31`)
  );
  const snapshot = await getDocs(q);
  const invoices = snapshot.docs.map(doc => doc.data());
  
  // Filtrem per emissor i format de l'any actual (començant per "R[1-5]{year}" o "{year}")
  const matchingInvoices = invoices.filter(inv => {
    if (inv.issuerId !== issuerPrefix || !inv.invoiceNumber) return false;
    
    if (isRectificativa) {
      // Per exemple: R420260000001
      // Comença per tipoFactura + year (ex: R42026), té longitud 14 i la part de la seqüència és numèrica
      const prefix = `${tipoFactura}${year}`;
      return inv.invoiceNumber.startsWith(prefix) && 
             inv.invoiceNumber.length === 14 && 
             /^\d+$/.test(inv.invoiceNumber.substring(prefix.length));
    } else {
      // Per ordinària: 202600000001
      // Comença per year (ex: 2026), té longitud 12 i és tot numèric
      return inv.invoiceNumber.startsWith(year) && 
             inv.invoiceNumber.length === 12 && 
             /^\d+$/.test(inv.invoiceNumber);
    }
  });
  
  const defaultNum = isRectificativa ? `${tipoFactura}${year}00000001` : `${year}00000001`;
  
  if (matchingInvoices.length === 0) {
    return defaultNum;
  }
  
  // Ordenem descendentment
  matchingInvoices.sort((a, b) => b.invoiceNumber.localeCompare(a.invoiceNumber));
  
  const lastInvoice = matchingInvoices[0].invoiceNumber;
  const seqStr = isRectificativa ? lastInvoice.substring(tipoFactura.length + 4) : lastInvoice.substring(4);
  const lastNum = parseInt(seqStr, 10);
  
  if (isNaN(lastNum)) {
    return defaultNum;
  }
  
  const nextNum = (lastNum + 1).toString().padStart(8, '0');
  return isRectificativa ? `${tipoFactura}${year}${nextNum}` : `${year}${nextNum}`;
};

export const deleteInvoice = async (id) => {
  const docRef = doc(db, 'invoices', id);
  await deleteDoc(docRef);
};

export const updateInvoice = async (id, invoiceData) => {
  const docRef = doc(db, 'invoices', id);
  await updateDoc(docRef, invoiceData);
};

// BUDGETS (Pressupostos)
export const addBudget = async (budgetData) => {
  return await addDoc(collection(db, 'budgets'), {
    ...budgetData,
    status: 'Pendent',
    createdAt: new Date().toISOString()
  });
};

export const getBudgets = async () => {
  const q = query(collection(db, 'budgets'), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getBudgetById = async (id) => {
  const docRef = doc(db, 'budgets', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
};

export const updateBudget = async (id, budgetData) => {
  const docRef = doc(db, 'budgets', id);
  await updateDoc(docRef, budgetData);
};

export const deleteBudget = async (id) => {
  const docRef = doc(db, 'budgets', id);
  await deleteDoc(docRef);
};

export const getNextBudgetNumber = async (issuerPrefix) => {
  const year = new Date().getFullYear().toString();
  
  // Optimització de rendiment: en lloc de descarregar tots els pressupostos a memòria,
  // només demanem els de l'any actual mitjançant una consulta de rang de dates.
  const q = query(
    collection(db, 'budgets'),
    where('date', '>=', `${year}-01-01`),
    where('date', '<=', `${year}-12-31`)
  );
  const snapshot = await getDocs(q);
  const budgets = snapshot.docs.map(doc => doc.data());
  
  // Format: PRissuerId-YYYYSEQ (ex: PRJB-2026001)
  const prefix = `PR${issuerPrefix}-${year}`;
  const matchingBudgets = budgets.filter(b => 
    b.budgetNumber && 
    b.budgetNumber.startsWith(prefix)
  );
  
  if (matchingBudgets.length === 0) {
    return `${prefix}001`;
  }
  
  // Ordenem descendentment
  matchingBudgets.sort((a, b) => b.budgetNumber.localeCompare(a.budgetNumber, undefined, { numeric: true }));
  
  const lastBudget = matchingBudgets[0].budgetNumber;
  const seqStr = lastBudget.substring(prefix.length);
  const lastNum = parseInt(seqStr, 10);
  
  if (isNaN(lastNum)) {
    return `${prefix}001`;
  }
  
  const nextNum = (lastNum + 1).toString().padStart(3, '0');
  return `${prefix}${nextNum}`;
};

// LEDGERS ISSUED (Factures Expedides / Ingressos)
export const getLedgersIssued = async () => {
  const snapshot = await getDocs(collection(db, 'ledgers_issued'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addLedgerIssued = async (record) => {
  return await addDoc(collection(db, 'ledgers_issued'), {
    ...record,
    createdAt: new Date().toISOString()
  });
};

export const updateLedgerIssued = async (id, data) => {
  const docRef = doc(db, 'ledgers_issued', id);
  await updateDoc(docRef, data);
};

export const deleteLedgerIssued = async (id) => {
  const docRef = doc(db, 'ledgers_issued', id);
  await deleteDoc(docRef);
};

// LEDGERS RECEIVED (Factures Rebudes / Despeses)
export const getLedgersReceived = async () => {
  const snapshot = await getDocs(collection(db, 'ledgers_received'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addLedgerReceived = async (record) => {
  return await addDoc(collection(db, 'ledgers_received'), {
    ...record,
    createdAt: new Date().toISOString()
  });
};

export const updateLedgerReceived = async (id, data) => {
  const docRef = doc(db, 'ledgers_received', id);
  await updateDoc(docRef, data);
};

export const deleteLedgerReceived = async (id) => {
  const docRef = doc(db, 'ledgers_received', id);
  await deleteDoc(docRef);
};

// FORMAT CLIENT NAME (Title Case for Catalan/Spanish and Acronyms)
export const formatClientName = (str) => {
  if (!str || typeof str !== 'string') return '';
  
  const lowercaseWords = new Set([
    'de', 'del', 'd\'', 'des', 'i', 'a', 'al', 'o', 'u', 'y', 
    'la', 'el', 'els', 'les', 'l\'', 'en', 'na', 'ca', 'amb', 'per'
  ]);

  const cleanStr = str.replace(/\s+/g, ' ').trim();
  const tokens = cleanStr.split(' ');
  const formattedTokens = tokens.map((token, index) => {
    if (!token) return '';
    
    const lowerToken = token.toLowerCase();
    
    // Check for contractions (d', l', m', n', s')
    const contractionMatch = token.match(/^([dlmsn])'(.+)$/i);
    if (contractionMatch) {
      const prefix = contractionMatch[1].toLowerCase();
      const rest = contractionMatch[2];
      const capitalizedRest = rest.charAt(0).toUpperCase() + rest.slice(1).toLowerCase();
      return `${prefix}'${capitalizedRest}`;
    }
    
    if (lowercaseWords.has(lowerToken) && index > 0) {
      return lowerToken;
    }
    
    return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
  });
  
  let result = formattedTokens.join(' ');

  // Fix standard uppercase acronyms / business suffixes
  result = result.replace(/\bSl\b/g, 'SL');
  result = result.replace(/\bSa\b/g, 'SA');
  result = result.replace(/\bAmpa\b/g, 'AMPA');
  result = result.replace(/\bEuses\b/g, 'EUSES');
  result = result.replace(/\bIae\b/g, 'IAE');
  result = result.replace(/\bAeat\b/g, 'AEAT');
  result = result.replace(/\bIban\b/g, 'IBAN');
  result = result.replace(/\bNif\b/g, 'NIF');
  result = result.replace(/\bXml\b/g, 'XML');
  
  return result;
};
