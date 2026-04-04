import { useState } from 'react';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';
import type { Message, ChatResponse } from './types';

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

      const data: ChatResponse = await res.json();
      setHistory(data.history);
      setMessages((prev) => [...prev, { role: 'perry', content: data.response }]);
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
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3 shrink-0">
        <img src="/agentp.png" className="w-9 h-9 rounded-full object-cover object-top" alt="Perry" />
        <div>
          <h1 className="text-base font-semibold text-gray-800 leading-tight">Perry</h1>
          <p className="text-xs text-gray-400">Physical Therapy Assistant</p>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-hidden max-w-3xl w-full mx-auto flex flex-col">
        <ChatWindow messages={messages} loading={loading} />
      </main>

      {/* Input */}
      <div className="max-w-3xl w-full mx-auto w-full">
        <ChatInput onSend={handleSend} disabled={loading} />
      </div>
    </div>
  );
}
