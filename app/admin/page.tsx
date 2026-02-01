'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, Play, RefreshCw, Plus, Loader2, CheckCircle, 
  Clock, ArrowLeft, Trash2, Settings, LogOut, Lock, CalendarDays
} from 'lucide-react';

// Admin credentials - in production, use proper auth
const ADMIN_CREDENTIALS = {
  email: 'bahtiyarozturk@gmail.com',
  password: 'admin123'
};

interface Event {
  id: string;
  name: string;
  theme: string;
  status: string;
  round_duration_sec: number;
  event_date?: string;
}

interface User {
  id: string;
  full_name: string;
  company: string;
  position: string;
  current_intent: string;
  checked_in: boolean;
}

export default function AdminPage() {
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // App state
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState(false);
  const { toast } = useToast();

  // New event form
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    name: '',
    theme: '',
    round_duration_sec: 360,
    event_date: ''
  });

  useEffect(() => {
    // Check if already logged in
    const adminToken = localStorage.getItem('admin_logged_in');
    if (adminToken === 'true') {
      setIsLoggedIn(true);
      fetchEvents();
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);

    setTimeout(() => {
      if (loginEmail === ADMIN_CREDENTIALS.email && loginPassword === ADMIN_CREDENTIALS.password) {
        localStorage.setItem('admin_logged_in', 'true');
        setIsLoggedIn(true);
        fetchEvents();
        toast({
          title: "Giriş Başarılı",
          description: "Hoş geldiniz!"
        });
      } else {
        toast({
          title: "Giriş Başarısız",
          description: "Email veya şifre hatalı.",
          variant: "destructive"
        });
      }
      setLoginLoading(false);
    }, 500);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_logged_in');
    setIsLoggedIn(false);
    setLoginEmail('');
    setLoginPassword('');
    setSelectedEvent(null);
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/events');
      const data = await res.json();
      if (data.events) {
        setEvents(data.events);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipants = async (eventId: string) => {
    try {
      const res = await fetch(`/api/events/${eventId}`);
      const data = await res.json();
      if (data.event) {
        setSelectedEvent(data.event);
        setParticipants(data.event.participants || []);
      }
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  };

  const createEvent = async () => {
    // Tarih zorunlu kontrolü
    if (!newEvent.event_date) {
      toast({
        title: "Hata",
        description: "Etkinlik tarihi zorunludur.",
        variant: "destructive"
      });
      return;
    }

    if (!newEvent.name) {
      toast({
        title: "Hata",
        description: "Etkinlik adı zorunludur.",
        variant: "destructive"
      });
      return;
    }

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newEvent,
          status: 'active'  // Otomatik aktif olsun
        })
      });
      const data = await res.json();
      if (data.event) {
        setEvents([...events, data.event]);
        setShowNewEvent(false);
        setNewEvent({ name: '', theme: '', round_duration_sec: 360, event_date: '' });
        toast({
          title: "Etkinlik Oluşturuldu",
          description: `${data.event.name} etkinliği başarıyla oluşturuldu.`
        });
      }
    } catch (error) {
      toast({
        title: "Hata",
        description: "Etkinlik oluşturulamadı.",
        variant: "destructive"
      });
    }
  };

  const startMatching = async () => {
    if (!selectedEvent) return;
    setMatching(true);
    try {
      const res = await fetch(`/api/events/${selectedEvent.id}/match`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Eşleştirme Tamamlandı! 🎉",
          description: `${data.matchCount} eşleştirme oluşturuldu.`
        });
        fetchParticipants(selectedEvent.id);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message || "Eşleştirme başlatılamadı.",
        variant: "destructive"
      });
    } finally {
      setMatching(false);
    }
  };

  const activateEvent = async () => {
    if (!selectedEvent) return;
    try {
      const res = await fetch(`/api/events/${selectedEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' })
      });
      const data = await res.json();
      if (data.event) {
        setSelectedEvent(data.event);
        fetchEvents();
        toast({
          title: "Etkinlik Aktifleştirildi",
          description: "Katılımcılar artık kaydolabilir."
        });
      }
    } catch (error) {
      toast({
        title: "Hata",
        description: "Etkinlik aktifleştirilemedi.",
        variant: "destructive"
      });
    }
  };

  const activateEventById = async (eventId: string) => {
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' })
      });
      const data = await res.json();
      if (data.event) {
        fetchEvents();
        toast({
          title: "Etkinlik Aktifleştirildi",
          description: "Katılımcılar artık kaydolabilir."
        });
      }
    } catch (error) {
      toast({
        title: "Hata",
        description: "Etkinlik aktifleştirilemedi.",
        variant: "destructive"
      });
    }
  };

  const deleteEvent = async (eventId: string) => {
    if (!confirm('Bu etkinliği silmek istediğinize emin misiniz?')) return;
    
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        fetchEvents();
        toast({
          title: "Etkinlik Silindi",
          description: "Etkinlik başarıyla silindi."
        });
      }
    } catch (error) {
      toast({
        title: "Hata",
        description: "Etkinlik silinemedi.",
        variant: "destructive"
      });
    }
  };

  // Login Screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-cyan-600" />
            </div>
            <CardTitle>Organizatör Girişi</CardTitle>
            <CardDescription>
              Yönetim paneline erişmek için giriş yapın
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@teknopark.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Şifre</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-cyan-600 hover:bg-cyan-700"
                disabled={loginLoading}
              >
                {loginLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Giriş Yapılıyor...
                  </>
                ) : (
                  'Giriş Yap'
                )}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <Button variant="link" onClick={() => window.location.href = '/'}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Ana Sayfaya Dön
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Event Detail View
  if (selectedEvent) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <Button variant="outline" onClick={() => setSelectedEvent(null)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Geri
              </Button>
              <Button variant="outline" onClick={() => fetchParticipants(selectedEvent.id)}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Yenile
              </Button>
            </div>

            {/* Event Info */}
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedEvent.name}</CardTitle>
                    <CardDescription>Tema: {selectedEvent.theme || 'Belirtilmemiş'}</CardDescription>
                    {selectedEvent.event_date && (
                      <div className="text-sm text-cyan-600 flex items-center gap-1 mt-2">
                        <CalendarDays className="w-4 h-4" />
                        {new Date(selectedEvent.event_date).toLocaleDateString('tr-TR', { 
                          day: 'numeric', 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </div>
                    )}
                  </div>
                  <Badge className={
                    selectedEvent.status === 'active' ? 'bg-green-500' :
                    selectedEvent.status === 'completed' ? 'bg-gray-500' : 'bg-yellow-500'
                  }>
                    {selectedEvent.status === 'active' ? 'Aktif' :
                     selectedEvent.status === 'completed' ? 'Tamamlandı' : 'Taslak'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <Users className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                    <div className="text-2xl font-bold">{participants.length}</div>
                    <div className="text-sm text-gray-500">Katılımcı</div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
                    <div className="text-2xl font-bold">
                      {participants.filter(p => p.checked_in).length}
                    </div>
                    <div className="text-sm text-gray-500">Check-in</div>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <Clock className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                    <div className="text-2xl font-bold">{Math.floor(selectedEvent.round_duration_sec / 60)} dk</div>
                    <div className="text-sm text-gray-500">Tur Süresi</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Eşleştirme Yönetimi</CardTitle>
                <CardDescription>
                  Katılımcıları AI destekli algoritma ile eşleştirin
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  {selectedEvent.status === 'draft' && (
                    <Button onClick={activateEvent} variant="outline">
                      <Play className="w-4 h-4 mr-2" />
                      Etkinliği Aktifleştir
                    </Button>
                  )}
                  <Button 
                    onClick={startMatching}
                    disabled={matching || participants.length < 2}
                    className="bg-cyan-600 hover:bg-cyan-700"
                  >
                    {matching ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Eşleştiriliyor...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Eşleştirmeleri Başlat
                      </>
                    )}
                  </Button>
                  <Button variant="outline">
                    Yeni Tur Başlat
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Participants List */}
            <Card>
              <CardHeader>
                <CardTitle>Katılımcılar</CardTitle>
              </CardHeader>
              <CardContent>
                {participants.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Henüz katılımcı yok
                  </div>
                ) : (
                  <div className="space-y-3">
                    {participants.map((user) => (
                      <div 
                        key={user.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <div className="font-medium">{user.full_name}</div>
                          <div className="text-sm text-gray-500">
                            {user.company} • {user.position}
                          </div>
                          <div className="text-sm text-cyan-600 mt-1">
                            "{user.current_intent}"
                          </div>
                        </div>
                        <Badge variant={user.checked_in ? "default" : "outline"}>
                          {user.checked_in ? '✓ Kayıtlı' : 'Bekliyor'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Events List View
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Organizatör Paneli</h1>
              <p className="text-gray-500">Etkinlik ve eşleştirme yönetimi</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => window.location.href = '/'}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Ana Sayfa
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Çıkış
              </Button>
            </div>
          </div>

          {/* New Event Form */}
          {showNewEvent && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Yeni Etkinlik Oluştur</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Etkinlik Adı *</Label>
                      <Input
                        placeholder="Yapay Zeka Zirvesi 2026"
                        value={newEvent.name}
                        onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>Tema</Label>
                      <Input
                        placeholder="Yapay Zeka"
                        value={newEvent.theme}
                        onChange={(e) => setNewEvent({ ...newEvent, theme: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Tur Süresi (saniye)</Label>
                      <Input
                        type="number"
                        value={newEvent.round_duration_sec}
                        onChange={(e) => setNewEvent({ ...newEvent, round_duration_sec: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Etkinlik Tarihi *</Label>
                      <Input
                        type="date"
                        value={newEvent.event_date}
                        onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={createEvent} 
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      disabled={!newEvent.name || !newEvent.event_date}
                    >
                      Oluştur
                    </Button>
                    <Button variant="outline" onClick={() => setShowNewEvent(false)}>
                      İptal
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-4 mb-6">
            <Button onClick={() => setShowNewEvent(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Yeni Etkinlik
            </Button>
            <Button variant="outline" onClick={fetchEvents}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Yenile
            </Button>
          </div>

          {/* Events List */}
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-cyan-500" />
            </div>
          ) : events.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Settings className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Henüz etkinlik yok
                </h3>
                <p className="text-gray-500 mb-4">
                  İlk etkinliğinizi oluşturarak başlayın
                </p>
                <Button onClick={() => setShowNewEvent(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Etkinlik Oluştur
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {events.map((event) => (
                <Card 
                  key={event.id} 
                  className="hover:border-cyan-300 transition-colors"
                >
                  <CardContent className="py-6">
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => fetchParticipants(event.id)}
                      >
                        <div className="font-medium text-lg">{event.name}</div>
                        <div className="text-sm text-gray-500">
                          Tema: {event.theme || 'Belirtilmemiş'} • Tur: {Math.floor(event.round_duration_sec / 60)} dk
                        </div>
                        {event.event_date && (
                          <div className="text-sm text-cyan-600 flex items-center gap-1 mt-1">
                            <CalendarDays className="w-3 h-3" />
                            {new Date(event.event_date).toLocaleDateString('tr-TR', { 
                              day: 'numeric', 
                              month: 'long', 
                              year: 'numeric' 
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {event.status === 'draft' && (
                          <Button 
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              activateEventById(event.id);
                            }}
                          >
                            Aktifleştir
                          </Button>
                        )}
                        <Button 
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-300 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteEvent(event.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <Badge className={
                          event.status === 'active' ? 'bg-green-500' :
                          event.status === 'completed' ? 'bg-gray-500' : 'bg-yellow-500'
                        }>
                          {event.status === 'active' ? 'Aktif' :
                           event.status === 'completed' ? 'Tamamlandı' : 'Taslak'}
                        </Badge>
                      </div>
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
