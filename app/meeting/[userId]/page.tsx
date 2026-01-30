'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  QrCode, Clock, User, Building, Target, MessageCircle,
  ArrowLeft, RefreshCw, Loader2, CheckCircle, Scan, Play, Lightbulb, Sparkles
} from 'lucide-react';

interface Match {
  id: string;
  round_number: number;
  table_number: number;
  icebreaker_question: string;
  status: string;
  myHandshake: boolean;
  partnerHandshake: boolean;
  started_at: string | null;
  partner: {
    id: string;
    full_name: string;
    company: string;
    position: string;
    current_intent: string;
  };
  event: {
    id: string;
    name: string;
    round_duration_sec: number;
  };
}

export default function MeetingPage({ params }: { params: { userId: string } }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();
  const userId = params.userId;

  const fetchMatches = useCallback(async () => {
    try {
      const res = await fetch(`/api/matches/user/${userId}`);
      const data = await res.json();
      if (data.matches) {
        setMatches(data.matches);
        // Find current active or pending match
        const activeMatch = data.matches.find((m: Match) => 
          m.status === 'active' || m.status === 'pending'
        );
        if (activeMatch) {
          setCurrentMatch(activeMatch);
        }
      }
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchMatches();
    const interval = setInterval(fetchMatches, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [fetchMatches]);

  // Timer effect
  useEffect(() => {
    if (currentMatch?.status === 'active' && currentMatch.started_at) {
      const startTime = new Date(currentMatch.started_at).getTime();
      const duration = currentMatch.event?.round_duration_sec || 360;
      
      const updateTimer = () => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        const remaining = Math.max(0, duration - elapsed);
        setTimeLeft(remaining);
        setTimerActive(remaining > 0);
        
        if (remaining <= 0) {
          // Timer ended
          completeMatch();
        }
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [currentMatch]);

  const handleHandshake = async () => {
    if (!currentMatch) return;

    try {
      const res = await fetch(`/api/matches/${currentMatch.id}/handshake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: data.bothReady ? "Görüşme Başladı! 🎉" : "Handshake Kaydedildi ✅",
          description: data.bothReady 
            ? "Her iki taraf da hazır, zamanlaycı başladı!" 
            : "Karşı tarafın QR taratması bekleniyor..."
        });
        fetchMatches();
      }
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const completeMatch = async () => {
    if (!currentMatch) return;
    
    try {
      await fetch(`/api/matches/${currentMatch.id}/complete`, {
        method: 'POST'
      });
      fetchMatches();
    } catch (error) {
      console.error('Error completing match:', error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startQRScanner = async () => {
    setScanning(true);
    // Simulate QR scan - in production use html5-qrcode
    setTimeout(() => {
      setScanning(false);
      handleHandshake();
    }, 1500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Timer View - Active Match
  if (currentMatch?.status === 'active' && timerActive) {
    const halfTime = (currentMatch.event?.round_duration_sec || 360) / 2;
    const isFirstHalf = timeLeft > halfTime;
    const progress = ((currentMatch.event?.round_duration_sec || 360) - timeLeft) / (currentMatch.event?.round_duration_sec || 360) * 100;

    return (
      <div className={`min-h-screen flex flex-col ${
        timeLeft <= 10 ? 'bg-red-500' : isFirstHalf ? 'bg-blue-500' : 'bg-purple-500'
      } transition-colors duration-500`}>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-white">
          {/* Timer */}
          <div className="text-8xl font-bold mb-4 timer-pulse">
            {formatTime(timeLeft)}
          </div>
          
          {/* Progress Bar */}
          <div className="w-full max-w-md h-2 bg-white/30 rounded-full mb-8">
            <div 
              className="h-full bg-white rounded-full transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Current Speaker Indicator */}
          <div className="text-2xl font-medium mb-2">
            {isFirstHalf ? "Sizin Sıranız" : `${currentMatch.partner.full_name}'in Sırası`}
          </div>
          <div className="text-white/80 mb-8">
            {isFirstHalf ? "Kendinizi tanıtın" : "Dinleme zamanı"}
          </div>

          {/* Icebreaker Question */}
          {currentMatch.icebreaker_question && (
            <Card className="w-full max-w-md bg-white/10 border-white/20">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <MessageCircle className="w-5 h-5 mt-1 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium mb-1">Buz Kırıcı Soru:</div>
                    <div className="text-lg">{currentMatch.icebreaker_question}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Partner Info */}
          <div className="mt-8 text-center">
            <div className="text-white/60 text-sm">Görüşme:</div>
            <div className="text-xl font-medium">{currentMatch.partner.full_name}</div>
            <div className="text-white/80">
              {currentMatch.partner.company} • {currentMatch.partner.position}
            </div>
          </div>
        </div>

        {/* Table Number */}
        <div className="p-4 text-center text-white/60">
          Masa {currentMatch.table_number} • Tur {currentMatch.round_number}
        </div>
      </div>
    );
  }

  // Timer Ended View
  if (timeLeft === 0 && currentMatch?.status === 'active') {
    return (
      <div className="min-h-screen bg-red-600 flex flex-col items-center justify-center p-6 text-white">
        <Clock className="w-24 h-24 mb-4" />
        <h1 className="text-4xl font-bold mb-2">Süre Doldu!</h1>
        <p className="text-xl mb-8">Görüşmeniz tamamlandı</p>
        <Button 
          size="lg" 
          variant="secondary"
          onClick={() => {
            completeMatch();
            fetchMatches();
          }}
        >
          Sonraki Eşleşmeye Geç
        </Button>
      </div>
    );
  }

  // Pending Match - QR Handshake View
  if (currentMatch?.status === 'pending') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <Badge className="mb-4">
                Tur {currentMatch.round_number} • Masa {currentMatch.table_number}
              </Badge>
              <h1 className="text-2xl font-bold text-gray-900">Eşleşmeniz Hazır!</h1>
              <p className="text-gray-600">Masa {currentMatch.table_number}'e gidin</p>
            </div>

            {/* Partner Card */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  {currentMatch.partner.full_name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-gray-600">
                  <Building className="w-4 h-4" />
                  {currentMatch.partner.company || 'Belirtilmemiş'} • {currentMatch.partner.position || 'Belirtilmemiş'}
                </div>
                <div className="flex items-start gap-2 text-blue-600">
                  <Target className="w-4 h-4 mt-1 flex-shrink-0" />
                  <span>"{currentMatch.partner.current_intent}"</span>
                </div>
              </CardContent>
            </Card>

            {/* Icebreaker Question */}
            {currentMatch.icebreaker_question && (
              <Card className="mb-6 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <Lightbulb className="w-6 h-6 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-semibold text-amber-700">Buz Kırıcı Soru</span>
                      </div>
                      <p className="text-lg font-medium text-gray-800">
                        {currentMatch.icebreaker_question}
                      </p>
                      <p className="text-xs text-amber-600 mt-2">
                        💡 Bu soru yapay zeka tarafından sizin için özel olarak oluşturuldu
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* QR Handshake */}
            <Card className="mb-6 border-2 border-blue-200">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-lg font-medium mb-4">QR Handshake</div>
                  
                  {/* Status Indicators */}
                  <div className="flex justify-center gap-8 mb-6">
                    <div className="text-center">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                        currentMatch.myHandshake ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        {currentMatch.myHandshake ? (
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        ) : (
                          <QrCode className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div className="text-sm text-gray-600">Siz</div>
                    </div>
                    <div className="text-center">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                        currentMatch.partnerHandshake ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        {currentMatch.partnerHandshake ? (
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        ) : (
                          <QrCode className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div className="text-sm text-gray-600">{currentMatch.partner.full_name.split(' ')[0]}</div>
                    </div>
                  </div>

                  {!currentMatch.myHandshake ? (
                    <Button 
                      size="lg" 
                      className="w-full"
                      onClick={startQRScanner}
                      disabled={scanning}
                    >
                      {scanning ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Taranıyor...
                        </>
                      ) : (
                        <>
                          <Scan className="w-4 h-4 mr-2" />
                          QR Kod Tarat
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="text-center">
                      <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                      <p className="text-gray-600">
                        {currentMatch.partnerHandshake 
                          ? "Her iki taraf hazır! Görüşme başlıyor..." 
                          : "Karşı tarafın taraması bekleniyor..."}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Manual Start (for demo) */}
            {currentMatch.myHandshake && currentMatch.partnerHandshake && (
              <Button 
                className="w-full" 
                size="lg"
                onClick={fetchMatches}
              >
                <Play className="w-4 h-4 mr-2" />
                Görüşmeyi Başlat
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // No Active Match - List View
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Eşleşmelerim</h1>
              <p className="text-gray-500">Tüm görüşme eşleşmeleriniz</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => window.location.href = '/'}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Geri
              </Button>
              <Button onClick={fetchMatches}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Yenile
              </Button>
            </div>
          </div>

          {/* Matches List */}
          {matches.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Henüz eşleşme yok
                </h3>
                <p className="text-gray-500">
                  Organizatör eşleştirmeleri başlattığında burada görünecek
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {matches.map((match) => (
                <Card 
                  key={match.id}
                  className={`${
                    match.status === 'pending' ? 'border-blue-200 bg-blue-50' :
                    match.status === 'active' ? 'border-green-200 bg-green-50' :
                    ''
                  }`}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">Tur {match.round_number}</Badge>
                          <Badge variant="secondary">Masa {match.table_number}</Badge>
                          {match.status === 'pending' && <Badge className="bg-blue-500">Bekliyor</Badge>}
                          {match.status === 'active' && <Badge className="bg-green-500">Aktif</Badge>}
                          {match.status === 'completed' && <Badge variant="outline">Tamamlandı</Badge>}
                        </div>
                        <div className="font-medium text-lg">{match.partner.full_name}</div>
                        <div className="text-gray-500">
                          {match.partner.company} • {match.partner.position}
                        </div>
                        {match.icebreaker_question && (
                          <div className="mt-2 text-sm text-blue-600">
                            💬 {match.icebreaker_question}
                          </div>
                        )}
                      </div>
                      {match.status === 'pending' && (
                        <Button onClick={() => setCurrentMatch(match)}>
                          Başlat
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
