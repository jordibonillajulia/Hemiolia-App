'use client';

import { Suspense, useState, useEffect } from 'react';
import { useAuth } from '../../../../lib/AuthContext';
import { addInvoice, getBillingClients, getBillingProducts, getNextInvoiceNumber, getInvoiceById, updateInvoice, formatDisplayInvoiceNumber, getBudgetById, updateBudget, getInvoices, formatClientName } from '../../../../lib/firestoreUtils';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const ISSUERS = [
  {
    id: 'JB',
    name: 'Jordi Bonilla Julià',
    nif: '40936132L',
    address: 'Avinguda Catalunya, 87 (5-A)',
    postalCode: '43500',
    municipality: 'Tortosa',
    province: 'Tarragona',
    email: 'jordibonillajulia@gmail.com',
    phone: '639966697',
    website: 'www.hemiolia.cat',
    bankName: 'TRIODOS BANK',
    iban: 'ES60 1491 0001 2420 6282 2024'
  },
  {
    id: 'PM',
    name: 'Paula Martí Fandos',
    nif: '78582484V',
    address: 'Avinguda Catalunya, 87 (5-A)',
    postalCode: '43500',
    municipality: 'Tortosa',
    province: 'Tarragona',
    email: 'unaonadapetitona@gmail.com',
    phone: '619579935',
    website: 'www.hemiolia.cat',
    bankName: 'TRIODOS BANK',
    iban: 'ES28 1491 0001 2020 6961 5124'
  }
];

