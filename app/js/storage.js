// Stockage local (IndexedDB) : projets + médias (images, vidéos, polices).
const DB_NAME = 'moteur-motion';
let dbp = null;

function db() {
  return (dbp ||= new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('media')) d.createObjectStore('media', { keyPath: 'id' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}

function run(store, mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const tx = d.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

export const saveProject = (p) => run('projects', 'readwrite', (s) => s.put(p));
export const getProject = (id) => run('projects', 'readonly', (s) => s.get(id));
export const listProjects = () => run('projects', 'readonly', (s) => s.getAll());
export const deleteProject = (id) => run('projects', 'readwrite', (s) => s.delete(id));
export const saveMedia = (rec) => run('media', 'readwrite', (s) => s.put(rec));
export const getMedia = (id) => run('media', 'readonly', (s) => s.get(id));
