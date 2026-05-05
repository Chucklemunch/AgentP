import { useState } from 'react';

interface AuthScreenProps {
  onAuth: (token: string, username: string) => void;
}

const API = import.meta.env.VITE_API_URL;

export default function AuthScreen({ onAuth }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'register' && !username.trim()) {
      setError('Username is required');
      return;
    }
    setLoading(true);
    try {
      const body = mode === 'register'
        ? { email, username, password }
        : { email, password };
      const res = await fetch(`${API}/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? 'Something went wrong');
        return;
      }
      onAuth(data.access_token, data.username);
    } catch {
      setError('Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode((m) => (m === 'login' ? 'register' : 'login'));
    setError('');
    setUsername('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center gap-3 mb-8">
        <img
          src="/agentp.png"
          className="w-16 h-16 rounded-full object-cover object-top ring-4 ring-teal-100 shadow-md"
          alt="Perry"
        />
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-800">Perry</h1>
          <p className="text-sm text-slate-500">Physical Therapy Assistant</p>
        </div>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">
          {mode === 'login' ? 'Sign in to your account' : 'Create an account'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
            <input
              type="email"
              required
              autoFocus
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Username</label>
              <input
                type="text"
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your display name"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Password</label>
            <input
              type="password"
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:bg-teal-100 disabled:text-teal-400 transition-colors"
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="text-xs text-slate-500 text-center mt-4">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={switchMode}
            className="text-teal-600 font-medium hover:text-teal-700 transition-colors"
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
