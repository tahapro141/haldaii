import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Mail, CheckCircle, AlertCircle } from 'lucide-react';

interface GmailStatus {
  connected: boolean;
  email?: string;
}

export function GmailConnectionStatus() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Query Gmail connection status
  const { data: gmailStatus, isLoading } = useQuery<GmailStatus>({
    queryKey: ['/api/gmail/status'],
    refetchInterval: 5000,
  });

  // Connect Gmail with OAuth 2.0
  const handleGmailConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await apiRequest('POST', '/api/gmail/connect');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server response was not JSON');
      }

      const data = await response.json();

      if (data.authUrl) {
        console.log('Opening OAuth URL:', data.authUrl);
        
        // Open Gmail OAuth in popup
        const popup = window.open(data.authUrl, 'gmail-oauth', 'width=500,height=600,scrollbars=yes,resizable=yes');

        // Poll for connection status
        const pollInterval = setInterval(async () => {
          try {
            // Check if popup was closed
            if (popup?.closed) {
              clearInterval(pollInterval);
              setIsConnecting(false);
              return;
            }

            const statusResponse = await apiRequest('GET', '/api/gmail/status');
            if (statusResponse.ok) {
              const statusData = await statusResponse.json();

              if (statusData.connected) {
                clearInterval(pollInterval);
                if (popup) popup.close();
                
                toast({
                  title: "Gmail Connected! 🎉",
                  description: `Successfully connected ${statusData.email}. You can send up to 2 emails per day.`,
                });
                queryClient.invalidateQueries({ queryKey: ['/api/gmail/status'] });
                setIsConnecting(false);
              }
            }
          } catch (error) {
            // Continue polling
          }
        }, 2000);

        // Stop polling after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          if (popup && !popup.closed) popup.close();
          setIsConnecting(false);
        }, 300000);

      } else {
        throw new Error(data.message || 'No auth URL received');
      }
    } catch (error: any) {
      console.error('Gmail connection error:', error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect Gmail. Please check your network connection and try again.",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  // Disconnect Gmail mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/gmail/disconnect');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gmail/status'] });
      toast({
        title: 'Disconnected',
        description: 'Gmail account disconnected successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to disconnect Gmail',
        variant: 'destructive',
      });
    },
  });



  if (isLoading) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center animate-pulse">
              <Mail className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <p className="text-white font-medium">Checking Gmail connection...</p>
              <p className="text-gray-400 text-sm">Please wait</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (gmailStatus?.connected) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white font-medium">Gmail Connected</p>
                <p className="text-gray-400 text-sm">{gmailStatus.email}</p>
              </div>
            </div>
            <Button
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              variant="outline"
              size="sm"
              className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
            >
              {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }


  if (!gmailStatus?.connected) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardContent className="p-4">
          {!showConnectForm ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white font-medium">Gmail Not Connected</p>
                  <p className="text-gray-400 text-sm">Connect your Gmail account to send emails</p>
                </div>
              </div>
              <Button
                onClick={handleGmailConnect}
                disabled={isConnecting}
                className="bg-blue-600 hover:bg-blue-500 text-white"
                size="sm"
              >
                <Mail className="w-4 h-4 mr-2" />
                Connect Gmail
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white font-medium">Connect Your Gmail</p>
                  <p className="text-gray-400 text-sm">Click the button below to start the Gmail connection process.</p>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleGmailConnect}
                  disabled={isConnecting}
                  className="bg-blue-600 hover:bg-blue-500 text-white flex-1"
                >
                  {isConnecting ? 'Initiating Connection...' : 'Start Gmail Connection'}
                </Button>
                <Button
                  onClick={() => setShowConnectForm(false)}
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  Cancel
                </Button>
              </div>

              <p className="text-xs text-gray-500 mt-2">
                🔒 Your Gmail account will be connected securely via OAuth.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
}