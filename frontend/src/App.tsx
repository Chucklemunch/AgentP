import { useState } from 'react';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';
import type { Message } from './types';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSend = async (userMessage: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/chat`, {
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
          } else if (event.type === 'done') {
            setHistory(event.history);
          }
        }
      }
    } catch (err) {
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
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-xs text-teal-100 font-medium">Online</span>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-hidden max-w-3xl w-full mx-auto flex flex-col">
        <ChatWindow messages={messages} loading={loading} onSend={handleSend} />
      </main>

      {/* Input */}
      <div className="max-w-3xl w-full mx-auto">
        <ChatInput onSend={handleSend} disabled={loading} />
      </div>
    </div>
  );
}
