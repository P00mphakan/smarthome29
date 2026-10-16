const crypto = require('crypto');

const CLIENT_ID = process.env.TUYA_CLIENT_ID || 'rxg3fghwhgpruxrxyhpx';
const CLIENT_SECRET = process.env.TUYA_CLIENT_SECRET || '0190e1e2a79e411791522ef296e0d73f';
const TUYA_BASE_URL = process.env.TUYA_BASE_URL || 'https://openapi.tuyaus.com';

const EWELINK_TOKEN = process.env.EWELINK_TOKEN || '8870561bd60dbf863d786a2d8c357700a7c5dde3';
const EWELINK_BASE_URL = process.env.EWELINK_BASE_URL || 'https://as-apia.coolkit.cc';

const N8N_FALLBACK_URL = process.env.N8N_WEBHOOK_URL || 'https://n8n.scmc.cmu.ac.th/webhook/smart-home-ai';

const DEVICES = {
  bedroom:     { id: 'eb0d00aecb32d846e9wcay', code: 'switch_1', platform: 'tuya', name: 'ไฟห้องนอน' },
  kitchen:     { id: 'eb3d9918f1ee2e5fcbjddp', code: 'switch_1', platform: 'tuya', name: 'ไฟห้องครัว' },
  outdoor:     { id: 'ebea61dbb0304a72ce0nsx', code: 'switch_1', platform: 'tuya', name: 'ไฟนอกบ้าน' },
  tv:          { id: 'eb1fc8ad111be286156cwh', code: 'Power', platform: 'tuya', name: 'ทีวี' },
  ev_meter:    { id: 'eb22a5147bed005948apdm', code: 'switch', platform: 'tuya', name: 'ชาร์จรถ EV' },
  door_switch: { id: 'eb5702ab44f3dcaf5cgl4v', code: 'switch_1', platform: 'tuya', name: 'สวิตช์หน้าประตู' },
  living_room: { id: '1000feb7b8', name: 'ไฟห้องนั่งเล่น', channel: 'both', platform: 'ewelink' },
  small_room:  { id: '10011955ab', name: 'ไฟห้องเล็ก', channel: 1, platform: 'ewelink' }
};

const SCENES = {
  all_light_on:   { id: 'tG2L8ZSn2LKMB5dA', name: 'Turn on all light' },
  all_light_off:  { id: 'bE4YctfyXMkwuYPM', name: 'Turn off all light' },
  ev_charge:      { id: 'qT9UAVrv0RTgKUcH', name: 'ชาร์จแบดรถ' },
  outdoor_off:    { id: 'aPvQxxAAHrNW79aq', name: 'ปิดไฟนอกบ้าน' },
  outdoor_on:     { id: '77n60735lR2fhihl', name: 'เปิดไฟนอกบ้าน' },
  kitchen_off:    { id: 'CflXy0nyniOyAdQ3', name: 'ปิดไฟห้องครัว' },
  kitchen_on:     { id: 'k4HXoWlech1EyRmh', name: 'เปิดไฟห้องครัว' },
  bedroom_off:    { id: '92Z1chBnFIaGtBve', name: 'ปิดไฟห้องนอน' },
  bedroom_on:     { id: '757KMZwcaSQ7RP6b', name: 'เปิดไฟห้องนอน' },
  air_off:        { id: '0A8liR6N0ZeTkUPw', name: 'ปิดแอร์' },
  air_on:         { id: 'naAjHkYX5DYVp0m7', name: 'เปิดแอร์' },
  air_27:         { id: 'XrRz80YEKHf3IQJa', name: 'ปรับแอร์ 27 องศา' },
  fan_speed:      { id: '7fM9org32gAw0Nh9', name: 'เพิ่มสปีดพัดลม' },
  fan_off:        { id: '7hOnwT8sio3St18V', name: 'ปิดพัดลม' },
  fan_on:         { id: 'SXvpOX3pq6XmRBWO', name: 'เปิดพัดลม' },
  fan_swing:      { id: '', name: 'ส่ายพัดลม' }
};

