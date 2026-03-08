import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const faqs = [
    {
        question: "How does NexusAI compare to OpenAI or Anthropic?",
        answer: "NexusAI is specifically designed as a reasoning engine for enterprise workflows, not a general chatbot. We offer lower latency, guaranteed VPC isolation, and much finer control over model alignment."
    },
    {
        question: "Can I deploy the models on my own infrastructure?",
        answer: "Yes, our Enterprise plan includes options for completely isolated on-premise deployments or VPC peering within AWS, GCP, and Azure."
    },
    {
        question: "Do you train your models on my company data?",
        answer: "Absolutely not. Data privacy is our core tenet. We have a zero-retention policy for API requests, and fine-tuning data is siloed to your specific organizational unit."
    },
    {
        question: "What is the typical latency for the API?",
        answer: "For our standard H1 models, time-to-first-token (TTFT) averages 45ms. Predictive streaming can bring perceived latency down to almost zero for sequential generations."
    }
];

export default function FAQSection() {
    const [openIndex, setOpenIndex] = useState(0);

    return (
        <section id="faq" className="py-32 relative">
            <div className="max-w-3xl mx-auto px-6">
                <div className="text-center mb-16">
                    <h2 className="text-4xl font-bold tracking-tight mb-4">Frequently Asked Questions</h2>
                </div>

                <div className="space-y-4">
                    {faqs.map((faq, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className="glass-panel border-white/10 rounded-2xl overflow-hidden"
                        >
                            <button
                                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                                className="w-full text-left px-6 py-6 flex justify-between items-center focus:outline-none"
                            >
                                <span className="font-medium text-lg pr-8">{faq.question}</span>
                                <ChevronDown
                                    className={`w-5 h-5 text-muted transition-transform duration-300 shrink-0 ${openIndex === index ? 'rotate-180' : ''}`}
                                />
                            </button>

                            <AnimatePresence>
                                {openIndex === index && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: "easeInOut" }}
                                    >
                                        <div className="px-6 pb-6 text-muted leading-relaxed border-t border-white/5 pt-4">
                                            {faq.answer}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
