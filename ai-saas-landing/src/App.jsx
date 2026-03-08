import React from 'react';
import HeroSection from './components/HeroSection';
import FeaturesSection from './components/FeaturesSection';
import ProductDemoSection from './components/ProductDemoSection';
import Testimonials from './components/Testimonials';
import PricingSection from './components/PricingSection';
import FAQSection from './components/FAQSection';
import Footer from './components/Footer';

function App() {
  return (
    <div className="min-h-screen bg-background text-primary selection:bg-accent1/30">
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 glass-panel border-b-0 border-x-0 border-t-0">
        <div className="text-xl font-bold tracking-tighter flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-accent1 to-accent3"></div>
          NexusAI
        </div>
        <div className="hidden md:flex gap-8 text-sm font-medium text-muted">
          <a href="#features" className="hover:text-primary transition-colors">Features</a>
          <a href="#demo" className="hover:text-primary transition-colors">Platform</a>
          <a href="#pricing" className="hover:text-primary transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-primary transition-colors">FAQ</a>
        </div>
        <div className="flex gap-4">
          <button className="text-sm font-medium px-4 py-2 hover:text-white transition-colors">Log in</button>
          <button className="text-sm font-medium bg-white text-black px-4 py-2 rounded-full hover:bg-gray-200 transition-colors">Sign Up</button>
        </div>
      </nav>

      <main>
        <HeroSection />
        <FeaturesSection />
        <ProductDemoSection />
        <Testimonials />
        <PricingSection />
        <FAQSection />
      </main>

      <Footer />
    </div>
  );
}

export default App;
