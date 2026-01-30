'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, XCircle, Handshake } from 'lucide-react';

export default function HandshakePage({ 
  params 
}: { 
  params: { matchId: string; oderId: string } 
}) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already'>('loading');
  const [message, setMessage] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const router = useRouter();
  const { matchId, oderId } = params;

  useEffect(() => {
    const confirmHandshake = async () => {
      console.log('Handshake page loaded:', { matchId, oderId });
      setDebugInfo(`Match: ${matchId?.slice(0,8)}... User: ${oderId?.slice(0,8)}...`);
      
      if (!matchId || !oderId) {
        setStatus('error');
        setMessage('Geçersiz QR kodu - parametreler eksik');
        return;
      }

      try {
        const apiUrl = `/api/matches/${matchId}/handshake`;
        console.log('Calling API:', apiUrl, 'with user_id:', oderId);
        
        // Call the handshake API with the scanner's user ID (oderId)
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: oderId })
        });

        console.log('API response status:', res.status);
        const data = await res.json();
        console.log('API response data:', data);

        if (data.success) {
          if (data.bothReady) {
            setStatus('success');
            setMessage('Her iki taraf da hazır! Görüşme başlıyor...');
          } else {
            setStatus('success');
            setMessage('Handshake kaydedildi! Karşı tarafın taramasını bekleyin.');
          }
        } else if (data.error?.includes('yetkisiz') || data.error?.includes('bulunamad')) {
          setStatus('error');
          setMessage(data.error || 'Geçersiz QR kodu');
        } else {
          setStatus('error');
          setMessage(data.error || 'Bir hata oluştu');
        }
      } catch (error: any) {
        console.error('Handshake fetch error:', error);
        setStatus('error');
        setMessage('Bağlantı hatası: ' + (error.message || 'Lütfen tekrar deneyin.'));
      }
    };

    confirmHandshake();
  }, [matchId, oderId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8">
          <div className="text-center">
            {status === 'loading' && (
              <>
                <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                  <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Handshake Onaylanıyor...</h1>
                <p className="text-gray-600">Lütfen bekleyin</p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h1 className="text-2xl font-bold text-green-700 mb-2">Başarılı! 🎉</h1>
                <p className="text-gray-600 mb-6">{message}</p>
                <div className="flex items-center justify-center gap-2 text-green-600 mb-4">
                  <Handshake className="w-6 h-6" />
                  <span className="font-medium">Tanışma Onaylandı</span>
                </div>
                <Button 
                  className="w-full"
                  onClick={() => router.push(`/meeting/${oderId}`)}
                >
                  Eşleşmelerime Dön
                </Button>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-10 h-10 text-red-600" />
                </div>
                <h1 className="text-2xl font-bold text-red-700 mb-2">Hata</h1>
                <p className="text-gray-600 mb-4">{message}</p>
                {debugInfo && (
                  <p className="text-xs text-gray-400 mb-4 font-mono bg-gray-100 p-2 rounded">
                    Debug: {debugInfo}
                  </p>
                )}
                <Button 
                  variant="outline"
                  className="w-full"
                  onClick={() => router.back()}
                >
                  Geri Dön
                </Button>
              </>
            )}

            {status === 'already' && (
              <>
                <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-amber-600" />
                </div>
                <h1 className="text-2xl font-bold text-amber-700 mb-2">Zaten Onaylandı</h1>
                <p className="text-gray-600 mb-6">Bu handshake daha önce kaydedilmiş.</p>
                <Button 
                  className="w-full"
                  onClick={() => router.push(`/meeting/${oderId}`)}
                >
                  Eşleşmelerime Dön
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
