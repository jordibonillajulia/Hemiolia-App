'use client';

import { useState } from 'react';
import { useAuth } from '../../../../../lib/AuthContext';
import { addBillingClient } from '../../../../../lib/firestoreUtils';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import Link from 'next/link';

export default function ImportBillingClientsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [file, setFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [importStats, setImportStats] = useState(null);
  const [delimiter, setDelimiter] = useState(''); // '' means auto-detect

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    if (selectedFile) {
      parseCSV(selectedFile);
    } else {
      setPreviewData([]);
    }
  };

  const parseCSV = (fileToParse = file, delim = delimiter) => {
    Papa.parse(fileToParse, {
      delimiter: delim || undefined,
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: h => h.trim(),
      complete: (results) => {
        setPreviewData(results.data.slice(0, 5)); // Mostrar 5 de prova
      },
      error: (error) => {
        alert("Error llegint el CSV: " + error.message);
      }
    });
  };

  const handleImport = () => {
    if (!file) return;
    setIsImporting(true);

    Papa.parse(file, {
      delimiter: delimiter || undefined,
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: h => h.trim(),
      complete: async (results) => {
        let successCount = 0;
        let errorCount = 0;

        // Comprovar si PapaParse ha fallat a detectar les columnes separades
        if (results.data.length > 0) {
          const firstRowKeys = Object.keys(results.data[0]);
          if (firstRowKeys.length === 1 && (firstRowKeys[0].includes(';') || firstRowKeys[0].includes(',') || firstRowKeys[0].includes('#'))) {
            alert("Atenció: Sembla que l'arxiu no s'ha separat correctament en columnes. Tria el separador adequat (# o ;) al desplegable superior.");
            setIsImporting(false);
            return;
          }
        }

        const getVal = (row, validNames) => {
          const rowKeys = Object.keys(row);
          for (let k of rowKeys) {
            const cleanK = k.toLowerCase().trim();
            if (validNames.some(v => cleanK.includes(v.toLowerCase()))) {
              return row[k]?.trim() || '';
            }
          }
          return '';
        };

        for (const row of results.data) {
          try {
            const name = getVal(row, ['nom', 'raó', 'rao', 'razón', 'razon', 'name', 'cliente']);
            const nif = getVal(row, ['nif', 'cif', 'dni', 'identificaci']);
            
            // Si no hi ha nom o nif, ens ho saltem per evitar brutícia
            if (!name || !nif) {
              errorCount++;
              continue;
            }

            const typeRaw = getVal(row, ['tipus', 'type', 'tipo']).toLowerCase();
            const type = typeRaw.includes('físic') || typeRaw.includes('fisic') ? 'Física' : 'Jurídica';
            
            const address = getVal(row, ['adreça', 'direc', 'address', 'domicili']);
            const postalCode = getVal(row, ['codi postal', 'cp', 'postal']);
            const municipality = getVal(row, ['població', 'poblacio', 'poblaci', 'municipi', 'localitat', 'ciudad', 'city']);
            const province = getVal(row, ['província', 'provincia', 'province']);
            let country = getVal(row, ['país', 'pais', 'country', 'símbolo país']);
            if (!country) country = 'Espanya';

            let countryCode = getVal(row, ['país codi', 'codi pais', 'codigo pais', 'country code', 'countrycode', 'codigo_pais', 'country_code']);
            if (!countryCode) {
              if (country.toLowerCase().includes('espanya') || country.toLowerCase().includes('españa') || country.toLowerCase().includes('spain')) {
                countryCode = 'ES';
              } else {
                countryCode = 'ES';
              }
            }
            countryCode = countryCode.toUpperCase().slice(0, 2).trim();

            let nifType = getVal(row, ['tipus identificacio', 'tipus nif', 'nif type', 'niftype', 'tipo identificacion', 'tipo nif', 'nif_type']);
            if (!nifType) {
              nifType = 'NIF';
            }

            const clientData = { 
              type, 
              name, 
              nif, 
              nifType, 
              address, 
              postalCode, 
              municipality, 
              province, 
              country, 
              countryCode 
            };
            
            await addBillingClient(clientData);
            successCount++;
          } catch (err) {
            console.error(err);
            errorCount++;
          }
        }
        
        setImportStats({ success: successCount, error: errorCount });
        setIsImporting(false);
      },
      error: (error) => {
        alert("Error en l'anàlisi del CSV: " + error.message);
        setIsImporting(false);
      }
    });
  };

  if (loading || !user) return <div className="container mt-xl text-center">Carregant...</div>;

  return (
    <div className="container" style={{ paddingTop: 'var(--space-md)' }}>
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <Link href="/dashboard/billing/clients" className="btn-back no-print" title="Tornar a Clients" style={{ marginRight: '1rem' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </Link>
        <h1 style={{ marginTop: '0.5rem', marginBottom: 0, display: 'inline-block', verticalAlign: 'middle' }}>Importar Clients de Facturació</h1>
      </div>

      <div className="glass-panel animate-fade-in-up">
        <h3 style={{ color: 'var(--color-accent)' }}>Instruccions</h3>
        <p>Puja un arxiu <strong>.csv</strong>. La primera fila ha de contenir les capçaleres de les columnes. L'aplicació buscarà els següents noms (pot ser en majúscules, minúscules o anglès):</p>
        <ul style={{ marginBottom: '1.5rem', marginLeft: '1.5rem', color: 'var(--color-text-secondary)' }}>
          <li><strong>Nom</strong>, Raó Social, Name</li>
          <li><strong>NIF</strong>, CIF, DNI</li>
          <li><strong>Tipus</strong> (Física / Jurídica)</li>
          <li><strong>Adreça</strong>, Dirección</li>
          <li><strong>CP</strong>, Codi Postal</li>
          <li><strong>Població</strong>, Municipi</li>
          <li><strong>Província</strong></li>
          <li><strong>País</strong></li>
        </ul>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="input-group">
            <label>Separador del CSV</label>
            <select className="input-field" value={delimiter} onChange={e => { setDelimiter(e.target.value); if(file) parseCSV(file, e.target.value); }}>
              <option value="">Automàtic (Recomanat)</option>
              <option value=";">Punt i coma ( ; ) - Format típic d'Excel España</option>
              <option value="#">Coixinet ( # ) - El teu format actual</option>
              <option value=",">Coma ( , ) - Format estàndard</option>
            </select>
          </div>
          <div className="input-group">
            <label>Selecciona l'arxiu CSV</label>
            <input type="file" accept=".csv" className="input-field" onChange={handleFileChange} />
          </div>
        </div>

        {previewData.length > 0 && !importStats && (
          <div style={{ marginTop: '2rem' }}>
            <h4>Previsualització (Primers 5 registres):</h4>
            <div style={{ overflowX: 'auto', marginTop: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
              <pre style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                {JSON.stringify(previewData, null, 2)}
              </pre>
            </div>
            
            <button 
              className="btn btn-primary" 
              style={{ marginTop: '1.5rem', width: '100%' }}
              onClick={handleImport}
              disabled={isImporting}
            >
              {isImporting ? 'Important...' : 'Iniciar Importació Massiva'}
            </button>
          </div>
        )}

        {importStats && (
          <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(46, 204, 113, 0.1)', border: '1px solid #2ecc71', borderRadius: 'var(--radius-md)' }}>
            <h3 style={{ color: '#2ecc71', margin: '0 0 1rem 0' }}>✅ Importació Completada</h3>
            <p><strong>Clients importats amb èxit:</strong> {importStats.success}</p>
            {importStats.error > 0 && (
              <p style={{ color: '#ff6b6b' }}><strong>Errors (Files ignorades per falta de NIF o nom):</strong> {importStats.error}</p>
            )}
            <div style={{ marginTop: '1.5rem' }}>
              <Link href="/dashboard/billing/clients" className="btn btn-primary">
                Veure Clients Importats
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
