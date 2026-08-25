'use client';

import { Suspense, useState, useEffect } from 'react';
import { useAuth } from '../../../../../lib/AuthContext';
import { addBudget, getBillingClients, getBillingProducts, getNextBudgetNumber, getBudgetById, updateBudget, formatClientName } from '../../../../../lib/firestoreUtils';
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

function BudgetForm() {
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
  const [userHasEditedOperationDate, setUserHasEditedOperationDate] = useState(false);
  const [budgetNumber, setBudgetNumber] = useState('');
  const [status, setStatus] = useState('Pendent');
  const [originalBudget, setOriginalBudget] = useState(null);
  
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientData, setClientData] = useState(null);
  
  const [notes, setNotes] = useState('');
  const [irpfPercent, setIrpfPercent] = useState('15');
  const [lines, setLines] = useState([]);
  
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    Promise.all([getBillingClients(), getBillingProducts()]).then(([cData, pData]) => {
      setClients(cData);
      setProducts(pData);
      
      if (editId) {
        getBudgetById(editId).then(budget => {
          if (budget) {
            setOriginalBudget(budget);
            setIssuerId(budget.issuerId);
            setDate(budget.date);
            setOperationDate(budget.operationDate || budget.date);
            setUserHasEditedOperationDate(!!budget.operationDate && budget.operationDate !== budget.date);
            setBudgetNumber(budget.budgetNumber);
            setStatus(budget.status || 'Pendent');
            setSelectedClientId(budget.clientId);
            setClientData(budget.clientData);
            setLines(budget.lines || []);
            setNotes(budget.notes || '');
            setIrpfPercent(budget.irpfPercent?.toString() || '0');
          }
        });
      }
    });
  }, [user, editId]);

  useEffect(() => {
    if (!issuerId || !date) return;

    if (editId) {
      if (originalBudget) {
        if (issuerId === originalBudget.issuerId) {
          setBudgetNumber(originalBudget.budgetNumber);
        } else {
          getNextBudgetNumber(issuerId).then(num => {
            setBudgetNumber(num);
          });
        }
      }
    } else {
      getNextBudgetNumber(issuerId).then(num => {
        setBudgetNumber(num);
      });
    }
  }, [issuerId, date, editId, originalBudget]);

  const handleClientChange = (e) => {
    const id = e.target.value;
    setSelectedClientId(id);
    if (id) {
      const client = clients.find(c => c.id === id);
      setClientData(client);
    } else {
      setClientData(null);
    }
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setDate(newDate);
    if (!userHasEditedOperationDate) {
      setOperationDate(newDate);
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

  const updateLine = (id, fieldOrUpdates, value) => {
    setLines(prevLines => prevLines.map(l => {
      if (l.id === id) {
        if (typeof fieldOrUpdates === 'string') {
          return { ...l, [fieldOrUpdates]: value };
        } else {
          return { ...l, ...fieldOrUpdates };
        }
      }
      return l;
    }));
  };

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

  const handleSaveBudget = async (e) => {
    e.preventDefault();
    if (!clientData) {
      alert("Selecciona un client");
      return;
    }
    if (lines.length === 0) {
      alert("Afegeix almenys un producte al pressupost");
      return;
    }
    
    setIsSaving(true);
    const issuer = ISSUERS.find(i => i.id === issuerId);
    
    try {
      const dataToSave = {
        issuerId,
        issuerData: issuer,
        date,
        operationDate,
        budgetNumber,
        status,
        clientId: clientData.id,
        clientName: formatClientName(clientData.name),
        clientNif: clientData.nif,
        clientData: clientData,
        lines,
        notes,
        irpfPercent: parseFloat(irpfPercent) || 0,
        totals: calculateTotals()
      };

      let targetId = editId;
      if (editId) {
        await updateBudget(editId, dataToSave);
      } else {
        const docRef = await addBudget(dataToSave);
        if (docRef && docRef.id) targetId = docRef.id;
      }
      router.push(targetId ? `/dashboard/billing/budgets?highlight=${targetId}` : '/dashboard/billing/budgets');
    } catch (err) {
      console.error(err);
      alert('Error en guardar el pressupost.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (val) => {
    return (parseFloat(val) || 0).toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  };

  const totals = calculateTotals();

  if (loading || !user) return <div className="container mt-xl text-center">Carregant...</div>;

  if (!isAdmin) {
    return (
      <div className="container" style={{ paddingTop: 'var(--space-md)' }}>
        <div className="glass-panel text-center" style={{ padding: '3rem', maxWidth: '500px', margin: '2rem auto' }}>
          <h2 style={{ color: '#ff6b6b', marginBottom: '1rem' }}>⚠️ Accés Denegat</h2>
          <p>Només els administradors poden crear o editar pressupostos en aquesta aplicació.</p>
          <div style={{ marginTop: '2rem' }}>
            <Link href="/dashboard/billing/budgets" className="btn btn-primary">
              Tornar a Pressupostos
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
          <Link href="/dashboard/billing/budgets" className="btn-back no-print" title="Tornar a Pressupostos" style={{ marginRight: '1rem', verticalAlign: 'middle' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </Link>
          <h1 style={{ marginTop: '0.5rem', marginBottom: 0, color: 'var(--color-accent)', display: 'inline-block', verticalAlign: 'middle' }}>
            {editId ? `Editar Pressupost (${budgetNumber})` : 'Crear Nou Pressupost'}
          </h1>
        </div>
      </div>

      <div className="glass-panel animate-fade-in-up">
        <form onSubmit={handleSaveBudget} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div className="input-group">
              <label>Emissor del Pressupost</label>
              <select className="input-field" value={issuerId} onChange={e => setIssuerId(e.target.value)}>
                {ISSUERS.map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>Data del Pressupost</label>
              <input type="date" className="input-field" value={date} onChange={handleDateChange} required />
            </div>
            <div className="input-group">
              <label>Data d'Operació (Espectacle)</label>
              <input 
                type="date" 
                className="input-field" 
                value={operationDate} 
                onChange={e => {
                  setOperationDate(e.target.value);
                  setUserHasEditedOperationDate(true);
                }} 
                required 
              />
            </div>
            <div className="input-group">
              <label>Nº Pressupost</label>
              <input type="text" className="input-field" value={budgetNumber} onChange={e => setBudgetNumber(e.target.value)} required />
            </div>
            {editId && (
              <div className="input-group">
                <label>Estat del Pressupost</label>
                <select className="input-field" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="Pendent">Pendent</option>
                  <option value="Acceptat">Acceptat</option>
                  <option value="Rebutjat">Rebutjat</option>
                </select>
              </div>
            )}
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

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--color-accent)' }}>Línies del Pressupost</h3>
            
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
                      updateLine(line.id, {
                        isVatExempt: true,
                        vatPercent: 0,
                        exemptionCause: line.exemptionCause || 'E1',
                        exemptionText: line.exemptionText || "Exempt d'IVA segons l'Art. 20.Un.9è de la Llei 37/1992"
                      });
                    } else {
                      updateLine(line.id, {
                        isVatExempt: false,
                        vatPercent: parseFloat(e.target.value)
                      });
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
                        <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
                          Sugerit per a espectacles educatius: <strong style={{ color: '#f1c40f' }}>Exempt d'IVA segons l'Art. 20.Un.9è de la Llei 37/1992</strong>
                        </span>
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
                <label>Concepte / Observacions del Pressupost (Opcional)</label>
                <textarea 
                  className="input-field" 
                  rows="4" 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  placeholder="Validesa del pressupost, mètodes de pagament..." 
                />
              </div>
            </div>

            <div style={{ width: '100%', maxWidth: '400px', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: 'var(--radius-sm)' }}>
              <div className="input-group" style={{ marginBottom: '1rem' }}>
                <label>Retenció IRPF (%)</label>
                <input type="number" step="1" className="input-field" value={irpfPercent} onChange={e => setIrpfPercent(e.target.value)} />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Base imposable:</span> <span>{formatCurrency(totals.baseImposable)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Quota repercutida:</span> <span>{formatCurrency(totals.totalIva)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: '500', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '0.3rem' }}>
                <span>Total pressupost:</span> <span>{formatCurrency(totals.baseImposable + totals.totalIva)}</span>
              </div>
              {parseFloat(totals.totalIrpf || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#ff6b6b' }}>
                  <span>IRPF ({irpfPercent}%):</span> <span>-{formatCurrency(totals.totalIrpf)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '1rem', borderTop: '1.5px solid rgba(255,255,255,0.2)', fontWeight: 'bold', fontSize: '1.4rem', color: 'var(--color-accent)' }}>
                <span>TOTAL:</span> <span>{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '1rem', fontSize: '1.1rem' }} disabled={isSaving}>
              {isSaving ? 'Guardant Pressupost...' : (editId ? 'Guardar Canvis' : 'Crear Pressupost')}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

export default function NewBudgetPage() {
  return (
    <Suspense fallback={<div className="container mt-xl text-center">Carregant formulari...</div>}>
      <BudgetForm />
    </Suspense>
  );
}
