
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Users, Mail, Zap } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  contactCount: number;
  subject: string;
  listName: string;
}

export function ConfirmationDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  contactCount, 
  subject, 
  listName 
}: ConfirmationDialogProps) {
  const isOverLimit = contactCount > 2;
  const emailsToSend = Math.min(contactCount, 2);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-silver-300 flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-400" />
            Confirm Email Campaign
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Campaign Details */}
          <div className="bg-gray-800 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-start">
              <span className="text-gray-400 text-sm">Subject:</span>
              <span className="text-white font-medium text-right max-w-[200px]">{subject}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Email List:</span>
              <span className="text-silver-300">{listName}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Total Contacts:</span>
              <Badge variant="secondary" className="bg-blue-600/20 text-blue-400">
                <Users className="w-3 h-3 mr-1" />
                {contactCount}
              </Badge>
            </div>
          </div>

          {/* Email Sending Info */}
          <div className={`rounded-lg p-4 border ${
            isOverLimit 
              ? 'bg-yellow-900/20 border-yellow-600/30' 
              : 'bg-green-900/20 border-green-600/30'
          }`}>
            <div className="flex items-start gap-3">
              {isOverLimit ? (
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              ) : (
                <Zap className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              )}
              
              <div className="space-y-2">
                <p className={`font-medium ${
                  isOverLimit ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {isOverLimit ? 'Sending Limited by Free Plan' : 'Ready to Send'}
                </p>
                
                <p className="text-gray-300 text-sm">
                  {isOverLimit ? (
                    <>
                      You have <strong>{contactCount} contacts</strong> but can only send{' '}
                      <strong className="text-yellow-400">{emailsToSend} emails</strong> on the free plan.
                    </>
                  ) : (
                    <>
                      All <strong className="text-green-400">{emailsToSend} emails</strong> will be sent to your contacts.
                    </>
                  )}
                </p>

                {isOverLimit && (
                  <div className="mt-3 p-3 bg-gray-800 rounded border border-gray-600">
                    <p className="text-xs text-gray-400 mb-2">
                      Want to send to all {contactCount} contacts?
                    </p>
                    <Button 
                      size="sm" 
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-xs"
                      onClick={() => {
                        // Future: Navigate to pricing
                        console.log('Navigate to pricing');
                      }}
                    >
                      Upgrade Plan →
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="flex-1 bg-silver-600 text-gray-900 hover:bg-silver-500 silver-glow"
            >
              Send {emailsToSend} Email{emailsToSend !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
