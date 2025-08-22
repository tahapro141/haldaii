import express, { type Express } from "express";
import { Server } from "http";
import multer from 'multer';
import csvParser from 'csv-parser';
import { Readable } from 'stream';
import type { Request, Response, NextFunction } from 'express';
import type { User } from '@shared/schema';
import { storage } from "./storage";
import { verifyFirebaseToken } from "./services/firebase-admin";
import { generateEmailWithGroq } from "./services/groq";
import { sendBulkEmails, sendEmailCampaign, getCampaignProgress } from "./services/email";
import { gmailService } from "./services/gmail";
import { insertUserSchema, insertEmailListSchema, insertCampaignSchema } from "@shared/schema";

const upload = multer({ storage: multer.memoryStorage() });

interface AuthenticatedRequest extends Request {
  user: {
    uid: string;
    email: string;
  };
}

const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyFirebaseToken(token);

    (req as AuthenticatedRequest).user = {
      uid: decodedToken.uid,
      email: decodedToken.email || ''
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
};

export async function registerRoutes(app: Express): Promise<void> {
  // Debug route to show current redirect URI
  app.get("/debug/redirect-uri", (req, res) => {
    const getCurrentDomain = () => {
      const replitDomain = process.env.REPLIT_DEV_DOMAIN;
      if (replitDomain) {
        return `https://${replitDomain}`;
      }
      const replitSlug = process.env.REPL_SLUG;
      const replitOwner = process.env.REPL_OWNER;
      if (replitSlug && replitOwner) {
        return `https://${replitSlug}-${replitOwner}.replit.app`;
      }
      return 'http://localhost:5000';
    };

    const redirectUri = `${getCurrentDomain()}/auth/gmail/callback`;
    res.json({ 
      redirectUri,
      domain: getCurrentDomain(),
      instructions: `Add this redirect URI to your Google Cloud Console: ${redirectUri}`
    });
  });

  // Gmail OAuth connection routes
  app.post("/api/gmail/connect", authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      const authUrl = gmailService.generateAuthUrl(req.user.uid);
      res.json({ authUrl });
    } catch (error) {
      console.error('Gmail auth URL generation error:', error);
      res.status(500).json({ message: 'Failed to generate Gmail auth URL' });
    }
  });

  app.get("/api/gmail/auth-url", authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      const authUrl = gmailService.generateAuthUrl(req.user.uid);
      res.json({ authUrl });
    } catch (error) {
      console.error('Gmail auth URL generation error:', error);
      res.status(500).json({ message: 'Failed to generate Gmail auth URL' });
    }
  });

  app.get("/auth/gmail/callback", async (req, res) => {
    try {
      const { code, state, error } = req.query;

      if (error) {
        console.error('OAuth error:', error);
        return res.redirect('/?gmail=error&reason=' + encodeURIComponent(error as string));
      }

      if (!code) {
        console.error('No authorization code provided');
        return res.redirect('/?gmail=error&reason=no_code');
      }

      console.log('🔐 Processing Gmail OAuth callback...');

      // Exchange code for tokens
      const tokens = await gmailService.getTokens(code as string);
      console.log('✅ Got OAuth tokens');

      // Set credentials and get user info
      gmailService.setCredentials(tokens);
      const userInfo = await gmailService.getUserInfo();
      console.log('✅ Got user info:', userInfo.email);

      // Find user by Firebase UID (from state parameter)
      const user = await storage.getUserByFirebaseUid(state as string);
      if (!user) {
        console.error('User not found for UID:', state);
        return res.redirect('/?gmail=error&reason=user_not_found');
      }

      // Store Gmail credentials
      const encryptedTokens = JSON.stringify(tokens);
      await storage.updateUser(user.id, {
        gmailCredentials: encryptedTokens,
        gmailEmail: userInfo.email
      });

      console.log('✅ Gmail connected successfully for user:', userInfo.email);
      res.redirect('/?gmail=connected');
    } catch (error: any) {
      console.error('Gmail OAuth callback error:', error);
      res.redirect('/?gmail=error&reason=' + encodeURIComponent(error.message || 'unknown'));
    }
  });

  app.get("/api/gmail/status", authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await storage.getUserByFirebaseUid(req.user.uid);
      if (!user) {
        console.log('❌ User not found for UID:', req.user.uid);
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if user has Gmail credentials
      const gmailCredentials = (user as any).gmailCredentials;
      const hasGmailCredentials = !!(gmailCredentials);
      const gmailEmail = hasGmailCredentials ? (user as any).gmailEmail : null;

      console.log('📊 Gmail status check:', { 
        userId: user.id, 
        connected: hasGmailCredentials, 
        email: gmailEmail 
      });

      res.json({ 
        connected: hasGmailCredentials,
        email: gmailEmail,
        authType: 'oauth',
        debug: {
          hasCredentials: hasGmailCredentials,
          credentialsLength: gmailCredentials ? gmailCredentials.length : 0
        }
      });
    } catch (error) {
      console.error('Gmail status check error:', error);
      res.status(500).json({ message: 'Failed to check Gmail status', error: error.message });
    }
  });

  app.post("/api/gmail/disconnect", authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await storage.getUserByFirebaseUid(req.user.uid);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Remove Gmail credentials
      await storage.updateUser(user.id, { 
        gmailCredentials: null,
        gmailEmail: null 
      });

      res.json({ message: 'Gmail disconnected successfully' });
    } catch (error) {
      console.error('Gmail disconnect error:', error);
      res.status(500).json({ message: 'Failed to disconnect Gmail' });
    }
  });

  // Gmail daily stats endpoint
  app.get("/api/gmail/stats", authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await storage.getUserByFirebaseUid(req.user.uid);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const gmailCredentials = (user as any).gmailCredentials;
      if (!gmailCredentials) {
        return res.status(400).json({ message: 'Gmail not connected' });
      }

      // Get user's daily stats from Gmail service
      const userStats = gmailService.getUserDailyStats(req.user.uid);
      const limits = gmailService.getDailyLimits();

      const stats = {
        dailyCount: userStats.emailsSentToday,
        dailyLimit: 2, // Free plan limit
        remainingToday: 2 - userStats.emailsSentToday,
        note: "Free plan: 2 emails per day. Upgrade for unlimited sending.",
        resetDate: userStats.lastResetDate
      };

      res.json(stats);
    } catch (error) {
      console.error('Gmail stats error:', error);
      res.status(500).json({ message: 'Failed to get Gmail stats' });
    }
  });

  // Auth routes
  app.post("/api/auth/verify", async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ message: 'Token is required' });
      }

      const decodedToken = await verifyFirebaseToken(token);

      // Check if user exists, create if not
      let user = await storage.getUserByFirebaseUid(decodedToken.uid);
      if (!user) {
        const userData = {
          firebaseUid: decodedToken.uid,
          email: decodedToken.email || '',
          name: decodedToken.name || 'User'
        };

        const validatedData = insertUserSchema.parse(userData);
        user = await storage.createUser(validatedData);
      }

      res.json({ success: true, user: { id: user.id, email: user.email, name: user.name } });
    } catch (error) {
      console.error('Auth verification error:', error);
      res.status(401).json({ message: 'Invalid token' });
    }
  });

  // Email Lists routes
  app.get("/api/email-lists", authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await storage.getUserByFirebaseUid(req.user.uid);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const emailLists = await storage.getEmailListsByUserId(user.id);
      res.json(emailLists);
    } catch (error) {
      console.error('Get email lists error:', error);
      res.status(500).json({ message: 'Failed to fetch email lists' });
    }
  });

  app.post("/api/email-lists/upload", authenticateUser, upload.single('file'), async (req: AuthenticatedRequest, res) => {
    try {
      const user = await storage.getUserByFirebaseUid(req.user.uid);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const file = req.file;
      const { name, description } = req.body;

      if (!file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      console.log(`Processing file: ${file.originalname}`);

      // Convert buffer to string
      const fileContent = file.buffer.toString('utf8');
      console.log(`File content preview: ${fileContent.substring(0, 100)}`);

      const contacts: Array<{ email: string; name?: string; company?: string; [key: string]: any }> = [];

      // Parse different file formats
      if (file.originalname.endsWith('.csv') || file.originalname.endsWith('.tsv')) {
        const delimiter = file.originalname.endsWith('.tsv') ? '\t' : ',';
        const stream = Readable.from([fileContent]);

        await new Promise((resolve, reject) => {
          stream
            .pipe(csvParser({ separator: delimiter }))
            .on('data', (row) => {
              // Handle different column name variations
              const emailField = row.email || row.Email || row.EMAIL || row['Email Address'] || row['email_address'];
              const nameField = row.name || row.Name || row.NAME || row['Full Name'] || row['full_name'] || row.firstname || row.firstName;
              const companyField = row.company || row.Company || row.COMPANY || row.organization || row.Organization;

              if (emailField && emailField.includes('@')) {
                contacts.push({
                  email: emailField.trim(),
                  name: nameField ? nameField.trim() : undefined,
                  company: companyField ? companyField.trim() : undefined,
                  ...row // Include all other fields
                });
              }
            })
            .on('end', resolve)
            .on('error', reject);
        });
      } else if (file.originalname.endsWith('.txt')) {
        // Plain text file - extract emails using multiple strategies
        console.log(`Parsing .txt file with content: "${fileContent}"`);

        // Try multiple email regex patterns for better detection
        const patterns = [
          /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
          /[\w\.-]+@[\w\.-]+\.\w+/g,
          /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
        ];

        let allEmails = new Set();

        // Split by lines and also try each regex pattern
        const lines = fileContent.split(/[\r\n]+/).filter(line => line.trim());
        lines.forEach(line => {
          patterns.forEach(pattern => {
            const matches = line.match(pattern) || [];
            matches.forEach(match => allEmails.add(match.trim()));
          });

          // Also check if line itself is an email
          if (line.trim().includes('@') && line.trim().includes('.')) {
            const cleanEmail = line.trim().replace(/[^\w@.-]/g, '');
            if (cleanEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
              allEmails.add(cleanEmail);
            }
          }
        });

        console.log(`Found emails: ${Array.from(allEmails).join(', ')}`);

        Array.from(allEmails).forEach(email => {
          if (email && email.includes('@') && email.includes('.')) {
            contacts.push({ email: email.trim() });
          }
        });
      } else if (file.originalname.endsWith('.json')) {
        // JSON file
        const jsonData = JSON.parse(fileContent);
        const emailArray = Array.isArray(jsonData) ? jsonData : [jsonData];

        emailArray.forEach(item => {
          if (typeof item === 'string' && item.includes('@')) {
            contacts.push({ email: item.trim() });
          } else if (typeof item === 'object' && item.email) {
            contacts.push({
              email: item.email.trim(),
              name: item.name,
              company: item.company,
              ...item
            });
          }
        });
      }

      console.log(`Total contacts found: ${contacts.length}`);

      if (contacts.length === 0) {
        console.log(`File analysis - No emails found in file: ${file.originalname}`);

        let helpMessage = 'No valid email addresses found in your file';
        if (!fileContent.includes('@')) {
          helpMessage = 'Your file doesn\'t contain any email addresses (no @ symbols found)';
        } else if (!fileContent.includes('.com') && !fileContent.includes('.org') && !fileContent.includes('.net')) {
          helpMessage = 'Your file contains @ symbols but no valid email domains like .com, .org, or .net';
        }

        return res.status(400).json({ 
          message: helpMessage,
          suggestion: 'Please add valid email addresses like: user@gmail.com, contact@company.org',
          contactCount: 0
        });
      }

      // Create email list
      const emailListData = {
        userId: user.id,
        name: name || file.originalname,
        description: description || `Imported from ${file.originalname}`,
        contactCount: contacts.length,
        contacts
      };

      const validatedData = insertEmailListSchema.parse(emailListData);
      const emailList = await storage.createEmailList(validatedData);

      res.json(emailList);
    } catch (error) {
      console.error('Upload email list error:', error);
      res.status(500).json({ message: 'Failed to upload email list' });
    }
  });

  app.delete("/api/email-lists/:id", authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await storage.getUserByFirebaseUid(req.user.uid);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const emailListId = req.params.id;
      const emailList = await storage.getEmailList(emailListId);

      if (!emailList || emailList.userId !== user.id) {
        return res.status(404).json({ message: 'Email list not found' });
      }

      await storage.deleteEmailList(emailListId);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete email list error:', error);
      res.status(500).json({ message: 'Failed to delete email list' });
    }
  });

  // Campaigns routes
  app.get("/api/campaigns", authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await storage.getUserByFirebaseUid(req.user.uid);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const campaigns = await storage.getCampaignsByUserId(user.id);
      res.json(campaigns);
    } catch (error) {
      console.error('Get campaigns error:', error);
      res.status(500).json({ message: 'Failed to fetch campaigns' });
    }
  });

  // AI email generation
  app.post("/api/ai/generate-email", authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      const { purpose, audience, benefits, tone } = req.body;

      if (!purpose) {
        return res.status(400).json({ message: 'Purpose is required' });
      }

      const emailContent = await generateEmailWithGroq({
        purpose,
        audience: audience || 'Business professionals',
        benefits: benefits || 'Advanced AI-powered solutions',
        tone: tone || 'Professional and friendly'
      });

      res.json(emailContent);
    } catch (error) {
      console.error('Generate email error:', error);
      res.status(500).json({ message: 'Failed to generate email content' });
    }
  });

  // Send campaign using Gmail API
  app.post("/api/campaigns/send", authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await storage.getUserByFirebaseUid(req.user.uid);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const { emailListId, subject, content } = req.body;

      if (!emailListId || !subject || !content) {
        return res.status(400).json({ message: 'Email list, subject, and content are required' });
      }

      const emailList = await storage.getEmailList(emailListId);
      if (!emailList || emailList.userId !== user.id) {
        return res.status(404).json({ message: 'Email list not found' });
      }

      // Check daily limit (2 emails for free plan)
      const userStats = gmailService.getUserDailyStats(req.user.uid);
      const DAILY_LIMIT = 2; // Free plan limit
      
      if (userStats.emailsSentToday >= DAILY_LIMIT) {
        return res.json({ 
          limitReached: true,
          message: 'Daily limit reached. Upgrade to send more emails.',
          sent: 0
        });
      }

      // Check if user has Gmail connected
      const encryptedCredentials = (user as any).gmailCredentials;
      if (!encryptedCredentials) {
        return res.status(400).json({ message: 'Gmail not connected. Please connect your Gmail account first.' });
      }

      // Parse stored Gmail tokens
      const gmailTokens = JSON.parse(encryptedCredentials);

      // Set credentials for Gmail service
      gmailService.setCredentials(gmailTokens);

      // Validate token and refresh if needed
      const tokenValid = await gmailService.validateAndRefreshToken();
      if (!tokenValid) {
        return res.status(400).json({ message: 'Gmail token expired. Please reconnect your Gmail account.' });
      }

      // Limit contacts to remaining daily allowance
      const remainingEmails = DAILY_LIMIT - userStats.emailsSentToday;
      const contactsToSend = (emailList.contacts || []).slice(0, remainingEmails);

      // Create campaign
      const campaignData = {
        userId: user.id,
        emailListId,
        name: `Campaign - ${subject}`,
        subject,
        content,
        senderEmail: (user as any).gmailEmail,
        senderName: 'Email Campaign',
        status: 'sent' as const
      };

      const campaign = await storage.createCampaign(campaignData);

      try {
        console.log(`🚀 Starting Gmail API campaign for ${contactsToSend.length} emails`);

        // Send emails synchronously
        const result = await gmailService.sendBulkEmails(
          contactsToSend,
          subject,
          content,
          (user as any).gmailEmail,
          req.user.uid // Pass Firebase UID for daily tracking
        );

        console.log('✅ Campaign completed:', result);

        // Update campaign status
        await storage.updateCampaign(campaign.id, { 
          status: 'sent',
          sentAt: new Date(),
          sentCount: result.sent 
        });

        // Return success response
        res.json({ 
          success: true,
          sent: result.sent,
          failed: result.failed,
          limitReached: false,
          message: 'Emails sent successfully!'
        });

      } catch (error) {
        console.error('❌ Campaign failed:', error);
        await storage.updateCampaign(campaign.id, { status: 'failed' });
        throw error;
      }
    } catch (error) {
      console.error('Send campaign error:', error);
      res.status(500).json({ message: 'Failed to send email campaign' });
    }
  });

  // Get campaign progress
  app.get("/api/campaigns/:id/progress", authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      const campaignId = req.params.id;
      const progress = getCampaignProgress(campaignId);

      if (!progress) {
        return res.status(404).json({ message: 'Campaign not found or completed' });
      }

      res.json(progress);
    } catch (error) {
      console.error('Get campaign progress error:', error);
      res.status(500).json({ message: 'Failed to get campaign progress' });
    }
  });

  // Get email activity for live dashboard
  app.get("/api/email-activity", authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user.uid;

      // Get recent email activities from campaigns  
      const user = await storage.getUserByFirebaseUid(req.user.uid);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const campaigns = await storage.getCampaignsByUserId(user.id);
      const activities: any[] = [];

      // Mock recent activity data - in real implementation, you'd track individual email sends
      const recentCampaigns = campaigns
        .filter(c => c.status === 'sent' || c.status === 'sending')
        .slice(0, 5);

      for (const campaign of recentCampaigns) {
        const emailList = await storage.getEmailList(campaign.emailListId);
        if (emailList) {
          // Generate mock activities for demonstration
          const mockEmails = [
            'john@company.com', 'sarah@startup.io', 'mike@business.net', 
            'anna@corp.org', 'david@agency.co', 'lisa@enterprise.com'
          ];

          const statuses = ['sent', 'delivered', 'opened', 'bounced'];

          for (let i = 0; i < Math.min(3, emailList.contactCount); i++) {
            activities.push({
              id: `${campaign.id}-${i}`,
              email: mockEmails[i % mockEmails.length],
              status: statuses[Math.floor(Math.random() * statuses.length)],
              timestamp: new Date(Date.now() - Math.random() * 60 * 60 * 1000).toISOString(),
              campaignName: campaign.name
            });
          }
        }
      }

      // Sort by timestamp (newest first)
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      res.json(activities.slice(0, 20)); // Return last 20 activities
    } catch (error) {
      console.error('Get email activity error:', error);
      res.status(500).json({ message: 'Failed to get email activity' });
    }
  });

  // Routes registered successfully
}