async function run() {
  const url = 'https://www.hemiolia.cat/api/public/gigs';
  console.log('Fetching', url);
  try {
    const res = await fetch(url);
    console.log('Status:', res.status);
    console.log('Headers:', Object.fromEntries(res.headers.entries()));
    const text = await res.text();
    console.log('Response body:', text);
  } catch (err) {
    console.error(err);
  }
}

run().catch(console.error);
