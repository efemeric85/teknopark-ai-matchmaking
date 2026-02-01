'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Users, Sparkles, QrCode, Clock, ArrowRight, Loader2, CalendarDays, MapPin } from 'lucide-react';

export default function HomePage() {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    company: '',
    position: '',
    current_intent: ''
  });

  useEffect(() => {
    const savedUserId = localStorage.getItem('teknopark_user_id');
    if (savedUserId) {
      setUserId(savedUserId);
      setRegistered(true);
    }
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/events');
      const data = await res.json();
      if (data.events) {
        setEvents(data.events.filter((e: any) => e.status !== 'completed'));
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          event_id: selectedEvent
        })
      });

      const data = await res.json();

      if (data.success && data.user) {
        localStorage.setItem('teknopark_user_id', data.user.id);
        setUserId(data.user.id);
        setRegistered(true);
        toast({
          title: "Kayıt Başarılı! 🎉",
          description: "Eşleştirmeler başlayınca bilgilendirileceksiniz."
        });
      } else {
        throw new Error(data.error || 'Kayıt başarısız');
      }
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('teknopark_user_id');
    setUserId(null);
    setRegistered(false);
    setFormData({
      email: '',
      full_name: '',
      company: '',
      position: '',
      current_intent: ''
    });
  };

  const selectedEventData = events.find(e => e.id === selectedEvent);

  if (registered && userId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-blue-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <img 
                src="/logo-white.png" 
                alt="Teknopark Ankara Yapay Zeka Kümelenmesi" 
                style={{ maxHeight: '100px', width: 'auto' }}
                className="mx-auto mb-4"
              />
              <h1 className="text-3xl font-bold text-gray-900">Kayıt Tamamlandı!</h1>
              <p className="text-gray-600 mt-2">Eşleştirmeler için bekleyiniz</p>
            </div>

            {/* Waiting Card */}
            <Card className="mb-6 border-2 border-cyan-100">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mb-4">
                    <Clock className="w-12 h-12 text-white" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    Eşleştirme Bekleniyor
                  </h2>
                  <p className="text-gray-600 mb-4">
                    Organizatör eşleştirmeleri başlattığında bilgilendirileceksiniz.
                    Bu sayfa otomatik olarak güncellenecektir.
                  </p>
                  <div className="w-full max-w-xs">
                    <Button 
                      className="w-full bg-cyan-600 hover:bg-cyan-700" 
                      onClick={() => window.location.href = `/meeting/${userId}`}
                    >
                      Eşleşmelerimi Gör
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={handleLogout}>
                Farklı Hesapla Giriş
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-6">
            <img 
              src="/logo-white.png" 
              alt="Teknopark Ankara Yapay Zeka Kümelenmesi" 
              style={{ maxHeight: '100px', width: 'auto' }}
              className="mx-auto mb-2"
            />
            <h1 className="text-2xl font-bold text-gray-900">AI Networking Platformu</h1>
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 rounded-lg bg-white shadow-sm border border-cyan-100">
              <Sparkles className="w-8 h-8 text-cyan-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">AI Eşleştirme</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-white shadow-sm border border-cyan-100">
              <QrCode className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">QR Handshake</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-white shadow-sm border border-cyan-100">
              <Clock className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">Zamanlayıcı</p>
            </div>
          </div>

          {/* Registration Form */}
          <Card className="border-2 border-cyan-100">
            <CardHeader>
              <CardTitle>Katılımcı Kayıt</CardTitle>
              <CardDescription>
                Networking etkinliğine katılmak için bilgilerinizi girin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Event Selection */}
                {events.length > 0 && (
                  <div className="space-y-2">
                    <Label>Etkinlik Seçin</Label>
                    <div className="grid gap-2">
                      {events.map((event) => (
                        <div
                          key={event.id}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            selectedEvent === event.id
                              ? 'border-cyan-500 bg-cyan-50'
                              : 'border-gray-200 hover:border-cyan-200'
                          }`}
                          onClick={() => setSelectedEvent(event.id)}
                        >
                          <div className="font-medium">{event.name}</div>
                          {event.theme && (
                            <div className="text-sm text-gray-500">Tema: {event.theme}</div>
                          )}
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
                      ))}
                    </div>
                  </div>
                )}

                {events.length === 0 && !loading && (
                  <div className="text-center py-8 text-gray-500">
                    <CalendarDays className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>Şu an aktif etkinlik bulunmuyor.</p>
                    <p className="text-sm">Lütfen daha sonra tekrar deneyin.</p>
                  </div>
                )}

                {events.length > 0 && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="ornek@firma.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="full_name">Ad Soyad *</Label>
                        <Input
                          id="full_name"
                          placeholder="Ahmet Yılmaz"
                          value={formData.full_name}
                          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="company">Şirket</Label>
                        <Input
                          id="company"
                          placeholder="ABC Teknoloji A.Ş."
                          value={formData.company}
                          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="position">Pozisyon</Label>
                        <Input
                          id="position"
                          placeholder="Yazılım Mühendisi"
                          value={formData.position}
                          onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="current_intent">Bugün burada ne arıyorsun? *</Label>
                      <Textarea
                        id="current_intent"
                        placeholder="Örneğin: Yapay zeka projelerimiz için yatırımcı arıyorum, veya: B2B satış için potansiyel müşteriler bulmak istiyorum..."
                        className="min-h-[100px]"
                        value={formData.current_intent}
                        onChange={(e) => setFormData({ ...formData, current_intent: e.target.value })}
                        required
                      />
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full bg-cyan-600 hover:bg-cyan-700" 
                      size="lg"
                      disabled={submitting || !selectedEvent}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Kayıt Yapılıyor...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Etkinliğe Katıl
                        </>
                      )}
                    </Button>
                  </>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Admin Link */}
          <div className="text-center mt-6">
            <Button variant="link" onClick={() => window.location.href = '/admin'}>
              Organizatör Girişi
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