// In-Memory Token Cache
let cachedTuyaToken = null;
let tuyaTokenExpiresAt = 0;

function sha256(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

function hmacSha256(key, str) {
  return crypto.createHmac('sha256', key).update(str, 'utf8').digest('hex').toUpperCase();
}

async function getTuyaToken(forceRefresh = false) {
  if (!forceRefresh && cachedTuyaToken && Date.now() < tuyaTokenExpiresAt - 60000) {
    return cachedTuyaToken;
  }
  const t = Date.now().toString();
  const method = 'GET';
  const path = '/v1.0/token?grant_type=1';
  const contentHash = sha256('');
  const stringToSign = [method, contentHash, '', path].join('\n');
  const sign = hmacSha256(CLIENT_SECRET, CLIENT_ID + t + stringToSign);

  const res = await fetch(TUYA_BASE_URL + path, {
    method,
    headers: {
      'client_id': CLIENT_ID,
      'sign': sign,
      't': t,
      'sign_method': 'HMAC-SHA256'
    }
  });
  const data = await res.json();
  if (data.success && data.result) {
    cachedTuyaToken = data.result.access_token;
    tuyaTokenExpiresAt = Date.now() + (data.result.expire_time * 1000);
    return cachedTuyaToken;
  }
  throw new Error('Failed to obtain Tuya access token: ' + JSON.stringify(data));
}

async function tuyaRequest(method, path, body = null, retry = true) {
  const token = await getTuyaToken();
  const t = Date.now().toString();
  const bStr = body ? JSON.stringify(body) : '';
  const contentHash = sha256(bStr);
  const stringToSign = [method, contentHash, '', path].join('\n');
  const sign = hmacSha256(CLIENT_SECRET, CLIENT_ID + token + t + stringToSign);

  const headers = {
    'client_id': CLIENT_ID,
    'sign': sign,
    't': t,
    'sign_method': 'HMAC-SHA256',
    'Content-Type': 'application/json',
    'access_token': token
  };

  const res = await fetch(TUYA_BASE_URL + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();

  // If token expired (code 1010), retry once with fresh token
  if (retry && data && (data.code === 1010 || data.code === 1011)) {
    await getTuyaToken(true);
    return await tuyaRequest(method, path, body, false);
  }
  return data;
}

async function ewelinkRequest(method, path, body = null) {
  const headers = {
    'Authorization': 'Bearer ' + EWELINK_TOKEN,
    'Content-Type': 'application/json'
  };
  const res = await fetch(EWELINK_BASE_URL + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  return await res.json();
}

async function controlDevice(deviceKey, state) {
  const dev = DEVICES[deviceKey];
  if (!dev) return { success: false, error: 'Unknown device: ' + deviceKey };

  const boolState = Boolean(state);

  if (dev.platform === 'ewelink') {
    const stateStr = boolState ? 'on' : 'off';
    let paramsObj = {};
    if (dev.channel === 'both') {
      paramsObj = { switches: [{ outlet: 0, switch: stateStr }, { outlet: 1, switch: stateStr }] };
    } else {
      paramsObj = { switches: [{ outlet: dev.channel, switch: stateStr }] };
    }
    const res = await ewelinkRequest('POST', '/v2/device/thing/status', {
      type: 1,
      id: dev.id,
      params: paramsObj
    });
    return { success: res.error === 0, device: deviceKey, state: boolState, raw: res };
  } else {
    const res = await tuyaRequest('POST', `/v1.0/iot-03/devices/${dev.id}/commands`, {
      commands: [{ code: dev.code, value: boolState }]
    });
    return { success: res.success === true, device: deviceKey, state: boolState, raw: res };
  }
}

async function sendTvKey(key) {
  const tvDevId = DEVICES.tv.id;

  // ตรวจสอบซีน Tap-to-Run อัตโนมัติ (หากผู้ใช้สร้างไว้ใน Smart Life)
  if (key === 'Power') {
    try {
      const rules = await tuyaRequest('GET', '/v2.0/cloud/scene/rule?space_id=65646606');
      if (rules && rules.success && rules.result && rules.result.list) {
        const found = rules.result.list.find(s => s.name.includes('ทีวี') || s.name.toUpperCase().includes('TV'));
        if (found) {
          return await triggerScene(found.id, found.name);
        }
      }
    } catch(e) {}
  }

  const res = await tuyaRequest('POST', `/v1.0/iot-03/devices/${tvDevId}/commands`, {
    commands: [{ code: key, value: key }]
  });
  return { success: res.success === true, action: 'tv_key', key, raw: res };
}

async function triggerScene(sceneId, sceneName = '') {
  // Tuya Cloud Scene Trigger expects null / empty body
  const res = await tuyaRequest('POST', `/v2.0/cloud/scene/rule/${sceneId}/actions/trigger`, null);
  return { success: res.success === true, action: 'trigger_scene', scene_id: sceneId, name: sceneName, raw: res };
}

async function getAllStatus() {
  const statusMap = {};
  const tasks = Object.entries(DEVICES).map(async ([key, dev]) => {
    try {
      if (dev.platform === 'ewelink') {
        const st = await ewelinkRequest('GET', `/v2/device/thing/status?type=1&id=${dev.id}`);
        if (st && st.error === 0 && st.data?.params?.switches) {
          if (dev.channel === 'both') {
            const ch0 = st.data.params.switches.find(s => s.outlet === 0);
            const ch1 = st.data.params.switches.find(s => s.outlet === 1);
            statusMap[key] = Boolean((ch0 && ch0.switch === 'on') || (ch1 && ch1.switch === 'on'));
          } else {
            const ch = st.data.params.switches.find(s => s.outlet === dev.channel);
            statusMap[key] = Boolean(ch && ch.switch === 'on');
          }
        } else {
          statusMap[key] = false;
        }
      } else {
        const st = await tuyaRequest('GET', `/v1.0/iot-03/devices/${dev.id}/status`);
        if (st && st.success && Array.isArray(st.result)) {
          const sw = st.result.find(item => item.code === dev.code || item.code.startsWith('switch'));
          statusMap[key] = sw ? Boolean(sw.value) : false;
        } else {
          statusMap[key] = false;
        }
      }
    } catch (e) {
      statusMap[key] = false;
    }
  });

  await Promise.allSettled(tasks);
  return statusMap;
}

// Fast-Path Intent Parser for Siri Voice Commands
function parseVoiceCommand(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  const text = rawText.trim();
  const lower = text.toLowerCase();

  // 1. All lights
  if (/(เปิด|ติด).*ไฟ.*(ทั้งหมด|ทั้งบ้าน|ทุกดวง)/.test(text) || /(เปิดทั้งหมด|เปิดไฟทั้งบ้าน)/.test(text)) {
    return { type: 'scene', sceneId: SCENES.all_light_on.id, reply: 'เปิดไฟทุกดวงในบ้านให้เรียบร้อยแล้วค่ะ' };
  }
  if (/(?<!เ)(ปิด|ดับ).*ไฟ.*(ทั้งหมด|ทั้งบ้าน|ทุกดวง)/.test(text) || /(?<!เ)(ปิดทั้งหมด|ปิดไฟทั้งบ้าน)/.test(text)) {
    return { type: 'scene', sceneId: SCENES.all_light_off.id, reply: 'ปิดไฟทุกดวงในบ้านให้เรียบร้อยแล้วค่ะ' };
  }

  // 2. Air conditioner
  if (/(เปิดแอร์|เปิดเครื่องปรับอากาศ)/.test(text)) {
    return { type: 'scene', sceneId: SCENES.air_on.id, reply: 'เปิดแอร์ Haier 25 องศาให้แล้วค่ะ' };
  }
  if (/(?<!เ)ปิดแอร์|(?<!เ)ปิดเครื่องปรับอากาศ/.test(text)) {
    return { type: 'scene', sceneId: SCENES.air_off.id, reply: 'ปิดแอร์เรียบร้อยแล้วค่ะ' };
  }
  if (/(แอร์.*27|27.*องศา|ปรับแอร์)/.test(text)) {
    return { type: 'scene', sceneId: SCENES.air_27.id, reply: 'ปรับแอร์เป็น 27 องศาให้แล้วค่ะ' };
  }

  // 3. Fan
  if (/(เปิดพัดลม|เปิด Hatari)/.test(text)) {
    return { type: 'scene', sceneId: SCENES.fan_on.id, reply: 'เปิดพัดลมให้เรียบร้อยแล้วค่ะ' };
  }
  if (/(?<!เ)ปิดพัดลม|(?<!เ)ปิด Hatari/.test(text)) {
    return { type: 'scene', sceneId: SCENES.fan_off.id, reply: 'ปิดพัดลมเรียบร้อยแล้วค่ะ' };
  }
  if (/(เร่งพัดลม|เพิ่มสปีดพัดลม|สปีดพัดลม|พัดลมแรงขึ้น)/.test(text)) {
    return { type: 'scene', sceneId: SCENES.fan_speed.id, reply: 'เพิ่มสปีดพัดลมให้แล้วค่ะ' };
  }
  if (/(ส่ายพัดลม|พัดลมส่าย|สวิงพัดลม|พัดลมสวิง|เปิดส่าย|ปิดส่าย)/.test(text)) {
    return { type: 'fan_swing', reply: 'สั่งส่ายพัดลมให้แล้วค่ะ' };
  }

  // 4. TV
  if (/(เปิดทีวี|เปิดโทรทัศน์)/.test(text)) {
    return { type: 'tv_key', key: 'Power', reply: 'เปิดทีวีให้แล้วค่ะ' };
  }
  if (/(?<!เ)ปิดทีวี|(?<!เ)ปิดโทรทัศน์/.test(text)) {
    return { type: 'tv_key', key: 'Power', reply: 'ปิดทีวีให้แล้วค่ะ' };
  }
  if (/(เพิ่มเสียง|เร่งเสียง|ดังขึ้น)/.test(text)) {
    return { type: 'tv_key', key: 'Volume+', reply: 'เพิ่มเสียงทีวีให้แล้วค่ะ' };
  }
  if (/(ลดเสียง|เบาเสียง)/.test(text)) {
    return { type: 'tv_key', key: 'Volume-', reply: 'ลดเสียงทีวีให้แล้วค่ะ' };
  }
  if (/(?<!เ)ปิดเสียง|เงียบเสียง|mute/i.test(text)) {
    return { type: 'tv_key', key: 'Mute', reply: 'ปิดเสียงทีวีให้แล้วค่ะ' };
  }
  if (/(เปลี่ยนช่อง|ช่องถัดไป)/.test(text)) {
    return { type: 'tv_key', key: 'Channel+', reply: 'เปลี่ยนช่องทีวีให้แล้วค่ะ' };
  }

  // 5. Switches & Lights
  // Bedroom
  if (/(เปิด|ติด).*ไฟ.*ห้องนอน/.test(text) || /เปิด.*ห้องนอน/.test(text)) {
    return { type: 'device', device: 'bedroom', state: true, reply: 'เปิดไฟห้องนอนให้แล้วค่ะ' };
  }
  if (/(?<!เ)(ปิด|ดับ).*ไฟ.*ห้องนอน/.test(text) || /(?<!เ)ปิด.*ห้องนอน/.test(text)) {
    return { type: 'device', device: 'bedroom', state: false, reply: 'ปิดไฟห้องนอนเรียบร้อยแล้วค่ะ' };
  }

  // Kitchen
  if (/(เปิด|ติด).*ไฟ.*(ครัว|ห้องครัว)/.test(text) || /เปิด.*(ครัว|ห้องครัว)/.test(text)) {
    return { type: 'device', device: 'kitchen', state: true, reply: 'เปิดไฟห้องครัวให้แล้วค่ะ' };
  }
  if (/(?<!เ)(ปิด|ดับ).*ไฟ.*(ครัว|ห้องครัว)/.test(text) || /(?<!เ)ปิด.*(ครัว|ห้องครัว)/.test(text)) {
    return { type: 'device', device: 'kitchen', state: false, reply: 'ปิดไฟห้องครัวเรียบร้อยแล้วค่ะ' };
  }

  // Outdoor
  if (/(เปิด|ติด).*ไฟ.*(นอกบ้าน|หน้าบ้าน|ระเบียง)/.test(text) || /เปิด.*(ไฟนอกบ้าน|ไฟหน้าบ้าน)/.test(text)) {
    return { type: 'device', device: 'outdoor', state: true, reply: 'เปิดไฟนอกบ้านให้แล้วค่ะ' };
  }
  if (/(?<!เ)(ปิด|ดับ).*ไฟ.*(นอกบ้าน|หน้าบ้าน|ระเบียง)/.test(text) || /(?<!เ)ปิด.*(ไฟนอกบ้าน|ไฟหน้าบ้าน)/.test(text)) {
    return { type: 'device', device: 'outdoor', state: false, reply: 'ปิดไฟนอกบ้านเรียบร้อยแล้วค่ะ' };
  }

  // Living Room (eWeLink)
  if (/(เปิด|ติด).*ไฟ.*(ห้องนั่งเล่น|ห้องโถง)/.test(text) || /เปิด.*ห้องนั่งเล่น/.test(text)) {
    return { type: 'device', device: 'living_room', state: true, reply: 'เปิดไฟห้องนั่งเล่นให้แล้วค่ะ' };
  }
  if (/(?<!เ)(ปิด|ดับ).*ไฟ.*(ห้องนั่งเล่น|ห้องโถง)/.test(text) || /(?<!เ)ปิด.*ห้องนั่งเล่น/.test(text)) {
    return { type: 'device', device: 'living_room', state: false, reply: 'ปิดไฟห้องนั่งเล่นเรียบร้อยแล้วค่ะ' };
  }

  // Small Room (eWeLink)
  if (/(เปิด|ติด).*ไฟ.*(ห้องเล็ก|ห้องนอนเล็ก)/.test(text) || /เปิด.*ห้องเล็ก/.test(text)) {
    return { type: 'device', device: 'small_room', state: true, reply: 'เปิดไฟห้องเล็กให้แล้วค่ะ' };
  }
  if (/(?<!เ)(ปิด|ดับ).*ไฟ.*(ห้องเล็ก|ห้องนอนเล็ก)/.test(text) || /(?<!เ)ปิด.*ห้องเล็ก/.test(text)) {
    return { type: 'device', device: 'small_room', state: false, reply: 'ปิดไฟห้องเล็กเรียบร้อยแล้วค่ะ' };
  }

  // EV Charger (รถไฟฟ้า)
  if (/(?<!เ)(ปิด|หยุด|เลิก|ดับ|ยกเลิก).*(ชาร์จ|ev|รถ)/i.test(text) || /(?<!เ)(ปิด|หยุด|เลิก).*(การชาร์จ|ระบบชาร์จ)/i.test(text)) {
    return { type: 'device', device: 'ev_meter', state: false, reply: 'ปิดการชาร์จรถไฟฟ้าเรียบร้อยแล้วค่ะ' };
  }
  if (/เปิด.*(ชาร์จ|ev|รถ)/i.test(text) || /(เริ่ม|สั่งเปิด).*(ชาร์จ|ev|รถ)/i.test(text) || /^(ชาร์จ|ชาร์จแบต|ชาร์จไฟ).*(รถ|ev|รถไฟฟ้า)/i.test(text) || /(ชาร์จรถ|ชาร์จรถไฟฟ้า|ชาร์จ ev)/i.test(text)) {
    return { type: 'device', device: 'ev_meter', state: true, reply: 'เปิดชาร์จรถไฟฟ้าให้แล้วค่ะ' };
  }

  // Door Switch
  if (/(เปิดประตู|กดประตู|สวิตช์ประตู)/.test(text)) {
    return { type: 'device', device: 'door_switch', state: true, reply: 'กดสวิตช์หน้าประตูให้แล้วค่ะ' };
  }

  return null; // Not matched in fast-path
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8930232874:AAGlSTYpx7Y9HWpF-jRu9ez1A9RAvc8Q7hE';

async function sendTelegramSecurityAlert({ message, chatId, photoBase64, customToken } = {}) {
  const token = (customToken || TELEGRAM_BOT_TOKEN).trim();
  const targetChatIds = new Set();

  if (chatId && String(chatId).trim()) {
    targetChatIds.add(String(chatId).trim());
  }

  // Auto-discover chat_ids from getUpdates so homeowner doesn't even need to manually look up chat_id
  try {
    const updRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=50`);
    const updData = await updRes.json();
    if (updData && updData.ok && Array.isArray(updData.result)) {
      updData.result.forEach(u => {
        const cid = u.message?.chat?.id || u.edited_message?.chat?.id || u.callback_query?.message?.chat?.id || u.my_chat_member?.chat?.id;
        if (cid) targetChatIds.add(String(cid));
      });
    }
  } catch (e) {}

  const chatList = Array.from(targetChatIds);
  if (chatList.length === 0) {
    return {
      success: false,
      need_start: true,
      bot_username: 'hermes_poalxzodmm54xkzh_bot',
      msg: 'กรุณากด Start บอท @hermes_poalxzodmm54xkzh_bot ในแอป Telegram ครั้งแรกเพื่อให้บอทรู้จัก Chat ID ของคุณ'
    };
  }

  const results = [];
  for (const cid of chatList) {
    try {
      let sentPhoto = false;
      if (photoBase64 && photoBase64.startsWith('data:image')) {
        try {
          const base64Data = photoBase64.split(',')[1];
          const buffer = Buffer.from(base64Data, 'base64');
          const form = new FormData();
          form.append('chat_id', cid);
          form.append('caption', message || '🚨 แจ้งเตือนความปลอดภัย Smart Home 2/9');
          const blob = new Blob([buffer], { type: 'image/jpeg' });
          form.append('photo', blob, 'security_capture.jpg');

          const pRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
            method: 'POST',
            body: form
          });
          const pJson = await pRes.json();
          if (pJson && pJson.ok) {
            sentPhoto = true;
            results.push({ chat_id: cid, type: 'photo', ok: true });
          }
        } catch (pe) {}
      }

      if (!sentPhoto) {
        const mRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: cid,
            text: message || '🚨 แจ้งเตือนความปลอดภัย Smart Home 2/9'
          })
        });
        const mJson = await mRes.json();
        results.push({ chat_id: cid, type: 'text', ok: Boolean(mJson && mJson.ok) });
      }
    } catch (err) {
      results.push({ chat_id: cid, error: err.message });
    }
  }

  return {
    success: results.some(r => r.ok),
    chat_ids: chatList,
    results
  };
}

async function fetchYahooQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
  });
  const data = await res.json();
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== 'number') return null;

  const price = meta.regularMarketPrice;
  const prev = meta.chartPreviousClose || meta.previousClose || price;
  let changePct = typeof meta.regularMarketChangePercent === 'number'
    ? meta.regularMarketChangePercent
    : (prev ? ((price - prev) / prev) * 100 : 0);

  return {
    price: Number(price.toFixed(2)),
    prevClose: Number(prev.toFixed(2)),
    changePct: Number(changePct.toFixed(2))
  };
}

async function fetchSwissquoteSpot(pairPath) {
  const url = `https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/${pairPath}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
  });
  const arr = await res.json();
  const quotes = arr?.[0]?.spreadProfilePrices;
  if (Array.isArray(quotes) && quotes.length > 0) {
    const q = quotes.find(item => item.spreadProfile === 'elite' || item.spreadProfile === 'prime') || quotes[0];
    if (typeof q.bid === 'number' && typeof q.ask === 'number') {
      return Number(((q.bid + q.ask) / 2).toFixed(2));
    }
  }
  return null;
}

async function getRealtimeMarketPrices(mt5TunnelUrl = '') {
  // 1. Optional Custom Windows MT5 Tunnel Override (if user provides one and it responds)
  if (mt5TunnelUrl && mt5TunnelUrl.startsWith('http')) {
    try {
      const tRes = await fetch(mt5TunnelUrl, { signal: AbortSignal.timeout(2500) });
      const tData = await tRes.json();
      if (tData && (tData.BTC || tData.XAUUSD || tData.data)) {
        return {
          success: true,
          source: 'mt5_tunnel',
          timestamp: Date.now(),
          data: tData.data || tData
        };
      }
    } catch (e) {}
  }

  // 2. Free Real-Time Online Multi-Source Feed (Swissquote MT5 Feed + Yahoo Finance Live v8)
  const [btcYahoo, goldYahoo, oilYahoo, goldSpot, oilSpot] = await Promise.allSettled([
    fetchYahooQuote('BTC-USD'),
    fetchYahooQuote('GC=F'),
    fetchYahooQuote('CL=F'),
    fetchSwissquoteSpot('XAU/USD'),
    fetchSwissquoteSpot('WTI/USD')
  ]);

  const btc = btcYahoo.status === 'fulfilled' && btcYahoo.value ? btcYahoo.value : { price: 0, changePct: 0 };
  const gY = goldYahoo.status === 'fulfilled' && goldYahoo.value ? goldYahoo.value : { price: 0, prevClose: 0, changePct: 0 };
  const oY = oilYahoo.status === 'fulfilled' && oilYahoo.value ? oilYahoo.value : { price: 0, prevClose: 0, changePct: 0 };

  const xauPrice = (goldSpot.status === 'fulfilled' && goldSpot.value) ? goldSpot.value : gY.price;
  const xauChange = (gY.prevClose && xauPrice)
    ? Number((((xauPrice - gY.prevClose) / gY.prevClose) * 100).toFixed(2))
    : gY.changePct;

  const xtiPrice = (oilSpot.status === 'fulfilled' && oilSpot.value) ? oilSpot.value : oY.price;
  const xtiChange = (oY.prevClose && xtiPrice)
    ? Number((((xtiPrice - oY.prevClose) / oY.prevClose) * 100).toFixed(2))
    : oY.changePct;

  return {
    success: true,
    source: 'online_realtime',
    timestamp: Date.now(),
    data: {
      BTC: {
        symbol: 'BTC',
        price: btc.price,
        changePct: btc.changePct
      },
      XAUUSD: {
        symbol: 'XAUUSD',
        price: xauPrice,
        changePct: xauChange
      },
      XTIUSD: {
        symbol: 'XTIUSD',
        price: xtiPrice,
        changePct: xtiChange
      }
    }
  };
}

module.exports = {
  DEVICES,
  SCENES,
  tuyaRequest,
  ewelinkRequest,
  controlDevice,
  sendTvKey,
  triggerScene,
  getAllStatus,
  parseVoiceCommand,
  sendTelegramSecurityAlert,
  getRealtimeMarketPrices,
  TELEGRAM_BOT_TOKEN,
  N8N_FALLBACK_URL
};
