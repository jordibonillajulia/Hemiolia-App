'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../../../lib/AuthContext';
import { getBudgetById, deleteBudget, formatClientName } from '../../../../../lib/firestoreUtils';
import Link from 'next/link';

export default function BudgetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const budgetId = params.id;
  const { user, loading } = useAuth();
  
  const [budget, setBudget] = useState(null);
  const [isSigned, setIsSigned] = useState(false);
  const [isSigningPDF, setIsSigningPDF] = useState(false);

  useEffect(() => {
    if (user && budgetId) {
      getBudgetById(budgetId).then(b => {
        setBudget(b);
      });
    }
  }, [user, budgetId]);

  const handlePrint = () => {
    window.print();
  };

  const handleSignAndDownloadPDF = async () => {
    setIsSigningPDF(true);
    const wasSigned = isSigned;
    
    let elementToRestore = null;
    let originalPadding = '';
    let originalMinHeight = '';

    try {
      // Toggle visual signature if not already active to capture it
      if (!wasSigned) {
        setIsSigned(true);
        // Wait for React DOM to render the signature box
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      // Add a class to body to force desktop layout for high-quality snapshot
      document.body.classList.add('generating-pdf');
      // Small timeout to allow DOM/styles layout to recalculate
      await new Promise(resolve => setTimeout(resolve, 100));

      // Dynamically import client-side modules to prevent SSR reference errors
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const element = document.querySelector('.invoice-paper');
      if (!element) throw new Error("No s'ha trobat la targeta del pressupost.");

      elementToRestore = element;
      originalPadding = element.style.padding;
      originalMinHeight = element.style.minHeight;

      // Adjust padding temporarily to push the footer closer to the absolute bottom of the PDF page
      element.style.padding = '2.5rem 2.5rem 0.6rem 2.5rem';
      element.style.minHeight = '29.7cm';

      const canvas = await html2canvas(element, {
        scale: 2, // High resolution
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 794,
        height: 1123,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 794,
        windowHeight: 1123
      });

      // Remove the layout override class immediately after snapshot is captured
      document.body.classList.remove('generating-pdf');

      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

      // Extract raw Base64 bytes
      const pdfBase64 = pdf.output('datauristring').split(',')[1];

      // Request server to sign the PDF cryptographically (PAdES)
      const response = await fetch('/api/billing/budgets/sign-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfBase64,
          issuerNif: budget.issuerData?.nif
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error signant el PDF al servidor.');
      }

      const signedPdfBase64 = data.signedPdfBase64;

      // Convert Base64 back to Blob
      const byteCharacters = atob(signedPdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      // Trigger browser download
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const fileName = `pressupost_${budget.budgetNumber || 'pressupost'}_signat.pdf`;

      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      alert('Pressupost signat digitalment i descarregat correctament!');
    } catch (err) {
      console.error('Error signant el pressupost:', err);
      alert(`Error en signar digitalment: ${err.message}\nAssegura't de posar les contrasenyes del certificat al .env.local!`);
    } finally {
      document.body.classList.remove('generating-pdf');
      setIsSigningPDF(false);
      // Restore previous signature state if it wasn't visually signed
      if (!wasSigned) {
        setIsSigned(false);
      }
      // Restore styles if modified
      if (elementToRestore) {
        elementToRestore.style.padding = originalPadding;
        elementToRestore.style.minHeight = originalMinHeight;
      }
    }
  };

  const handleConvertToInvoice = () => {
    if (confirm('Estàs segur que vols convertir aquest pressupost en una nova factura? Es pre-carregaran totes les dades del client i línies de concepte.')) {
      router.push(`/dashboard/billing/new?fromBudget=${budgetId}`);
    }
  };

  if (loading || !user || !budget) return <div className="container mt-xl text-center">Carregant pressupost...</div>;

  const formatCurrency = (val) => {
    return (parseFloat(val) || 0).toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  };

  const formatDate = (dateStr) => {
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

  const getValidityDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 30);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getVerificationCode = (id) => {
    if (!id) return '';
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash << 5) - hash + id.charCodeAt(i);
      hash |= 0;
    }
    const val1 = Math.abs(hash).toString(36).toUpperCase().padStart(5, '0');
    const val2 = Math.abs(hash * 31).toString(36).toUpperCase().padStart(5, '0');
    return `CSV-PB-${val1}-${val2}`;
  };

  // Tax breakdown calculation
  const taxableGroups = {};
  const exemptGroups = {};

  (budget.lines || []).forEach(line => {
    const amount = parseFloat(line.amount) || 0;
    const isExempt = line.isVatExempt === true || line.isVatExempt === 'true';

    if (isExempt) {
      const cause = line.exemptionCause || 'E1';
      exemptGroups[cause] = (exemptGroups[cause] || 0) + amount;
    } else {
      const vatPercent = parseFloat(line.vatPercent) || 0;
      if (!taxableGroups[vatPercent]) {
        taxableGroups[vatPercent] = { base: 0, cuota: 0 };
      }
      taxableGroups[vatPercent].base += amount;
      taxableGroups[vatPercent].cuota += amount * (vatPercent / 100);
    }
  });

  const taxLines = [];
  
  for (const [vatPercent, group] of Object.entries(taxableGroups)) {
    taxLines.push({
      base: group.base,
      type: `IVA (${parseFloat(vatPercent).toFixed(2).replace('.', ',')} %)`,
      cuota: group.cuota
    });
  }

  for (const [cause, baseAmount] of Object.entries(exemptGroups)) {
    const lineWithCause = (budget.lines || []).find(l => (l.isVatExempt === true || l.isVatExempt === 'true') && l.exemptionCause === cause);
    const textDetail = lineWithCause?.exemptionText || '';
    taxLines.push({
      base: baseAmount,
      type: `Exempt (${cause})${textDetail ? ` - ${textDetail}` : ''}`,
      cuota: 0
    });
  }

  const isLongBudget = (budget.lines || []).length > 3 || (budget.notes || '').length > 60;

  return (
    <div className="container" style={{ paddingTop: 'var(--space-md)', paddingBottom: 'var(--space-xl)' }}>
      {/* NO-PRINT HEADER */}
      <div className="no-print no-print-header" style={{ marginBottom: 'var(--space-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <Link href="/dashboard/billing/budgets" className="btn-back no-print" title="Tornar a Pressupostos" style={{ marginRight: '1rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </Link>
          <h1 style={{ marginTop: '0.5rem', marginBottom: '0.2rem', color: 'var(--color-accent)', whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'middle' }}>
            Visor de Pressupost
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>Data: {formatDate(budget.date)}</p>
        </div>
        
        <div className="no-print-button-group" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ 
            padding: '0.5rem 0.8rem', 
            borderRadius: 'var(--radius-full)', 
            background: budget.status === 'Acceptat' 
              ? 'rgba(46, 204, 113, 0.2)' 
              : budget.status === 'Rebutjat' 
              ? 'rgba(231, 76, 60, 0.2)' 
              : 'rgba(241, 196, 15, 0.2)',
            color: budget.status === 'Acceptat' 
              ? 'var(--color-success)' 
              : budget.status === 'Rebutjat' 
              ? '#ff6b6b' 
              : 'var(--color-accent)',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            fontSize: '0.9rem'
          }}>
            Estat: {budget.status || 'Pendent'}
          </div>
          
          <Link href={`/dashboard/billing/budgets/new?edit=${budget.id}`} className="btn btn-glass" style={{ whiteSpace: 'nowrap' }}>
            ✏️ Editar
          </Link>

          <button className="btn btn-glass" onClick={handlePrint} style={{ whiteSpace: 'nowrap' }}>
            🖨️ Imprimir
          </button>

          <button 
            className="btn btn-primary" 
            onClick={handleSignAndDownloadPDF}
            disabled={isSigningPDF}
            style={{ background: '#27ae60', borderColor: '#2ecc71', display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}
          >
            🖋️ {isSigningPDF ? 'Signant...' : 'Signar i Descarregar PDF'}
          </button>

          <button className="btn btn-primary" onClick={handleConvertToInvoice} style={{ whiteSpace: 'nowrap' }}>
            🚀 Facturar
          </button>
        </div>
      </div>

      {/* BUDGET PAPER (PRINTABLE) */}
      <div className={`glass-panel invoice-paper ${isLongBudget ? 'print-compact' : ''}`} style={{ 
        background: '#ffffff', 
        color: '#000000', 
        borderRadius: '8px', 
        padding: '2.5rem', 
        position: 'relative',
        boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        minHeight: '29.7cm' // A4 Height aspect
      }}>
        
        {/* TOP: EMISSOR BLOCK */}
        <div className="top-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', gap: '2rem' }}>
          <div className="emissor-box info-box" style={{ 
            flex: 1, 
            border: '1px solid #e2e8f0', 
            borderRadius: '6px', 
            padding: '0.85rem 1.2rem', 
            background: '#f8fafc', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.4rem'
          }}>
            <h3 style={{ margin: '0', fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', color: '#475569', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.2rem' }}>Emissor</h3>
            <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1.5rem' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.95rem', color: '#1e293b' }}>
                <div><strong>NIF:</strong> {budget.issuerData?.nif}</div>
                <div><strong>Nom i cognoms:</strong> {budget.issuerData?.name}</div>
                <div><strong>Adreça:</strong> {budget.issuerData?.address}</div>
                <div>{budget.issuerData?.postalCode} {budget.issuerData?.municipality} ({budget.issuerData?.province}) - Espanya</div>
                <div><strong>Telèfon:</strong> {budget.issuerData?.phone}</div>
                <div><strong>Adreça electrònica:</strong> {budget.issuerData?.email}</div>
              </div>
              <div className="emissor-logo-container" style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                flexShrink: 0,
                background: '#0a0a0c',
                padding: '0.6rem 1.2rem',
                borderRadius: '6px'
              }}>
                <img src="/logo-hemiolia-dark.png" alt="Hemiòlia Logo" className="emissor-logo" style={{ maxHeight: '145px', maxWidth: '240px', objectFit: 'contain' }} />
              </div>
            </div>
          </div>
        </div>

        {/* DETAILS ROW */}
        <div className="details-row" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          background: '#f1f5f9', 
          border: '1px solid #e2e8f0',
          borderRadius: '6px', 
          padding: '0.85rem 1.2rem'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PRESSUPOST</h2>
            <p style={{ margin: '0.15rem 0 0 0', fontSize: '1.05rem', color: '#334155' }}>
              <strong>Núm. Pressupost:</strong> {budget.budgetNumber}
            </p>
          </div>
          <div className="dates-block" style={{ textAlign: 'right', fontSize: '0.92rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div><strong>Data d&apos;operació:</strong> {formatDate(budget.operationDate || budget.date)}</div>
            <div><strong>Data de pressupost:</strong> {formatDate(budget.date)}</div>
          </div>
        </div>

        {/* DESTINATARI BLOCK */}
        <div className="destinatari-box info-box" style={{ 
          border: '1px solid #e2e8f0', 
          borderRadius: '6px', 
          padding: '0.85rem 1.2rem', 
          background: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem'
        }}>
          <h3 style={{ margin: '0', fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', color: '#475569', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.2rem' }}>Destinatari</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.95rem', color: '#1e293b' }}>
            <div><strong>NIF/ID:</strong> {budget.clientNif}</div>
            <div><strong>Raó social:</strong> {formatClientName(budget.clientName)}</div>
            <div><strong>Adreça:</strong> {budget.clientData?.address}</div>
            <div>{budget.clientData?.postalCode} {budget.clientData?.municipality} ({budget.clientData?.province}) {budget.clientData?.country ? `- ${budget.clientData.country}` : ''}</div>
          </div>
        </div>

        {/* BUDGET LINES TABLE */}
        <div className="table-container" style={{ width: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a' }}>
                <th style={{ padding: '0.6rem 0.8rem', textAlign: 'left', fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#0f172a', whiteSpace: 'nowrap' }}>Concepte</th>
                <th style={{ padding: '0.6rem 0.8rem', textAlign: 'right', fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#0f172a', width: '90px', whiteSpace: 'nowrap' }}>Tipus</th>
                <th style={{ padding: '0.6rem 0.8rem', textAlign: 'right', fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#0f172a', width: '50px', whiteSpace: 'nowrap' }}>U.</th>
                <th style={{ padding: '0.6rem 0.8rem', textAlign: 'right', fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#0f172a', width: '110px', whiteSpace: 'nowrap' }}>Preu unitari</th>
                <th style={{ padding: '0.6rem 0.8rem', textAlign: 'right', fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#0f172a', width: '110px', whiteSpace: 'nowrap' }}>Import</th>
              </tr>
            </thead>
            <tbody>
              {budget.lines?.map((line, idx) => {
                const amt = parseFloat(line.amount) || 0;
                const isExempt = line.isVatExempt === true || line.isVatExempt === 'true';
                const vatPercentDisplay = isExempt ? '0,00 %' : `${parseFloat(line.vatPercent).toFixed(2).replace('.', ',')} %`;
                
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td data-label="Concepte" style={{ padding: '0.75rem 0.8rem', fontSize: '0.9rem', color: '#1e293b' }}>
                      <strong style={{ display: 'block', color: '#0f172a' }}>{line.description}</strong>
                      {isExempt && (
                        <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginTop: '0.1rem' }}>
                          Exempt d&apos;IVA ({line.exemptionCause || 'E1'}). {line.exemptionText || ''}
                        </span>
                      )}
                    </td>
                    <td data-label="Tipus" style={{ padding: '0.75rem 0.8rem', textAlign: 'right', fontSize: '0.9rem', color: '#334155' }}>
                      {vatPercentDisplay}
                    </td>
                    <td data-label="U." style={{ padding: '0.75rem 0.8rem', textAlign: 'right', fontSize: '0.9rem', color: '#334155' }}>
                      1,00
                    </td>
                    <td data-label="Preu unitari" style={{ padding: '0.75rem 0.8rem', textAlign: 'right', fontSize: '0.9rem', color: '#334155' }}>
                      {formatCurrency(amt)}
                    </td>
                    <td data-label="Import" style={{ padding: '0.75rem 0.8rem', textAlign: 'right', fontSize: '0.9rem', fontWeight: 'bold', color: '#0f172a' }}>
                      {formatCurrency(amt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* CONCEPTE / DESCRIPCIO BOX */}
        {budget.notes && (
          <div className="notes-box info-box" style={{ 
            border: '1px solid #e2e8f0', 
            borderRadius: '6px', 
            padding: '0.75rem 1.1rem', 
            background: '#f8fafc',
            fontSize: '0.78rem', 
            color: '#1e293b', 
            lineHeight: '1.45',
            marginTop: '0.4rem',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem'
          }}>
            <h4 style={{ margin: '0', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.15rem' }}>
              Descripció del pressupost
            </h4>
            <div style={{ whiteSpace: 'normal', color: '#1e293b', paddingTop: '0.1rem' }}>
              {budget.notes.replace(/\r?\n/g, ' ')}
            </div>
          </div>
        )}

        {/* IMPOSTOS & IMPORTS */}
        <div className="totals-section" style={{ display: 'flex', justifyContent: 'space-between', gap: '2rem', pageBreakInside: 'avoid', marginTop: 'auto' }}>
          <div style={{ flex: 1.2, border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', height: 'fit-content' }}>
            <div style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', padding: '0.45rem', textTransform: 'uppercase', fontWeight: 'bold', fontSize: '0.8rem', letterSpacing: '1px', color: '#0f172a', textAlign: 'center' }}>
              Impostos
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#ffffff', borderBottom: '1px solid #0f172a' }}>
                  <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 'bold', color: '#0f172a', borderBottom: '1px solid #0f172a' }}>Base imposable</th>
                  <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 'bold', color: '#0f172a', borderBottom: '1px solid #0f172a' }}>Tipus impositiu</th>
                  <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 'bold', color: '#0f172a', borderBottom: '1px solid #0f172a' }}>Quota Repercutida</th>
                </tr>
              </thead>
              <tbody>
                {taxLines.map((tLine, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontSize: '0.8rem', color: '#334155' }}>
                      {formatCurrency(tLine.base)}
                    </td>
                    <td style={{ padding: '0.45rem 0.5rem', textAlign: 'center', fontSize: '0.8rem', color: '#334155' }}>
                      {tLine.type}
                    </td>
                    <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontSize: '0.8rem', color: '#334155' }}>
                      {formatCurrency(tLine.cuota)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ flex: 0.8, border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', background: '#ffffff', height: 'fit-content' }}>
            <div style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', padding: '0.45rem', textTransform: 'uppercase', fontWeight: 'bold', fontSize: '0.8rem', letterSpacing: '1px', color: '#0f172a', textAlign: 'center' }}>
              Imports
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem', padding: '0.75rem 1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#334155' }}>
                <span>Base imposable:</span>
                <span>{formatCurrency(budget.totals?.baseImposable)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#334155' }}>
                <span>Quota repercutida:</span>
                <span>{formatCurrency(budget.totals?.totalIva)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '500', color: '#0f172a', borderTop: '1px dashed #e2e8f0', paddingTop: '0.3rem' }}>
                <span>Total pressupost:</span>
                <span>{formatCurrency(parseFloat(budget.totals?.baseImposable || 0) + parseFloat(budget.totals?.totalIva || 0))}</span>
              </div>
              {parseFloat(budget.totals?.totalIrpf || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e11d48' }}>
                  <span>IRPF ({budget.irpfPercent}%):</span>
                  <span>-{formatCurrency(budget.totals?.totalIrpf)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#0f172a', borderTop: '1.5px solid #0f172a', paddingTop: '0.4rem', marginTop: '0.2rem' }}>
                <span style={{ whiteSpace: 'nowrap' }}>TOTAL:</span>
                <span style={{ color: 'var(--color-accent, #d4af37)', whiteSpace: 'nowrap' }}>{formatCurrency(budget.totals?.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* PAYMENT / ACCEPTANCE CONDITIONS BLOCK */}
        <div className="payment-box" style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', pageBreakInside: 'avoid', marginTop: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#0f172a', textAlign: 'center', width: '30%', whiteSpace: 'nowrap' }}>Validesa del pressupost</th>
                <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#0f172a', textAlign: 'center', width: '30%', whiteSpace: 'nowrap' }}>Forma de pagament</th>
                <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#0f172a', textAlign: 'center', width: '40%', whiteSpace: 'nowrap' }}>
                  IBAN <span style={{ fontSize: '0.62rem', textTransform: 'none', fontWeight: 'normal', color: '#475569' }}>(si s&apos;accepta)</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td data-label="Validesa" style={{ padding: '0.55rem 0.5rem', fontSize: '0.9rem', color: '#1e293b', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                  Fins a {getValidityDate(budget.date)} (30 dies)
                </td>
                <td data-label="Forma de pagament" style={{ padding: '0.55rem 0.5rem', fontSize: '0.9rem', color: '#1e293b', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                  Transferència bancària
                </td>
                <td data-label="IBAN (si s'accepta)" style={{ padding: '0.55rem 0.5rem', fontSize: '0.85rem', fontFamily: 'monospace', color: '#1e293b', textAlign: 'center', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                  {budget.issuerData?.iban}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* SIGNATURE BLOCK */}
        {isSigned && (
          <div className="signature-stamp-box" style={{
            alignSelf: 'flex-end',
            border: '1px dashed #2ecc71',
            borderRadius: '6px',
            padding: '0.6rem 1rem',
            background: 'rgba(46, 204, 113, 0.02)',
            fontSize: '0.75rem',
            color: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginTop: '1.5rem',
            maxWidth: '380px',
            pageBreakInside: 'avoid'
          }}>
            <div style={{ fontSize: '1.5rem' }}>🖋️</div>
            <div>
              <div style={{ fontWeight: 'bold', color: '#27ae60', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Signat Digitalment
              </div>
              <div style={{ marginTop: '0.15rem' }}>
                <strong>Signatari:</strong> {budget.issuerData?.name || 'Hemiòlia'}
              </div>
              <div>
                <strong>NIF:</strong> {budget.issuerData?.nif}
              </div>
              <div>
                <strong>Data de signatura:</strong> {(() => { const now = new Date(); return `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`; })()} a les {new Date().toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div style={{ fontSize: '0.65rem', color: '#64748b', fontFamily: 'monospace', marginTop: '0.15rem' }}>
                CSV: {getVerificationCode(budget.id)}
              </div>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="footer-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#64748b' }}>
          <div style={{ width: '60px' }}></div> 
          <div style={{ fontWeight: '500', letterSpacing: '0.5px' }}>www.hemiolia.cat</div>
          <div style={{ width: '60px' }}></div>
        </div>

      </div>
    </div>
  );
}
