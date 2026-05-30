'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { addContact } from '../../../../lib/firestoreUtils';
import Link from 'next/link';
import { useAuth } from '../../../../lib/AuthContext';

export default function ImportContactsPage() {
  const { user, loading, isAdmin, isCrm } = useAuth();
  const [file, setFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState(null);

  // ... rest of state and handlers ...

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setIsImporting(true);
    setResults(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;
        let successCount = 0;
        let errorCount = 0;

        for (const row of rows) {
          // Check if new format or old format
          const isNewFormat = row['Contacte 1: Nom'] !== undefined || row['Població / Municipi'] !== undefined;
          
          if (isNewFormat) {
            const municipality = row['Població / Municipi'] || '';
            const province = row['Província / Regió'] || '';
            const status = row['Estat'] || 'Pendent';
            const performedShowsRaw = row['Espectacles Realitzats'] || '';
            const interestedShowsRaw = row['Espectacles d\'Interès'] || '';
            const feedbackSummary = row['Detalls / Feedback'] || '';
            const notes = row['Historial d\'Interaccions'] || '';

            const performedShows = performedShowsRaw ? performedShowsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
            const interestedShows = interestedShowsRaw ? interestedShowsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

            // Extract up to 3 contacts
            const contacts = [];
            for (let i = 1; i <= 3; i++) {
              const cName = row[`Contacte ${i}: Nom`] || '';
              const cRole = row[`Contacte ${i}: Càrrec`] || '';
              const cEmail = row[`Contacte ${i}: Correu`] || '';
              const cPhone = row[`Contacte ${i}: Telèfon`] || '';

              if (cName.trim() || cEmail.trim()) {
                contacts.push({
                  name: cName.trim(),
                  role: cRole.trim(),
                  email: cEmail.trim(),
                  phone: cPhone.trim()
                });
              }
            }

            // If no contacts, create placeholder for the municipality
            if (contacts.length === 0 && municipality.trim()) {
              contacts.push({
                name: `Ajuntament de ${municipality.trim()}`,
                role: 'General',
                email: '',
                phone: ''
              });
            }

            // Save contacts
            for (const contact of contacts) {
              try {
                await addContact({
                  name: contact.name,
                  entity: contact.role || 'Ajuntament',
                  municipality: municipality.trim(),
                  province: province.trim(),
                  email: contact.email,
                  phone: contact.phone,
                  status: status.trim(),
                  performedShows,
                  interestedShows,
                  feedbackSummary,
                  notes,
                  nextActionDate: '',
                  nextActionNotes: ''
                });
                successCount++;
              } catch (error) {
                console.error("Error inserting contact", contact, error);
                errorCount++;
              }
            }
          } else {
            // Old format fallback
            try {
              await addContact({
                name: row['Nom'] || row['name'] || 'Desconegut',
                entity: row['Entitat'] || row['entity'] || 'Sense especificar',
                municipality: row['Municipi'] || row['municipality'] || '',
                province: '',
                email: row['Correu'] || row['email'] || '',
                phone: row['Telefon'] || row['Telèfon'] || row['phone'] || '',
                status: 'Pendent',
                performedShows: [],
                interestedShows: [],
                feedbackSummary: '',
                notes: '',
                nextActionDate: '',
                nextActionNotes: ''
              });
              successCount++;
            } catch (error) {
              console.error("Error inserting row", row, error);
              errorCount++;
            }
          }
        }
        
        setIsImporting(false);
        setResults({ success: successCount, errors: errorCount });
      },
      error: (error) => {
        console.error("Parse error:", error);
        setIsImporting(false);
      }
    });
  };

  if (loading || !user) return <div className="container mt-xl">Carregant...</div>;

  if (!isAdmin && !isCrm) {
    return (
      <div className="container" style={{ paddingTop: 'var(--space-md)' }}>
        <div className="glass-panel text-center" style={{ padding: '3rem', maxWidth: '500px', margin: '2rem auto' }}>
          <h2 style={{ color: '#ff6b6b', marginBottom: '1rem' }}>⚠️ Accés Denegat</h2>
          <p>Només els administradors poden importar contactes en aquesta aplicació.</p>
          <div style={{ marginTop: '2rem' }}>
            <Link href="/dashboard/crm" className="btn btn-primary">
              Tornar a CRM
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 'var(--space-md)' }}>
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <Link href="/dashboard/crm" className="btn-back no-print" title="Tornar a CRM" style={{ marginRight: '1rem' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </Link>
        <h1 style={{ marginTop: '0.5rem', color: 'var(--color-accent)' }}>Importar Contactes (CSV)</h1>
      </div>

      <div className="glass-panel animate-fade-in-up">
        <p className="mb-lg">
          Puja un fitxer CSV provinent de l'Excel. L'arxiu hauria de tenir preferiblement les columnes:
          <strong> Nom, Entitat, Municipi, Correu, Telefon</strong>.
        </p>

        <div className="input-group">
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleFileChange} 
            className="input-field" 
            style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)' }}
          />
        </div>

        <button 
          className="btn btn-primary mt-xl" 
          onClick={handleImport} 
          disabled={!file || isImporting}
        >
          {isImporting ? 'Important...' : 'Començar Importació'}
        </button>

        {results && (
          <div style={{ marginTop: 'var(--space-lg)', padding: '1rem', background: 'var(--color-success)', color: '#000', borderRadius: 'var(--radius-sm)' }}>
            <strong>Importació completada!</strong><br/>
            Contactes afegits: {results.success} <br/>
            Errors: {results.errors}
          </div>
        )}
      </div>
    </div>
  );
}
