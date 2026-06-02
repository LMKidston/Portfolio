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

    // Parse output
    let outputToSave = {};
    if (data.content) {
      const outputText = data.content.map(b => b.text || '').join('');
      try {
        outputToSave = JSON.parse(outputText.replace(/```json|```/g, '').trim());
      } catch(e) {
        outputToSave = { raw: outputText.substring(0, 1000) };
      }
    }

    // Send response to client immediately
    res.status(response.status).json(data);

    // Save to Supabase after response is sent
    if (response.ok && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
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
            output: outputToSave
          })
        });
        const sbText = await sbRes.text();
        console.log('Supabase:', sbRes.status, sbText.substring(0, 200));
      } catch(sbErr) {
        console.log('Supabase error:', sbErr.message);
      }
    }

  } catch (err) {
    console.error('Handler error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
