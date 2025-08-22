import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Plus, Edit2, Trash2, BarChart3, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import type { EmailList, Campaign } from '@shared/schema';
import { GmailConnectionStatus } from './GmailConnectionStatus';
import { GmailDailyStats } from './GmailDailyStats';
import { LiveEmailActivity } from './LiveEmailActivity';

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Fetch email lists
  const { data: emailLists = [], isLoading: listsLoading } = useQuery<EmailList[]>({
    queryKey: ['/api/email-lists'],
    enabled: !!user,
  });

  // Fetch campaigns for stats
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ['/api/campaigns'],
    enabled: !!user,
  });



  // Upload CSV mutation
  const uploadCsvMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiRequest('POST', '/api/email-lists/upload', formData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-lists'] });
      toast({
        title: '✅ Success!',
        description: 'Email list uploaded successfully',
      });
    },
    onError: (error: any) => {
      let title = '❌ Upload Failed';
      let description = 'Failed to upload email list';

      if (error.message && error.message.includes('No valid email addresses found')) {
        title = '📧 No Emails Found';
        description = 'Your file doesn\'t contain valid email addresses like user@gmail.com. Please check your file and try again.';
      } else if (error.message && error.message.includes('Please upload a CSV, TXT, or TSV file')) {
        title = '📁 Invalid File Type';
        description = 'Please upload a CSV, TXT, or TSV file containing email addresses.';
      } else if (error.message) {
        // Extract just the main message without technical details
        const cleanMessage = error.message.split(':').pop()?.trim() || error.message;
        description = cleanMessage;
      }

      toast({
        title,
        description,
        variant: 'destructive',
      });
    },
  });

  // Delete email list mutation
  const deleteListMutation = useMutation({
    mutationFn: async (listId: string) => {
      return apiRequest('DELETE', `/api/email-lists/${listId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-lists'] });
      toast({
        title: 'Success',
        description: 'Email list deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete email list',
        variant: 'destructive',
      });
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validExtensions = ['.csv', '.txt', '.tsv'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!validExtensions.includes(fileExtension)) {
      toast({
        title: '📁 Invalid File Type',
        description: 'Please upload a CSV, TXT, or TSV file containing email addresses',
        variant: 'destructive',
      });
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: '📁 File Too Large',
        description: 'Please upload a file smaller than 5MB',
        variant: 'destructive',
      });
      return;
    }

    setUploadingFile(true);
    try {
      await uploadCsvMutation.mutateAsync(file);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleDeleteList = (listId: string) => {
    if (confirm('Are you sure you want to delete this email list?')) {
      deleteListMutation.mutate(listId);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-400">Please sign in to access the dashboard</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold gradient-text mb-2" data-testid="text-dashboard-title">Dashboard</h2>
          <p className="text-gray-400">Manage your email campaigns and track performance</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Email List Management */}
          <div className="lg:col-span-2">
            <Card className="glass-card border-white/10">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-xl font-semibold text-silver-300">Email Lists</CardTitle>
                  <Button 
                    onClick={handleUploadClick}
                    disabled={uploadingFile}
                    className="bg-silver-600 text-gray-900 hover:bg-silver-500 silver-glow"
                    data-testid="button-upload-csv"
                  >
                    {uploadingFile ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Files
                      </>
                    )}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt,.tsv"
                    onChange={handleFileUpload}
                    className="hidden"
                    data-testid="input-file-upload"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {/* CSV Upload Area */}
                <div 
                  className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center mb-6 hover:border-silver-500 transition-colors cursor-pointer"
                  onClick={handleUploadClick}
                  data-testid="area-csv-upload"
                >
                  <FileSpreadsheet className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400 mb-2">Drop your email list here or click to browse</p>
                  <p className="text-sm text-gray-500">Supports CSV, TXT, and TSV files</p>
                  <div className="mt-3 text-xs text-gray-600">
                    <p>✅ Valid: user@gmail.com, contact@company.org</p>
                    <p>❌ Invalid: just text without @ symbols</p>
                  </div>
                </div>

                {/* Email List Preview */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <h4 className="font-medium text-silver-300 mb-3">Your Email Lists</h4>
                  {listsLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-16 bg-gray-700 rounded-lg animate-pulse" />
                      ))}
                    </div>
                  ) : emailLists.length === 0 ? (
                    <p className="text-gray-400 text-center py-8" data-testid="text-no-email-lists">
                      No email lists yet. Upload a CSV file to get started.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {emailLists.map((list) => (
                        <div 
                          key={list.id} 
                          className="flex justify-between items-center p-3 bg-gray-700 rounded-lg"
                          data-testid={`card-email-list-${list.id}`}
                        >
                          <div>
                            <span className="font-medium text-white" data-testid={`text-list-name-${list.id}`}>
                              {list.name}
                            </span>
                            <span className="text-sm text-gray-400 ml-2" data-testid={`text-list-count-${list.id}`}>
                              {list.contactCount} contacts
                            </span>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-silver-400 hover:text-silver-300 h-8 w-8 p-0"
                              data-testid={`button-edit-list-${list.id}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteList(list.id)}
                              className="text-red-400 hover:text-red-300 h-8 w-8 p-0"
                              data-testid={`button-delete-list-${list.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Gmail Connection Status */}
            <GmailConnectionStatus />

            {/* Gmail Daily Stats */}
            <GmailDailyStats />

            {/* Live Email Activity - Removed as per instruction */}

            <Card className="glass-card border-white/10">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-silver-300">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/compose">
                  <Button 
                    className="w-full bg-silver-600 text-gray-900 hover:bg-silver-500"
                    data-testid="button-new-campaign"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New Campaign
                  </Button>
                </Link>
                <Button 
                  className="w-full bg-gray-700 text-white hover:bg-gray-600"
                  data-testid="button-view-analytics"
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  View Analytics
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}