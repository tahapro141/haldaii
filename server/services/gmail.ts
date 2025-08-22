import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

// Get the current domain from the request or use default
const getCurrentDomain = () => {
  // For Replit dev environment (this is the active domain format)
  const replitDomain = process.env.REPLIT_DEV_DOMAIN;
  if (replitDomain) {
    return `https://${replitDomain}`;
  }

  // For Replit production
  const replitSlug = process.env.REPL_SLUG;
  const replitOwner = process.env.REPL_OWNER;
  if (replitSlug && replitOwner) {
    return `https://${replitSlug}-${replitOwner}.replit.app`;
  }

  return 'http://localhost:5000';
};

const REDIRECT_URI = `${getCurrentDomain()}/auth/gmail/callback`;

interface UserDailyStats {
  emailsSentToday: number;
  dailyLimit: number;
  lastResetDate: string;
}

interface SendProgress {
  sent: number;
  total: number;
  failed: number;
  status: 'sending' | 'completed' | 'failed';
  errors?: string[];
  currentEmail?: string;
}

class GmailService {
  private oauth2Client: OAuth2Client;
  private gmail: any;
  private userStats: Map<string, UserDailyStats> = new Map();
  private dailyStats: Map<string, UserDailyStats> = new Map(); // Added for daily stats tracking

  constructor() {
    this.oauth2Client = new OAuth2Client(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      REDIRECT_URI
    );

    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  // Generate OAuth URL for Gmail authentication
  generateAuthUrl(userId?: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/gmail.send',
      'openid'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      include_granted_scopes: true,
      state: userId || 'unknown',
      prompt: 'consent'
    });
  }

  // Exchange authorization code for tokens
  async getTokens(code: string) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      return tokens;
    } catch (error) {
      console.error('Error getting tokens:', error);
      throw new Error('Failed to get access tokens');
    }
  }

  // Get user profile information
  async getUserInfo(accessToken?: string) {
    try {
      if (accessToken) {
        const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`);
        const userInfo = await response.json();
        return userInfo;
      } else {
        const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
        const { data } = await oauth2.userinfo.get();
        return data;
      }
    } catch (error) {
      console.error('Error getting user info:', error);
      throw new Error('Failed to get user information');
    }
  }

  // Set credentials for API calls
  setCredentials(tokens: any) {
    this.oauth2Client.setCredentials(tokens);
  }

  // Validate and refresh token if needed
  async validateAndRefreshToken(): Promise<boolean> {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);
      return true;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
  }

  // Daily limits tracking with 2 email limit for free plan
  getUserDailyStats(userId: string) {
    const today = new Date().toISOString().split('T')[0];

    if (!this.dailyStats.has(userId)) {
      this.dailyStats.set(userId, {
        emailsSentToday: 0,
        dailyLimit: 2, // Free plan limit: 2 emails per day
        lastResetDate: today
      });
    }

    const userStats = this.dailyStats.get(userId)!;

    // Reset if new day
    if (userStats.lastResetDate !== today) {
      userStats.emailsSentToday = 0;
      userStats.lastResetDate = today;
      this.dailyStats.set(userId, userStats);
    }

    return userStats;
  }

  // Get daily limits info
  getDailyLimits() {
    return {
      freePlan: 2,
      workspaceAccount: 2000,
      note: "Free plan: 2 emails per day. Limits reset daily at midnight UTC"
    };
  }

  // Send a single email
  async sendEmail(to: string, subject: string, htmlContent: string, senderEmail: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const stats = this.getUserDailyStats(userId);

    if (stats.emailsSentToday >= stats.dailyLimit) {
      return { success: false, error: 'You have hit the limit of 2 emails for the free plan. Please upgrade your plan.' };
    }

    try {
      const email = [
        `To: ${to}`,
        `From: ${senderEmail}`,
        `Subject: ${subject}`,
        `Content-Type: text/html; charset=utf-8`,
        ``,
        htmlContent
      ].join('\n');

      const encodedEmail = Buffer.from(email)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail
        }
      });

      // Increment sent count after successful send
      stats.emailsSentToday++;
      this.dailyStats.set(userId, stats);

      return { success: true };
    } catch (error: any) {
      console.error('Gmail send error:', error);
      // Do not increment sent count on failure
      return { success: false, error: error.message || 'Failed to send email' };
    }
  }

  // Send bulk emails with progress tracking
  async sendBulkEmails(
    contacts: Array<{ email: string; name?: string; [key: string]: any }>,
    subject: string,
    content: string,
    senderEmail: string,
    userId: string, // Added userId for tracking
    onProgress?: (progress: SendProgress) => void
  ): Promise<SendProgress> {
    const progress: SendProgress = {
      sent: 0,
      total: contacts.length,
      failed: 0,
      status: 'sending',
      errors: [],
      currentEmail: undefined
    };

    // Check overall limit before starting
    const userStats = this.getUserDailyStats(userId);
    if (userStats.emailsSentToday >= userStats.dailyLimit) {
      progress.status = 'failed';
      progress.errors = [`You have hit the limit of 2 emails for the free plan. Please <a href="/pricing">upgrade your plan</a>.`];
      if (onProgress) {
        onProgress(progress);
      }
      return progress;
    }

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      progress.currentEmail = contact.email;

      if (onProgress) {
        onProgress({ ...progress, currentEmail: contact.email });
      }

      // Check limit for each email
      const currentUserStats = this.getUserDailyStats(userId);
      if (currentUserStats.emailsSentToday >= currentUserStats.dailyLimit) {
        progress.failed++;
        progress.errors?.push(`${contact.email}: Limit reached. Please upgrade your plan.`);
        continue; // Skip to the next contact
      }

      // Send individual email
      const result = await this.sendEmail(contact.email, subject, content, senderEmail, userId);

      if (result.success) {
        progress.sent++;
      } else {
        progress.failed++;
        progress.errors?.push(`${contact.email}: ${result.error}`);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    progress.status = 'completed';
    progress.currentEmail = undefined;

    if (onProgress) {
      onProgress({ ...progress });
    }

    return progress;
  }

  // Validate if tokens are still valid
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

export const gmailService = new GmailService();