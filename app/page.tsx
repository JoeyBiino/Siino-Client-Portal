'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { login, getToken } from '@/lib/api';

export default function LoginPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<'en' | 'fr'>('en');
  const router = useRouter();

  useEffect(() => {
    if (getToken()) {
      router.push('/dashboard');
    }
    const savedLang = localStorage.getItem('portal_language') as 'en' | 'fr';
    if (savedLang) setLang(savedLang);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(code.toUpperCase().trim());
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || (lang === 'fr' ? 'Code portail invalide' : 'Invalid portal code'));
    } finally {
      setLoading(false);
    }
  };

  const handleLangChange = (newLang: 'en' | 'fr') => {
    setLang(newLang);
    localStorage.setItem('portal_language', newLang);
  };

  return (
    <div className="min-h-screen bg-[#0d0d10] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Language Toggle */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center space-x-1 bg-[#1a1a1e] rounded-lg p-1">
            <button
              onClick={() => handleLangChange('en')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                lang === 'en' ? 'bg-[#9B7EBF] text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => handleLangChange('fr')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                lang === 'fr' ? 'bg-[#9B7EBF] text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              FR
            </button>
          </div>
        </div>

        <div className="bg-[#1a1a1e] rounded-2xl border border-[#2a2a32] p-8">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#9B7EBF] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Client Portal</h1>
            <p className="text-gray-400 mt-2">
              {lang === 'fr' ? 'Entrez votre code portail pour continuer' : 'Enter your portal code to continue'}
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="code" className="block text-sm font-medium text-gray-300 mb-2">
                {lang === 'fr' ? 'Code Portail' : 'Portal Code'}
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC12345"
                className="w-full px-4 py-3 rounded-lg border border-[#2a2a32] bg-[#0d0d10] text-white text-center text-2xl tracking-widest font-mono focus:ring-2 focus:ring-[#9B7EBF] focus:border-transparent outline-none transition placeholder-gray-600"
                maxLength={8}
                autoComplete="off"
                autoFocus
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || code.length < 8}
              className="w-full py-3 px-4 bg-[#9B7EBF] hover:bg-[#8a6dae] disabled:bg-[#9B7EBF]/50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition duration-200 flex items-center justify-center"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {lang === 'fr' ? 'Connexion...' : 'Signing in...'}
                </>
              ) : (
                lang === 'fr' ? 'Se connecter' : 'Sign In'
              )}
            </button>
          </form>

          {/* Help text */}
          <p className="mt-6 text-center text-sm text-gray-500">
            {lang === 'fr' 
              ? 'Votre code portail vous a été fourni par votre gestionnaire de projet.' 
              : 'Your portal code was provided by your project manager.'}
            <br />
            {lang === 'fr' 
              ? 'Contactez-le si vous avez besoin d\'aide.' 
              : 'Contact them if you need assistance.'}
          </p>
        </div>
      </div>
    </div>
  );
}
