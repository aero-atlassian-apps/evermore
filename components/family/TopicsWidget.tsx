'use client';

import React, { useState } from 'react';

interface TopicsWidgetProps {
    topics: string[];
    onAdd: (topic: string) => void;
    onRemove: (topic: string) => void;
    isSaving: boolean;
}

export function TopicsWidget({ topics, onAdd, onRemove, isSaving }: TopicsWidgetProps) {
    const [inputValue, setInputValue] = useState('');

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleAdd();
        }
    };

    const handleAdd = () => {
        if (inputValue.trim()) {
            onAdd(inputValue.trim());
            setInputValue('');
        }
    };

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold font-serif text-[#3D3430] mb-2">Topics to Avoid</h2>

            <div className="flex flex-wrap gap-3 mb-4">
                {topics.map((topic, i) => (
                    <span key={i} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#EAE0D5] text-[#5C4D44] font-medium border border-[#D6C5B3]">
                        {topic}
                        <button onClick={() => onRemove(topic)} className="hover:text-[#3D3430] transition-colors flex items-center">
                            <span className="material-symbols-outlined text-sm font-bold">close</span>
                        </button>
                    </span>
                ))}
            </div>

            <div className="flex gap-2">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Add a topic..."
                    className="flex-1 h-12 bg-white rounded-full border border-[#D6C5B3] px-6 text-[#3D3430] focus:outline-none focus:border-[#E07A5F] focus:ring-2 focus:ring-[#E07A5F]/10 shadow-sm transition-all"
                />
                <button
                    onClick={handleAdd}
                    className="w-12 h-12 rounded-full bg-[#E07A5F] text-white flex items-center justify-center hover:bg-[#C66348] transition-colors shadow-md"
                >
                    <span className="material-symbols-outlined text-xl">add</span>
                </button>
            </div>
        </div>
    );
}
