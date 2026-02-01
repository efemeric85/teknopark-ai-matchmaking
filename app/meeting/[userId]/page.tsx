'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Users, ArrowLeft, RefreshCw, Building, Briefcase, MessageSquare } from 'lucide-react';

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
  const userId = params.userId as string;
  
  const [user, setUser] = useState<User | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMeetingData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch(`/api/meeting/${userId}`);
      const data = await res.json();
      
      console.log('Meeting API response:', data);
      
      if (data.error) {
        setError(data.error);
        return;
      }
      
      setUser(data.user);
      setMatches(data.matches || []);
    } catch (err: any) {
      console.error('Error fetching meeting data:', err);
      setError('Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchMeetingData();
    }
  }, [userId]);

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
        {/* User Info */}
        {user && (
          <Card className="mb-6 border-cyan-200 bg-cyan-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-cyan-600 flex items-center justify-center text-white font-bold text-lg">
                  {user.full_name?.charAt(0) || '?'}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{user.full_name}</p>
                  <p className="text-sm text-gray-600">{user.company} • {user.position}</p>
                </div>
              </div>
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
            
            {matches.map((match, index) => (
              <Card key={match.id} className="border-2 border-cyan-100 hover:border-cyan-300 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold">
                        {match.partner?.full_name?.charAt(0) || '?'}
                      </div>
                      {match.partner?.full_name || 'Bilinmeyen Kullanıcı'}
                    </CardTitle>
                    <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      Tur {match.round_number}
                    </span>
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
