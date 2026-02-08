const fs = require('fs');
const path = require('path');

console.log('=== FIX Y1: Middleware - katilimci route\'larini public yap ===');

const mwPath = path.join('.', 'middleware.ts');
let mw = fs.readFileSync(mwPath, 'utf8');

// Mevcut public route'lardan sonra matches participant route'larini ekle
// Bul: if (path.startsWith('/api/admin/auth')) return NextResponse.next();
// Ekle: if (path.startsWith('/api/matches') && !path.includes('/reset')) return NextResponse.next();
const oldLine = "if (path.startsWith('/api/admin/auth')) return NextResponse.next();";
const newLine = oldLine + "\n  if (path.startsWith('/api/matches') && !path.includes('/reset')) return NextResponse.next();";

if (mw.includes(oldLine) && !mw.includes("'/api/matches')")) {
  mw = mw.replace(oldLine, newLine);
  fs.writeFileSync(mwPath, mw);
  console.log('  DONE: /api/matches/* public yapildi (reset haric)');
} else if (mw.includes("'/api/matches')")) {
  console.log('  SKIP: Zaten eklenmiş');
} else {
  console.log('  HATA: middleware.ts yapisi beklenenden farkli, manuel kontrol et');
}

console.log('');
console.log('=== FIX Y3: Debug route sil ===');

const debugDir = path.join('.', 'app', 'api', 'debug');
if (fs.existsSync(debugDir)) {
  fs.rmSync(debugDir, { recursive: true });
  console.log('  DONE: app/api/debug/ silindi');
} else {
  console.log('  SKIP: Debug route zaten yok');
}

console.log('');
console.log('=== FIX O3: Console.log temizligi ===');

let cleanCount = 0;

function cleanConsole(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(f => {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) {
      cleanConsole(p);
    } else if (f.name === 'route.ts') {
      let c = fs.readFileSync(p, 'utf8');
      const o = c;
      // console.log satirlarini sil (console.error kalsin - serverda lazim)
      c = c.replace(/^\s*console\.log\(.*\);\s*\n/gm, '');
      if (c !== o) {
        fs.writeFileSync(p, c);
        cleanCount++;
        console.log('  CLEANED:', p);
      }
    }
  });
}

cleanConsole(path.join('.', 'app', 'api'));
console.log('  Toplam ' + cleanCount + ' dosyadan console.log temizlendi');

console.log('');
console.log('=== TAMAMLANDI ===');
console.log('Simra:');
console.log('  git add -A');
console.log('  git commit -m "fix: middleware + debug route + console.log cleanup"');
console.log('  git push');
