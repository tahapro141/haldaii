
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

export class SimpleGmailService {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage', 
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process'
      ]
    });

    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 }
    });

    this.page = await this.context.newPage();
  }

  async testLogin(email: string, password: string): Promise<boolean> {
    try {
      if (!this.page) throw new Error('Browser not initialized');

      console.log('🔐 Testing Gmail login...');
      
      // Navigate to Gmail login
      await this.page.goto('https://accounts.google.com/signin', { waitUntil: 'networkidle' });
      await this.page.waitForTimeout(2000);

      // Fill email
      const emailField = this.page.locator('input[type="email"]');
      await emailField.waitFor({ state: 'visible', timeout: 10000 });
      await emailField.fill(email);
      await this.page.keyboard.press('Enter');
      await this.page.waitForTimeout(3000);

      // Fill password
      const passwordField = this.page.locator('input[type="password"]');
      await passwordField.waitFor({ state: 'visible', timeout: 10000 });
      await passwordField.fill(password);
      await this.page.keyboard.press('Enter');
      await this.page.waitForTimeout(5000);

      // Check if we're successfully logged in
      try {
        // Wait for either Gmail or verification page
        await Promise.race([
          this.page.waitForURL('**/mail.google.com/**', { timeout: 15000 }),
          this.page.waitForSelector('[data-testid="2sv-challenge"]', { timeout: 15000 })
        ]);

        // If we need to navigate to Gmail
        if (!this.page.url().includes('mail.google.com')) {
          await this.page.goto('https://mail.google.com', { waitUntil: 'networkidle' });
          await this.page.waitForTimeout(3000);
        }

        // Check if Gmail interface is loaded
        const gmailLoaded = await this.page.locator('[role="main"], .nH, .aic').first().isVisible();
        if (gmailLoaded) {
          console.log('✅ Gmail login successful');
          return true;
        }
      } catch (e) {
        console.log('❌ Login failed or requires additional verification');
      }

      return false;
    } catch (error) {
      console.error('❌ Gmail login test failed:', error);
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

      // Test login first
      const loginSuccess = await this.testLogin(campaign.userEmail, campaign.userPassword);
      if (!loginSuccess) {
        throw new Error('Gmail login failed. Please check your email and password.');
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

          // Fill subject (personalized)
          const personalizedSubject = campaign.subject.replace(/\{name\}/g, contact.name || 'there');
          await this.fillSubject(personalizedSubject);
          await this.page.waitForTimeout(500);

          // Fill email content (personalized)
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

        // Update progress
        if (progressCallback) progressCallback(progress);

        // Add delay between emails to avoid spam detection
        if (i < campaign.contacts.length - 1) {
          await this.page.waitForTimeout(3000 + Math.random() * 2000); // 3-5 seconds delay
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

  private async clickCompose(): Promise<void> {
    const composeSelectors = [
      '[role="button"][aria-label*="Compose"]',
      '.T-I.T-I-KE.L3',
      'div[role="button"]:has-text("Compose")',
      '.z0 > .L3',
      '[data-tooltip="Compose"]'
    ];

    for (const selector of composeSelectors) {
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

    // Fallback: try keyboard shortcut
    await this.page!.keyboard.press('c');
  }

  private async fillRecipient(email: string): Promise<void> {
    const recipientSelectors = [
      'input[name="to"]',
      'textarea[name="to"]',
      '[aria-label*="To"]',
      '.vR input',
      '.aoD.hl input',
      'input[role="combobox"][aria-label*="To"]'
    ];

    for (const selector of recipientSelectors) {
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

    throw new Error('Could not find recipient field');
  }

  private async fillSubject(subject: string): Promise<void> {
    const subjectSelectors = [
      'input[name="subjectbox"]',
      'input[aria-label*="Subject"]',
      '.aoT input',
      'input[role="textbox"][aria-label*="Subject"]'
    ];

    for (const selector of subjectSelectors) {
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

    throw new Error('Could not find subject field');
  }

  private async fillContent(content: string): Promise<void> {
    const contentSelectors = [
      'div[role="textbox"][aria-label*="Message body"]',
      '.Am.Al.editable',
      '.ii.gt div[role="textbox"]',
      'div[contenteditable="true"][role="textbox"]',
      '.editable[role="textbox"]'
    ];

    for (const selector of contentSelectors) {
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

    throw new Error('Could not find content field');
  }

  private async sendEmail(): Promise<void> {
    const sendSelectors = [
      '[role="button"][aria-label*="Send"]',
      '.T-I.J-J5-Ji.aoO.v7.T-I-atl.L3',
      'div[role="button"]:has-text("Send")',
      '[data-tooltip*="Send"]',
      '.dC .T-I-atl'
    ];

    for (const selector of sendSelectors) {
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

    // Fallback: keyboard shortcut
    await this.page!.keyboard.press('Control+Enter');
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }
}

export const simpleGmailService = new SimpleGmailService();
