'use client';

import { useState } from 'react';
import { TreePine, Mail, Lock, ArrowRight, Star } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Simulate auth call
    await new Promise(r => setTimeout(r, 1200));
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(170deg, #f0fdf4 0%, #dcfce7 40%, #f8fafc 100%)' }}>
      {/* Decorative top graphic */}
      <div className="hero-gradient relative overflow-hidden flex items-center justify-center" style={{ minHeight: 280 }}>
        <div className="absolute top-0 right-0 w-56 h-56 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/3" />

        {/* Snowflakes */}
        {[...Array(6)].map((_, i) => (
          <Star
            key={i}
            size={8 + (i % 3) * 4}
            className="absolute text-white/20 sway"
            style={{ top: `${15 + (i * 13) % 70}%`, left: `${8 + (i * 17) % 80}%`, animationDelay: `${i * 0.7}s` }}
          />
        ))}

        <div className="text-center px-6 z-10">
          <div className="flex justify-center mb-4">
            <span className="flex items-center justify-center w-20 h-20 rounded-3xl bg-white/15 backdrop-blur-sm">
              <TreePine size={40} className="text-white" />
            </span>
          </div>
          <h1 className="text-white text-3xl font-bold">Church Carol<br/>Tracking</h1>
          <p className="text-green-200 text-sm mt-2 font-medium">Spread the joy. Share the love.</p>
        </div>
      </div>

      {/* Form card */}
      <div className="flex-1 px-5 -mt-6 relative z-10">
        <div className="carol-card p-6 mt-0">
          {sent ? (
            <div className="text-center py-6">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-50 mx-auto mb-4">
                <TreePine size={32} className="text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">You&apos;re In! 🎄</h2>
              <p className="text-slate-500 text-sm mt-2">Welcome to Let&apos;s Carol. Redirecting you now...</p>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-bold text-slate-800 mb-1">Welcome back</h2>
              <p className="text-slate-400 text-sm mb-6">Sign in to your carol team account</p>

              <form onSubmit={handleSubmit} className="space-y-4" id="login-form">
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Username / Email
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="email"
                      type="email"
                      className="carol-input pl-10"
                      placeholder="Enter admin username"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="password"
                      type="password"
                      className="carol-input pl-10"
                      placeholder="Enter password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                <button
                  id="login-submit"
                  type="submit"
                  className="btn-primary mt-2"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                      Signing in…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Login <ArrowRight size={16} />
                    </span>
                  )}
                </button>
              </form>

              <p className="text-center text-xs text-slate-400 mt-5">
                By signing in you agree to our{' '}
                <a href="#" className="text-green-700 font-medium">Terms of Service</a>
              </p>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6 pb-8">
          🎄 Stay connected. Spread the joy.
        </p>
      </div>
    </div>
  );
}
