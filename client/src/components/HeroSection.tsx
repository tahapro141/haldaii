import { ArrowRight } from 'lucide-react';
import LightRays from './LightRays';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'wouter';

export default function HeroSection() {
  const { user } = useAuth();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black">
      <div className="absolute inset-0">
        <LightRays 
          raysOrigin="top-center"
          raysColor="#c0c0c0"
          raysSpeed={1.2}
          lightSpread={0.6}
          rayLength={3.5}
          pulsating={true}
          fadeDistance={1.8}
          saturation={2.2}
          followMouse={true}
          mouseInfluence={0.2}
          noiseAmount={0.08}
          distortion={0.15}
          className="opacity-95"
        />
      </div>
      
      <div className="absolute inset-0 bg-gradient-to-br from-black/30 via-gray-900/20 to-black/50"></div>
      
      <div className="relative z-10 text-center max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24">
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
          Turn Leads Into Clients<br/>
          <span className="gradient-text">With AI Outreach</span>
        </h1>
        
        <p className="text-xl sm:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed" data-testid="text-hero-description">
          Hald AI automates your sales outreach, saving you time and boosting your reply rates with intelligent, personalized emails.
        </p>
        
        {user ? (
          <Link href="/dashboard">
            <Button 
              size="lg"
              className="bg-silver-500 text-gray-900 px-8 py-4 text-lg font-semibold hover:bg-silver-400 transition-all duration-300 silver-glow hover-lift"
              data-testid="button-go-to-dashboard"
            >
              Go to Dashboard
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        ) : (
          <Button 
            size="lg"
            className="bg-silver-500 text-gray-900 px-8 py-4 text-lg font-semibold hover:bg-silver-400 transition-all duration-300 silver-glow hover-lift"
            onClick={() => window.scrollTo({ top: document.getElementById('pricing')?.offsetTop, behavior: 'smooth' })}
            data-testid="button-get-started"
          >
            Get Started For Free
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        )}
      </div>
    </section>
  );
}
