import { type User, type InsertUser, type EmailList, type InsertEmailList, type Campaign, type InsertCampaign, type EmailTemplate, type InsertEmailTemplate } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;

  // Email Lists
  getEmailList(id: string): Promise<EmailList | undefined>;
  getEmailListsByUserId(userId: string): Promise<EmailList[]>;
  createEmailList(emailList: InsertEmailList): Promise<EmailList>;
  deleteEmailList(id: string): Promise<void>;

  // Campaigns
  getCampaign(id: string): Promise<Campaign | undefined>;
  getCampaignsByUserId(userId: string): Promise<Campaign[]>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign | undefined>;

  // Email Templates
  getEmailTemplate(id: string): Promise<EmailTemplate | undefined>;
  getEmailTemplatesByUserId(userId: string): Promise<EmailTemplate[]>;
  createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate>;
  deleteEmailTemplate(id: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private emailLists: Map<string, EmailList> = new Map();
  private campaigns: Map<string, Campaign> = new Map();
  private emailTemplates: Map<string, EmailTemplate> = new Map();

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.firebaseUid === firebaseUid);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Email Lists
  async getEmailList(id: string): Promise<EmailList | undefined> {
    return this.emailLists.get(id);
  }

  async getEmailListsByUserId(userId: string): Promise<EmailList[]> {
    return Array.from(this.emailLists.values()).filter(list => list.userId === userId);
  }

  async createEmailList(insertEmailList: InsertEmailList): Promise<EmailList> {
    const id = randomUUID();
    const emailList: EmailList = {
      ...insertEmailList,
      id,
      description: insertEmailList.description || null,
      contactCount: insertEmailList.contactCount || (insertEmailList.contacts?.length || 0),
      contacts: insertEmailList.contacts || [],
      createdAt: new Date()
    };
    this.emailLists.set(id, emailList);
    return emailList;
  }

  async deleteEmailList(id: string): Promise<void> {
    this.emailLists.delete(id);
  }

  // Campaigns
  async getCampaign(id: string): Promise<Campaign | undefined> {
    return this.campaigns.get(id);
  }

  async getCampaignsByUserId(userId: string): Promise<Campaign[]> {
    return Array.from(this.campaigns.values()).filter(campaign => campaign.userId === userId);
  }

  async createCampaign(insertCampaign: InsertCampaign): Promise<Campaign> {
    const id = randomUUID();
    const campaign: Campaign = {
      ...insertCampaign,
      id,
      status: insertCampaign.status || 'draft',
      sentCount: 0,
      openCount: 0,
      replyCount: 0,
      sentAt: null,
      createdAt: new Date()
    };
    this.campaigns.set(id, campaign);
    return campaign;
  }

  async updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign | undefined> {
    const campaign = this.campaigns.get(id);
    if (!campaign) return undefined;

    const updatedCampaign = { ...campaign, ...updates };
    this.campaigns.set(id, updatedCampaign);
    return updatedCampaign;
  }

  // Email Templates
  async getEmailTemplate(id: string): Promise<EmailTemplate | undefined> {
    return this.emailTemplates.get(id);
  }

  async getEmailTemplatesByUserId(userId: string): Promise<EmailTemplate[]> {
    return Array.from(this.emailTemplates.values()).filter(template => template.userId === userId);
  }

  async createEmailTemplate(insertTemplate: InsertEmailTemplate): Promise<EmailTemplate> {
    const id = randomUUID();
    const template: EmailTemplate = {
      ...insertTemplate,
      id,
      isPublic: insertTemplate.isPublic || false,
      createdAt: new Date()
    };
    this.emailTemplates.set(id, template);
    return template;
  }

  async deleteEmailTemplate(id: string): Promise<void> {
    this.emailTemplates.delete(id);
  }
}

export const storage = new MemStorage();
