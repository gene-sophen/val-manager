const { createState, migrateState } = require('./state');
const { applyCommand } = require('./commands');

const SAVE_KEY = 'val-manager-season-v2-save';
const LEGACY_KEY = 'val-manager-prototype-v1-save';
function memoryStore(initial = createState()) {
  const legacyRaw = initial.schemaVersion === 1 ? JSON.stringify(initial) : null;
  let value = migrateState(initial);
  return {
    load: () => structuredClone(value),
    exportRaw: () => JSON.stringify(value, null, 2),
    exportLegacyRaw: () => legacyRaw,
    dispatch(command) {
      value = applyCommand(value, command);
      return structuredClone(value);
    }
  };
}
function localStorageStore(storage, key = SAVE_KEY) {
  if (!storage) throw new Error('浏览器没有可用的本地存储');
  const fallback = key === SAVE_KEY ? LEGACY_KEY : null;
  const backupKey = `${key}:legacy-v1-backup`;
  const raw = () => storage.getItem(key) ?? (fallback ? storage.getItem(fallback) : null);
  function read() {
    const value = raw();
    if (!value) return createState();
    const parsed = JSON.parse(value);
    const next = migrateState(parsed);
    if (parsed.schemaVersion === 1) {
      if (storage.getItem(backupKey) === null) storage.setItem(backupKey, value);
      storage.setItem(key, JSON.stringify(next));
    }
    return next;
  }
  return {
    load: () => structuredClone(read()),
    exportRaw: () => raw() ?? JSON.stringify(createState(), null, 2),
    exportLegacyRaw: () => storage.getItem(backupKey) ?? (fallback ? storage.getItem(fallback) : null),
    dispatch(command) {
      const next = applyCommand(read(), command);
      storage.setItem(key, JSON.stringify(next));
      return structuredClone(next);
    }
  };
}
function indexedDBStore(indexedDB, databaseName = 'val-manager-prototype-v1') {
  if (!indexedDB) throw new Error('浏览器不支持 IndexedDB');
  const open = () => new Promise((resolve, reject) => {
    const req = indexedDB.open(databaseName, 2);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('save')) req.result.createObjectStore('save');
      if (!req.result.objectStoreNames.contains('legacyBackups')) req.result.createObjectStore('legacyBackups');
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('旧页面正在使用存档，请关闭旧页面后刷新'));
    req.onsuccess = () => { req.result.onversionchange = () => req.result.close(); resolve(req.result); };
  });
  async function transact(command) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['save', 'legacyBackups'], 'readwrite');
      const store = tx.objectStore('save');
      let result, failure;
      const request = store.get('career');
      request.onsuccess = () => {
        try {
          const original = request.result;
          result = original ? migrateState(original) : createState();
          if (command) result = applyCommand(result, command);
          if (original?.schemaVersion === 1) tx.objectStore('legacyBackups').put(JSON.stringify(original), `v1:${original.revision}:${original.activeRun?.id || 'career'}`);
          if (command || original?.schemaVersion === 1) store.put(result, 'career');
        } catch (error) { failure = error; tx.abort(); }
      };
      tx.oncomplete = () => { db.close(); resolve(structuredClone(result)); };
      tx.onerror = tx.onabort = () => { db.close(); reject(failure || tx.error || new Error('存档事务已中止')); };
    });
  }
  async function exportRaw() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('save', 'readonly');
      const req = tx.objectStore('save').get('career');
      req.onsuccess = () => resolve(JSON.stringify(req.result ?? createState(), null, 2));
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
      tx.onabort = () => { db.close(); reject(tx.error || new Error('原始存档导出失败')); };
    });
  }
  async function exportLegacyRaw() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('legacyBackups', 'readonly');
      const req = tx.objectStore('legacyBackups').getAll();
      req.onsuccess = () => resolve(req.result.length ? JSON.stringify(req.result.map(raw => JSON.parse(raw)), null, 2) : null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
      tx.onabort = () => { db.close(); reject(tx.error || new Error('旧存档备份导出失败')); };
    });
  }
  return { load: () => transact(), dispatch: transact, exportRaw, exportLegacyRaw };
}
module.exports = { SAVE_KEY, LEGACY_KEY, memoryStore, localStorageStore, indexedDBStore };
