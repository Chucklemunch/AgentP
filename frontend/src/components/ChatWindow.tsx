import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ExerciseProgram, LibraryExercise, Message } from '../types';
import ProgramCard from './ProgramCard';
import ProgramCardSkeleton from './ProgramCardSkeleton';

interface ChatWindowProps {
  messages: Message[];
  loading: boolean;
  onSend: (message: string) => void;
  savedPrograms: ExerciseProgram[];
  onSaveProgram: (program: ExerciseProgram) => void;
  exercises: LibraryExercise[];
  onCreateExercise: (data: Omit<LibraryExercise, 'id' | 'is_custom'>) => Promise<LibraryExercise>;
}

const SUGGESTED_PROMPTS = [
  'Build me a knee rehabilitation program for post-ACL surgery recovery',
  'Help with lower back exercises',
  'Tips for post-surgery recovery',
  'Shoulder mobility routine',
];

export default function ChatWindow({ messages, loading, onSend, savedPrograms, onSaveProgram, exercises, onCreateExercise }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center gap-5 px-4">
          <div className="flex flex-col items-center gap-3">
            <img
              src="/agentp.png"
              className="w-16 h-16 rounded-full object-cover object-top ring-4 ring-teal-100 shadow-md"
              alt="Perry"
            />
            <div>
              <p className="text-xl font-semibold text-slate-700">Hi, I'm Perry!</p>
              <p className="text-sm text-slate-500 mt-1 max-w-xs leading-relaxed">
                Your AI-powered physical therapy assistant. Tell me what's bothering you and I'll help.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => onSend(prompt)}
                className="text-left text-xs text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl px-3 py-2.5 leading-snug transition-colors cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}
      {messages.map((msg, i) => (
        <div key={i} className={`flex animate-message-in ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          {msg.role === 'perry' && (
            <img
              src="/agentp.png"
              className="w-8 h-8 rounded-full mr-2 mt-1 shrink-0 object-cover object-top"
              alt="Perry"
            />
          )}
          <div className={`max-w-[75%] ${msg.role === 'user' ? '' : 'w-full'}`}>
            <div
              className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-teal-600 text-white rounded-tr-sm shadow-sm'
                  : 'bg-white text-slate-800 rounded-tl-sm border border-slate-100 shadow-sm'
              }`}
            >
              {msg.role === 'user' ? (
                msg.content
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                    ul: ({ children }) => <ul className="list-disc list-outside pl-4 mb-2 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-outside pl-4 mb-2 space-y-1">{children}</ol>,
                    li: ({ children }) => <li>{children}</li>,
                    h1: ({ children }) => <h1 className="text-base font-bold mb-1">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-sm font-bold mb-1">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
                    code: ({ children }) => <code className="bg-slate-100 rounded px-1 py-0.5 text-xs font-mono">{children}</code>,
                    pre: ({ children }) => <pre className="bg-slate-100 rounded p-2 text-xs font-mono overflow-x-auto mb-2">{children}</pre>,
                    blockquote: ({ children }) => <blockquote className="border-l-2 border-teal-300 pl-3 italic text-slate-600 mb-2">{children}</blockquote>,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              )}
            </div>
            {msg.programLoading && <ProgramCardSkeleton />}
            {msg.program && (
              <ProgramCard
                program={msg.program}
                onSave={onSaveProgram}
                isSaved={savedPrograms.some((p) => p.id === msg.program!.id)}
                exercises={exercises}
                onCreateExercise={onCreateExercise}
              />
            )}
          </div>
        </div>
      ))}
      {loading && (
        <div className="flex justify-start items-center gap-2 animate-message-in">
          <img src="/agentp.png" className="w-8 h-8 rounded-full shrink-0 object-cover object-top" alt="Perry" />
          <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
            <div className="flex gap-1 items-center h-4">
              <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
