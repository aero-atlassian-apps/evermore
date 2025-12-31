'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TopicInputProps {
    topics: string[];
    onAdd: (topic: string) => void;
    onRemove: (topic: string) => void;
}

export function TopicInput({ topics, onAdd, onRemove }: TopicInputProps) {
    const [input, setInput] = useState('');

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleAdd();
        }
    };

    const handleAdd = () => {
        if (input.trim()) {
            onAdd(input.trim());
            setInput('');
        }
    };

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold font-serif text-[#3D3430]">Topics I Love</h2>

            <div className="flex flex-wrap gap-2 min-h-[40px]">
                <AnimatePresence>
                    {topics.map((topic) => (
                        <motion.span
                            key={topic}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#EAE0D5] text-[#5C4D44] font-medium border border-[#D6C5B3] shadow-sm"
                        >
                            {topic}
                            <button onClick={() => onRemove(topic)} className="hover:text-[#3D3430] transition-colors flex items-center justify-center">
                                <span className="material-symbols-outlined text-[16px] font-bold">close</span>
                            </button>
                        </motion.span>
                    ))}
                </AnimatePresence>
            </div>

            <div className="relative group">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Add a new topic..."
                    className="w-full px-5 py-4 bg-white border border-[#E07A5F]/20 rounded-2xl text-[#3D3430] placeholder:text-[#756A63]/40 focus:outline-none focus:border-[#E07A5F] focus:ring-4 focus:ring-[#E07A5F]/5 shadow-sm transition-all"
                />
                <button
                    onClick={handleAdd}
                    disabled={!input.trim()}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#F2CC8F] text-[#3D3430] rounded-xl flex items-center justify-center hover:bg-[#E0A885] disabled:opacity-0 disabled:pointer-events-none transition-all shadow-sm"
                >
                    <span className="material-symbols-outlined font-bold">add</span>
                </button>
            </div>
        </div>
    );
}
