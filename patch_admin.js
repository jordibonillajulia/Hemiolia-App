const fs = require('fs');
const file = '/Users/hemiolia/Documents/ANTIGRAVITY/APP HEMIOLIA/src/lib/facturaeGenerator.js';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
  if (dir3Office || dir3Gestor || dir3Unit) {
    adminCentresXml = \`\\n      <AdministrativeCentres>\`;
    
    const adminDetails = \`
          <Name>\${escapeXml(buyerName)}</Name>
          <AddressInSpain>
            <Address>\${escapeXml(buyerAddress)}</Address>
            <PostCode>\${escapeXml(buyerPostalCode)}</PostCode>
            <Town>\${escapeXml(buyerMunicipality)}</Town>
            <Province>\${escapeXml(buyerProvince)}</Province>
            <CountryCode>ESP</CountryCode>
          </AddressInSpain>\`;

    if (dir3Office) {
      adminCentresXml += \`
        <AdministrativeCentre>
          <CentreCode>\${escapeXml(dir3Office)}</CentreCode>
          <RoleTypeCode>01</RoleTypeCode>\${adminDetails}
        </AdministrativeCentre>\`;
    }
    if (dir3Gestor) {
      adminCentresXml += \`
        <AdministrativeCentre>
          <CentreCode>\${escapeXml(dir3Gestor)}</CentreCode>
          <RoleTypeCode>02</RoleTypeCode>\${adminDetails}
        </AdministrativeCentre>\`;
    }
    if (dir3Unit) {
      adminCentresXml += \`
        <AdministrativeCentre>
          <CentreCode>\${escapeXml(dir3Unit)}</CentreCode>
          <RoleTypeCode>03</RoleTypeCode>\${adminDetails}
        </AdministrativeCentre>\`;
    }
    adminCentresXml += \`
      </AdministrativeCentres>\`;
  }
`;

const regex = /if\s*\(dir3Office\s*\|\|\s*dir3Gestor\s*\|\|\s*dir3Unit\)\s*\{[\s\S]*?adminCentresXml\s*\+=\s*`\s*<\/AdministrativeCentres>`;\s*\}/;

content = content.replace(regex, replacement.trim());
fs.writeFileSync(file, content);
