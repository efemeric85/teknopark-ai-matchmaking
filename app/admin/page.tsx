'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, Plus, Play, RefreshCw, Settings, ArrowLeft, 
  Loader2, CheckCircle, Clock, UserCheck
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function AdminPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const [newEvent, setNewEvent] = useState({
    name: '',
    theme: '',
    round_duration_sec: 360
  });

  useEffect(() => {
    fetchEvents();
  }, []);

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

  const fetchEventDetails = async (eventId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/events/${eventId}`);
      const data = await res.json();
      if (data.event) {
        setSelectedEvent(data.event);
        setParticipants(data.participants || []);
      }
    } catch (error) {
      console.error('Error fetching event:', error);
    } finally {
      setLoading(false);
    }
  };

  const createEvent = async () => {
    if (!newEvent.name) {
      toast({
        title: "Hata",
        description: "Etkinlik adı gerekli",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEvent)
      });
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: "Başarılı!",
          description: "Etkinlik oluşturuldu"
        });
        setDialogOpen(false);
        setNewEvent({ name: '', theme: '', round_duration_sec: 360 });
        fetchEvents();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const startMatching = async (roundNumber = 1) => {
    if (!selectedEvent) return;

    try {
      setMatching(true);
      const res = await fetch(`/api/events/${selectedEvent.id}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round_number: roundNumber })
      });
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: "Eşleştirme Tamamlandı! 🎉",
          description: data.message
        });
        fetchEventDetails(selectedEvent.id);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setMatching(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Taslak</Badge>;
      case 'active':
        return <Badge className="bg-green-500">Aktif</Badge>;
      case 'completed':
        return <Badge variant="outline">Tamamlandı</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Event Detail View
  if (selectedEvent) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setSelectedEvent(null)}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{selectedEvent.name}</h1>
                {selectedEvent.theme && (
                  <p className="text-gray-500">Tema: {selectedEvent.theme}</p>
                )}
              </div>
              {getStatusBadge(selectedEvent.status)}
            </div>
            <Button onClick={() => fetchEventDetails(selectedEvent.id)}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Yenile
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{participants.length}</div>
                    <div className="text-gray-500">Katılımcı</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                    <UserCheck className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{participants.filter(p => p.checked_in).length}</div>
                    <div className="text-gray-500">Check-in</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{selectedEvent.round_duration_sec / 60} dk</div>
                    <div className="text-gray-500">Tur Süresi</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Matching Button */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Eşleştirme Yönetimi</CardTitle>
              <CardDescription>
                Katılımcıları AI destekli algoritma ile eşleştirin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button 
                  size="lg" 
                  onClick={() => startMatching(1)}
                  disabled={matching || participants.length < 2}
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
                <Button variant="outline" onClick={() => startMatching(2)} disabled={matching}>
                  Yeni Tur Başlat
                </Button>
              </div>
              {participants.length < 2 && (
                <p className="text-sm text-amber-600 mt-2">
                  Eşleştirme için en az 2 katılımcı gerekli
                </p>
              )}
            </CardContent>
          </Card>

          {/* Participants */}
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
                  {participants.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium">{p.full_name}</div>
                        <div className="text-sm text-gray-500">
                          {p.company && `${p.company} • `}{p.position || 'Pozisyon belirtilmemiş'}
                        </div>
                        <div className="text-sm text-blue-600 mt-1">
                          "{p.current_intent}"
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-green-50">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Kayıtlı
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Events List View
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Organizatör Paneli</h1>
            <p className="text-gray-500">Etkinliklerinizi yönetin</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Ana Sayfa
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Yeni Etkinlik
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Yeni Etkinlik Oluştur</DialogTitle>
                  <DialogDescription>
                    Networking etkinliği için bilgileri girin
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Etkinlik Adı *</Label>
                    <Input
                      placeholder="Yapay Zeka Zirvesi 2025"
                      value={newEvent.name}
                      onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tema</Label>
                    <Input
                      placeholder="Savunma Sanayii, Fintech, vs."
                      value={newEvent.theme}
                      onChange={(e) => setNewEvent({ ...newEvent, theme: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tur Süresi (saniye)</Label>
                    <Input
                      type="number"
                      value={newEvent.round_duration_sec}
                      onChange={(e) => setNewEvent({ ...newEvent, round_duration_sec: parseInt(e.target.value) || 360 })}
                    />
                  </div>
                  <Button className="w-full" onClick={createEvent} disabled={loading}>
                    {loading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Oluştur
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Events Grid */}
        {loading && events.length === 0 ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
          </div>
        ) : events.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Settings className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Henüz etkinlik yok
              </h3>
              <p className="text-gray-500 mb-4">
                İlk networking etkinliğinizi oluşturun
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Etkinlik Oluştur
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((event) => (
              <Card 
                key={event.id} 
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => fetchEventDetails(event.id)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{event.name}</CardTitle>
                    {getStatusBadge(event.status)}
                  </div>
                  {event.theme && (
                    <CardDescription>Tema: {event.theme}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-gray-500">
                    <Clock className="w-4 h-4 mr-1" />
                    {event.round_duration_sec / 60} dakika / tur
                  </div>
                  <div className="text-xs text-gray-400 mt-2">
                    {new Date(event.created_at).toLocaleDateString('tr-TR')}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
