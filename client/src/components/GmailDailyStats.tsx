import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Mail, Clock, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface GmailStats {
  dailyCount: number;
  dailyLimit: number;
  remainingToday: number;
}

export function GmailDailyStats() {
  const { data: stats, isLoading, error } = useQuery<GmailStats>({
    queryKey: ['/api/gmail/stats'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Daily Email Limits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-700 rounded mb-2"></div>
            <div className="h-2 bg-gray-700 rounded mb-4"></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="h-16 bg-gray-700 rounded"></div>
              <div className="h-16 bg-gray-700 rounded"></div>
              <div className="h-16 bg-gray-700 rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !stats) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            Gmail Stats Unavailable
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400 text-sm">
            Connect your Gmail account to view daily sending limits
          </p>
        </CardContent>
      </Card>
    );
  }

  const progressPercentage = (stats.dailyCount / stats.dailyLimit) * 100;
  const isNearLimit = progressPercentage > 80;
  const isAtLimit = stats.remainingToday === 0;

  return (
    <Card className="bg-gray-900 border-gray-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-lg flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Daily Email Limits
          {isAtLimit && (
            <Badge variant="destructive" className="ml-auto">
              <AlertCircle className="w-3 h-3 mr-1" />
              Limit Reached
            </Badge>
          )}
          {isNearLimit && !isAtLimit && (
            <Badge variant="secondary" className="ml-auto bg-yellow-600 text-white">
              <Clock className="w-3 h-3 mr-1" />
              Near Limit
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Daily Usage</span>
            <span className="text-white font-medium">
              {stats.dailyCount} / {stats.dailyLimit}
            </span>
          </div>
          <Progress 
            value={progressPercentage} 
            className="h-2"
            indicatorClassName={
              isAtLimit ? "bg-red-500" : 
              isNearLimit ? "bg-yellow-500" : 
              "bg-green-500"
            }
          />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center mb-1">
              <Mail className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-xl font-bold text-white">{stats.dailyCount}</div>
            <div className="text-xs text-gray-400">Sent Today</div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center mb-1">
              <BarChart3 className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-xl font-bold text-white">{stats.remainingToday}</div>
            <div className="text-xs text-gray-400">Remaining</div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center mb-1">
              <Clock className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-xl font-bold text-white">{stats.dailyLimit}</div>
            <div className="text-xs text-gray-400">Daily Limit</div>
          </div>
        </div>

        {/* Account Type Info */}
        <div className="pt-2 border-t border-gray-700">
          <p className="text-xs text-gray-400">
            {stats.dailyLimit === 500 ? (
              <>
                <span className="text-blue-400">Free Gmail Account</span> - 500 emails per day
              </>
            ) : (
              <>
                <span className="text-green-400">Workspace Account</span> - 2,000 emails per day
              </>
            )}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Limits reset daily at midnight
          </p>
        </div>
      </CardContent>
    </Card>
  );
}