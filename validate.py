import xmlschema
import requests

xsd_url = "https://raw.githubusercontent.com/invopop/gobl.facturae/main/test/schema/facturaev3_2_2.xsd"

xsd_content = requests.get(xsd_url).text
with open("Facturaev3_2_2.xsd", "w") as f:
    f.write(xsd_content)

try:
    schema = xmlschema.XMLSchema('Facturaev3_2_2.xsd')
    schema.validate('test_invoice_4.xml')
    print("XML IS VALID!")
except Exception as e:
    print("VALIDATION ERROR:")
    print(e)
