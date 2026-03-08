import React from 'react';
import { motion } from 'framer-motion';

const testimonials = [
    {
        quote: "NexusAI replaced our entire machine learning pipeline. The latency is practically non-existent, and the accuracy is staggering.",
        author: "Sarah Chen",
        role: "CTO at DataFlow",
        avatar: "https://i.pravatar.cc/150?u=sarah"
    },
    {
        quote: "We were able to integrate their semantic search in 15 minutes. It's the most polished DX I've seen in the AI space.",
        author: "Marcus Johnson",
        role: "Lead Engineer at Scale",
        avatar: "https://i.pravatar.cc/150?u=marcus"
    },
    {
        quote: "The SOC2 compliance and VPC deployment options made this an easy sell to our enterprise security team.",
        author: "Elena Rodriguez",
        role: "VP Engineering at Acme Corp",
        avatar: "https://i.pravatar.cc/150?u=elena"
    },
    {
        quote: "NexusAI didn't just speed up our product, it fundamentally changed what we thought was possible to build.",
        author: "David Kim",
        role: "Founder at NextGen",
        avatar: "https://i.pravatar.cc/150?u=david"
    }
];

export default function Testimonials() {
    return (
        <section className="py-24 relative overflow-hidden border-y border-white/5 bg-white/[0.01]">
            <div className="absolute left-0 top-0 w-32 h-full bg-gradient-to-r from-background to-transparent z-10" />
            <div className="absolute right-0 top-0 w-32 h-full bg-gradient-to-l from-background to-transparent z-10" />

            <div className="flex gap-6 animate-[scroll_40s_linear_infinite] w-max">
                {[...testimonials, ...testimonials].map((item, idx) => (
                    <div
                        key={idx}
                        className="w-[400px] glass-panel p-8 rounded-2xl flex flex-col justify-between shrink-0"
                    >
                        <div className="flex gap-1 mb-6">
                            {[1, 2, 3, 4, 5].map(star => (
                                <svg key={star} className="w-4 h-4 text-accent1" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                            ))}
                        </div>
                        <p className="text-lg mb-8 leading-relaxed text-primary/90">"{item.quote}"</p>
                        <div className="flex items-center gap-4">
                            <img src={item.avatar} alt={item.author} className="w-12 h-12 rounded-full border border-white/20" />
                            <div>
                                <div className="font-semibold text-sm">{item.author}</div>
                                <div className="text-xs text-muted">{item.role}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(calc(-50% - 12px)); }
        }
      `}} />
        </section>
    );
}
