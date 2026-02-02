'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function StartMatchPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const [status, setStatus] = useState<'starting' | 'success' | 'error'>('starting');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!matchId) return;

    const startMatch = async () => {
      try {
        const res = await fetch(`/api/matches/${matchId}/start`, { method: 'POST' });
        const data = await res.json();

        if (res.ok || data.success) {
          setStatus('success');
          // localStorage'dan email al, kendi meeting sayfasına yönlendir
          const email = localStorage.getItem('teknopark_user_email');
          setTimeout(() => {
            if (email) {
              window.location.href = `/meeting/${email}`;
            } else {
              window.location.href = '/';
            }
          }, 2000);
        } else {
          setStatus('error');
          setErrorMsg(data.error || 'Başlatılamadı');
        }
      } catch (err) {
        setStatus('error');
        setErrorMsg('Bağlantı hatası');
      }
    };

    startMatch();
  }, [matchId]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: "'Segoe UI', system-ui, sans-serif"
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '400px',
        width: '100%'
      }}>
        {status === 'starting' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '20px', animation: 'pulse 1s ease-in-out infinite' }}>⏱️</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: 'white', marginBottom: '8px' }}>
              Görüşme başlatılıyor...
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>✅</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#22c55e', marginBottom: '8px' }}>
              Görüşme başlatıldı!
            </div>
            <div style={{ color: '#94a3b8', fontSize: '14px' }}>
              Sayfanıza yönlendiriliyorsunuz...
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#ef4444', marginBottom: '8px' }}>
              {errorMsg}
            </div>
            <a href="/" style={{
              display: 'inline-block', marginTop: '20px',
              padding: '12px 24px', background: '#22d3ee',
              borderRadius: '10px', color: '#0f172a',
              textDecoration: 'none', fontWeight: '600'
            }}>
              Ana Sayfaya Dön
            </a>
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}
