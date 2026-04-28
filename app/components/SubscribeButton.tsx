'use client';

import { useState } from 'react';

export function SubscribeButton() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('submitting');
    setErrorMsg('');
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState('error');
        setErrorMsg(json.error ?? 'Er ging iets mis');
        return;
      }
      setState('success');
    } catch {
      setState('error');
      setErrorMsg('Netwerkfout — probeer opnieuw');
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 transition-colors dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
      >
        Subscribe to updates
      </button>
    );
  }

  if (state === 'success') {
    return (
      <div className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
        Check je inbox voor de bevestigingsmail.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        type="email"
        autoFocus
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="jij@email.nl"
        className="px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
      <button
        type="submit"
        disabled={state === 'submitting'}
        className="px-3 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
      >
        {state === 'submitting' ? '…' : 'Subscribe'}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
      >
        Annuleer
      </button>
      {state === 'error' && (
        <span className="text-xs text-red-600 dark:text-red-400 ml-2">{errorMsg}</span>
      )}
    </form>
  );
}
