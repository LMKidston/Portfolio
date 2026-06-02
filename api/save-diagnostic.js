export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    const sbRes = await fetch(process.env.SUPABASE_URL + '/rest/v1/diagnostics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + process.env.SUPABASE_ANON_KEY,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(body)
    });
    
    const text = await sbRes.text();
    console.log('Save result:', sbRes.status, text);
    return res.status(sbRes.status).json({ status: sbRes.status, body: text });
    
  } catch(err) {
    console.error('Save error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
