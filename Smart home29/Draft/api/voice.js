const {
  controlDevice,
  sendTvKey,
  triggerScene,
  parseVoiceCommand,
  N8N_FALLBACK_URL
} = require('./_shared');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let command = '';
  if (req.body) {
    command = typeof req.body === 'string' ? req.body : (req.body.command || req.body.text || '');
  }
  if (!command && req.query && req.query.command) {
    command = req.query.command;
  }

  command = (command || '').trim();

  if (!command) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(400).send('กรุณาระบุคำสั่งเสียงค่ะ');
  }

  // 1. FAST-PATH: ตรวจจับคำสั่งตรงตัว (ตอบสนองใน 0.2 - 0.3 วินาที)
  const matched = parseVoiceCommand(command);

  if (matched) {
    try {
      if (matched.type === 'device') {
        await controlDevice(matched.device, matched.state);
      } else if (matched.type === 'scene') {
        await triggerScene(matched.sceneId);
      } else if (matched.type === 'tv_key') {
        await sendTvKey(matched.key);
      }

      // ตรวจสอบว่า Client ขอรับเป็น JSON หรือ Plain Text
      const wantsJson = (req.query && req.query.format === 'json') || 
                        (req.headers && req.headers['accept'] && req.headers['accept'].includes('application/json'));
      if (wantsJson) {
        return res.status(200).json({ output: matched.reply, success: true });
      }

      // ตอบกลับเป็น Text Plain ให้ Siri และ Web พูด/แสดงผลได้ทันที
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(matched.reply);
    } catch (err) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(500).send('เกิดข้อผิดพลาดในการสั่งงาน: ' + err.message);
    }
  }

  // 2. FALLBACK: หากเป็นประโยคซับซ้อน ส่งต่อไปให้ n8n AI Agent วิเคราะห์
  try {
    const fallbackRes = await fetch(N8N_FALLBACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command })
    });
    const fallbackText = await fallbackRes.text();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(fallbackText);
  } catch (err) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send('รับคำสั่งแล้ว แต่ไม่สามารถติดต่อ AI Agent ได้ในขณะนี้ค่ะ');
  }
};
