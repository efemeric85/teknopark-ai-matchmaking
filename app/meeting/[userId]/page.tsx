'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Users, ArrowLeft, RefreshCw, Building, Briefcase, MessageSquare, QrCode, Play, Pause, RotateCcw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface Partner {
  id: string;
  full_name: string;
  company: string;
  position: string;
  current_intent: string;
}

interface Match {
  id: string;
  event_id: string;
  user1_id: string;
  user2_id: string;
  round_number: number;
  status: string;
  partner: Partner;
}

interface User {
  id: string;
  email: string;
  full_name: string;
  company: string;
  position: string;
}

export default function MeetingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const identifier = params.userId as string;
  const shouldStart = searchParams.get('start') === 'true';
  const matchIdFromUrl = searchParams.get('match');
  
  const [user, setUser] = useState<User | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Timer states
  const [timerRunning, setTimerRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(360); // 6 minutes default
  const [totalTime, setTotalTime] = useState(360);
  const [showQR, setShowQR] = useState(false);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [timerStarted, setTimerStarted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchMeetingData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch(`/api/meeting/${encodeURIComponent(identifier)}`);
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
        return;
      }
      
      setUser(data.user);
      setMatches(data.matches || []);
      
      // Auto-start timer if URL has start=true
      if (shouldStart && !timerStarted && data.matches && data.matches.length > 0) {
        const matchToStart = matchIdFromUrl 
          ? data.matches.find((m: Match) => m.id === matchIdFromUrl) 
          : data.matches[0];
        
        if (matchToStart) {
          setActiveMatchId(matchToStart.id);
          setTimeLeft(totalTime);
          setTimerRunning(true);
          setTimerStarted(true);
        }
      }
    } catch (err: any) {
      setError('Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (identifier) {
      fetchMeetingData();
    }
  }, [identifier]);

  // Timer effect
  useEffect(() => {
    if (timerRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setTimerRunning(false);
            // Play sound when timer ends
            if (audioRef.current) {
              audioRef.current.play();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [timerRunning]);

  const startTimer = (matchId: string) => {
    setActiveMatchId(matchId);
    setTimeLeft(totalTime);
    setTimerRunning(true);
    setShowQR(false);
  };

  const pauseTimer = () => {
    setTimerRunning(false);
  };

  const resumeTimer = () => {
    setTimerRunning(true);
  };

  const resetTimer = () => {
    setTimerRunning(false);
    setTimeLeft(totalTime);
    setActiveMatchId(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    const percentage = (timeLeft / totalTime) * 100;
    if (percentage > 50) return 'text-green-600';
    if (percentage > 25) return 'text-yellow-600';
    return 'text-red-600';
  };

  // QR kod partnerin sayfasına yönlendirir ve sayacı başlatır
  const activeMatch = matches.find(m => m.id === activeMatchId) || matches[0];
  const qrValue = activeMatch?.partner 
    ? `https://atyzk.vercel.app/meeting/${activeMatch.partner.id}?start=true&match=${activeMatch.id}`
    : '';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-cyan-600" />
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => window.location.href = '/'}>
            Ana Sayfaya Dön
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Audio for timer end */}
      <audio ref={audioRef} src="/timer-end.mp3" />
      
      {/* Header */}
      <div className="bg-white border-b px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Eşleşmelerim</h1>
            <p className="text-sm text-gray-500">Tüm görüşme eşleşmeleriniz</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Geri
            </Button>
            <Button onClick={fetchMeetingData} className="bg-cyan-600 hover:bg-cyan-700">
              <RefreshCw className="w-4 h-4 mr-2" />
              Yenile
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Active Timer Card */}
        {activeMatchId && (
          <Card className="mb-6 border-2 border-cyan-500 bg-gradient-to-br from-cyan-50 to-blue-50">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">
                  {matches.find(m => m.id === activeMatchId)?.partner?.full_name} ile görüşme
                </p>
                <div className={`text-6xl font-mono font-bold mb-4 ${getTimerColor()}`}>
                  {formatTime(timeLeft)}
                </div>
                <div className="flex justify-center gap-3 mb-4">
                  {!timerRunning && timeLeft > 0 && timeLeft < totalTime && (
                    <Button onClick={resumeTimer} className="bg-green-600 hover:bg-green-700">
                      <Play className="w-4 h-4 mr-2" />
                      Devam
                    </Button>
                  )}
                  {timerRunning && (
                    <Button onClick={pauseTimer} variant="outline">
                      <Pause className="w-4 h-4 mr-2" />
                      Duraklat
                    </Button>
                  )}
                  <Button onClick={resetTimer} variant="outline">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Sıfırla
                  </Button>
                </div>
                {timeLeft === 0 && (
                  <div className="text-red-600 font-semibold text-lg animate-pulse">
                    ⏰ Süre Doldu!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* User Info */}
        {user && (
          <Card className="mb-6 border-cyan-200 bg-cyan-50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-cyan-600 flex items-center justify-center text-white font-bold text-lg">
                    {user.full_name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{user.full_name}</p>
                    <p className="text-sm text-gray-600">{user.company} • {user.position}</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowQR(!showQR)}
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  QR Kodum
                </Button>
              </div>
              
              {/* QR Code Display */}
              {showQR && qrValue && (
                <div className="mt-4 p-4 bg-white rounded-lg text-center">
                  <QRCodeSVG 
                    value={qrValue}
                    size={200}
                    className="mx-auto"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Eşleştiğiniz kişi bu QR'ı okutunca sayaç başlar
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Matches */}
        {matches.length === 0 ? (
          <Card className="border-2 border-dashed border-gray-300">
            <CardContent className="py-12">
              <div className="text-center">
                <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-700 mb-2">Henüz eşleşme yok</h2>
                <p className="text-gray-500">
                  Organizatör eşleştirmeleri başlattığında burada görünecek
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-600" />
              Görüşme Eşleşmeleriniz ({matches.length})
            </h2>
            
            {matches.map((match) => (
              <Card 
                key={match.id} 
                className={`border-2 transition-colors ${
                  activeMatchId === match.id 
                    ? 'border-cyan-500 bg-cyan-50' 
                    : 'border-cyan-100 hover:border-cyan-300'
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold">
                        {match.partner?.full_name?.charAt(0) || '?'}
                      </div>
                      {match.partner?.full_name || 'Bilinmeyen Kullanıcı'}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        Tur {match.round_number}
                      </span>
                      {activeMatchId !== match.id && (
                        <Button 
                          size="sm" 
                          onClick={() => startTimer(match.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Başlat
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {match.partner && (
                    <div className="space-y-2 text-sm">
                      {match.partner.company && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Building className="w-4 h-4" />
                          <span>{match.partner.company}</span>
                        </div>
                      )}
                      {match.partner.position && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Briefcase className="w-4 h-4" />
                          <span>{match.partner.position}</span>
                        </div>
                      )}
                      {match.partner.current_intent && (
                        <div className="flex items-start gap-2 text-gray-600 mt-3 p-3 bg-gray-50 rounded-lg">
                          <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span className="italic">"{match.partner.current_intent}"</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
