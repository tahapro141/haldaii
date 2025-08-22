
import { chromium, Browser, Page, BrowserContext } from 'playwright';

interface Contact {
  email: string;
  name?: string;
  company?: string;
}

interface EmailCampaign {
  contacts: Contact[];
  subject: string;
  content: string;
  userEmail: string;
  userPassword: string;
}

interface SendProgress {
  sent: number;
  total: number;
  failed: number;
  status: 'preparing' | 'sending' | 'completed' | 'failed';
  currentEmail?: string;
  errors: string[];
}

export class GmailWebAutomation {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: false, // Visible browser for user interaction
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage', 
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 }
    });

    this.page = await this.context.newPage();
  }

  async loginToGmail(email: string, password: string): Promise<boolean> {
    try {
      if (!this.page) throw new Error('Browser not initialized');

      // Navigate to Gmail
      await this.page.goto('https://accounts.google.com/signin');
      await this.page.waitForTimeout(2000);

      // Fill email
      const emailField = this.page.locator('input[type="email"]');
      await emailField.fill(email);
      await this.page.keyboard.press('Enter');
      await this.page.waitForTimeout(3000);

      // Fill password
      const passwordField = this.page.locator('input[type="password"]');
      await passwordField.fill(password);
      await this.page.keyboard.press('Enter');
      await this.page.waitForTimeout(5000);

      // Check if we need to handle 2FA or other verification
      const currentUrl = this.page.url();
      if (currentUrl.includes('challenge') || currentUrl.includes('verify')) {
        console.log('⚠️ Additional verification required. Please complete in the browser.');
        // Wait for user to complete verification
        await this.page.waitForURL('**/mail.google.com/**', { timeout: 60000 });
      }

      // Navigate to Gmail if not already there
      if (!this.page.url().includes('mail.google.com')) {
        await this.page.goto('https://mail.google.com');
        await this.page.waitForTimeout(3000);
      }

      // Verify we're logged in
      const gmailInterface = await this.page.locator('[role="main"], .nH').first().isVisible();
      return gmailInterface;

    } catch (error) {
      console.error('❌ Gmail login failed:', error);
      return false;
    }
  }

  async sendBulkEmails(campaign: EmailCampaign, progressCallback?: (progress: SendProgress) => void): Promise<SendProgress> {
    const progress: SendProgress = {
      sent: 0,
      total: campaign.contacts.length,
      failed: 0,
      status: 'preparing',
      errors: []
    };

    try {
      if (!this.page) throw new Error('Browser not initialized');

      // Login first
      const loginSuccess = await this.loginToGmail(campaign.userEmail, campaign.userPassword);
      if (!loginSuccess) {
        throw new Error('Failed to login to Gmail');
      }

      progress.status = 'sending';
      if (progressCallback) progressCallback(progress);

      for (let i = 0; i < campaign.contacts.length; i++) {
        const contact = campaign.contacts[i];
        progress.currentEmail = contact.email;
        
        try {
          // Navigate to Gmail compose
          await this.page.goto('https://mail.google.com/mail/u/0/#inbox');
          await this.page.waitForTimeout(2000);

          // Click compose button
          await this.clickCompose();
          await this.page.waitForTimeout(1500);

          // Fill recipient
          await this.fillRecipient(contact.email);
          await this.page.waitForTimeout(500);

          // Fill subject
          const personalizedSubject = campaign.subject.replace(/\{name\}/g, contact.name || 'there');
          await this.fillSubject(personalizedSubject);
          await this.page.waitForTimeout(500);

          // Fill content
          const personalizedContent = campaign.content
            .replace(/\{name\}/g, contact.name || 'there')
            .replace(/\{company\}/g, contact.company || 'your company');
          
          await this.fillContent(personalizedContent);
          await this.page.waitForTimeout(1000);

          // Send the email
          await this.sendEmail();
          await this.page.waitForTimeout(2000);

          progress.sent++;
          console.log(`✅ Email sent to ${contact.email} (${progress.sent}/${progress.total})`);

        } catch (error) {
          progress.failed++;
          progress.errors.push(`Failed to send to ${contact.email}: ${error}`);
          console.error(`❌ Failed to send to ${contact.email}:`, error);
        }

        if (progressCallback) progressCallback(progress);

        // Delay between emails
        if (i < campaign.contacts.length - 1) {
          await this.page.waitForTimeout(3000 + Math.random() * 2000);
        }
      }

      progress.status = 'completed';
      if (progressCallback) progressCallback(progress);
      return progress;

    } catch (error) {
      progress.status = 'failed';
      progress.errors.push(`Campaign failed: ${error}`);
      if (progressCallback) progressCallback(progress);
      return progress;
    }
  }

  private async clickCompose(): Promise<void> {
    const selectors = [
      '[role="button"][aria-label*="Compose"]',
      '.T-I.T-I-KE.L3',
      'div[role="button"]:has-text("Compose")'
    ];

    for (const selector of selectors) {
      try {
        const element = this.page!.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          await element.click();
          return;
        }
      } catch (e) {
        continue;
      }
    }
    await this.page!.keyboard.press('c');
  }

  private async fillRecipient(email: string): Promise<void> {
    const selectors = [
      'input[name="to"]',
      'textarea[name="to"]',
      '[aria-label*="To"]',
      'input[role="combobox"][aria-label*="To"]'
    ];

    for (const selector of selectors) {
      try {
        const element = this.page!.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          await element.click();
          await element.fill(email);
          await this.page!.keyboard.press('Tab');
          return;
        }
      } catch (e) {
        continue;
      }
    }
  }

  private async fillSubject(subject: string): Promise<void> {
    const selectors = [
      'input[name="subjectbox"]',
      'input[aria-label*="Subject"]',
      'input[role="textbox"][aria-label*="Subject"]'
    ];

    for (const selector of selectors) {
      try {
        const element = this.page!.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          await element.click();
          await element.fill(subject);
          return;
        }
      } catch (e) {
        continue;
      }
    }
  }

  private async fillContent(content: string): Promise<void> {
    const selectors = [
      'div[role="textbox"][aria-label*="Message body"]',
      '.Am.Al.editable',
      'div[contenteditable="true"][role="textbox"]'
    ];

    for (const selector of selectors) {
      try {
        const element = this.page!.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          await element.click();
          await element.fill(content);
          return;
        }
      } catch (e) {
        continue;
      }
    }
  }

  private async sendEmail(): Promise<void> {
    const selectors = [
      '[role="button"][aria-label*="Send"]',
      '.T-I.J-J5-Ji.aoO.v7.T-I-atl.L3',
      'div[role="button"]:has-text("Send")'
    ];

    for (const selector of selectors) {
      try {
        const element = this.page!.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          await element.click();
          return;
        }
      } catch (e) {
        continue;
      }
    }
    await this.page!.keyboard.press('Control+Enter');
  }

  async close(): Promise<void> {
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
  }
}

export const gmailWebAutomation = new GmailWebAutomation();
