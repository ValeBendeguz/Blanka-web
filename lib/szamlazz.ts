const SZAMLAZZ_URL = 'https://www.szamlazz.hu/szamla/';

interface InvoiceItem {
  name: string;
  quantity: number;
  unitPrice: number;
  unit?: string;
}

interface InvoiceData {
  customerName: string;
  customerEmail: string;
  customerAddress?: {
    postalCode?: string;
    city?: string;
    line?: string;
  };
  customerTaxNumber?: string;
  items: InvoiceItem[];
  orderNumber: string;
  comment?: string;
}

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildInvoiceXml(data: InvoiceData): string {
  const agentKey = process.env.SZAMLAZZ_AGENT_KEY;
  if (!agentKey) throw new Error('SZAMLAZZ_AGENT_KEY not configured');

  const today = new Date().toISOString().split('T')[0];

  const itemsXml = data.items
    .map((item) => {
      const brutto = Math.round(item.unitPrice * item.quantity);
      const nettoEgysegar = Math.round(item.unitPrice / 1.27);
      const netto = Math.round(nettoEgysegar * item.quantity);
      const afa = brutto - netto;
      return `    <tetel>
      <megnevezes>${escXml(item.name)}</megnevezes>
      <mennyiseg>${item.quantity}</mennyiseg>
      <mennyisegiEgyseg>${escXml(item.unit || 'db')}</mennyisegiEgyseg>
      <nettoEgysegar>${nettoEgysegar}</nettoEgysegar>
      <afakulcs>27</afakulcs>
      <nettoErtek>${netto}</nettoErtek>
      <afaErtek>${afa}</afaErtek>
      <bruttoErtek>${brutto}</bruttoErtek>
    </tetel>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamla xmlns="http://www.szamlazz.hu/xmlszamla" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamla https://www.szamlazz.hu/szamla/docs/xsds/agent/xmlszamla.xsd">
  <beallitasok>
    <szamlaagentkulcs>${escXml(agentKey)}</szamlaagentkulcs>
    <eszamla>true</eszamla>
    <szamlaLetoltes>false</szamlaLetoltes>
    <valaszVerzio>2</valaszVerzio>
  </beallitasok>
  <fejlec>
    <keltDatum>${today}</keltDatum>
    <teljesitesDatum>${today}</teljesitesDatum>
    <fizetesiHataridoDatum>${today}</fizetesiHataridoDatum>
    <fizmod>bankkártya (Stripe)</fizmod>
    <penznem>HUF</penznem>
    <szamlaNyelve>hu</szamlaNyelve>
    <megjegyzes>${escXml(data.comment || '')}</megjegyzes>
    <rendelesSzam>${escXml(data.orderNumber)}</rendelesSzam>
    <fizetve>true</fizetve>
  </fejlec>
  <elado>
    <emailReplyto>info@blankanovak.com</emailReplyto>
    <emailTargy>Számla – Novák Blanka</emailTargy>
    <emailSzoveg>Köszönjük a vásárlását! Mellékletben találja a számlát.</emailSzoveg>
  </elado>
  <vevo>
    <nev>${escXml(data.customerName)}</nev>
    <irsz>${escXml(data.customerAddress?.postalCode || '')}</irsz>
    <telepules>${escXml(data.customerAddress?.city || '')}</telepules>
    <cim>${escXml(data.customerAddress?.line || '')}</cim>
    <email>${escXml(data.customerEmail)}</email>
    <sendEmail>true</sendEmail>${data.customerTaxNumber ? `\n    <adoszam>${escXml(data.customerTaxNumber)}</adoszam>` : ''}
  </vevo>
  <tetelek>
${itemsXml}
  </tetelek>
</xmlszamla>`;
}

export async function createInvoice(data: InvoiceData): Promise<{ invoiceNumber: string }> {
  const xml = buildInvoiceXml(data);

  const boundary = '----SzamlazzBoundary' + Date.now().toString(36);
  const body =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="action-xmlagentxmlfile"; filename="invoice.xml"\r\n` +
    `Content-Type: text/xml\r\n\r\n` +
    xml +
    `\r\n--${boundary}--\r\n`;

  const res = await fetch(SZAMLAZZ_URL, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });

  const responseText = await res.text();

  if (!res.ok) {
    throw new Error(`Számlázz.hu HTTP ${res.status}: ${responseText.substring(0, 300)}`);
  }

  const errorCode = responseText.match(/<hibakod>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/hibakod>/)?.[1];
  const errorMsg = responseText.match(/<hibauzenet>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/hibauzenet>/)?.[1];
  if (errorCode || errorMsg) {
    throw new Error(`Számlázz.hu error ${errorCode}: ${errorMsg}`);
  }

  const invoiceNumber =
    responseText.match(/<szamlaszam>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/szamlaszam>/)?.[1] ||
    responseText.match(/<szlahu_szamlaszam>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/szlahu_szamlaszam>/)?.[1];

  if (invoiceNumber) return { invoiceNumber };

  // Response contains invoice data but no invoice number tag — treat as success
  if (responseText.includes('<szamlabrutto>')) return { invoiceNumber: 'OK' };

  throw new Error(`Számlázz.hu unexpected response: ${responseText.substring(0, 300)}`);
}
