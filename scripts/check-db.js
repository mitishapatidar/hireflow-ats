const fs = require('fs');

if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('DIRECT_URL=')) {
      const val = trimmed.replace('DIRECT_URL=', '').replace(/^["']|["']$/g, '');
      const u = new URL(val);
      const decoded = decodeURIComponent(u.password);
      console.log('Decoded password length:', decoded.length);
      console.log('Decoded contains YOUR-PASSWORD:', decoded.includes('YOUR-PASSWORD'));
      console.log('Decoded contains brackets:', decoded.includes('[') || decoded.includes(']'));
      console.log('Structure of decoded:', decoded.replace(/[a-zA-Z0-9]/g, '*'));
    }
  }
}
