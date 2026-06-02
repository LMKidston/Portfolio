export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const parsed = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { accessCode, clientInfo, intakeData, ...body } = parsed;

  if (accessCode !== process.env.CIPHER_ACCESS_CODE) {
    return res.status(401).json({ error: 'Invalid access code.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch(e) { data = { raw: text }; }

    // Always attempt Supabase save after successful response
    if (response.ok) {
      console.log('Attempting Supabase save for:', clientInfo?.name);
      console.log('SUPABASE_URL present:', !!process.env.SUPABASE_URL);
      console.log('SUPABASE_SERVICE_KEY present:', !!process.env.SUPABASE_SERVICE_KEY);

      let outputToSave = null;
      if (data.content) {
        const outputText = data.content.map(b => b.text || '').join('');
        try {
          outputToSave = JSON.parse(outputText.replace(/```json|```/g, '').trim());
        } catch(e) {
          console.log('Output parse failed:', e.message);
          outputToSave = { raw: outputText.substring(0, 500) };
        }
      }

      try {
        const sbRes = await fetch(process.env.SUPABASE_URL + '/rest/v1/diagnostics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_SERVICE_KEY,
            'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_KEY,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            client_name: clientInfo?.name || 'Unknown',
            client_arr: clientInfo?.arr || '',
            client_stage: clientInfo?.stage || '',
            intake: intakeData || {},
            output: outputToSave || {}
          })
        });
        const sbText = await sbRes.text();
        console.log('Supabase status:', sbRes.status, 'response:', sbText);
      } catch(sbErr) {
        console.log('Supabase save error:', sbErr.message);
      }
    }

    return res.status(response.status).json(data);

  } catch (err) {
    console.error('Handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
