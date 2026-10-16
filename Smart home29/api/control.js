const {
  controlDevice,
  sendTvKey,
  triggerScene,
  getAllStatus,
  tuyaRequest,
  sendTelegramSecurityAlert,
  getRealtimeMarketPrices,
  SCENES
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

  try {
    const input = req.body || {};
    const action = input.action || (req.query && req.query.action);

    // 0. Auto-Discovery for Tuya & eWeLink
    if (action === 'discover') {
      const discoverHandler = require('./discover');
      return await discoverHandler(req, res);
    }

    // 0.1 Telegram Security Alert
    if (action === 'telegram_alert') {
      const alertResult = await sendTelegramSecurityAlert({
        message: input.message,
        chatId: input.chat_id,
        photoBase64: input.photo_base64,
        customToken: input.bot_token
      });
      return res.status(200).json(alertResult);
    }

    // 0.2 Real-Time Market Prices (BTC, XAUUSD, XTIUSD)
    if (action === 'market_prices') {
      const mt5Url = input.mt5_url || (req.query && req.query.mt5_url) || '';
      const marketData = await getRealtimeMarketPrices(mt5Url);
      return res.status(200).json(marketData);
    }

    // 1. Get Status (Sync all devices)
    if (action === 'get_status') {
      const statusMap = await getAllStatus();
      return res.status(200).json({ success: true, type: 'status_sync', data: statusMap });
    }

    // 2. TV Key
    if (action === 'tv_key' && input.key) {
      const result = await sendTvKey(input.key);
      return res.status(200).json(result);
    }

    // 3. Trigger Scene
    if (action === 'trigger_scene' && input.scene_id) {
      const result = await triggerScene(input.scene_id, input.scene_name || '');
      return res.status(200).json(result);
    }

    // 3.1 Fan Swing (Auto-discover scene from Tuya if not set)
    if (action === 'fan_swing') {
      let swingSceneId = SCENES.fan_swing ? SCENES.fan_swing.id : '';
      if (!swingSceneId) {
        try {
          const rules = await tuyaRequest('GET', '/v2.0/cloud/scene/rule?space_id=65646606');
          if (rules && rules.success && rules.result && rules.result.list) {
            const found = rules.result.list.find(s => s.name.includes('ส่าย') || s.name.toLowerCase().includes('swing'));
            if (found) {
              swingSceneId = found.id;
              SCENES.fan_swing.id = found.id;
            }
          }
        } catch(e) {}
      }

      if (swingSceneId) {
        const result = await triggerScene(swingSceneId, 'ส่ายพัดลม');
        return res.status(200).json(result);
      } else {
        return res.status(200).json({ success: false, need_scene: true, msg: 'กรุณาสร้างซีน Tap-to-Run ชื่อ "ส่ายพัดลม" ในแอป Smart Life' });
      }
    }

    // 4. Device Toggle / Direct State Control
    if (input.device) {
      const result = await controlDevice(input.device, input.state);
      return res.status(200).json(result);
    }

    // 5. CCTV PTZ Action
    if (action === 'cctv_ptz') {
      return res.status(200).json({ success: true, action: 'cctv_ptz', camera: input.camera, direction: input.direction });
    }

    return res.status(400).json({ success: false, error: 'Invalid command or missing device/action' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
};
