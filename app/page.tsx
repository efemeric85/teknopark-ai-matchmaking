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
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    company: '',
    position: '',
    current_intent: ''
  });

  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookingUp, setLookingUp] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/events');
      const data = await res.json();
      
      if (data.events) {
        const validEvents = data.events.filter((e: any) => {
          const isActive = e.status?.toLowerCase() === 'active';
          return isActive;
        });
        
        const sortedEvents = validEvents.sort((a: any, b: any) => {
          if (!a.event_date && !b.event_date) return 0;
          if (!a.event_date) return 1;
          if (!b.event_date) return -1;
          return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
        });
        
        const nearestEvent = sortedEvents.slice(0, 1);
        setEvents(nearestEvent);
        
        if (nearestEvent.length > 0) {
          setSelectedEvent(nearestEvent[0].id);
        }
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
        localStorage.setItem('teknopark_user_email', data.user.email);
        toast({
          title: "Kayıt Başarılı! 🎉",
          description: "Eşleşme sayfanıza yönlendiriliyorsunuz..."
        });
        // Kayıt sonrası meeting sayfasına yönlendir
        window.location.href = `/meeting/${data.user.email}`;
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

  const handleEmailLogin = async () => {
    if (!loginEmail || !selectedEvent) return;
    
    try {
      const res = await fetch(`/api/users/login?email=${encodeURIComponent(loginEmail)}&event_id=${selectedEvent}`);
      const data = await res.json();
      
      if (data.user) {
        localStorage.setItem('teknopark_user_id', data.user.id);
        localStorage.setItem('teknopark_user_email', data.user.email);
        
        // Giriş sonrası meeting sayfasına yönlendir
        window.location.href = `/meeting/${data.user.email}`;
      } else {
        toast({
          title: "Kullanıcı Bulunamadı",
          description: "Bu email ile kayıt bulunamadı. Lütfen önce kayıt olun.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Hata",
        description: "Giriş yapılamadı.",
        variant: "destructive"
      });
    }
  };

  const handleLookup = async () => {
    if (!lookupEmail) return;
    
    setLookingUp(true);
    try {
      const res = await fetch(`/api/users/login?email=${encodeURIComponent(lookupEmail)}`);
      const data = await res.json();
      
      if (data.user) {
        localStorage.setItem('teknopark_user_id', data.user.id);
        localStorage.setItem('teknopark_user_email', data.user.email);
        
        // Direkt meeting sayfasına yönlendir
        window.location.href = `/meeting/${data.user.email}`;
      } else {
        toast({
          title: "Kullanıcı Bulunamadı",
          description: "Bu email ile kayıt bulunamadı.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Hata",
        description: "Arama yapılamadı.",
        variant: "destructive"
      });
    } finally {
      setLookingUp(false);
    }
  };

  const selectedEventData = events.find(e => e.id === selectedEvent);

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-6">
            <img 
              src="/logo-white.png" 
              alt="Teknopark Ankara Yapay Zeka Kümelenmesi" 
              style={{ maxHeight: '250px', width: 'auto' }}
              className="mx-auto mb-2"
            />
            <h1 className="text-2xl font-bold text-gray-900">Networking Eşleştirme Uygulaması</h1>
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
              <div className="flex gap-4 mb-2">
                <Button 
                  variant={!showEmailLogin ? "default" : "outline"}
                  onClick={() => setShowEmailLogin(false)}
                  className={!showEmailLogin ? "bg-blue-600" : ""}
                >
                  Yeni Kayıt
                </Button>
                <Button 
                  variant={showEmailLogin ? "default" : "outline"}
                  onClick={() => setShowEmailLogin(true)}
                  className={showEmailLogin ? "bg-blue-600" : ""}
                >
                  Giriş Yap
                </Button>
              </div>
              <CardTitle>{showEmailLogin ? 'Email ile Giriş' : 'Katılımcı Kayıt'}</CardTitle>
              <CardDescription>
                {showEmailLogin 
                  ? 'Daha önce kayıt olduysanız email adresinizle giriş yapın'
                  : 'Networking etkinliğine katılmak için bilgilerinizi girin'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Email Login Form */}
              {showEmailLogin ? (
                <div className="space-y-4">
                  {events.length > 0 && (
                    <div className="space-y-2">
                      <Label>Etkinlik</Label>
                      <div className="grid gap-2">
                        {events.map((event) => (
                          <div
                            key={event.id}
                            className="p-4 rounded-lg border-2 border-cyan-500 bg-cyan-50"
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
                  <div className="space-y-2">
                    <Label htmlFor="loginEmail">Email Adresiniz</Label>
                    <Input
                      id="loginEmail"
                      type="email"
                      placeholder="ornek@firma.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button 
                    onClick={handleEmailLogin}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold" 
                    size="lg"
                    disabled={!loginEmail || !selectedEvent}
                  >
                    Giriş Yap
                  </Button>
                </div>
              ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Event Selection */}
                {events.length > 0 && (
                  <div className="space-y-2">
                    <Label>Etkinlik</Label>
                    <div className="grid gap-2">
                      {events.map((event) => (
                        <div
                          key={event.id}
                          className="p-4 rounded-lg border-2 border-cyan-500 bg-cyan-50"
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
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold" 
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
              )}
            </CardContent>
          </Card>

          {/* Already Registered */}
          <Card className="mt-6 border border-gray-200">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-3">Daha önce kayıt oldunuz mu?</p>
                <div className="flex gap-2 max-w-md mx-auto">
                  <Input
                    type="email"
                    placeholder="Email adresinizi girin"
                    value={lookupEmail}
                    onChange={(e) => setLookupEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    variant="outline"
                    onClick={handleLookup}
                    disabled={lookingUp}
                  >
                    {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Giriş'}
                  </Button>
                </div>
              </div>
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
