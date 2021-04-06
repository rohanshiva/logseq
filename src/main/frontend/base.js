'use strict';

const { renderWithSize } = require("react-resize-context");

Object.defineProperty(exports, '__esModule', { value: true });

function getCookieValue(a) {
    var b = document.cookie.match('(^|;)\\s*' + a + '\\s*=\\s*([^;]+)');
    return b ? b.pop() : '';
}

const deta = window.Deta(getCookieValue("pk"))
const logseq_db = deta.Base('logseq_db')

class Store {
    constructor(dbName = 'keyval-store', storeName = 'keyval', version = 1) {
        this.storeName = storeName;
        this._dbName = dbName;
        this._storeName = storeName;
        this._version = version;
        this.id = `dbName:${dbName};;storeName:${storeName}`;
        this._init();
    }
    _init() {
        if (this._dbp) {
            return;
        }
        this._dbp = new Promise((resolve, reject) => {
            const openreq = indexedDB.open(this._dbName, this._version);
            openreq.onerror = () => reject(openreq.error);
            openreq.onsuccess = () => resolve(openreq.result);
            // First time setup: create an empty object store
            openreq.onupgradeneeded = () => {
                openreq.result.createObjectStore(this._storeName);
            };
        });
    }
    _withIDBStore(type, callback) {
        this._init();
        return this._dbp.then(db => new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, type);
            transaction.oncomplete = () => resolve();
            transaction.onabort = transaction.onerror = () => reject(transaction.error);
            callback(transaction.objectStore(this.storeName));
        }));
    }
    _close() {
        this._init();
        return this._dbp.then(db => {
            db.close();
            this._dbp = undefined;
        });
    }
}
class Batcher {
    constructor(executor) {
        this.executor = executor;
        this.items = [];
    }
  async process() {
        const toProcess = this.items;
        this.items = [];
        await this.executor(toProcess.map(({ item }) => item));
        toProcess.map(({ onProcessed }) => onProcessed());
        if (this.items.length) {
            this.ongoing = this.process();
        }
        else {
            this.ongoing = undefined;
        }
    }
    async queue(item) {
        const result = new Promise((resolve) => this.items.push({ item, onProcessed: resolve }));
        if (!this.ongoing)
            this.ongoing = this.process();
        return result;
    }
}
let store;

function encodeData(data){
    return window.LZString.compressToEncodedURIComponent(data);
}

function decodeData(data){ 
    return window.LZString.decompressFromEncodedURIComponent(data);
}
function put (value, key) {
    return logseq_db.put({'value': value}, key).then(res => res);
}

function getDefaultStore() {
    if (!store)
        store = new Store();
    return store;
}
function get(key, store = getDefaultStore()) {

    let default_pages;
    let default_files;
    let req;
    return store._withIDBStore('readwrite', store => {
        req = store.get(key);
        default_pages = store.get('logseq-db/local');
        default_files = store.get('logseq-files-db/local')
    }).then(() => {
        return logseq_db.get(key).then(res=> {
            if (res == null) {
                put(encodeData(default_pages.result), 'logseq-db/local').then(pages=> {
                    put(encodeData(default_files.result), 'logseq-files-db/local').then(files=> {
                        console.log('Res is null, putting default values in db!')
                        return req.result;
                    })
                })
            }
            else {
                console.log(res.value)
                return decodeData(res.value);
            }
        })
    });
}
const setBatchers = {};


function set(key, value, store = getDefaultStore()) {
    if (!setBatchers[store.id]) {
        setBatchers[store.id] = new Batcher((items) => store._withIDBStore('readwrite', store => {
            for (const item of items) {
                put(encodeData(item.value), item.key).then(res=> console.log(res));
            }
        }));
    }
    return setBatchers[store.id].queue({ key, value });
}
function setBatch(items, store = getDefaultStore()) {
  return store._withIDBStore('readwrite', store => {
    for (const item of items) {
            put(encodeData(item.value), item.key).then(res=> console.log(res));
    }
  });
}
function update(key, updater, store = getDefaultStore()) {
    return logseq_db.get(key).then(res => {
        put(encodeData(updater(decodeData(res.value))), key).then(res=> console.log(res))
    })
  
}
function del(key, store = getDefaultStore()) {
    return logseq_db.delete(key).then();
 
}
function clear(store = getDefaultStore()) {
    return store._withIDBStore('readwrite', store => {
        store.clear();
    });
}
function keys(store = getDefaultStore()) {
    const keys = ['logseq-db/local', 'logseq-files-db/local'];
    return keys
}
function close(store = getDefaultStore()) {
    return store._close();
}

exports.Store = Store;
exports.get = get;
exports.set = set;
exports.setBatch = setBatch;
exports.update = update;
exports.del = del;
exports.clear = clear;
exports.keys = keys;
exports.close = close;
