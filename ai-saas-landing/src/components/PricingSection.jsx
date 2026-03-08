import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const plans = [
    {
        name: "Developer",
        price: "Free",
        desc: "For individuals building their first AI application.",
        features: ["100k requests/month", "Community support", "Standard models", "1GB Vector Storage"],
        cta: "Start Free",
        popular: false
    },
    {
        name: "Pro",
        price: "$49",
        period: "/mo",
        desc: "For production teams that need scale and reliability.",
        features: ["Unlimited requests", "Priority 24/7 support", "Custom fine-tuning", "100GB Vector Storage", "SLA guarantee"],
        cta: "Start Trial",
        popular: true
    },
    {
        name: "Enterprise",
        price: "Custom",
        desc: "Dedicated infrastructure for mission-critical workloads.",
        features: ["VPC Peering", "Dedicated Account Manager", "Custom SLAs", "Unlimited Storage", "On-premise deployment"],
        cta: "Contact Sales",
        popular: false
    }
];

export default function PricingSection() {
    return (
        <section id="pricing" className="py-32 relative">
            <div className="max-w-7xl mx-auto px-6">
                <div className="text-center mb-20">
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Simple, transparent pricing</h2>
                    <p className="text-muted text-lg max-w-2xl mx-auto">
                        Start for free, scale when you need to. No hidden fees or surprise overages.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                    {plans.map((plan, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-50px" }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            className={`relative rounded-3xl p-8 flex flex-col ${plan.popular
                                    ? 'bg-gradient-to-b from-white/10 to-transparent border border-accent1/50 shadow-[0_0_40px_rgba(192,132,252,0.15)] transform md:-translate-y-4'
                                    : 'glass-panel border-white/10'
                                }`}
                        >
                            {plan.popular && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1 bg-accent1 text-black text-xs font-bold rounded-full">
                                    Most Popular
                                </div>
                            )}

                            <div className="mb-8">
                                <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                                <p className="text-muted text-sm min-h-[40px]">{plan.desc}</p>
                            </div>

                            <div className="mb-8 flex items-end gap-1">
                                <span className="text-5xl font-bold tracking-tighter">{plan.price}</span>
                                {plan.period && <span className="text-muted mb-1">{plan.period}</span>}
                            </div>

                            <div className="flex-1 space-y-4 mb-8">
                                {plan.features.map((feature, idx) => (
                                    <div key={idx} className="flex items-center gap-3">
                                        <Check className="w-5 h-5 text-accent2 shrink-0" />
                                        <span className="text-sm text-primary/90">{feature}</span>
                                    </div>
                                ))}
                            </div>

                            <button
                                className={`w-full py-4 rounded-xl font-semibold transition-all duration-300 ${plan.popular
                                        ? 'bg-white text-black hover:bg-gray-200 button-glow'
                                        : 'bg-white/5 hover:bg-white/10 border border-white/10'
                                    }`}
                            >
                                {plan.cta}
                            </button>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
