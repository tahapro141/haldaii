import { Link, useLocation } from 'wouter';
import { Bot } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

interface NavigationProps {
  onAuthClick: (isSignUp: boolean) => void;
}

export default function Navigation({ onAuthClick }: NavigationProps) {
  const { user, signOut } = useAuth();
  const [location] = useLocation();

  const scrollToSection = (sectionId: string) => {
    if (location !== '/') return;
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="fixed top-4 left-1/2 transform -translate-x-1/2 w-11/12 max-w-6xl z-50 bg-gray-900/80 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl">
      <div className="px-6 sm:px-8 lg:px-10">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center space-x-2" data-testid="link-home">
            <Bot className="h-8 w-8 text-silver-500" />
            <span className="text-xl font-bold gradient-text">Hald AI</span>
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            <button 
              onClick={() => scrollToSection('how-it-works')}
              className="text-gray-300 hover:text-silver-400 transition-colors"
              data-testid="button-how-it-works"
            >
              How It Works
            </button>
            <button 
              onClick={() => scrollToSection('about')}
              className="text-gray-300 hover:text-silver-400 transition-colors"
              data-testid="button-about"
            >
              About
            </button>
            <button 
              onClick={() => scrollToSection('pricing')}
              className="text-gray-300 hover:text-silver-400 transition-colors"
              data-testid="button-pricing"
            >
              Pricing
            </button>
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                <Link href="/dashboard">
                  <Button variant="outline" className="text-silver-400 border-silver-400 hover:bg-silver-400 hover:text-gray-900" data-testid="button-dashboard">
                    Dashboard
                  </Button>
                </Link>
                <Button 
                  onClick={signOut}
                  variant="ghost"
                  className="text-gray-300 hover:text-silver-400"
                  data-testid="button-sign-out"
                >
                  Sign Out
                </Button>
              </div>
            ) : (
              <Button 
                onClick={() => onAuthClick(false)}
                className="bg-silver-500 text-gray-900 hover:bg-silver-400 flex items-center space-x-2"
                data-testid="button-continue-google"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Continue with Google</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}