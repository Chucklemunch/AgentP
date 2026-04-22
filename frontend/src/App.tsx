import { useEffect, useState } from 'react';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';
import ProgramsPanel from './components/ProgramsPanel';
import type { ExerciseProgram, LibraryExercise, Message } from './types';

const API = import.meta.env.VITE_API_URL;

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [savedPrograms, setSavedPrograms] = useState<ExerciseProgram[]>([]);
  const [exercises, setExercises] = useState<LibraryExercise[]>([]);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    fetchPrograms();
    fetchExercises();
  }, []);

  const fetchPrograms = async () => {
    try {
      const res = await fetch(`${API}/programs`);
      if (res.ok) setSavedPrograms(await res.json());
    } catch {
      // silently ignore — programs panel will just show empty
    }
  };

  const fetchExercises = async () => {
    try {
      const res = await fetch(`${API}/exercises`);
      if (res.ok) setExercises(await res.json());
    } catch {
      // silently ignore
    }
  };

  const handleCreateExercise = async (
    data: Omit<LibraryExercise, 'id' | 'is_custom'>
  ): Promise<LibraryExercise> => {
    const res = await fetch(`${API}/exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const created: LibraryExercise = await res.json();
    setExercises((prev) => [...prev, created]);
    return created;
  };

  const handleSaveProgram = async (program: ExerciseProgram) => {
    const alreadySaved = savedPrograms.some((p) => p.id === program.id);
    try {
      if (alreadySaved) {
        await fetch(`${API}/programs/${program.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(program),
        });
      } else {
        await fetch(`${API}/programs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(program),
        });
      }
      await fetchPrograms();
    } catch {
      // ignore
    }
  };

  const handleUpdateProgram = async (id: string, program: ExerciseProgram) => {
    await fetch(`${API}/programs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(program),
    });
    await fetchPrograms();
  };

  const handleDeleteProgram = async (id: string) => {
    await fetch(`${API}/programs/${id}`, { method: 'DELETE' });
    await fetchPrograms();
  };

  const handleSend = async (userMessage: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, history }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamStarted = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const event = JSON.parse(line.slice(6));

          if (event.type === 'text') {
            if (!streamStarted) {
              streamStarted = true;
              setLoading(false);
              setMessages((prev) => [...prev, { role: 'perry', content: event.chunk }]);
            } else {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + event.chunk,
                };
                return updated;
              });
            }
          } else if (event.type === 'program_start') {
            setMessages((prev) => {
              const updated = [...prev];
              for (let i = updated.length - 1; i >= 0; i--) {
                if (updated[i].role === 'perry') {
                  updated[i] = { ...updated[i], programLoading: true };
                  break;
                }
              }
              return updated;
            });
          } else if (event.type === 'exercise_program') {
            setMessages((prev) => {
              const updated = [...prev];
              for (let i = updated.length - 1; i >= 0; i--) {
                if (updated[i].role === 'perry') {
                  updated[i] = { ...updated[i], program: event.program, programLoading: false };
                  break;
                }
              }
              return updated;
            });
          } else if (event.type === 'done') {
            setHistory(event.history);
            setMessages((prev) =>
              prev.map((msg) => (msg.programLoading ? { ...msg, programLoading: false } : msg))
            );
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'perry', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-teal-700 to-teal-600 px-6 py-4 flex items-center gap-3 shrink-0 shadow-md">
        <img
          src="/agentp.png"
          className="w-10 h-10 rounded-full object-cover object-top ring-2 ring-white/40"
          alt="Perry"
        />
        <div className="flex-1">
          <h1 className="text-base font-semibold text-white leading-tight">Perry</h1>
          <p className="text-xs text-teal-100">Physical Therapy Assistant</p>
        </div>
        <button
          onClick={() => setShowPanel(true)}
          className="relative flex items-center gap-1.5 text-xs font-medium text-teal-100 hover:text-white border border-teal-500/60 hover:border-teal-300 rounded-lg px-3 py-1.5 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          My Programs
          {savedPrograms.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-400 text-white text-[10px] font-bold flex items-center justify-center">
              {savedPrograms.length}
            </span>
          )}
        </button>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-xs text-teal-100 font-medium">Online</span>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-hidden max-w-3xl w-full mx-auto flex flex-col">
        <ChatWindow
          messages={messages}
          loading={loading}
          onSend={handleSend}
          savedPrograms={savedPrograms}
          onSaveProgram={handleSaveProgram}
          exercises={exercises}
          onCreateExercise={handleCreateExercise}
        />
      </main>

      {/* Input */}
      <div className="max-w-3xl w-full mx-auto">
        <ChatInput onSend={handleSend} disabled={loading} />
      </div>

      {/* Programs panel */}
      {showPanel && (
        <ProgramsPanel
          programs={savedPrograms}
          onClose={() => setShowPanel(false)}
          onUpdate={handleUpdateProgram}
          onDelete={handleDeleteProgram}
          exercises={exercises}
          onCreateExercise={handleCreateExercise}
        />
      )}
    </div>
  );
}
