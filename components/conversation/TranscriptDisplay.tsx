'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/ui/cn';

export interface Message {
    id: string;
    speaker: 'agent' | 'user';
    text: string;
    timestamp: Date;
    audioTimestamp?: number;
}

interface TranscriptDisplayProps {
  messages: Message[];
}

export function TranscriptDisplay({ messages }: TranscriptDisplayProps) {
  const bottomRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <ol
      className="bg-neutral-50 p-8 space-y-4 max-w-4xl mx-auto list-none"
      aria-label="Conversation transcript"
      aria-live="polite"
      aria-relevant="additions"
    >
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <li ref={bottomRef} className="h-px w-px opacity-0" aria-hidden="true" />
    </ol>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isAgent = message.speaker === 'agent';

  return (
    <li className={cn(
      "flex items-start gap-3",
      !isAgent && "flex-row-reverse"
    )}>
      {/* Avatar */}
      <div
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0",
          isAgent ? "bg-neutral-200" : "bg-primary-500"
        )}
        role="img"
        aria-label={isAgent ? "Agent avatar" : "User avatar"}
      >
        {isAgent ? "🎙️" : "👤"}
      </div>

      {/* Message bubble */}
      <div className={cn(
        "max-w-[75%] px-4 py-3 rounded-lg",
        isAgent
          ? "bg-white border border-neutral-300 rounded-bl-none"
          : "bg-primary-500 text-white rounded-br-none"
      )}>
        <p className="text-base leading-relaxed">{message.text}</p>
      </div>
    </li>
  );
}
