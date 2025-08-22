import { Shield, Lock, BarChart3, Settings } from 'lucide-react';

export default function AboutSection() {
  return (
    <section id="about" className="py-20 bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-4xl font-bold gradient-text mb-6">About Hald AI</h2>
            <div className="space-y-6 text-gray-300">
              <p className="text-lg leading-relaxed" data-testid="text-about-description-1">
                Hald AI revolutionizes email marketing by combining artificial intelligence with enterprise-grade email delivery. 
                Our platform enables businesses to scale their outreach efforts while maintaining personalization and authenticity.
              </p>
              
              <p className="leading-relaxed" data-testid="text-about-description-2">
                Built for modern sales teams, marketing professionals, and entrepreneurs who need to reach thousands 
                of prospects efficiently. Our AI understands context, tone, and industry-specific language to create 
                emails that convert.
              </p>
              
              <div className="grid grid-cols-2 gap-6 mt-8">
                <div className="text-center">
                  <div className="text-3xl font-bold text-silver-400" data-testid="text-stat-total-emails">500K+</div>
                  <div className="text-sm text-gray-400">Emails Sent</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-silver-400" data-testid="text-stat-active-users">1K+</div>
                  <div className="text-sm text-gray-400">Active Users</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-silver-400" data-testid="text-stat-avg-open-rate">28%</div>
                  <div className="text-sm text-gray-400">Average Open Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-silver-400" data-testid="text-stat-avg-reply-rate">12%</div>
                  <div className="text-sm text-gray-400">Average Reply Rate</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="glass-card rounded-xl p-8">
            <img 
              src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=600" 
              alt="Modern office workspace with analytics dashboards" 
              className="rounded-lg w-full h-auto mb-6"
            />
            
            <div>
              <h3 className="text-xl font-semibold text-silver-300 mb-4">Enterprise-Ready Features</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-center" data-testid="feature-soc2-compliance">
                  <Shield className="text-silver-400 mr-3 h-5 w-5" />
                  SOC 2 Type II Compliance
                </li>
                <li className="flex items-center" data-testid="feature-encryption">
                  <Lock className="text-silver-400 mr-3 h-5 w-5" />
                  End-to-end Encryption
                </li>
                <li className="flex items-center" data-testid="feature-analytics">
                  <BarChart3 className="text-silver-400 mr-3 h-5 w-5" />
                  Advanced Analytics
                </li>
                <li className="flex items-center" data-testid="feature-api-integration">
                  <Settings className="text-silver-400 mr-3 h-5 w-5" />
                  API Integration
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
