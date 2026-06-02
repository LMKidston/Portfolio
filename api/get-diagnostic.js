export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { id, accessCode } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  if (accessCode !== process.env.CIPHER_ACCESS_CODE) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const r = await fetch(process.env.SUPABASE_URL + '/rest/v1/diagnostics?id=eq.' + id + '&limit=1', {
      headers: { 'apikey': process.env.SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + process.env.SUPABASE_ANON_KEY }
    });
    const rows = await r.json();
    return res.status(200).json({ row: rows[0] || null });
  } catch(err) { return res.status(500).json({ error: err.message }); }
}
