async function run() {
  const res = await fetch('https://www.hemiolia.cat/');
  const html = await res.text();
  
  console.log('--- Script tags ---');
  const matches = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const m of matches) {
    if (m.includes('concert') || m.includes('fetch') || m.includes('api') || m.includes('js')) {
      console.log(m.substring(0, 500));
      console.log('------------------');
    }
  }

  console.log('--- Script src attributes ---');
  const srcMatches = html.match(/src="([^"]+)"/g) || [];
  console.log(srcMatches);
}

run().catch(console.error);
