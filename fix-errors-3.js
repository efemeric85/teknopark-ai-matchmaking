const fs = require('fs');
const path = require('path');

let count = 0;

function fix(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(f => {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) {
      fix(p);
    } else if (f.name === 'route.ts') {
      let c = fs.readFileSync(p, 'utf8');
      const o = c;
      c = c.replace(/matchError\.message/g, "'Sunucu hatasi.'");
      c = c.replace(/updateError\.message/g, "'Sunucu hatasi.'");
      c = c.replace(/refetchError\.message/g, "'Sunucu hatasi.'");
      c = c.replace(/fetchError\.message/g, "'Sunucu hatasi.'");
      c = c.replace(/allError\.message/g, "'Sunucu hatasi.'");
      c = c.replace(/insertErr\.message/g, "'Sunucu hatasi.'");
      c = c.replace(/updateErr\.message/g, "'Sunucu hatasi.'");
      // Fix broken template literals
      c = c.replace(/`[^`]*\$\{'Sunucu hatasi\.'\}[^`]*`/g, "'Sunucu hatasi.'");
      // Remove matchId from error response objects
      c = c.replace(/, matchId\b/g, '');
      if (c !== o) {
        fs.writeFileSync(p, c);
        count++;
        console.log('FIXED:', p);
      }
    }
  });
}

fix(path.join('.', 'app', 'api'));
console.log('\nToplam ' + count + ' dosya duzeltildi.');
