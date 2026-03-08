import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Cpu, Sparkles, Shield, Rocket, Layers } from 'lucide-react';

const features = [
  {
    icon: <Cpu className="w-6 h-6 text-accent1" />,
    title: "Neural Processing",
    desc: "Lightning fast contextual analysis powered by our custom H1 architecture."
  },
  {
    icon: <Zap className="w-6 h-6 text-accent2" />,
    title: "Zero Latency",
    desc: "Predictive response streaming ensures your users never wait."
  },
  {
    icon: <Sparkles className="w-6 h-6 text-accent3" />,
    title: "Semantic Search",
    desc: "Vector embeddings out-of-the-box. Connect your data effortlessly."
  },
  {
    icon: <Shield className="w-6 h-6 text-accent1" />,
    title: "Enterprise Grade",
    desc: "SOC2 Type II certified. Your proprietary data never leaves your VPC."
  },
  {
    icon: <Rocket className="w-6 h-6 text-accent2" />,
    title: "Instant Deploy",
    desc: "Push to main and watch your AI applications go live globally in seconds."
  },
  {
    icon: <Layers className="w-6 h-6 text-accent3" />,
    title: "Extensible APIs",
    desc: "GraphQL and REST endpoints strictly typed for the best DX possible."
  }
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-32 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Built for the next generation</h2>
          <p className="text-muted text-lg max-w-2xl mx-auto">
            Everything you need to build intelligent applications. No compromise on speed, security, or developer experience.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="glass-panel p-8 rounded-2xl hover:bg-white/[0.05] transition-all duration-300 group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
              <div className="w-12 h-12 rounded-lg bg-white/[0.05] flex items-center justify-center mb-6 border border-white/10 group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                {item.icon}
              </div>
              <h3 className="text-xl font-semibold mb-3 tracking-tight">{item.title}</h3>
              <p className="text-muted leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
