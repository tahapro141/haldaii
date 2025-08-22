
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, CheckCircle, XCircle, Clock, Eye } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface EmailActivity {
  id: string;
  email: string;
  status: 'sent' | 'delivered' | 'opened' | 'bounced' | 'failed';
  timestamp: string;
  campaignName?: string;
}

const statusConfig = {
  sent: { color: 'text-green-400 bg-green-400/10', icon: Mail, label: 'Sent' },
  delivered: { color: 'text-blue-400 bg-blue-400/10', icon: CheckCircle, label: 'Delivered' },
  opened: { color: 'text-purple-400 bg-purple-400/10', icon: Eye, label: 'Opened' },
  bounced: { color: 'text-red-400 bg-red-400/10', icon: XCircle, label: 'Bounced' },
  failed: { color: 'text-orange-400 bg-orange-400/10', icon: XCircle, label: 'Failed' },
};

export function LiveEmailActivity() {
  const { data: activities = [], isLoading } = useQuery<EmailActivity[]>({
    queryKey: ['/api/email-activity'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  if (isLoading) {
    return (
      <Card className="glass-card border-white/10">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg font-semibold text-silver-300">Live Email Activity</CardTitle>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
              <span className="text-xs text-gray-400">Loading</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-800 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-white/10">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-semibold text-silver-300">Live Email Activity</CardTitle>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-400">Live</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 max-h-80 overflow-y-auto">
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-gray-500 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No recent email activity</p>
            <p className="text-gray-500 text-xs mt-1">Start a campaign to see live updates</p>
          </div>
        ) : (
          activities.slice(0, 10).map((activity) => {
            const config = statusConfig[activity.status];
            const Icon = config.icon;
            
            return (
              <div key={activity.id} className="flex justify-between items-center p-3 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <Icon className={`h-4 w-4 ${config.color.split(' ')[0]} flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">
                      {activity.email}
                    </p>
                    <div className="flex items-center space-x-2">
                      <p className="text-xs text-gray-400">
                        {formatTimeAgo(activity.timestamp)}
                      </p>
                      {activity.campaignName && (
                        <span className="text-xs text-gray-500">
                          • {activity.campaignName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Badge variant="secondary" className={`${config.color} border-none text-xs`}>
                  {config.label}
                </Badge>
              </div>
            );
          })
        )}
        
        {activities.length > 10 && (
          <div className="text-center pt-2">
            <p className="text-xs text-gray-500">
              Showing latest 10 activities • {activities.length} total
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
