/**
 * Generates an unsigned Facturae 3.2.2 XML file for e-Fact / FACe submission.
 */
export function generateFacturaeXML(invoice) {
  const escapeXml = (unsafe) => {
    if (!unsafe) return '';
    return unsafe.toString()
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const pad = (num) => String(num).padStart(2, '0');
  const formatDateFacturae = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const sellerNif = escapeXml(invoice.issuerData?.nif || '');
  const sellerName = escapeXml(invoice.issuerData?.name || '');
  const sellerAddress = escapeXml(invoice.issuerData?.address || '');
  const sellerPostalCode = escapeXml(invoice.issuerData?.postalCode || '');
  const sellerMunicipality = escapeXml(invoice.issuerData?.municipality || '');
  const sellerProvince = escapeXml(invoice.issuerData?.province || '');
  const sellerEmail = escapeXml(invoice.issuerData?.email || '');
  
  // Format IBAN: remove spaces
  const sellerIban = escapeXml((invoice.issuerData?.iban || '').replace(/\s+/g, ''));

  const buyerNif = escapeXml(invoice.clientNif || '');
  const buyerName = escapeXml(invoice.clientName || '');
  const buyerAddress = escapeXml(invoice.clientData?.address || '');
  const buyerPostalCode = escapeXml(invoice.clientData?.postalCode || '');
  const buyerMunicipality = escapeXml(invoice.clientData?.municipality || '');
  const buyerProvince = escapeXml(invoice.clientData?.province || '');
  const buyerCountryCode = escapeXml(invoice.clientCountryCode || 'ES');

  const invoiceNumber = escapeXml(invoice.invoiceNumber || '');
  const issueDate = formatDateFacturae(invoice.date);
  
  let invoiceDescriptionText = 'Factura generada per un sistema VERI*FACTU.';
  if (invoice.huella) {
    invoiceDescriptionText += ` Codi de registre (petjada): ${invoice.huella}.`;
  }
  if (invoice.notes) {
    invoiceDescriptionText += ` Observacions: ${invoice.notes}`;
  }
  const has10PercentVat = (invoice.lines || []).some(line => parseFloat(line.vatPercent) === 10 && !line.isVatExempt);
  if (has10PercentVat) {
    invoiceDescriptionText += " D'acord amb el que s'especifica l'article 91.U.2.13, de la llei 37-1992 de 28 de desembre de l'IVA (BOE 312, de 29-12-1992), s'aplica el tipus d'IVA reduït a aquesta prestació de serveis.";
  }
  invoiceDescriptionText = invoiceDescriptionText.substring(0, 2500);
  
  // Extract file/expedient reference if present in invoice object or notes
  let fileReference = invoice.fileNumber || invoice.expediente || invoice.contractNumber || '';
  if (!fileReference && invoice.notes) {
    const match = invoice.notes.match(/(?:CODI\s+D[''’]EXPEDIENT|EXPEDIENT|NÚM\.?\s*EXPEDIENT|EXPEDIENT\s*NÚM\.?)\s*:\s*([A-Za-z0-9\-_]+)/i);
    if (match) {
      fileReference = match[1].trim();
    }
  }

  const baseImposable = parseFloat(invoice.totals?.baseImposable || 0);
  const totalIva = parseFloat(invoice.totals?.totalIva || 0);
  const totalIrpf = parseFloat(invoice.totals?.totalIrpf || 0);
  const totalFactura = baseImposable + totalIva - totalIrpf; // Facturae requires InvoiceTotal to subtract Withheld Taxes
  const totalAPagar = parseFloat(invoice.totals?.total || 0); // net total to pay

  const lines = invoice.lines || [];
  
  // Generate Administrative Centres if present
  let adminCentresXml = '';
  const dir3Office = invoice.clientData?.dir3OficinaContable;
  const dir3Gestor = invoice.clientData?.dir3OrganoGestor;
  const dir3Unit = invoice.clientData?.dir3UnidadTramitadora;
  
  if (dir3Office || dir3Gestor || dir3Unit) {
    adminCentresXml = `
      <AdministrativeCentres>`;
      
    const adminDetails = `
          <Name>${escapeXml(buyerName)}</Name>
          <AddressInSpain>
            <Address>${escapeXml(buyerAddress)}</Address>
            <PostCode>${escapeXml(buyerPostalCode)}</PostCode>
            <Town>${escapeXml(buyerMunicipality)}</Town>
            <Province>${escapeXml(buyerProvince)}</Province>
            <CountryCode>ESP</CountryCode>
          </AddressInSpain>`;

    if (dir3Office) {
      adminCentresXml += `
        <AdministrativeCentre>
          <CentreCode>${escapeXml(dir3Office)}</CentreCode>
          <RoleTypeCode>01</RoleTypeCode>${adminDetails}
        </AdministrativeCentre>`;
    }
    if (dir3Gestor) {
      adminCentresXml += `
        <AdministrativeCentre>
          <CentreCode>${escapeXml(dir3Gestor)}</CentreCode>
          <RoleTypeCode>02</RoleTypeCode>${adminDetails}
        </AdministrativeCentre>`;
    }
    if (dir3Unit) {
      adminCentresXml += `
        <AdministrativeCentre>
          <CentreCode>${escapeXml(dir3Unit)}</CentreCode>
          <RoleTypeCode>03</RoleTypeCode>${adminDetails}
        </AdministrativeCentre>`;
    }
    adminCentresXml += `
      </AdministrativeCentres>`;
  }

  // Tax Breakdown logic
  const taxableGroups = {};
  const exemptGroups = {};

  lines.forEach(line => {
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

  let taxesXml = '';
  let witholdingsXml = '';

  // Outputs <Tax> for VAT
  taxesXml += `
          <TaxesOutputs>`;
  for (const [vatPercent, group] of Object.entries(taxableGroups)) {
    taxesXml += `
            <Tax>
              <TaxTypeCode>01</TaxTypeCode>
              <TaxRate>${parseFloat(vatPercent).toFixed(4)}</TaxRate>
              <TaxableBase>
                <TotalAmount>${group.base.toFixed(2)}</TotalAmount>
              </TaxableBase>
              <TaxAmount>
                <TotalAmount>${group.cuota.toFixed(2)}</TotalAmount>
              </TaxAmount>
            </Tax>`;
  }
  for (const [cause, baseAmount] of Object.entries(exemptGroups)) {
    // Exempt behaves as 0% VAT in Facturae structure
    taxesXml += `
            <Tax>
              <TaxTypeCode>01</TaxTypeCode>
              <TaxRate>0.0000</TaxRate>
              <TaxableBase>
                <TotalAmount>${baseAmount.toFixed(2)}</TotalAmount>
              </TaxableBase>
              <TaxAmount>
                <TotalAmount>0.00</TotalAmount>
              </TaxAmount>
            </Tax>`;
  }
  taxesXml += `
          </TaxesOutputs>`;

  // Outputs <Tax> for IRPF withholding if present
  if (totalIrpf > 0) {
    const irpfPercent = parseFloat(invoice.irpfPercent || 15);
    witholdingsXml = `
          <TaxesWithheld>
            <Tax>
              <TaxTypeCode>04</TaxTypeCode>
              <TaxRate>${irpfPercent.toFixed(4)}</TaxRate>
              <TaxableBase>
                <TotalAmount>${baseImposable.toFixed(2)}</TotalAmount>
              </TaxableBase>
              <TaxAmount>
                <TotalAmount>${totalIrpf.toFixed(2)}</TotalAmount>
              </TaxAmount>
            </Tax>
          </TaxesWithheld>`;
  }

  // Invoice Lines items XML
  let itemsXml = '';
  lines.forEach((line, idx) => {
    const amount = parseFloat(line.amount) || 0;
    const isExempt = line.isVatExempt === true || line.isVatExempt === 'true';
    const vatPercent = isExempt ? 0 : parseFloat(line.vatPercent || 10);
    
    let lineDescription = line.description || '';
    if (isExempt) {
      const cause = line.exemptionCause || 'E1';
      const causeText = cause === 'E1' ? "Exempt per Article 20 de la Llei d'IVA" : `Exempt per causa ${cause}`;
      lineDescription += ` (${causeText})`;
    }

    itemsXml += `
            <InvoiceLine>
              <ItemDescription>${escapeXml(lineDescription)}</ItemDescription>
              <Quantity>1.000000</Quantity>
              <UnitOfMeasure>01</UnitOfMeasure>
              <UnitPriceWithoutTax>${amount.toFixed(6)}</UnitPriceWithoutTax>
              <TotalCost>${amount.toFixed(6)}</TotalCost>
              <GrossAmount>${amount.toFixed(6)}</GrossAmount>
              <TaxesOutputs>
                <Tax>
                  <TaxTypeCode>01</TaxTypeCode>
                  <TaxRate>${vatPercent.toFixed(4)}</TaxRate>
                  <TaxableBase>
                    <TotalAmount>${amount.toFixed(2)}</TotalAmount>
                  </TaxableBase>
                  <TaxAmount>
                    <TotalAmount>${(isExempt ? 0 : amount * (vatPercent / 100)).toFixed(2)}</TotalAmount>
                  </TaxAmount>
                </Tax>
              </TaxesOutputs>
            </InvoiceLine>`;
  });

  // Main XML Body
  return `<?xml version="1.0" encoding="UTF-8"?>
<fe:Facturae xmlns:fe="http://www.facturae.gob.es/formato/Versiones/Facturaev3_2_2.xml">
  <FileHeader>
    <SchemaVersion>3.2.2</SchemaVersion>
    <Modality>I</Modality>
    <InvoiceIssuerType>EM</InvoiceIssuerType>
    <Batch>
      <BatchIdentifier>${sellerNif}${invoiceNumber}</BatchIdentifier>
      <InvoicesCount>1</InvoicesCount>
      <TotalInvoicesAmount>
        <TotalAmount>${totalFactura.toFixed(2)}</TotalAmount>
      </TotalInvoicesAmount>
      <TotalOutstandingAmount>
        <TotalAmount>${totalAPagar.toFixed(2)}</TotalAmount>
      </TotalOutstandingAmount>
      <TotalExecutableAmount>
        <TotalAmount>${totalAPagar.toFixed(2)}</TotalAmount>
      </TotalExecutableAmount>
      <InvoiceCurrencyCode>EUR</InvoiceCurrencyCode>
    </Batch>
  </FileHeader>
  <Parties>
    <SellerParty>
      <TaxIdentification>
        <PersonTypeCode>F</PersonTypeCode>
        <ResidenceTypeCode>R</ResidenceTypeCode>
        <TaxIdentificationNumber>${sellerNif}</TaxIdentificationNumber>
      </TaxIdentification>
      <Individual>
        <Name>${sellerName.split(' ')[0] || ''}</Name>
        <FirstSurname>${sellerName.split(' ')[1] || ''}</FirstSurname>
        <SecondSurname>${sellerName.split(' ')[2] || ''}</SecondSurname>
        <AddressInSpain>
          <Address>${sellerAddress}</Address>
          <PostCode>${sellerPostalCode}</PostCode>
          <Town>${sellerMunicipality}</Town>
          <Province>${sellerProvince}</Province>
          <CountryCode>ESP</CountryCode>
        </AddressInSpain>
      </Individual>
    </SellerParty>
    <BuyerParty>
      <TaxIdentification>
        <PersonTypeCode>J</PersonTypeCode>
        <ResidenceTypeCode>R</ResidenceTypeCode>
        <TaxIdentificationNumber>${buyerNif}</TaxIdentificationNumber>
      </TaxIdentification>${adminCentresXml}
      <LegalEntity>
        <CorporateName>${buyerName}</CorporateName>
        <AddressInSpain>
          <Address>${buyerAddress}</Address>
          <PostCode>${buyerPostalCode}</PostCode>
          <Town>${buyerMunicipality}</Town>
          <Province>${buyerProvince}</Province>
          <CountryCode>ESP</CountryCode>
        </AddressInSpain>
      </LegalEntity>
    </BuyerParty>
  </Parties>
  <Invoices>
    <Invoice>
      <InvoiceHeader>
        <InvoiceNumber>${invoiceNumber}</InvoiceNumber>
        <InvoiceDocumentType>FC</InvoiceDocumentType>
        <InvoiceClass>OO</InvoiceClass>
      </InvoiceHeader>
      <InvoiceIssueData>
        <IssueDate>${issueDate}</IssueDate>
        <InvoiceCurrencyCode>EUR</InvoiceCurrencyCode>
        <TaxCurrencyCode>EUR</TaxCurrencyCode>
        <LanguageName>ca</LanguageName>
        <InvoiceDescription>${escapeXml(invoiceDescriptionText)}</InvoiceDescription>${fileReference ? `\n        <FileReference>${escapeXml(fileReference)}</FileReference>\n        <ReceiverContractReference>${escapeXml(fileReference)}</ReceiverContractReference>` : ''}
      </InvoiceIssueData>
${taxesXml}${totalIrpf > 0 ? `\n      ${witholdingsXml}` : ''}
      <InvoiceTotals>
        <TotalGrossAmount>${baseImposable.toFixed(2)}</TotalGrossAmount>
        <TotalGeneralDiscounts>0.00</TotalGeneralDiscounts>
        <TotalGeneralSurcharges>0.00</TotalGeneralSurcharges>
        <TotalGrossAmountBeforeTaxes>${baseImposable.toFixed(2)}</TotalGrossAmountBeforeTaxes>
        <TotalTaxOutputs>${totalIva.toFixed(2)}</TotalTaxOutputs>
        <TotalTaxesWithheld>${totalIrpf.toFixed(2)}</TotalTaxesWithheld>
        <InvoiceTotal>${totalFactura.toFixed(2)}</InvoiceTotal>
        <TotalOutstandingAmount>${totalAPagar.toFixed(2)}</TotalOutstandingAmount>
        <TotalExecutableAmount>${totalAPagar.toFixed(2)}</TotalExecutableAmount>
      </InvoiceTotals>
      <Items>${itemsXml}
      </Items>
      <PaymentDetails>
        <Installment>
          <InstallmentDueDate>${issueDate}</InstallmentDueDate>
          <InstallmentAmount>${totalAPagar.toFixed(2)}</InstallmentAmount>
          <PaymentMeans>04</PaymentMeans>
          <AccountToBeCredited>
            <IBAN>${sellerIban}</IBAN>
          </AccountToBeCredited>
        </Installment>
      </PaymentDetails>
    </Invoice>
  </Invoices>
</fe:Facturae>`.trim();
}
