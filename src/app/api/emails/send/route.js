import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer';
import { ImapFlow } from 'imapflow';
import path from 'path';

function textToHtml(text) {
  if (!text) return { html: '', hasSignature: false };
  
  // 1. Escape HTML
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
    
  // 2. Normalize newlines to \n
  html = html.replace(/\r\n/g, '\n');

  // 3. Define the signature pattern matching:
  // Paula Martí i Jordi Bonilla
  // HEMIÒLIA
  // 619579935 - 639966697
  const signaturePattern = /Paula\s+Martí\s+i\s+Jordi\s+Bonilla\s*\n\s*HEMIÒLIA\s*\n\s*619579935\s*-\s*639966697/i;
  
  const htmlSignature = `<div style="margin-top: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #000000;">
  <img src="cid:logo-hemiolia" alt="HEMIÒLIA" style="display: block; width: 140px; height: auto; margin-bottom: 8px;" />
  <div style="margin: 0; padding: 0;">Paula Martí i Jordi Bonilla</div>
  <div style="margin: 0; padding: 0; color: #000000;">619579935 - 639966697</div>
</div>`;

  let hasSignature = false;
  if (signaturePattern.test(html)) {
    hasSignature = true;
    html = html.replace(signaturePattern, '<!--SIGNATURE_PLACEHOLDER-->');
  }

  // 4. Convert newlines to <br />
  html = html.replace(/\n/g, '<br />');

  // 5. Replace placeholder back with the HTML signature
  if (hasSignature) {
    html = html.replace('<!--SIGNATURE_PLACEHOLDER-->', htmlSignature);
  }

  return { html, hasSignature };
}

async function compileRawEmail(mailOptions) {
  return new Promise((resolve, reject) => {
    const composer = new MailComposer(mailOptions);
    composer.compile().build((err, message) => {
      if (err) reject(err);
      else resolve(message);
    });
  });
}

async function saveToSentFolder(mailOptions) {
  const imapHost = process.env.IMAP_HOST || 'imap.strato.de';
  const imapPort = parseInt(process.env.IMAP_PORT || '993', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.log('IMAP: Credentials not set, skipping saving to Sent folder.');
    return;
  }

  const client = new ImapFlow({
    host: imapHost,
    port: imapPort,
    secure: true,
    auth: { user, pass },
    logger: false
  });

  try {
    const rawMessage = await compileRawEmail(mailOptions);
    await client.connect();

    // Find the Sent mailbox path
    const mailboxes = await client.list();
    let sentMailboxPath = 'Sent Items'; // Default fallback based on Strato analysis
    const foundBox = mailboxes.find(box => 
      box.specialUse === '\\Sent' || 
      (box.flags && (box.flags.has('\\Sent') || box.flags.has('Sent')))
    );
    if (foundBox) {
      sentMailboxPath = foundBox.path;
    } else {
      const fallback = mailboxes.find(box => box.path.toLowerCase().includes('sent'));
      if (fallback) {
        sentMailboxPath = fallback.path;
      }
    }

    console.log(`IMAP: Appending sent message to folder: "${sentMailboxPath}"`);
    await client.append(sentMailboxPath, rawMessage, ['\\Seen']);
    console.log('IMAP: Successfully saved copy to Sent folder.');
  } catch (error) {
    console.error('IMAP: Failed to save sent email copy:', error);
  } finally {
    try {
      await client.logout();
    } catch (e) {
      // ignore
    }
  }
}

export async function POST(request) {
  try {
    const { to, subject, text, attachments } = await request.json();

    // Configurem nodemailer amb les dades del servidor SMTP (ex: Gmail, hostalia, etc.)
    // Les credencials s'han de posar a l'arxiu .env.local
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const { html: htmlContent, hasSignature } = textToHtml(text);

    // Add inline attachment if signature is present
    const inlineAttachments = [];
    if (hasSignature) {
      inlineAttachments.push({
        filename: 'logo-hemiolia-signature.png',
        path: path.join(process.cwd(), 'public', 'logo-hemiolia-signature.png'),
        cid: 'logo-hemiolia'
      });
    }

    const mailOptions = {
      from: `"Hemiòlia Produccions" <${process.env.SMTP_USER || 'info@hemiolia.cat'}>`,
      to,
      subject,
      text,
      html: htmlContent,
      attachments: [
        ...(attachments || []),
        ...inlineAttachments
      ]
    };

    // Si no tenim configurat l'SMTP al .env.local, simplement fem un simulacre (mock) pel log
    if (!process.env.SMTP_USER) {
      console.log('--- SIMULACIÓ D\'ENVIAMENT DE CORREU ---');
      console.log(mailOptions);
      console.log('------------------------------------------');
      return NextResponse.json({ message: 'Simulació completada (falta config SMTP)' }, { status: 200 });
    }

    const info = await transporter.sendMail(mailOptions);

    // Save copy to Strato Sent folder in the background (non-blocking)
    saveToSentFolder(mailOptions).catch(err => {
      console.error('Background IMAP save copy failed:', err);
    });

    return NextResponse.json({ message: 'Correu enviat correctament', infoId: info.messageId }, { status: 200 });
    
  } catch (error) {
    console.error('Error enviant el correu:', error);
    return NextResponse.json({ error: 'Error intern enviant el correu' }, { status: 500 });
  }
}
