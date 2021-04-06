'use strict';

Object.defineProperty(exports, '__esModule', { value: true });


function getCookieValue(a) {
    var b = document.cookie.match('(^|;)\\s*' + a + '\\s*=\\s*([^;]+)');
    return b ? b.pop() : '';
}

class Store {
    constructor(dbName = 'keyval-store', storeName = 'keyval', version = 1) {
        this.storeName = storeName;
        this._dbName = dbName;
        this._storeName = storeName;
        this._version = version;
        this.id = `dbName:${dbName};;storeName:${storeName}`; 
        this.deta = window.Deta(getCookieValue("pk"))
        this.db = this.deta.Base('logseq_db')
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

function getDefaultStore() {
    if (!store)
        store = new Store();
    return store;
}
function get(key, store = getDefaultStore()) {
    return store.db.get(key).then(res => decodeData(res.value))
}
const setBatchers = {};

function put (value, key, store) {
    return store.db.put({'value': value}, key).then(res => res);
}
function set(key, value, store = getDefaultStore()) {
    if (!setBatchers[store.id]) {
        setBatchers[store.id] = new Batcher((items) =>  {
            for (const item of items) {
                put(encodeData(item.value), item.key, store).then(res=> console.log(res));
            }
        });
    }
    return setBatchers[store.id].queue({ key, value });
}
function setBatch(items, store = getDefaultStore()) {

    for (const item of items) {
            put(encodeData(item.value), item.key, store).then(res=> console.log(res));
    }

}
function update(key, updater, store = getDefaultStore()) {
    return store.db.get(key).then(res => {
        put(encodeData(updater(decodeData(res.value))), key, store).then(res=> console.log(res))
    })
  
}
function del(key, store = getDefaultStore()) {
    return store.db.delete(key).then();
 
}
function clear(store = getDefaultStore()) {
    return store.db.delete('logseq-db/local').then(res=> {
        store.db.delete('logseq-files-db/local')
    })
}
function keys(store = getDefaultStore()) {
    const keys = ['logseq-db/local', 'logseq-files-db/local'];
    return keys
}
function close(store = getDefaultStore()) {
    return null
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
