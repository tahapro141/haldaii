
import * as nodemailer from 'nodemailer';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-character-secret-key-here!';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

interface GmailCredentials {
  email: string;
  accessToken: string;
  refreshToken?: string;
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface SendProgress {
  sent: number;
  total: number;
  failed: number;
  status: 'preparing' | 'sending' | 'completed' | 'failed';
  currentEmail?: string;
  errors: string[];
}

export class GmailSMTPService {
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipher(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  encryptCredentials(credentials: GmailCredentials): string {
    const credentialsString = JSON.stringify(credentials);
    return this.encrypt(credentialsString);
  }

  decryptCredentials(encryptedCredentials: string): GmailCredentials {
    const decryptedString = this.decrypt(encryptedCredentials);
    return JSON.parse(decryptedString);
  }

  async testConnection(email: string, accessToken: string): Promise<boolean> {
    try {
      const transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: email,
          accessToken: accessToken,
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }
      });

      await transporter.verify();
      return true;
    } catch (error) {
      console.error('SMTP connection test failed:', error);
      return false;
    }
  }

  async sendSingleEmail(
    credentials: GmailCredentials, 
    emailOptions: EmailOptions
  ): Promise<boolean> {
    try {
      const transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: credentials.email,
          accessToken: credentials.accessToken,
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }
      });

      const mailOptions = {
        from: `"Your Name" <${credentials.email}>`,
        to: emailOptions.to,
        subject: emailOptions.subject,
        html: emailOptions.html,
        text: emailOptions.text || emailOptions.html.replace(/<[^>]*>/g, '') // Strip HTML for text version
      };

      await transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      console.error(`Failed to send email to ${emailOptions.to}:`, error);
      throw error;
    }
  }

  async sendBulkEmails(
    credentials: GmailCredentials,
    contacts: Array<{ email: string; name?: string; company?: string }>,
    subject: string,
    htmlContent: string,
    progressCallback?: (progress: SendProgress) => void
  ): Promise<SendProgress> {
    const progress: SendProgress = {
      sent: 0,
      total: contacts.length,
      failed: 0,
      status: 'preparing',
      errors: []
    };

    try {
      // Test connection first
      const connectionValid = await this.testConnection(credentials.email, credentials.accessToken);
      if (!connectionValid) {
        throw new Error('Invalid Gmail credentials or connection failed');
      }

      progress.status = 'sending';
      if (progressCallback) progressCallback(progress);

      // Send emails with delays to avoid rate limiting
      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        progress.currentEmail = contact.email;

        try {
          // Personalize content
          const personalizedSubject = subject.replace(/\{name\}/g, contact.name || 'there');
          const personalizedHtml = htmlContent
            .replace(/\{name\}/g, contact.name || 'there')
            .replace(/\{company\}/g, contact.company || 'your company');

          await this.sendSingleEmail(credentials, {
            to: contact.email,
            subject: personalizedSubject,
            html: personalizedHtml
          });

          progress.sent++;
          console.log(`✅ Email sent to ${contact.email} (${progress.sent}/${progress.total})`);

        } catch (error) {
          progress.failed++;
          progress.errors.push(`Failed to send to ${contact.email}: ${error}`);
          console.error(`❌ Failed to send to ${contact.email}:`, error);
        }

        // Update progress
        if (progressCallback) progressCallback(progress);

        // Add delay between emails (1-3 seconds) to avoid rate limiting
        if (i < contacts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
        }
      }

      progress.status = progress.failed === 0 ? 'completed' : 'completed';
      if (progressCallback) progressCallback(progress);

      return progress;

    } catch (error) {
      progress.status = 'failed';
      progress.errors.push(`Campaign failed: ${error}`);
      if (progressCallback) progressCallback(progress);
      return progress;
    }
  }

  getDailyLimits() {
    return {
      dailyLimit: 500, // Gmail's daily limit for regular accounts
      hourlyLimit: 100, // Conservative hourly limit
      note: 'Gmail OAuth limits: 500 emails/day for regular accounts, 2000/day for Google Workspace'
    };
  }
}

export const gmailSMTPService = new GmailSMTPService();
