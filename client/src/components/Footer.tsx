import { Bot } from 'lucide-react';
import { SiX, SiLinkedin, SiGithub } from 'react-icons/si';

export default function Footer() {
  return (
    <footer className="py-12 bg-[#141414]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <Bot className="h-8 w-8 text-silver-500" />
              <span className="text-xl font-bold gradient-text">Hald AI</span>
            </div>
            <p className="text-gray-400 max-w-md" data-testid="text-footer-description">
              Revolutionizing email outreach with AI-powered personalization and enterprise-grade delivery.
            </p>
          </div>
          
          <div>
            <h3 className="text-white font-semibold mb-4">Product</h3>
            <ul className="space-y-2 text-gray-400">
              <li><a href="#" className="hover:text-silver-400 transition-colors" data-testid="link-features">Features</a></li>
              <li><a href="#pricing" className="hover:text-silver-400 transition-colors" data-testid="link-pricing">Pricing</a></li>
              <li><a href="#" className="hover:text-silver-400 transition-colors" data-testid="link-api">API</a></li>
              <li><a href="#" className="hover:text-silver-400 transition-colors" data-testid="link-integrations">Integrations</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-white font-semibold mb-4">Support</h3>
            <ul className="space-y-2 text-gray-400">
              <li><a href="#" className="hover:text-silver-400 transition-colors" data-testid="link-documentation">Documentation</a></li>
              <li><a href="#" className="hover:text-silver-400 transition-colors" data-testid="link-help-center">Help Center</a></li>
              <li><a href="#" className="hover:text-silver-400 transition-colors" data-testid="link-contact">Contact</a></li>
              <li><a href="#" className="hover:text-silver-400 transition-colors" data-testid="link-status">Status</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-700 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm" data-testid="text-copyright">© 2024 Hald AI. All rights reserved.</p>
          <div className="flex space-x-6 mt-4 sm:mt-0">
            <a href="#" className="text-gray-400 hover:text-silver-400 transition-colors" data-testid="link-twitter">
              <SiX className="h-5 w-5" />
            </a>
            <a href="#" className="text-gray-400 hover:text-silver-400 transition-colors" data-testid="link-linkedin">
              <SiLinkedin className="h-5 w-5" />
            </a>
            <a href="#" className="text-gray-400 hover:text-silver-400 transition-colors" data-testid="link-github">
              <SiGithub className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
