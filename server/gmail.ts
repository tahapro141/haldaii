import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.NODE_ENV === 'production'
  ? 'https://your-domain.replit.app/auth/gmail/callback'
  : 'http://localhost:5000/auth/gmail/callback';

interface EmailData {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
}

interface SendProgress {
  sent: number;
  total: number;
  failed: number;
  status: 'sending' | 'completed' | 'failed';
  errors?: string[];
  current?: number; // Added for current email being processed
  currentEmail?: string; // Added for the email address of the current email being processed
}

export class GmailService {
  private oauth2Client: OAuth2Client;
  private gmail: any;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      REDIRECT_URI
    );

    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  // Generate OAuth URL for Gmail authentication
  generateAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'openid'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  // Exchange code for tokens
  async getTokens(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
  }

  // Set credentials for API calls
  setCredentials(tokens: any) {
    this.oauth2Client.setCredentials(tokens);
  }

  // Get user info
  async getUserInfo() {
    const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
    const { data } = await oauth2.userinfo.get();
    return data;
  }

  // Create email message in RFC2822 format
  private createMessage(emailData: EmailData): string {
    const { to, subject, htmlBody, textBody } = emailData;

    const boundary = '----boundary_' + Math.random().toString(36).substr(2, 9);

    let message = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      textBody || htmlBody.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      htmlBody,
      '',
      `--${boundary}--`
    ].join('\n');

    return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  // Send a single email
  async sendSingleEmail(emailData: EmailData): Promise<boolean> {
    try {
      const message = this.createMessage(emailData);

      await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: message
        }
      });

      return true;
    } catch (error) {
      console.error('Failed to send email to:', emailData.to, error);
      return false;
    }
  }

  // Send bulk emails with progress tracking
  async sendBulkEmails(emails: EmailData[], progressCallback?: (progress: SendProgress) => void): Promise<SendProgress> {
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    console.log(`📧 Starting bulk Gmail send: ${emails.length} emails`);

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];

      try {
        const success = await this.sendSingleEmail(email);
        if (success) {
          sent++;
          console.log(`✅ Email ${i + 1}/${emails.length} sent to ${email.to}`);
        } else {
          failed++;
          errors.push(`Failed to send to ${email.to}`);
          console.log(`❌ Email ${i + 1}/${emails.length} failed to ${email.to}`);
        }
      } catch (error) {
        failed++;
        const errorMsg = `Failed to send to ${email.to}: ${error}`;
        errors.push(errorMsg);
        console.error(`❌ Email ${i + 1}/${emails.length} error:`, error);
      }

      // Call progress callback after each email with current progress
      if (progressCallback) {
        progressCallback({
          sent,
          failed,
          total: emails.length,
          current: i + 1,
          status: i === emails.length - 1 ? (sent > 0 ? 'completed' : 'failed') : 'sending',
          currentEmail: email.to,
          errors
        });
      }

      // Add delay between emails (1-3 seconds)
      if (i < emails.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      }
    }

    const finalResult: SendProgress = {
      sent,
      failed,
      status: failed === 0 ? 'completed' : 'failed',
      errors
    };

    console.log(`📊 Gmail bulk send complete: ${sent} sent, ${failed} failed`);
    return finalResult;
  }

  // Validate token and refresh if needed
  async validateAndRefreshToken(): Promise<boolean> {
    try {
      await this.oauth2Client.getAccessToken();
      return true;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }
}

export const gmailService = new GmailService();