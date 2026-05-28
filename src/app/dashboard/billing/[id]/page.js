'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '../../../../lib/AuthContext';
import { getInvoiceById, updateInvoiceStatus, formatDisplayInvoiceNumber, formatClientName } from '../../../../lib/firestoreUtils';
import Link from 'next/link';
import { generateFacturaeXML } from '../../../../lib/facturaeGenerator';

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params.id;
  const { user, loading, isAdmin } = useAuth();
  
  const [invoice, setInvoice] = useState(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (user && invoiceId) {
      getInvoiceById(invoiceId).then(inv => {
        setInvoice(inv);
      });
    }
  }, [user, invoiceId]);

  const handleSendToVeriFactu = async (isProd = false) => {
    const confirmMsg = isProd 
      ? 'Estàs segur que vols enviar aquesta factura REAL a Hisenda (AEAT)? Un cop enviada, quedarà registrada oficialment, serà de caràcter definitiu i no es pobrà modificar ni esborrar.'
      : 'Estàs segur que vols enviar aquesta factura en mode de PROVA a Hisenda (AEAT)? Aquest és un entorn de proves i no té validesa legal.';

    if (!confirm(confirmMsg)) {
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch('/api/billing/verifactu/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invoiceId, isProduction: isProd }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error desconegut en la tramesa.');
      }

      const updatedInv = await getInvoiceById(invoiceId);
      setInvoice(updatedInv);
      alert(isProd 
        ? 'Factura enviada i registrada correctament a l\'Agència Tributària Real (AEAT)!'
        : 'Factura enviada i validada correctament a l\'entorn de PROVA de l\'AEAT!'
      );
    } catch (err) {
      console.error(err);
      alert(`Error en l'enviament a VeriFactu: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const [isSigning, setIsSigning] = useState(false);

  const handleDownloadFacturaeXML = async () => {
    setIsSigning(true);
    try {
      const xml = generateFacturaeXML(invoice);
      
      const response = await fetch('/api/billing/facturae/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          xmlString: xml,
          issuerNif: invoice.issuerData?.nif
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error signant la factura.');
      }

      const signedXml = data.signedXml;

      const blob = new Blob([signedXml], { type: 'application/xml;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      const fileName = `${invoice.invoiceNumber || 'factura'}_facturae_signed.xml`;
      
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error generant el fitxer Facturae XML:', err);
      alert(`Error en signar i generar el fitxer XML: ${err.message}\nAssegura't de posar les contrasenyes a l'arxiu .env.local!`);
    } finally {
      setIsSigning(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading || !user || !invoice) return <div className="container mt-xl text-center">Carregant factura...</div>;

  const isLocked = invoice.status === 'Enviada';

  // Format currencies
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

  const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return '';
    const d = new Date(dateTimeStr);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

  const getTipoFacturaTitle = (code) => {
    switch (code) {
      case 'F1': return 'Factura Ordinària';
      case 'F2': return 'Factura Simplificada';
      case 'R1': return 'Factura Rectificativa';
      case 'R2': return 'Factura Rectificativa';
      case 'R3': return 'Factura Rectificativa';
      case 'R4': return 'Factura Rectificativa';
      case 'R5': return 'Factura Rectificativa Simplificada';
      default: return 'Factura Ordinària';
    }
  };

  const getClaveRegimenTitle = (code) => {
    if (!code || code === '01') return 'operacions de règim general';
    switch (code) {
      case '02': return '02 - Exportació';
      case '03': return '03 - Canàries, Ceuta i Melilla';
      case '08': return '08 - Operacions amb inversió del subjecte passiu (ISP)';
      default: return `${code} - operacions de règim general`;
    }
  };


  // Get due date (25 days after invoice date)
  const getDueDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 25);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Generar URL de verificació per al codi QR de Veri*factu
  const qrDate = invoice.date ? (() => {
    const parts = invoice.date.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    const d = new Date(invoice.date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  })() : '';
  const qrAmount = invoice.totals 
    ? (parseFloat(invoice.totals.baseImposable || 0) + parseFloat(invoice.totals.totalIva || 0)).toFixed(2) 
    : '0.00';
  const issuerNif = invoice.issuerData?.nif || '';
  const invoiceNum = invoice.invoiceNumber || '';

  const isProduction = invoice.verifactuEnv === 'production' || invoice.verifactuId === 'AEAT-APP';
  const qrBaseUrl = isProduction 
    ? 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR' 
    : 'https://www5.aeat.es/wlpl/YECB-VFA1/Verifica';
  const numParam = isProduction ? 'numserie' : 'numfact';
  const qrUrl = `${qrBaseUrl}?nif=${issuerNif}&${numParam}=${encodeURIComponent(invoiceNum)}&fecha=${qrDate}&importe=${qrAmount}`;

  // Calcular desglossament de taxes/impostos dinàmicament
  const taxableGroups = {};
  const exemptGroups = {};

  (invoice.lines || []).forEach(line => {
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
    const lineWithCause = (invoice.lines || []).find(l => (l.isVatExempt === true || l.isVatExempt === 'true') && l.exemptionCause === cause);
    const textDetail = lineWithCause?.exemptionText || '';
    taxLines.push({
      base: baseAmount,
      type: `Exempt (${cause})${textDetail ? ` - ${textDetail}` : ''}`,
      cuota: 0
    });
  }

  // Descripció de la factura amb nota legal del 10% d'IVA si escau
  const has10PercentVat = invoice.lines?.some(line => parseFloat(line.vatPercent) === 10 && !line.isVatExempt);
  const legalNote10 = "D'acord amb el que s'especifica l'article 91.U.2.13, de la llei 37-1992 de 28 de desembre de l'IVA (BOE 312, de 29-12-1992), s'aplica el tipus d'IVA reduït a aquesta prestació de serveis.";
  
  const isLongInvoice = (invoice.lines || []).length > 3 || (invoice.notes || '').length > 60 || invoice.tipoFactura?.startsWith('R') || has10PercentVat;

  return (
    <div className="container" style={{ paddingTop: 'var(--space-md)', paddingBottom: 'var(--space-xl)' }}>
      {/* NO-PRINT HEADER */}
      <div className="no-print" style={{ marginBottom: 'var(--space-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Link href="/dashboard/billing" className="btn-back no-print" title="Tornar a Facturació" style={{ marginRight: '1rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </Link>
          <h1 style={{ marginTop: '0.5rem', marginBottom: '0.2rem', color: 'var(--color-accent)', display: 'inline-block', verticalAlign: 'middle' }}>
            Visor de Factura
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>Data: {formatDate(invoice.date)}</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ 
            padding: '0.5rem 1rem', 
            borderRadius: 'var(--radius-full)', 
            background: isLocked ? 'rgba(46, 204, 113, 0.2)' : 'rgba(241, 196, 15, 0.2)',
            color: isLocked ? 'var(--color-success)' : 'var(--color-accent)',
            fontWeight: 'bold'
          }}>
            Estat: {invoice.status}
          </div>
          <button className="btn btn-primary" onClick={handlePrint}>
            🖨️ Generar PDF / Imprimir
          </button>
        </div>
      </div>

      {/* INVOICE PAPER (PRINTABLE) */}
      <div className={`glass-panel invoice-paper ${isLongInvoice ? 'print-compact' : ''}`} style={{ 
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
        
        {/* TOP: QR BLOCK + EMISSOR BLOCK */}
        <div className="top-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', gap: '2rem' }}>
           {/* QR / e-Fact block on the left */}
          <div className="qr-box info-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '130px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.75rem', background: '#f8fafc' }}>
            {invoice.verifactuId === 'E-FACT' ? (
              <>
                <div style={{ 
                  width: '95px', 
                  height: '95px', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '4px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  flexDirection: 'column',
                  background: '#ffffff',
                  padding: '5px',
                  boxSizing: 'border-box'
                }}>
                  <span style={{ fontSize: '1.8rem' }}>⚡</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--color-success)', marginTop: '0.2rem' }}>e-Fact</span>
                </div>
                <span style={{ fontSize: '0.6rem', fontWeight: 'bold', marginTop: '0.4rem', letterSpacing: '0.5px', color: '#0f172a' }}>FACTURA ELECTRÒNICA</span>
                <span style={{ fontSize: '0.48rem', color: '#64748b', textAlign: 'center', marginTop: '0.2rem', lineHeight: '1.2' }}>Presentada via e-Fact / FACe</span>
              </>
            ) : isLocked ? (
              <>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=95x95&data=${encodeURIComponent(qrUrl)}`} 
                  alt="Codi QR AEAT" 
                  style={{ width: '95px', height: '95px', border: '1px solid #e2e8f0', padding: '2px', borderRadius: '4px', background: '#fff' }} 
                />
                <span style={{ fontSize: '0.65rem', fontWeight: 'bold', marginTop: '0.4rem', letterSpacing: '1px', color: '#0f172a' }}>VERI*FACTU</span>
                <span style={{ fontSize: '0.55rem', color: '#64748b', textAlign: 'center', marginTop: '0.2rem', lineHeight: '1.2' }}>Factura verificable a la seu de l&apos;AEAT</span>
              </>
            ) : (
              <>
                <div style={{ 
                  width: '95px', 
                  height: '95px', 
                  border: '1px dashed #cbd5e1', 
                  borderRadius: '4px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  flexDirection: 'column',
                  background: '#ffffff',
                  padding: '5px',
                  boxSizing: 'border-box'
                }}>
                  <span style={{ fontSize: '0.55rem', color: '#94a3b8', textAlign: 'center', lineHeight: '1.2' }}>QR VERI*FACTU<br/>(Pendent d&apos;enviament)</span>
                </div>
                <span style={{ fontSize: '0.65rem', fontWeight: 'bold', marginTop: '0.4rem', letterSpacing: '1px', color: '#94a3b8' }}>VERI*FACTU</span>
              </>
            )}
          </div>

          {/* EMISSOR block on the right with logo embedded inside */}
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
                <div><strong>NIF:</strong> {invoice.issuerData?.nif}</div>
                <div><strong>Nom i cognoms:</strong> {invoice.issuerData?.name}</div>
                <div><strong>Adreça:</strong> {invoice.issuerData?.address}</div>
                <div>{invoice.issuerData?.postalCode} {invoice.issuerData?.municipality} ({invoice.issuerData?.province}) - Espanya</div>
                <div><strong>Telèfon:</strong> {invoice.issuerData?.phone}</div>
                <div><strong>Adreça electrònica:</strong> {invoice.issuerData?.email}</div>
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

        {/* FACTURA DETAILS ROW */}
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
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{getTipoFacturaTitle(invoice.tipoFactura)}</h2>
            <p style={{ margin: '0.15rem 0 0 0', fontSize: '1.05rem', color: '#334155' }}>
              <strong>Núm. sèrie - Factura:</strong> {invoice.invoiceNumber}
            </p>
          </div>
          <div className="dates-block" style={{ textAlign: 'right', fontSize: '0.92rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div><strong>Data d&apos;emissió:</strong> {formatDate(invoice.date)}</div>
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
            <div>
              <strong>NIF/ID:</strong> {invoice.clientNif}
              {invoice.clientNifType && invoice.clientNifType !== 'NIF' && ` (${invoice.clientNifType})`}
              {invoice.clientCountryCode && invoice.clientCountryCode !== 'ES' && ` [${invoice.clientCountryCode}]`}
            </div>
            <div><strong>Raó social:</strong> {formatClientName(invoice.clientName)}</div>
            <div><strong>Adreça:</strong> {invoice.clientData?.address}</div>
            <div>{invoice.clientData?.postalCode} {invoice.clientData?.municipality} ({invoice.clientData?.province}) {invoice.clientData?.country ? `- ${invoice.clientData.country}` : ''}</div>
          </div>
        </div>

        {/* REGIM D'APLICACIO ROW */}
        <div className="regimen-row info-box" style={{ 
          border: '1px solid #e2e8f0', 
          borderRadius: '6px', 
          padding: '0.5rem 1rem', 
          background: '#ffffff', 
          fontSize: '0.9rem', 
          color: '#1e293b' 
        }}>
          <strong>Règim d&apos;aplicació:</strong> operacions de règim general.
        </div>

        {/* RECUADRO DE RECTIFICACIÓN CONDICIONAL */}
        {invoice.tipoFactura?.startsWith('R') && (
          <div className="rectification-box info-box" style={{ 
            border: '1px solid #e11d48', 
            borderRadius: '6px', 
            padding: '0.75rem 1rem', 
            background: 'rgba(225, 29, 72, 0.03)', 
            fontSize: '0.9rem', 
            color: '#1e293b',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.2rem'
          }}>
            <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '0.9rem', fontWeight: 'bold', color: '#e11d48', textTransform: 'uppercase' }}>Informació de Rectificació</h4>
            <div><strong>Tipus de rectificativa:</strong> {invoice.rectificationType === 'S' ? 'S - Per substitució (reemplaça totalment la factura original)' : 'I - Per diferències'}</div>
            <div><strong>Factura original rectificada:</strong> {invoice.rectifiedInvoiceNumber}</div>
            <div><strong>Data factura original:</strong> {invoice.rectifiedInvoiceDate ? formatDate(invoice.rectifiedInvoiceDate) : '-'}</div>
          </div>
        )}

        {/* DADES DE REGISTRE VERI*FACTU (AEAT) */}
        {invoice.huella && (
          <div className="huella-box info-box" style={{ 
            border: '1px solid #2ecc71', 
            borderRadius: '4px', 
            padding: '0.25rem 0.6rem', 
            background: 'rgba(46, 204, 113, 0.05)', 
            fontSize: '0.72rem', 
            color: '#27ae60',
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.6rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden'
          }}>
            <span style={{ color: '#1e293b' }}>
              <strong>Hash:</strong> <span style={{ fontFamily: 'monospace', fontSize: '0.68rem' }}>{invoice.huella}</span>
            </span>
            {invoice.fechaHoraHusoGenRegistro && (
              <>
                <span style={{ color: '#bdc3c7' }}>|</span>
                <span style={{ color: '#1e293b' }}>
                  <strong>Registre AEAT:</strong> {formatDateTime(invoice.fechaHoraHusoGenRegistro)}
                </span>
              </>
            )}
          </div>
        )}

        {/* INVOICE LINES TABLE */}
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
              {invoice.lines?.map((line, idx) => {
                const amt = parseFloat(line.amount) || 0;
                const isExempt = line.isVatExempt === true || line.isVatExempt === 'true';
                const vatPercentDisplay = isExempt ? '0,00 %' : `${parseFloat(line.vatPercent).toFixed(2).replace('.', ',')} %`;
                
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.75rem 0.8rem', fontSize: '0.9rem', color: '#1e293b' }}>
                      <strong style={{ display: 'block', color: '#0f172a' }}>{line.description}</strong>
                      {isExempt && (
                        <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginTop: '0.1rem' }}>
                          Exempt d&apos;IVA ({line.exemptionCause || 'E1'}). {line.exemptionText || (['E1','E2','E3','E4','E5','E6'].includes(line.exemptionCause) ? '' : line.exemptionCause)}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 0.8rem', textAlign: 'right', fontSize: '0.9rem', color: '#334155' }}>
                      {vatPercentDisplay}
                    </td>
                    <td style={{ padding: '0.75rem 0.8rem', textAlign: 'right', fontSize: '0.9rem', color: '#334155' }}>
                      1,00
                    </td>
                    <td style={{ padding: '0.75rem 0.8rem', textAlign: 'right', fontSize: '0.9rem', color: '#334155' }}>
                      {formatCurrency(amt)}
                    </td>
                    <td style={{ padding: '0.75rem 0.8rem', textAlign: 'right', fontSize: '0.9rem', fontWeight: 'bold', color: '#0f172a' }}>
                      {formatCurrency(amt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {has10PercentVat && (
            <div className="legal-note-vat10" style={{ 
              fontSize: '0.52rem', 
              color: '#475569', 
              marginTop: '0.2rem', 
              paddingLeft: '0.8rem',
              fontStyle: 'italic', 
              lineHeight: '1.3', 
              fontWeight: 'normal',
              whiteSpace: 'nowrap'
            }}>
              {legalNote10}
            </div>
          )}
        </div>

        {/* CONCEPTE / DESCRIPCIO BOX */}
        {invoice.notes && (
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
              Descripció de la factura
            </h4>
            <div style={{ whiteSpace: 'normal', color: '#1e293b', paddingTop: '0.1rem' }}>
              {invoice.notes.replace(/\r?\n/g, ' ')}
            </div>
          </div>
        )}

        {/* IMPOSTOS & IMPORTS SIDE-BY-SIDE */}
        <div className="totals-section" style={{ display: 'flex', justifyContent: 'space-between', gap: '2rem', pageBreakInside: 'avoid', marginTop: 'auto' }}>
          {/* IMPOSTOS TABLE */}
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

          {/* IMPORTS SUMMARY */}
          <div style={{ flex: 0.8, border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', background: '#ffffff', height: 'fit-content' }}>
            <div style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', padding: '0.45rem', textTransform: 'uppercase', fontWeight: 'bold', fontSize: '0.8rem', letterSpacing: '1px', color: '#0f172a', textAlign: 'center' }}>
              Imports
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem', padding: '0.75rem 1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#334155' }}>
                <span>Base imposable:</span>
                <span>{formatCurrency(invoice.totals?.baseImposable)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#334155' }}>
                <span>Quota repercutida:</span>
                <span>{formatCurrency(invoice.totals?.totalIva)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '500', color: '#0f172a', borderTop: '1px dashed #e2e8f0', paddingTop: '0.3rem' }}>
                <span>Total factura:</span>
                <span>{formatCurrency(parseFloat(invoice.totals?.baseImposable || 0) + parseFloat(invoice.totals?.totalIva || 0))}</span>
              </div>
              {parseFloat(invoice.totals?.totalIrpf || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e11d48' }}>
                  <span>IRPF ({invoice.irpfPercent}%):</span>
                  <span>-{formatCurrency(invoice.totals?.totalIrpf)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#0f172a', borderTop: '1.5px solid #0f172a', paddingTop: '0.4rem', marginTop: '0.2rem' }}>
                <span style={{ whiteSpace: 'nowrap' }}>Total per pagar:</span>
                <span style={{ color: 'var(--color-accent, #d4af37)', whiteSpace: 'nowrap' }}>{formatCurrency(invoice.totals?.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* PAYMENT DETAILS BLOCK */}
        <div className="payment-box" style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', pageBreakInside: 'avoid', marginTop: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#0f172a', textAlign: 'center', width: '22%', whiteSpace: 'nowrap' }}>Data de venciment</th>
                <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#0f172a', textAlign: 'center', width: '18%', whiteSpace: 'nowrap' }}>Import</th>
                <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#0f172a', textAlign: 'center', width: '25%', whiteSpace: 'nowrap' }}>Forma de pagament</th>
                <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#0f172a', textAlign: 'center', width: '35%', whiteSpace: 'nowrap' }}>Compte (IBAN)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '0.55rem 0.5rem', fontSize: '0.9rem', color: '#1e293b', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                  {getDueDate(invoice.date)}
                </td>
                <td style={{ padding: '0.55rem 0.5rem', fontSize: '0.9rem', color: '#1e293b', textAlign: 'center', borderRight: '1px solid #e2e8f0', fontWeight: '500' }}>
                  {formatCurrency(invoice.totals?.total)}
                </td>
                <td style={{ padding: '0.55rem 0.5rem', fontSize: '0.9rem', color: '#1e293b', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                  Transferència
                </td>
                <td style={{ padding: '0.55rem 0.5rem', fontSize: '0.85rem', fontFamily: 'monospace', color: '#1e293b', textAlign: 'center', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                  {invoice.issuerData?.iban}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div className="footer-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#64748b' }}>
          <div style={{ width: '60px' }}></div> 
          <div style={{ fontWeight: '500', letterSpacing: '0.5px' }}>www.hemiolia.cat</div>
          <div style={{ width: '60px' }}></div>
        </div>

      </div>

      {/* NO-PRINT ACTIONS */}
      <div className="no-print" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
        {invoice.submissionMethod === 'efact' && (
          <button className="btn btn-glass" onClick={handleDownloadFacturaeXML} disabled={isSigning}>
            📥 {isSigning ? 'Signant XML...' : 'Descarregar XML Facturae'}
          </button>
        )}
        {isAdmin && !isLocked && (
          <>
            <button 
              className="btn btn-glass" 
              style={{ color: '#f1c40f', borderColor: '#f1c40f', marginRight: '0.5rem' }} 
              onClick={() => handleSendToVeriFactu(false)} 
              disabled={isSending}
            >
              {isSending ? 'Processant...' : 'Enviar en mode Prova 🧪'}
            </button>
            <button 
              className="btn btn-primary" 
              onClick={() => handleSendToVeriFactu(true)} 
              disabled={isSending}
            >
              {isSending ? 'Enviant a AEAT Real...' : 'Enviar a VeriFactu (AEAT Real) 🚀'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