function NewInvoiceForm() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  
  // Data sources
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);

  // Form State
  const [issuerId, setIssuerId] = useState(ISSUERS[0].id);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [operationDate, setOperationDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientData, setClientData] = useState(null); // Copy of client at creation time
  
  const [notes, setNotes] = useState(''); // Camp de descripció general
  
  const [irpfPercent, setIrpfPercent] = useState('15');
  const [lines, setLines] = useState([]); // { id, type: 'product'|'discount', desc, amount, vat, exempt, exemptCause }
  
  const [isSaving, setIsSaving] = useState(false);

  // AEAT / Veri*Factu State
  const [tipoFactura, setTipoFactura] = useState('F1');
  const [claveRegimen, setClaveRegimen] = useState('01');
  const [submissionMethod, setSubmissionMethod] = useState('verifactu');
  const [rectificationType, setRectificationType] = useState('I');
  const [rectifiedInvoiceNumber, setRectifiedInvoiceNumber] = useState('');
  const [rectifiedInvoiceDate, setRectifiedInvoiceDate] = useState('');

  const [invoicesList, setInvoicesList] = useState([]);
  const [selectedOriginalInvoiceId, setSelectedOriginalInvoiceId] = useState('');
  const [isManualOriginalInvoice, setIsManualOriginalInvoice] = useState(false);
  const [hasResolvedOriginalInvoice, setHasResolvedOriginalInvoice] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    Promise.all([getBillingClients(), getBillingProducts(), getInvoices()]).then(([cData, pData, invData]) => {
      setClients(cData);
      setProducts(pData);
      setInvoicesList(invData);
      
      const fromBudgetId = searchParams.get('fromBudget');
      if (editId) {
        getInvoiceById(editId).then(inv => {
          if (inv) {
            if (inv.status === 'Enviada') {
              alert('No es pot editar una factura que ja ha estat enviada a l\'AEAT.');
              router.push('/dashboard/billing');
              return;
            }
            setIssuerId(inv.issuerId);
            setDate(inv.date);
            setOperationDate(inv.operationDate || inv.date);
            setInvoiceNumber(inv.invoiceNumber);
            setSelectedClientId(inv.clientId);
            setClientData(inv.clientData);
            setLines(inv.lines || []);
            setNotes(inv.notes || '');
            setIrpfPercent(inv.irpfPercent?.toString() || '0');
            setTipoFactura(inv.tipoFactura || 'F1');
            setClaveRegimen(inv.claveRegimen || '01');
            setSubmissionMethod(inv.submissionMethod || 'verifactu');
            setRectificationType(inv.rectificationType || 'I');
            setRectifiedInvoiceNumber(inv.rectifiedInvoiceNumber || '');
            setRectifiedInvoiceDate(inv.rectifiedInvoiceDate || '');
          }
        });
      } else if (fromBudgetId) {
        getBudgetById(fromBudgetId).then(budget => {
          if (budget) {
            setIssuerId(budget.issuerId);
            setOperationDate(budget.operationDate || budget.date);
            setSelectedClientId(budget.clientId);
            setClientData(budget.clientData);
            setLines(budget.lines || []);
            setNotes(budget.notes || '');
            setIrpfPercent(budget.irpfPercent?.toString() || '0');
            setTipoFactura('F1');
            if (budget.clientData && (budget.clientData.dir3OficinaContable || budget.clientData.dir3OrganoGestor || budget.clientData.dir3UnidadTramitadora)) {
              setSubmissionMethod('efact');
            } else {
              setSubmissionMethod('verifactu');
            }
          }
        });
      }
    });
  }, [user, editId, searchParams, router]);

  useEffect(() => {
    if (issuerId && date && !editId) {
      // Fetch next invoice number whenever issuer or invoice type changes, ONLY if not editing
      getNextInvoiceNumber(issuerId, tipoFactura).then(num => {
        setInvoiceNumber(num);
      });
    }
  }, [issuerId, date, tipoFactura, editId]);

  // Auto-Select Resolver Effect to map stored rectifiedInvoiceNumber to selectedOriginalInvoiceId
  useEffect(() => {
    if (invoicesList.length > 0 && editId && !hasResolvedOriginalInvoice) {
      getInvoiceById(editId).then(inv => {
        if (inv) {
          if (inv.tipoFactura && inv.tipoFactura.startsWith('R') && inv.rectifiedInvoiceNumber) {
            const matchingInv = invoicesList.find(
              i => i.invoiceNumber === inv.rectifiedInvoiceNumber && i.issuerId === inv.issuerId
            );
            if (matchingInv) {
              setSelectedOriginalInvoiceId(matchingInv.id);
              setIsManualOriginalInvoice(false);
            } else {
              setSelectedOriginalInvoiceId('manual');
              setIsManualOriginalInvoice(true);
            }
          }
          setHasResolvedOriginalInvoice(true);
        }
      });
    }
  }, [invoicesList, editId, hasResolvedOriginalInvoice]);

  // Reset original invoice selection if issuerId changes (only if it is no longer valid for the selected issuer)
  useEffect(() => {
    if (selectedOriginalInvoiceId && selectedOriginalInvoiceId !== 'manual') {
      const inv = invoicesList.find(i => i.id === selectedOriginalInvoiceId);
      if (inv && inv.issuerId !== issuerId) {
        setSelectedOriginalInvoiceId('');
        setIsManualOriginalInvoice(false);
        setRectifiedInvoiceNumber('');
        setRectifiedInvoiceDate('');
      }
    }
  }, [issuerId, selectedOriginalInvoiceId, invoicesList]);

  const filteredInvoices = invoicesList.filter(inv => inv.issuerId === issuerId);

  const handleOriginalInvoiceChange = (e) => {
    const val = e.target.value;
    setSelectedOriginalInvoiceId(val);
    
    if (val === 'manual') {
      setIsManualOriginalInvoice(true);
      setRectifiedInvoiceNumber('');
      setRectifiedInvoiceDate('');
    } else if (val === '') {
      setIsManualOriginalInvoice(false);
      setRectifiedInvoiceNumber('');
      setRectifiedInvoiceDate('');
    } else {
      setIsManualOriginalInvoice(false);
      const inv = invoicesList.find(i => i.id === val);
      if (inv) {
        setRectifiedInvoiceNumber(inv.invoiceNumber);
        setRectifiedInvoiceDate(inv.date);
      }
    }
  };

  const handleClientChange = (e) => {
    const id = e.target.value;
    setSelectedClientId(id);
    if (id) {
      const client = clients.find(c => c.id === id);
      setClientData(client);
      if (client && (client.dir3OficinaContable || client.dir3OrganoGestor || client.dir3UnidadTramitadora)) {
        setSubmissionMethod('efact');
      } else {
        setSubmissionMethod('verifactu');
      }
    } else {
      setClientData(null);
      setSubmissionMethod('verifactu');
    }
  };



  const addProductLine = (e) => {
    const prodId = e.target.value;
    if (!prodId) return;
    const prod = products.find(p => p.id === prodId);
    if (prod) {
      setLines([...lines, {
        id: Date.now().toString(),
        type: 'product',
        description: prod.description,
        amount: prod.unitPrice,
        vatPercent: prod.vatType,
        isVatExempt: prod.isVatExempt || false,
        exemptionCause: prod.exemptionCause || 'E1',
        exemptionText: prod.exemptionText || ''
      }]);
    }
    // Reset select
    e.target.value = '';
  };

  const addDiscountLine = () => {
    setLines([...lines, {
      id: Date.now().toString(),
      type: 'discount',
      description: 'Descompte comercial',
      amount: 0,
      vatPercent: 21,
      isVatExempt: false,
      exemptionCause: 'E1',
      exemptionText: ''
    }]);
  };

  const removeLine = (id) => {
    setLines(lines.filter(l => l.id !== id));
  };

  const updateLine = (id, field, value) => {
    setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const handleSaveDraft = async (e) => {
    e.preventDefault();
    if (!clientData) {
      alert("Selecciona un client");
      return;
    }
    if (lines.length === 0) {
      alert("Afegeix almenys un producte a la factura");
      return;
    }
    
    setIsSaving(true);
    
    // Preparar el document de factura
    const issuer = ISSUERS.find(i => i.id === issuerId);
    
    try {
      const dataToSave = {
        issuerId,
        issuerData: issuer,
        date,
        operationDate,
        invoiceNumber,
        clientId: clientData.id,
        clientName: formatClientName(clientData.name),
        clientNif: clientData.nif,
        clientNifType: clientData.nifType || 'NIF',
        clientCountryCode: clientData.countryCode || 'ES',
        clientData: clientData,
        lines,
        notes,
        irpfPercent: parseFloat(irpfPercent) || 0,
        totals: calculateTotals(),
        tipoFactura,
        claveRegimen,
        submissionMethod,
        rectificationType: tipoFactura.startsWith('R') ? rectificationType : '',
        rectifiedInvoiceNumber: tipoFactura.startsWith('R') ? rectifiedInvoiceNumber : '',
        rectifiedInvoiceDate: tipoFactura.startsWith('R') ? rectifiedInvoiceDate : ''
      };

      const fromBudgetId = searchParams.get('fromBudget');

      if (editId) {
        const inv = await getInvoiceById(editId);
        if (inv && inv.status === 'Enviada') {
          alert('No es pot editar una factura que ja ha estat enviada a l\'AEAT.');
          router.push('/dashboard/billing');
          return;
        }
        await updateInvoice(editId, dataToSave);
      } else {
        await addInvoice(dataToSave);
        if (fromBudgetId) {
          await updateBudget(fromBudgetId, { status: 'Acceptat' });
        }
      }
      router.push('/dashboard/billing');
    } catch (err) {
      console.error(err);
      alert('Error en guardar la factura.');
    } finally {
      setIsSaving(false);
    }
  };

  // Càlculs Totals
  const calculateTotals = () => {
    let baseImposable = 0;
    let totalIva = 0;
    
    lines.forEach(line => {
      const amt = parseFloat(line.amount) || 0;
      baseImposable += amt;
      
      if (!line.isVatExempt) {
        totalIva += amt * (parseFloat(line.vatPercent) / 100);
      }
    });

    const totalIrpf = baseImposable * (parseFloat(irpfPercent) / 100);
    const total = baseImposable + totalIva - totalIrpf;

    return { baseImposable, totalIva, totalIrpf, total };
  };

  const totals = calculateTotals();

  if (loading || !user) return <div className="container mt-xl text-center">Carregant...</div>;

  if (!isAdmin) {
    return (
      <div className="container" style={{ paddingTop: 'var(--space-md)' }}>
        <div className="glass-panel text-center" style={{ padding: '3rem', maxWidth: '500px', margin: '2rem auto' }}>
          <h2 style={{ color: '#ff6b6b', marginBottom: '1rem' }}>⚠️ Accés Denegat</h2>
          <p>Només els administradors poden crear o editar factures en aquesta aplicació.</p>
          <div style={{ marginTop: '2rem' }}>
            <Link href="/dashboard/billing" className="btn btn-primary">
              Tornar a Facturació
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 'var(--space-md)', paddingBottom: 'var(--space-xl)' }}>
      <div className="header-bar-responsive">
        <div>
          <Link href="/dashboard/billing" className="btn-back no-print" title="Tornar a Facturació" style={{ marginRight: '1rem', verticalAlign: 'middle' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </Link>
          <h1 style={{ marginTop: '0.5rem', marginBottom: 0, color: 'var(--color-accent)', display: 'inline-block', verticalAlign: 'middle' }}>
            {editId ? `Editar Factura (${invoiceNumber})` : 'Crear Nova Factura'}
          </h1>
        </div>
      </div>

      <div className="glass-panel animate-fade-in-up">
        <form onSubmit={handleSaveDraft} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div className="input-group">
              <label>Emissor de la Factura</label>
              <select className="input-field" value={issuerId} onChange={e => setIssuerId(e.target.value)}>
                {ISSUERS.map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>Data d'Emissió</label>
              <input 
                type="date" 
                className="input-field" 
                value={date} 
                disabled={true}
                readOnly={true}
                required 
              />
            </div>
            <div className="input-group">
              <label>Data d'Operació</label>
              <input 
                type="date" 
                className="input-field" 
                value={operationDate} 
                onChange={e => setOperationDate(e.target.value)} 
                required 
              />
            </div>
            <div className="input-group">
              <label>Nº Factura</label>
              <input type="text" className="input-field" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} required />
              {invoiceNumber && (
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                  Previsualització visual: <strong style={{ color: 'var(--color-accent)' }}>{formatDisplayInvoiceNumber(invoiceNumber, issuerId)}</strong>
                </span>
              )}
            </div>
          </div>

          <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)' }}>
            <div className="input-group" style={{ marginBottom: clientData ? '1rem' : 0 }}>
              <label>Client</label>
              <select className="input-field" value={selectedClientId} onChange={handleClientChange} required>
                <option value="">-- Selecciona un Client --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{formatClientName(c.name)} ({c.nif})</option>
                ))}
              </select>
            </div>
            {clientData && (
              <div className="grid-2col-responsive" style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', gap: '0.5rem' }}>
                <div><strong>Tipus:</strong> {clientData.type}</div>
                <div><strong>NIF:</strong> {clientData.nif} {clientData.nifType && `(${clientData.nifType})`}</div>
                <div><strong>Adreça:</strong> {clientData.address}</div>
                <div><strong>Localitat:</strong> {clientData.postalCode} {clientData.municipality} ({clientData.province}){clientData.countryCode && ` - ${clientData.countryCode}`}</div>
              </div>
            )}
          </div>

          {/* AEAT / Veri*Factu / e-Fact Fields */}
          <div style={{ padding: '1.2rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h4 style={{ margin: 0, color: 'var(--color-accent)', fontSize: '1rem' }}>Configuració Fiscal i Tramesa</h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="input-group">
                <label>Tipus de Factura</label>
                <select className="input-field" value={tipoFactura} onChange={e => {
                  setTipoFactura(e.target.value);
                }}>
                  <option value="F1">F1 - Factura ordinària (completa)</option>
                  <option value="F2">F2 - Factura simplificada</option>
                  <option value="R1">R1 - Factura rectificativa (Art. 80.1, 80.2 i error fundat en dret)</option>
                  <option value="R2">R2 - Factura rectificativa (Art. 80.3 - Concurs de creditors)</option>
                  <option value="R3">R3 - Factura rectificativa (Art. 80.4 - Crèdits incobrables)</option>
                  <option value="R4">R4 - Factura rectificativa (Resta de casos)</option>
                  <option value="R5">R5 - Factura rectificativa simplificada</option>
                </select>
              </div>

              <div className="input-group">
                <label>Règim Especial / Clau</label>
                <select className="input-field" value={claveRegimen} onChange={e => setClaveRegimen(e.target.value)}>
                  <option value="01">01 - Operacions de règim general</option>
                  <option value="02">02 - Exportació</option>
                  <option value="03">03 - Canàries, Ceuta i Melilla</option>
                  <option value="08">08 - Operacions amb inversió del subjecte passiu (ISP)</option>
                </select>
              </div>

              <div className="input-group">
                <label>Mètode de Tramesa</label>
                <select className="input-field" value={submissionMethod} onChange={e => setSubmissionMethod(e.target.value)}>
                  <option value="verifactu">Veri*Factu (Enviament directe AEAT)</option>
                  <option value="efact">e-Fact / FACe (Administració Pública)</option>
                </select>
              </div>
            </div>


            {/* Conditionally show rectifying fields */}
            {tipoFactura.startsWith('R') && (
              <div className="animate-fade-in-up" style={{ padding: '1rem', background: 'rgba(255,107,107,0.05)', borderRadius: 'var(--radius-sm)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', border: '1px dashed rgba(255,107,107,0.2)' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Tipus de Rectificativa</label>
                  <select className="input-field" value={rectificationType} onChange={e => setRectificationType(e.target.value)}>
                    <option value="I">I - Per diferències (només increment/reducció)</option>
                    <option value="S">S - Per substitució (reemplaça totalment la factura)</option>
                  </select>
                </div>
                
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Factura Original a Rectificar</label>
                  <select 
                    className="input-field" 
                    value={selectedOriginalInvoiceId} 
                    onChange={handleOriginalInvoiceChange}
                    required={tipoFactura.startsWith('R')}
                  >
                    <option value="">-- Selecciona una factura emesa --</option>
                    {filteredInvoices.map(inv => (
                      <option key={inv.id} value={inv.id}>
                        {formatDisplayInvoiceNumber(inv.invoiceNumber, inv.issuerId)} ({inv.date}) - {formatClientName(inv.clientName)}
                      </option>
                    ))}
                    <option value="manual">Altre / Introduir manualment...</option>
                  </select>
                </div>

                {isManualOriginalInvoice && (
                  <div className="input-group animate-fade-in-up" style={{ marginBottom: 0 }}>
                    <label>Factura Original Rectificada (Nº)</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={rectifiedInvoiceNumber} 
                      onChange={e => setRectifiedInvoiceNumber(e.target.value)} 
                      placeholder="Ex: JB-202600000001" 
                      required={tipoFactura.startsWith('R') && isManualOriginalInvoice} 
                    />
                  </div>
                )}

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Data de Factura Original</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={rectifiedInvoiceDate} 
                    onChange={e => setRectifiedInvoiceDate(e.target.value)} 
                    disabled={!isManualOriginalInvoice}
                    required={tipoFactura.startsWith('R')} 
                  />
                </div>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--color-accent)' }}>Línies de Factura</h3>
            
            {lines.map((line, index) => (
              <div key={line.id} className="line-items-grid-responsive" style={{ marginBottom: '1rem', background: line.type === 'discount' ? 'rgba(255,107,107,0.1)' : 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Concepte {line.type === 'discount' && '(Descompte)'}</label>
                  <input type="text" className="input-field" value={line.description} onChange={e => updateLine(line.id, 'description', e.target.value)} required />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>Import (€)</label>
                  <input type="number" step="0.01" className="input-field" value={line.amount} onChange={e => updateLine(line.id, 'amount', e.target.value)} required />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>IVA (%) / Exempció</label>
                  <select className="input-field" value={line.isVatExempt ? 'exempt' : line.vatPercent} onChange={e => {
                    if (e.target.value === 'exempt') {
                      updateLine(line.id, 'isVatExempt', true);
                      updateLine(line.id, 'vatPercent', 0);
                      if (!line.exemptionCause) updateLine(line.id, 'exemptionCause', 'E1');
                    } else {
                      updateLine(line.id, 'isVatExempt', false);
                      updateLine(line.id, 'vatPercent', parseFloat(e.target.value));
                    }
                  }}>
                    <option value="21">21%</option>
                    <option value="10">10%</option>
                    <option value="4">4%</option>
                    <option value="0">0%</option>
                    <option value="exempt">Exempt d'IVA (E1-E6)</option>
                  </select>
                </div>
                <button type="button" onClick={() => removeLine(line.id)} className="btn btn-glass" style={{ color: '#ff6b6b', height: 'fit-content', alignSelf: 'flex-end', marginBottom: '0.2rem' }}>
                  🗑️
                </button>
                
                {line.isVatExempt && (
                  <div className="input-group grid-span-all-desktop animate-fade-in-up" style={{ marginTop: '0.5rem', marginBottom: 0, padding: '0.5rem', background: 'rgba(241, 196, 15, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px dashed rgba(241, 196, 15, 0.2)' }}>
                    <div className="grid-2-1-responsive">
                      <div>
                        <label style={{ color: '#f1c40f', fontSize: '0.85rem' }}>Codi d'Exempció AEAT</label>
                        <select className="input-field" value={line.exemptionCause || 'E1'} onChange={e => updateLine(line.id, 'exemptionCause', e.target.value)}>
                          <option value="E1">E1 - Art. 20 (Serveis artístics, mèdics, etc.)</option>
                          <option value="E2">E2 - Art. 21 (Exportacions)</option>
                          <option value="E3">E3 - Art. 22 (Operacions assimilades)</option>
                          <option value="E4">E4 - Art. 24 (Zones franques / dipòsits)</option>
                          <option value="E5">E5 - Art. 25 (Lliuraments intracomunitaris)</option>
                          <option value="E6">E6 - Altres motius d'exempció</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ color: '#f1c40f', fontSize: '0.85rem' }}>Detall de l'Exempció (Text legal)</label>
                        <input type="text" className="input-field" value={line.exemptionText || ''} onChange={e => updateLine(line.id, 'exemptionText', e.target.value)} placeholder="Exempt d'IVA segons..." required={line.isVatExempt} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              <select className="input-field" style={{ width: 'auto', marginBottom: 0 }} onChange={addProductLine} value="">
                <option value="">+ Afegir Espectacle / Servei...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.description} ({p.unitPrice}€)</option>
                ))}
              </select>
              <button type="button" className="btn btn-glass" onClick={addDiscountLine}>
                - Afegir Descompte
              </button>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'space-between' }}>
            
            <div style={{ flex: '1 1 300px' }}>
              <div className="input-group">
                <label>Concepte / Observacions Generals (Opcional)</label>
                <textarea 
                  className="input-field" 
                  rows="4" 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  placeholder="Text lliure per afegir condicions de pagament, notes addicionals..." 
                />
              </div>
            </div>

            <div style={{ width: '100%', maxWidth: '400px', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: 'var(--radius-sm)' }}>
              <div className="input-group" style={{ marginBottom: '1rem' }}>
                <label>Retenció IRPF (%)</label>
                <input type="number" step="1" className="input-field" value={irpfPercent} onChange={e => setIrpfPercent(e.target.value)} />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Base Imposable:</span> <span>{totals.baseImposable.toFixed(2)} €</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Total IVA:</span> <span>{totals.totalIva.toFixed(2)} €</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#ff6b6b' }}>
                <span>Total IRPF (-{irpfPercent}%):</span> <span>-{totals.totalIrpf.toFixed(2)} €</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', fontWeight: 'bold', fontSize: '1.4rem', color: 'var(--color-accent)' }}>
                <span>TOTAL A COBRAR:</span> <span>{totals.total.toFixed(2)} €</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '1rem', fontSize: '1.1rem' }} disabled={isSaving}>
              {isSaving ? 'Guardant Factura...' : (editId ? 'Guardar Canvis de la Factura' : 'Guardar Factura (Pendent d\'Enviament)')}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<div className="container mt-xl text-center">Carregant formulari...</div>}>
      <NewInvoiceForm />
    </Suspense>
  );
}
