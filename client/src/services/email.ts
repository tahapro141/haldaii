import emailjs from '@emailjs/browser';

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || '';
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '';
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '';

// Initialize EmailJS
if (EMAILJS_PUBLIC_KEY) {
  emailjs.init(EMAILJS_PUBLIC_KEY);
}

interface EmailData {
  to: string;
  subject: string;
  content: string;
  senderName: string;
  senderEmail: string;
}

export async function sendEmail(emailData: EmailData): Promise<void> {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
    throw new Error('EmailJS configuration is incomplete');
  }

  try {
    const result = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      {
        to_email: emailData.to,
        subject: emailData.subject,
        message: emailData.content,
        from_name: emailData.senderName,
        from_email: emailData.senderEmail,
      }
    );

    if (result.status !== 200) {
      throw new Error(`EmailJS error: ${result.status} ${result.text}`);
    }
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error('Failed to send email');
  }
}

export async function sendBulkEmails(emails: EmailData[]): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const email of emails) {
    try {
      await sendEmail(email);
      sent++;
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to send email to ${email.to}:`, error);
      failed++;
    }
  }

  return { sent, failed };
}
