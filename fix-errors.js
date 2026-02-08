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
      c = c.replace(/error\.message/g, "'Sunucu hatasi.'");
      c = c.replace(/e\.message/g, "'Sunucu hatasi.'");
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
