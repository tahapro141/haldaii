import { useState } from 'react';
import Navigation from '@/components/Navigation';
import HeroSection from '@/components/HeroSection';
import AboutSection from '@/components/AboutSection';
import PricingSection from '@/components/PricingSection';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';
import { Upload, Bot, Send } from 'lucide-react';

export default function HomePage() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  const handleAuthClick = (isSignUp: boolean) => {
    setAuthMode(isSignUp ? 'signup' : 'signin');
    setAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation onAuthClick={handleAuthClick} />
      <HeroSection />
      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-[#000000]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold gradient-text mb-4">How It Works</h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">Simple, powerful, and automated. Get started in minutes.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="text-center glass-card rounded-xl p-8 hover-lift" data-testid="card-step-1">
              <div className="bg-silver-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Upload className="h-8 w-8 text-gray-900" />
              </div>
              <h3 className="text-xl font-semibold text-silver-300 mb-4">1. Upload Your Lists</h3>
              <p className="text-gray-400">Upload your CSV files with email contacts. Our system validates and organizes them automatically.</p>
            </div>
            
            {/* Step 2 */}
            <div className="text-center glass-card rounded-xl p-8 hover-lift" data-testid="card-step-2">
              <div className="bg-silver-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Bot className="h-8 w-8 text-gray-900" />
              </div>
              <h3 className="text-xl font-semibold text-silver-300 mb-4">2. AI Generates Content</h3>
              <p className="text-gray-400">Describe your campaign goals and let our AI create personalized, engaging email content for you.</p>
            </div>
            
            {/* Step 3 */}
            <div className="text-center glass-card rounded-xl p-8 hover-lift" data-testid="card-step-3">
              <div className="bg-silver-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Send className="h-8 w-8 text-gray-900" />
              </div>
              <h3 className="text-xl font-semibold text-silver-300 mb-4">3. Send & Track</h3>
              <p className="text-gray-400">Send to thousands with one click. Track opens, replies, and conversions in real-time.</p>
            </div>
          </div>
        </div>
      </section>
      <AboutSection />
      <PricingSection />
      <Footer />
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
      />
    </div>
  );
}
