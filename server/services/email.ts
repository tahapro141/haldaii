import { gmailService } from './gmail.js';

interface Contact {
  email: string;
  name?: string;
  company?: string;
}

interface SendEmailParams {
  contacts: Contact[];
  subject: string;
  content: string;
  userCredentials: {
    email: string;
    accessToken: string; // This is actually the password
  };
}

interface EmailProgress {
  sent: number;
  total: number;
  failed: number;
  status: 'sending' | 'completed' | 'failed' | 'cancelled';
  currentEmail?: string;
  errors?: string[];
}

// Track active email campaigns
const activeCampaigns = new Map<string, EmailProgress>();

export async function sendEmailCampaign(
  campaignId: string,
  params: SendEmailParams,
  progressCallback?: (progress: EmailProgress) => void
): Promise<EmailProgress> {
  const { contacts, subject, content, userCredentials } = params;

  // Initialize progress
  const progress: EmailProgress = {
    sent: 0,
    total: contacts.length,
    failed: 0,
    status: 'sending',
    errors: []
  };

  activeCampaigns.set(campaignId, progress);

  try {
    // Parse stored Gmail tokens and set credentials
    const gmailTokens = JSON.parse(userCredentials.accessToken);
    gmailService.setCredentials(gmailTokens);

    // Extract user ID from the email for daily limits
    const userId = userCredentials.email;

    // Send emails using Gmail API with user-specific limits
    const result = await gmailService.sendBulkEmails(
      contacts,
      subject,
      content,
      userCredentials.email,
      userId,
      (gmailProgress) => {
        // Update our progress with Gmail API results
        progress.sent = gmailProgress.sent || 0;
        progress.failed = gmailProgress.failed || 0;
        progress.status = gmailProgress.status || 'sending';
        progress.errors = gmailProgress.errors || [];
        progress.currentEmail = gmailProgress.currentEmail;

        // Update in active campaigns
        activeCampaigns.set(campaignId, { ...progress });

        // Call external progress callback
        if (progressCallback) {
          progressCallback({ ...progress });
        }
      }
    );

    // Ensure final result is updated
    progress.sent = result.sent;
    progress.failed = result.failed;
    progress.status = result.status;
    progress.errors = result.errors || [];
    activeCampaigns.set(campaignId, progress);

    return progress;

  } catch (error) {
    console.error('Email campaign error:', error);
    progress.status = 'failed';
    progress.errors = [`Campaign failed: ${error}`];
    activeCampaigns.set(campaignId, progress);
    return progress;
  } finally {
    // Keep campaign in memory for a while for status checking
    setTimeout(() => {
      activeCampaigns.delete(campaignId);
    }, 300000); // 5 minutes
  }
}

export function getCampaignProgress(campaignId: string): EmailProgress | null {
  return activeCampaigns.get(campaignId) || null;
}

export function cancelCampaign(campaignId: string): boolean {
  const campaign = activeCampaigns.get(campaignId);
  if (campaign && campaign.status === 'sending') {
    campaign.status = 'cancelled';
    activeCampaigns.set(campaignId, campaign);
    return true;
  }
  return false;
}

// Email templates for better formatting
export function createEmailTemplate(subject: string, content: string): { subject: string, content: string } {
  // Check if content already has HTML structure
  if (content.includes('<!DOCTYPE html>') || content.includes('<html>')) {
    return { subject, content };
  }

  // Create professional HTML email template
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, Helvetica, sans-serif;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
            <td align="center">
                <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">Hald AI</h1>
                            <p style="color: #ffffff; margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Intelligent Email Marketing</p>
                        </td>
                    </tr>

                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <div style="color: #333333; line-height: 1.6; font-size: 16px;">
                                ${content.replace(/\n/g, '<br>')}
                            </div>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e9ecef;">
                            <p style="color: #6c757d; margin: 0; font-size: 14px;">
                                Sent with ❤️ by <strong>Hald AI</strong> - Your AI-Powered Email Assistant
                            </p>
                            <p style="color: #adb5bd; margin: 10px 0 0 0; font-size: 12px;">
                                This email was generated using artificial intelligence to provide you with personalized content.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

  return {
    subject,
    content: htmlContent
  };
}

// Legacy mock functions for compatibility (remove these once Gmail is fully integrated)
interface EmailData {
  to: string;
  subject: string;
  content: string;
  senderName: string;
  senderEmail: string;
}

export async function sendEmail(emailData: EmailData): Promise<void> {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 100));

  console.log('📧 Email sent:', {
    to: emailData.to,
    subject: emailData.subject,
    from: `${emailData.senderName} <${emailData.senderEmail}>`,
    preview: emailData.content.substring(0, 50) + '...'
  });
}

export async function sendBulkEmails(emails: EmailData[]): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const email of emails) {
    try {
      await sendEmail(email);
      sent++;
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      console.error(`Failed to send email to ${email.to}:`, error);
      failed++;
    }
  }

  console.log(`📊 Bulk email results: ${sent} sent, ${failed} failed`);
  return { sent, failed };
}