const {
  tuyaRequest,
  ewelinkRequest,
  DEVICES,
  SCENES
} = require('./_shared');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const results = {
      success: true,
      timestamp: new Date().toISOString(),
      scenes: [],
      tuya_devices: [],
      ewelink_devices: [],
      configured_devices: DEVICES,
      configured_scenes: SCENES
    };

    // 1. Fetch Tuya Tap-to-Run Scenes for Home Space 65646606
    try {
      const sceneData = await tuyaRequest('GET', '/v2.0/cloud/scene/rule?space_id=65646606');
      if (sceneData && sceneData.success && sceneData.result && Array.isArray(sceneData.result.list)) {
        results.scenes = sceneData.result.list.map(s => ({
          id: s.id,
          name: s.name,
          enabled: s.enabled !== false,
          actions: s.actions || []
        }));
      } else if (sceneData && sceneData.result) {
        results.scenes_raw = sceneData.result;
      }
    } catch (err) {
      results.scenes_error = err.message;
    }

    // 2. Fetch Tuya Devices (Try user devices first, then home devices)
    try {
      let devData = await tuyaRequest('GET', '/v1.0/users/az1646642051997Yb82i/devices');
      if (!devData || !devData.success || !devData.result) {
        devData = await tuyaRequest('GET', '/v1.0/homes/65646606/devices');
      }
      if (devData && devData.success && Array.isArray(devData.result)) {
        results.tuya_devices = devData.result.map(d => ({
          id: d.id,
          name: d.name,
          online: d.online,
          category: d.category,
          product_name: d.product_name,
          status: d.status || []
        }));
      } else if (devData && devData.result && Array.isArray(devData.result.list)) {
        results.tuya_devices = devData.result.list.map(d => ({
          id: d.id,
          name: d.name,
          online: d.online,
          category: d.category,
          product_name: d.product_name,
          status: d.status || []
        }));
      }
    } catch (err) {
      results.tuya_devices_error = err.message;
    }

    // 3. Fetch eWeLink Devices
    try {
      const ewelinkData = await ewelinkRequest('GET', '/v2/device/thing');
      if (ewelinkData && ewelinkData.error === 0 && ewelinkData.data && Array.isArray(ewelinkData.data.thingList)) {
        results.ewelink_devices = ewelinkData.data.thingList.map(t => {
          const item = t.itemData || {};
          return {
            id: item.deviceid || t.id,
            name: item.name || 'eWeLink Device',
            online: item.online,
            brandName: item.brandName,
            extra: item.extra
          };
        });
      }
    } catch (err) {
      results.ewelink_error = err.message;
    }

    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Discovery Error' });
  }
};
