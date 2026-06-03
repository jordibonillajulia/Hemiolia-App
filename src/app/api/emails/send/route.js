import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

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

    // Format text to HTML paragraphs safely
    const htmlBody = text
      .split('\n')
      .map(paragraph => {
        const trimmed = paragraph.trim();
        if (!trimmed) return '<div style="height: 12px;"></div>';
        return `<p style="margin-top: 0; margin-bottom: 12px; line-height: 1.6; color: #2d3748; font-size: 15px;">${trimmed}</p>`;
      })
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f7fafc; margin: 0; padding: 30px 15px;">
          <div style="max-width: 600px; background-color: #ffffff; margin: 0 auto; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <!-- Header Logo -->
            <div style="padding: 25px; text-align: center; border-bottom: 1px solid #edf2f7; background-color: #ffffff;">
              <img src="https://hemiolia.cat/LOGOS%20HEMIOLIA/LOGO_RECT.png" alt="Hemiòlia Produccions" style="height: 55px; width: auto; max-width: 100%;" />
            </div>
            
            <!-- Email Body Content -->
            <div style="padding: 35px 30px;">
              ${htmlBody}
              
              <!-- Professional Signature -->
              <div style="margin-top: 35px; padding-top: 20px; border-top: 1px solid #edf2f7;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <img src="https://hemiolia.cat/LOGOS%20HEMIOLIA/LOGO.jpg" alt="Logo Hemiòlia" style="width: 45px; height: 45px; border-radius: 6px; border: 1px solid #edf2f7; object-fit: cover;" />
                  <div>
                    <p style="margin: 0; font-weight: 700; color: #1a202c; font-size: 14px; font-family: inherit;">Paula Martí i Jordi Bonilla</p>
                    <p style="margin: 2px 0 0 0; color: #718096; font-size: 12px; font-family: inherit; font-weight: 500;">Hemiòlia Produccions</p>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="padding: 15px; text-align: center; font-size: 11px; color: #a0aec0; background-color: #f7fafc; border-top: 1px solid #edf2f7;">
              Aquest correu s'ha enviat des d'Hemiòlia CRM.
            </div>
          </div>
        </body>
      </html>
    `;

    const mailOptions = {
      from: `"Hemiòlia Produccions" <${process.env.SMTP_USER || 'info@hemiolia.cat'}>`,
      to,
      subject,
      text, // Fallback plain text version
      html: htmlContent,
      ...(attachments && attachments.length > 0 ? { attachments } : {})
    };

    // Si no tenim configurat l'SMTP al .env.local, simplement fem un simulacre (mock) pel log
    if (!process.env.SMTP_USER) {
      console.log('--- SIMULACIÓ D\'ENVIAMENT DE CORREU ---');
      console.log(mailOptions);
      console.log('------------------------------------------');
      return NextResponse.json({ message: 'Simulació completada (falta config SMTP)' }, { status: 200 });
    }

    const info = await transporter.sendMail(mailOptions);
    return NextResponse.json({ message: 'Correu enviat correctament', infoId: info.messageId }, { status: 200 });
    
  } catch (error) {
    console.error('Error enviant el correu:', error);
    return NextResponse.json({ error: 'Error intern enviant el correu' }, { status: 500 });
  }
}
