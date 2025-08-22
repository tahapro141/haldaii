import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Wand2, Save, Send, Eye, Image, Link2, Bold } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GmailConnectionStatus } from './GmailConnectionStatus';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { EmailList } from '@shared/schema';
import { ConfirmationDialog } from './ConfirmationDialog';

interface GenerateEmailRequest {
  purpose: string;
  audience: string;
  benefits: string;
  tone: string;
}

interface GeneratedEmail {
  subject: string;
  content: string;
}

export default function EmailComposer() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [purpose, setPurpose] = useState('');
  const [audience, setAudience] = useState('');
  const [benefits, setBenefits] = useState('');
  const [tone, setTone] = useState('professional');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [uploadedImages, setUploadedImages] = useState<Array<{id: string, url: string, name: string}>>([]);
  const [senderEmail, setSenderEmail] = useState('echoai@gmail.com');
  const [senderName, setSenderName] = useState('Echo AI');
  const [selectedListId, setSelectedListId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Fetch email lists
  const { data: emailLists = [] } = useQuery<EmailList[]>({
    queryKey: ['/api/email-lists'],
    enabled: !!user,
  });

  // Generate email mutation
  const generateEmailMutation = useMutation({
    mutationFn: async (data: GenerateEmailRequest): Promise<GeneratedEmail> => {
      const response = await apiRequest('POST', '/api/ai/generate-email', data);
      return response.json();
    },
    onSuccess: (data) => {
      setSubject(data.subject);
      setContent(data.content);
      toast({
        title: 'Success',
        description: 'Email generated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate email',
        variant: 'destructive',
      });
    },
  });

  // Add state for tracking send progress
  const [sendProgress, setSendProgress] = useState<{sent: number; total: number; status: string} | null>(null);

  // Send campaign mutation
  const sendCampaignMutation = useMutation({
    mutationFn: async (campaignData: any) => {
      const response = await apiRequest('POST', '/api/campaigns/send', campaignData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send emails');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.limitReached) {
        toast({
          title: '🚀 Upgrade Required', 
          description: (
            <div>
              <p>You've hit the limit of 2 emails for the free plan.</p>
              <a 
                href="#pricing" 
                className="text-silver-300 underline hover:text-silver-200"
                onClick={() => window.location.hash = 'pricing'}
              >
                Upgrade your plan →
              </a>
            </div>
          ),
        });
      } else {
        toast({
          title: '✅ Emails Sent Successfully!', 
          description: `${data.sent || selectedList?.contactCount || 0} emails have been delivered through Gmail.`,
        });
        // Reset form
        setSubject('');
        setContent('');
        setPurpose('');
        setAudience('');
        setBenefits('');
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send campaign',
        variant: 'destructive',
      });
    },
  });

  // Handle image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    try {
      const newImages: Array<{id: string; url: string; name: string}> = [];
      
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        
        // Create object URL for preview
        const url = URL.createObjectURL(file);
        const id = Math.random().toString(36).substr(2, 9);
        
        newImages.push({
          id,
          url,
          name: file.name,
        });
      }
      
      setUploadedImages(prev => [...prev, ...newImages]);
      
      toast({
        title: 'Success',
        description: `${newImages.length} image(s) uploaded successfully`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to upload images',
        variant: 'destructive',
      });
    } finally {
      setUploadingImage(false);
      // Reset input
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  // Remove uploaded image
  const removeImage = (imageId: string) => {
    setUploadedImages(prev => {
      const imageToRemove = prev.find(img => img.id === imageId);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.url);
      }
      return prev.filter(img => img.id !== imageId);
    });
  };

  // Insert image into email content
  const insertImageIntoContent = (imageUrl: string, imageName: string) => {
    const imageHtml = `
<tr>
    <td style="padding: 20px 0; text-align: center;">
        <img src="${imageUrl}" alt="${imageName}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
    </td>
</tr>`;
    
    if (manualContent) {
      const newContent = manualContent + imageHtml;
      setManualContent(newContent);
      setContent(newContent);
    } else {
      const newContent = content + imageHtml;
      setContent(newContent);
    }
    
    toast({
      title: 'Success',
      description: 'Image inserted into email content',
    });
  };

  const handleGenerateEmail = async () => {
    if (!purpose.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a campaign purpose',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      await generateEmailMutation.mutateAsync({
        purpose,
        audience,
        benefits,
        tone,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendCampaign = async () => {
    if (!subject.trim() || !content.trim() || !senderEmail.trim() || !senderName.trim() || !selectedListId) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setShowConfirmDialog(true);
  };

  const handleConfirmSend = async () => {
    await sendCampaignMutation.mutateAsync({
      emailListId: selectedListId,
      subject,
      content,
      senderEmail,
      senderName,
    });
  };

  const selectedList = emailLists.find(list => list.id === selectedListId);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-400">Please sign in to access the email composer</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-20 bg-[#0a0a0a]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold gradient-text mb-2" data-testid="text-composer-title">AI Email Composer</h2>
          <p className="text-gray-400">Generate personalized emails with AI and customize them to perfection</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* AI Prompt Section */}
          <Card className="glass-card border-white/10">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-silver-300">AI Email Generator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="purpose" className="text-gray-300">Campaign Purpose</Label>
                <Input
                  id="purpose"
                  placeholder="e.g., Promote EchoAI.com tool"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white focus:border-silver-500"
                  data-testid="input-campaign-purpose"
                />
              </div>
              
              <div>
                <Label htmlFor="audience" className="text-gray-300">Target Audience</Label>
                <Input
                  id="audience"
                  placeholder="e.g., Startup founders, Marketing professionals"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white focus:border-silver-500"
                  data-testid="input-target-audience"
                />
              </div>
              
              <div>
                <Label htmlFor="benefits" className="text-gray-300">Key Benefits</Label>
                <Textarea
                  id="benefits"
                  placeholder="e.g., AI-powered automation, Save 10+ hours per week, Increase conversion rates"
                  value={benefits}
                  onChange={(e) => setBenefits(e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white focus:border-silver-500 h-24 resize-none"
                  data-testid="textarea-key-benefits"
                />
              </div>
              
              <div>
                <Label htmlFor="tone" className="text-gray-300">Tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white focus:border-silver-500" data-testid="select-tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="formal">Formal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button
                onClick={handleGenerateEmail}
                disabled={isGenerating}
                className="w-full bg-silver-600 text-gray-900 hover:bg-silver-500 silver-glow"
                data-testid="button-generate-email"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Generate Email with AI
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
          
          {/* Email Editor */}
          <Card className="glass-card border-white/10">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl font-semibold text-silver-300">Email Editor</CardTitle>
                <div className="flex space-x-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                    id="image-upload"
                    multiple
                  />
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="text-gray-400 hover:text-silver-300 h-8 w-8 p-0"
                    onClick={() => document.getElementById('image-upload')?.click()}
                    disabled={uploadingImage}
                    title="Upload image"
                  >
                    {uploadingImage ? (
                      <div className="animate-spin rounded-full h-3 w-3 border border-gray-400 border-t-transparent"></div>
                    ) : (
                      <Image className="h-4 w-4" />
                    )}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-gray-400 hover:text-silver-300 h-8 w-8 p-0">
                    <Link2 className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-gray-400 hover:text-silver-300 h-8 w-8 p-0">
                    <Bold className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="subject" className="text-gray-300">Subject Line</Label>
                <Input
                  id="subject"
                  placeholder="Subject will be generated by AI..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white focus:border-silver-500"
                  data-testid="input-email-subject"
                />
              </div>
              
              <div className="space-y-3">
                <Label className="text-gray-300">Email Content</Label>
                <div className="flex space-x-2 mb-3">
                  <Button 
                    type="button"
                    variant={!manualContent ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setManualContent('')}
                    className="text-xs bg-silver-600 text-gray-900 hover:bg-silver-500"
                  >
                    AI Generated
                  </Button>
                  <Button 
                    type="button"
                    variant={manualContent ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setManualContent('Enter your custom email content here...')}
                    className="text-xs bg-silver-600 text-gray-900 hover:bg-silver-500"
                  >
                    Manual Input
                  </Button>
                </div>
                {manualContent ? (
                  <Textarea
                    placeholder="Paste your email content here... You can write a full paragraph or use any format you like."
                    value={manualContent}
                    onChange={(e) => {
                      setManualContent(e.target.value);
                      setContent(e.target.value);
                    }}
                    className="border-gray-600 text-white focus:border-silver-500 min-h-80 resize-none bg-[#000000]"
                    data-testid="textarea-manual-content"
                  />
                ) : (
                  <Textarea
                    id="content"
                    placeholder="AI-generated email content will appear here..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="border-gray-600 text-white focus:border-silver-500 min-h-80 resize-none bg-[#000000]"
                    data-testid="textarea-email-content"
                  />
                )}
              </div>
              
              {/* Image Gallery */}
              {uploadedImages.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-gray-300">Uploaded Images</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {uploadedImages.map((image) => (
                      <div key={image.id} className="relative group">
                        <img 
                          src={image.url} 
                          alt={image.name}
                          className="w-full h-20 object-cover rounded border border-gray-600"
                        />
                        <button
                          onClick={() => removeImage(image.id)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                        <button
                          onClick={() => insertImageIntoContent(image.url, image.name)}
                          className="absolute bottom-1 left-1 bg-silver-600 text-gray-900 rounded px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Insert
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex space-x-4">
                <Button className="flex-1 bg-gray-700 text-white hover:bg-gray-600" data-testid="button-preview-email">
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </Button>
                <Button className="flex-1 bg-silver-600 text-gray-900 hover:bg-silver-500" data-testid="button-save-template">
                  <Save className="mr-2 h-4 w-4" />
                  Save Template
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Gmail Integration & Send */}
        <Card className="mt-8 glass-card border-white/10">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-silver-300 flex items-center gap-2">
              Gmail Connection & Send
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Gmail Status */}
              <GmailConnectionStatus />
              
              {/* Email List Selection */}
              <div className="space-y-2">
                <Label className="text-gray-300">Select Email List</Label>
                <Select value={selectedListId} onValueChange={setSelectedListId}>
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white focus:border-silver-500" data-testid="select-email-list">
                    <SelectValue placeholder="Choose your contact list" />
                  </SelectTrigger>
                  <SelectContent>
                    {emailLists.map((list) => (
                      <SelectItem key={list.id} value={list.id}>
                        {list.name} ({list.contactCount} contacts)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Email Limit Warning */}
              {selectedList && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Selected contacts:</span>
                    <span className="font-semibold text-silver-300 text-lg" data-testid="text-recipient-count">
                      {selectedList.contactCount} contacts
                    </span>
                  </div>
                  
                  {/* Daily Limit Warning */}
                  <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-yellow-400 font-medium">Free Plan Limit</span>
                    </div>
                    <p className="text-gray-300 text-sm mt-1">
                      You can send up to 2 emails per day on the free plan.
                    </p>
                  </div>
                </div>
              )}
              
              {/* Send Button */}
              <Button
                onClick={handleSendCampaign}
                disabled={sendCampaignMutation.isPending || !selectedListId || !subject.trim() || !content.trim()}
                className="w-full bg-silver-600 text-gray-900 hover:bg-silver-500 silver-glow py-6 text-lg font-semibold"
                data-testid="button-send-campaign"
              >
                {sendCampaignMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900 mr-3"></div>
                    Sending emails...
                  </>
                ) : (
                  <>
                    <Send className="mr-3 h-5 w-5" />
                    Send Campaign via Gmail
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Confirmation Dialog */}
        {selectedList && (
          <ConfirmationDialog
            isOpen={showConfirmDialog}
            onClose={() => setShowConfirmDialog(false)}
            onConfirm={handleConfirmSend}
            contactCount={selectedList.contactCount}
            subject={subject}
            listName={selectedList.name}
          />
        )}
      </div>
    </div>
  );
}
