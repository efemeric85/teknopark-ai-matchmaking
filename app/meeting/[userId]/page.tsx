// ... (mevcut kodun devamı, if (currentMatch?.status === 'pending') bloğunun kapanışından sonra)

  // STATE: Waiting - User has matches but all completed (odd number situation)
  const hasPendingOrActive = matches.some(m => m.status === 'pending' || m.status === 'active');
  const isWaitingForNextRound = matches.length > 0 && !hasPendingOrActive && !currentMatch;

  if (isWaitingForNextRound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-12 h-12 text-amber-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Lütfen Bekleyiniz</h1>
          <p className="text-lg text-gray-600 mb-6">
            Bu turda eşleşme sayısı tek olduğu için sıra sizde. 
            Bir sonraki turda öncelikli olarak eşleştirileceksiniz.
          </p>
          <div className="bg-white rounded-xl p-6 shadow-lg border border-amber-200">
            <div className="text-sm text-gray-500 mb-2">Tahmini bekleme süresi</div>
            <div className="text-4xl font-bold text-amber-600">~6 dakika</div>
          </div>
          <Button 
            variant="outline" 
            className="mt-6"
            onClick={fetchMatches}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Durumu Kontrol Et
          </Button>
        </div>
      </div>
    );
  }

  // STATE: No active/pending match - List View   <-- BU MEVCUT KOD, KALACAK
  return (
    <div className="min-h-screen bg-gray-50">
    // ... devamı
