import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import Database from 'sqlite3';
import { promisify } from 'util';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

interface EmailRecord {
  email: string;
  name?: string;
  company?: string;
  subject: string;
  body: string;
}

interface UserTokens {
  access_token: string;
  refresh_token: string;
  email: string;
  dailyCount: number;
  lastResetDate: string;
}

interface SendResult {
  sent: number;
  failed: number;
  rateLimited: boolean;
  dailyLimitReached: boolean;
  errors: string[];
}

export class GmailAPIService {
  private oauth2Client: OAuth2Client;
  private db: Database.Database;
  private userTokens: Map<string, UserTokens> = new Map();

  constructor() {
    this.oauth2Client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
    this.db = new Database.Database('./gmail_logs.db');
    this.initializeDatabase();
  }

  private async initializeDatabase() {
    const run = promisify(this.db.run.bind(this.db));
    
    await run(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        recipient_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        status TEXT NOT NULL,
        error_message TEXT,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS daily_counts (
        user_email TEXT PRIMARY KEY,
        count INTEGER DEFAULT 0,
        date TEXT NOT NULL
      )
    `);
  }

  async setUserTokens(userEmail: string, tokens: any) {
    const today = new Date().toISOString().split('T')[0];
    
    // Get existing daily count or reset if new day
    const get = promisify(this.db.get.bind(this.db));
    const run = promisify(this.db.run.bind(this.db));
    
    const countRecord = await get(
      'SELECT count, date FROM daily_counts WHERE user_email = ?',
      [userEmail]
    ) as any;

    let dailyCount = 0;
    if (countRecord) {
      if (countRecord.date === today) {
        dailyCount = countRecord.count;
      } else {
        // Reset count for new day
        await run(
          'UPDATE daily_counts SET count = 0, date = ? WHERE user_email = ?',
          [today, userEmail]
        );
      }
    } else {
      // Create new record
      await run(
        'INSERT INTO daily_counts (user_email, count, date) VALUES (?, 0, ?)',
        [userEmail, today]
      );
    }

    this.userTokens.set(userEmail, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      email: userEmail,
      dailyCount,
      lastResetDate: today
    });

    // Set credentials for the OAuth client
    this.oauth2Client.setCredentials(tokens);
  }

  private async refreshAccessToken(userEmail: string): Promise<boolean> {
    try {
      const userToken = this.userTokens.get(userEmail);
      if (!userToken?.refresh_token) {
        throw new Error('No refresh token available');
      }

      this.oauth2Client.setCredentials({
        refresh_token: userToken.refresh_token
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      if (credentials.access_token) {
        userToken.access_token = credentials.access_token;
        this.userTokens.set(userEmail, userToken);
        console.log(`🔄 Refreshed access token for ${userEmail}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`❌ Failed to refresh token for ${userEmail}:`, error);
      return false;
    }
  }

  private async checkAndResetDailyCount(userEmail: string) {
    const userToken = this.userTokens.get(userEmail);
    if (!userToken) return;

    const today = new Date().toISOString().split('T')[0];
    
    if (userToken.lastResetDate !== today) {
      // Reset daily count for new day
      const run = promisify(this.db.run.bind(this.db));
      await run(
        'UPDATE daily_counts SET count = 0, date = ? WHERE user_email = ?',
        [today, userEmail]
      );
      
      userToken.dailyCount = 0;
      userToken.lastResetDate = today;
      this.userTokens.set(userEmail, userToken);
      console.log(`📅 Reset daily count for ${userEmail}`);
    }
  }

  private getUserDailyLimit(userEmail: string): number {
    // Check if it's a workspace account (paid) or free Gmail
    const isWorkspace = userEmail.includes('@') && !userEmail.endsWith('@gmail.com');
    return isWorkspace ? 2000 : 500;
  }

  private async logEmail(userEmail: string, recipientEmail: string, subject: string, status: string, errorMessage?: string) {
    const run = promisify(this.db.run.bind(this.db));
    await run(
      'INSERT INTO email_logs (user_email, recipient_email, subject, status, error_message) VALUES (?, ?, ?, ?, ?)',
      [userEmail, recipientEmail, subject, status, errorMessage]
    );
  }

  private async updateDailyCount(userEmail: string) {
    const userToken = this.userTokens.get(userEmail);
    if (!userToken) return;

    userToken.dailyCount++;
    this.userTokens.set(userEmail, userToken);

    const run = promisify(this.db.run.bind(this.db));
    await run(
      'UPDATE daily_counts SET count = ? WHERE user_email = ?',
      [userToken.dailyCount, userEmail]
    );
  }

  private personalizeContent(template: string, record: EmailRecord): string {
    return template
      .replace(/\{name\}/g, record.name || 'there')
      .replace(/\{company\}/g, record.company || 'your company')
      .replace(/\{email\}/g, record.email);
  }

  private async sleep(min: number, max: number) {
    const delay = Math.random() * (max - min) + min;
    await new Promise(resolve => setTimeout(resolve, delay * 1000));
  }

  private async sendSingleEmail(userEmail: string, record: EmailRecord, retryCount = 0): Promise<boolean> {
    try {
      const userToken = this.userTokens.get(userEmail);
      if (!userToken) {
        throw new Error('User tokens not found');
      }

      // Check daily limit
      const dailyLimit = this.getUserDailyLimit(userEmail);
      if (userToken.dailyCount >= dailyLimit) {
        console.log(`📊 Daily limit reached for ${userEmail} (${userToken.dailyCount}/${dailyLimit})`);
        return false;
      }

      // Refresh token if needed (every hour)
      const tokenAge = Date.now() - (new Date().getTime() - 3600000); // 1 hour
      if (tokenAge > 3600000) {
        await this.refreshAccessToken(userEmail);
      }

      this.oauth2Client.setCredentials({
        access_token: userToken.access_token,
        refresh_token: userToken.refresh_token
      });

      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      // Personalize content
      const personalizedSubject = this.personalizeContent(record.subject, record);
      const personalizedBody = this.personalizeContent(record.body, record);

      // Create email message
      const message = [
        `To: ${record.email}`,
        `From: ${userEmail}`,
        `Subject: ${personalizedSubject}`,
        '',
        personalizedBody
      ].join('\n');

      const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      // Send email via Gmail API
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      });

      // Log success and update count
      await this.logEmail(userEmail, record.email, personalizedSubject, 'sent');
      await this.updateDailyCount(userEmail);
      
      console.log(`✅ Email sent to ${record.email} (${userToken.dailyCount + 1}/${dailyLimit})`);
      return true;

    } catch (error: any) {
      console.error(`❌ Failed to send email to ${record.email}:`, error.message);

      // Handle rate limiting (HTTP 429)
      if (error.code === 429 || error.message.includes('rate limit')) {
        const backoffDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        console.log(`⏰ Rate limited, backing off for ${backoffDelay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        
        if (retryCount < 3) {
          return this.sendSingleEmail(userEmail, record, retryCount + 1);
        }
      }

      // Log failure
      await this.logEmail(userEmail, record.email, record.subject, 'failed', error.message);
      return false;
    }
  }

  async sendBulkEmails(userEmail: string, emailRecords: EmailRecord[], progressCallback?: (progress: any) => void): Promise<SendResult> {
    console.log(`🚀 Starting bulk email send for ${userEmail} - ${emailRecords.length} emails`);
    
    await this.checkAndResetDailyCount(userEmail);
    
    const result: SendResult = {
      sent: 0,
      failed: 0,
      rateLimited: false,
      dailyLimitReached: false,
      errors: []
    };

    const userToken = this.userTokens.get(userEmail);
    const dailyLimit = this.getUserDailyLimit(userEmail);
    
    console.log(`📊 Current daily count: ${userToken?.dailyCount || 0}/${dailyLimit}`);

    for (let i = 0; i < emailRecords.length; i++) {
      const record = emailRecords[i];
      
      // Check daily limit before each send
      const currentUserToken = this.userTokens.get(userEmail);
      if (currentUserToken && currentUserToken.dailyCount >= dailyLimit) {
        result.dailyLimitReached = true;
        console.log(`🛑 Daily limit reached! Stopping at ${currentUserToken.dailyCount}/${dailyLimit}`);
        break;
      }

      const success = await this.sendSingleEmail(userEmail, record);
      
      if (success) {
        result.sent++;
      } else {
        result.failed++;
      }

      // Progress callback
      if (progressCallback) {
        progressCallback({
          sent: result.sent,
          failed: result.failed,
          total: emailRecords.length,
          current: i + 1,
          currentEmail: record.email,
          dailyCount: currentUserToken?.dailyCount || 0,
          dailyLimit
        });
      }

      // Sleep between sends (2-5 seconds with jitter)
      if (i < emailRecords.length - 1) {
        await this.sleep(2, 5);
      }
    }

    console.log(`📈 Bulk send complete: ${result.sent} sent, ${result.failed} failed`);
    return result;
  }

  async getUserDailyStats(userEmail: string) {
    await this.checkAndResetDailyCount(userEmail);
    const userToken = this.userTokens.get(userEmail);
    const dailyLimit = this.getUserDailyLimit(userEmail);
    
    return {
      dailyCount: userToken?.dailyCount || 0,
      dailyLimit,
      remainingToday: dailyLimit - (userToken?.dailyCount || 0)
    };
  }

  async close() {
    return new Promise<void>((resolve) => {
      this.db.close((err) => {
        if (err) console.error('Error closing database:', err);
        resolve();
      });
    });
  }
}

export const gmailAPIService = new GmailAPIService();