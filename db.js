const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');
const crypto = require('crypto');

/**
 * low-json-db
 * A lightweight, zero-dependency, file-based document database for Node.js
 * with MongoDB-style API, indexes, transactions, async support, and more.
 */

class JSONDB extends EventEmitter {
  /**
   * @param {string} [dbPath='./database']
   */
  constructor(dbPath = './database') {
    super();
    this.dbPath = dbPath;
    this.collections = {};          // loaded collections
    this.collectionOptions = {};    // stored options for lazy loading

    try {
      if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(dbPath, { recursive: true });
      }
    } catch (err) {
      console.log(err.message);
      this.emit('error', err);
    }
  }

  /**
   * Get or create a collection
   * @param {string|object} nameOrOptions
   * @returns {Collection}
   */
  collection(nameOrOptions) {
    const options = typeof nameOrOptions === 'string'
      ? { name: nameOrOptions }
      : (nameOrOptions || {});

    if (!options.name) {
      throw new Error('Collection name is required');
    }

    const name = options.name;

    // Merge with previously stored options
    if (!this.collectionOptions[name]) {
      this.collectionOptions[name] = { ...options };
    } else {
      this.collectionOptions[name] = { ...this.collectionOptions[name], ...options };
    }

    // Lazy loading: only create instance when first accessed
    if (!this.collections[name]) {
      this.collections[name] = new Collection(
        this.collectionOptions[name],
        this.dbPath,
        this
      );
    }

    return this.collections[name];
  }

  createCollection(nameOrOptions) {
    return this.collection(nameOrOptions);
  }

  /**
   * List all collection names (from files)
   * @returns {string[]}
   */
  listCollections() {
    try {
      return fs.readdirSync(this.dbPath)
        .filter(f => f.endsWith('.json') && !f.endsWith('.idx.json') && !f.endsWith('.tmp.json'))
        .map(f => f.replace(/\.json$/, ''));
    } catch (err) {
      console.log(err.message);
      this.emit('error', err);
      return [];
    }
  }

  /**
   * Drop a collection
   * @param {string} name
   * @returns {boolean}
   */
  dropCollection(name) {
    try {
      const filePath = path.join(this.dbPath, `${name}.json`);
      const idxPath = path.join(this.dbPath, `${name}.idx.json`);
      let deleted = false;

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        deleted = true;
      }
      if (fs.existsSync(idxPath)) {
        fs.unlinkSync(idxPath);
      }

      // Clean temp files if any
      const tmpPath = path.join(this.dbPath, `${name}.tmp.json`);
      const tmpIdx = path.join(this.dbPath, `${name}.tmp.idx.json`);
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      if (fs.existsSync(tmpIdx)) fs.unlinkSync(tmpIdx);

      delete this.collections[name];
      delete this.collectionOptions[name];

      return deleted;
    } catch (err) {
      console.log(err.message);
      this.emit('error', err);
      return false;
    }
  }

  /**
   * Unload a collection from memory
   * @param {string} name
   * @returns {boolean}
   */
  unloadCollection(name) {
    if (this.collections[name]) {
      delete this.collections[name];
      this.emit('unload', { collection: name });
      return true;
    }
    return false;
  }

  /**
   * Create a full backup of the database
   * @param {string} [backupRoot='./backups']
   * @returns {string|null}
   */
  backup(backupRoot = './backups') {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupRoot, `backup-${timestamp}`);

      if (!fs.existsSync(backupPath)) {
        fs.mkdirSync(backupPath, { recursive: true });
      }

      const files = fs.readdirSync(this.dbPath);
      for (const file of files) {
        if (file.endsWith('.json') && !file.includes('.tmp.')) {
          fs.copyFileSync(
            path.join(this.dbPath, file),
            path.join(backupPath, file)
          );
        }
      }

      this.emit('backup', { path: backupPath });
      return backupPath;
    } catch (err) {
      console.log(err.message);
      this.emit('error', err);
      return null;
    }
  }

  /**
   * Async backup
   * @param {string} [backupRoot='./backups']
   * @returns {Promise<string|null>}
   */
  async backupAsync(backupRoot = './backups') {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupRoot, `backup-${timestamp}`);

      await fsp.mkdir(backupPath, { recursive: true });

      const files = await fsp.readdir(this.dbPath);
      for (const file of files) {
        if (file.endsWith('.json') && !file.includes('.tmp.')) {
          await fsp.copyFile(
            path.join(this.dbPath, file),
            path.join(backupPath, file)
          );
        }
      }

      this.emit('backup', { path: backupPath });
      return backupPath;
    } catch (err) {
      console.log(err.message);
      this.emit('error', err);
      return null;
    }
  }
}

class Collection extends EventEmitter {
  /**
   * @param {object} options
   * @param {string} dbPath
   * @param {JSONDB} dbInstance
   */
  constructor(options, dbPath, dbInstance) {
    super();

    this.name = options.name;
    this.dbPath = dbPath;
    this.db = dbInstance;

    // ID configuration
    this.autoId = options.autoId === true;
    this.idField = options.idField || '_id';
    this.idType = options.idType || 'auto'; // 'auto' | 'uuid' | 'objectid'

    // Index configuration
    this.indexFields = Array.isArray(options.indexes) ? options.indexes : [];
    this.indexes = {};

    // Other options
    this.pretty = options.pretty !== false; // true by default
    this.lazy = options.lazy === true;

    // Paths
    this.filePath = path.join(dbPath, `${this.name}.json`);
    this.tmpPath = path.join(dbPath, `${this.name}.tmp.json`);
    this.indexPath = path.join(dbPath, `${this.name}.idx.json`);
    this.tmpIndexPath = path.join(dbPath, `${this.name}.tmp.idx.json`);

    // Lock system
    this._locked = false;
    this._queue = [];

    // Load data
    this.data = this._loadDataSync();
    this._idCounter = this._calculateNextId();
    this._loadIndexesSync();
  }

  // ==================== LOCK SYSTEM ====================

  _withLock(fn) {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        this._locked = true;
        try {
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          this._locked = false;
          if (this._queue.length > 0) {
            const next = this._queue.shift();
            next();
          }
        }
      };

      if (this._locked) {
        this._queue.push(execute);
      } else {
        execute();
      }
    });
  }

  // ==================== HELPERS ====================

  getNestedValue(obj, fieldPath) {
    if (!fieldPath) return undefined;
    const keys = fieldPath.split('.');
    let current = obj;
    for (const key of keys) {
      if (current === undefined || current === null) return undefined;
      current = current[key];
    }
    return current;
  }

  setNestedValue(obj, fieldPath, value) {
    const keys = fieldPath.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (current[keys[i]] === undefined || current[keys[i]] === null) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }

  // ==================== ID GENERATION ====================

  generateId() {
    switch (this.idType) {
      case 'uuid':
        return crypto.randomUUID();
      case 'objectid': {
        const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
        const random = crypto.randomBytes(8).toString('hex');
        return timestamp + random;
      }
      case 'auto':
      default:
        return this._idCounter++;
    }
  }

  _calculateNextId() {
    if (!this.data || this.data.length === 0) return 1;
    const ids = this.data
      .map(doc => this.getNestedValue(doc, this.idField))
      .filter(id => typeof id === 'number' && !isNaN(id));
    return ids.length ? Math.max(...ids) + 1 : 1;
  }

  /**
   * Recalculate the next auto-increment ID from current data
   */
  rebuildId() {
    this._idCounter = this._calculateNextId();
    return this._idCounter;
  }

  async rebuildIdAsync() {
    return this.rebuildId();
  }

  // ==================== LOAD / SAVE ====================

  _loadDataSync() {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(content);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (err) {
      console.log(err.message);
      this.emit('error', err);
      this.db?.emit('error', err);
    }
    return [];
  }

  _loadIndexesSync() {
    if (this.indexFields.length === 0) return;

    try {
      if (fs.existsSync(this.indexPath)) {
        const content = fs.readFileSync(this.indexPath, 'utf8');
        this.indexes = JSON.parse(content) || {};
      } else {
        this.rebuildIndexes();
      }
    } catch (err) {
      console.log(err.message);
      this.emit('error', err);
      this.rebuildIndexes();
    }
  }

  saveData() {
    try {
      const content = this.pretty
        ? JSON.stringify(this.data, null, 2)
        : JSON.stringify(this.data);

      fs.writeFileSync(this.tmpPath, content, 'utf8');
      fs.renameSync(this.tmpPath, this.filePath);

      this.emit('save', { collection: this.name, count: this.data.length });
      this.db?.emit('save', { collection: this.name, count: this.data.length });
    } catch (err) {
      console.log(err.message);
      this.emit('error', err);
      this.db?.emit('error', err);
      try {
        if (fs.existsSync(this.tmpPath)) fs.unlinkSync(this.tmpPath);
      } catch (e) {
        console.log(e.message);
      }
    }
  }

  async saveDataAsync() {
    try {
      const content = this.pretty
        ? JSON.stringify(this.data, null, 2)
        : JSON.stringify(this.data);

      await fsp.writeFile(this.tmpPath, content, 'utf8');
      await fsp.rename(this.tmpPath, this.filePath);

      this.emit('save', { collection: this.name, count: this.data.length });
      this.db?.emit('save', { collection: this.name, count: this.data.length });
    } catch (err) {
      console.log(err.message);
      this.emit('error', err);
      this.db?.emit('error', err);
      try {
        await fsp.unlink(this.tmpPath).catch(() => {});
      } catch (e) {
        console.log(e.message);
      }
    }
  }

  saveIndexes() {
    if (this.indexFields.length === 0) return;

    try {
      const content = this.pretty
        ? JSON.stringify(this.indexes, null, 2)
        : JSON.stringify(this.indexes);

      fs.writeFileSync(this.tmpIndexPath, content, 'utf8');
      fs.renameSync(this.tmpIndexPath, this.indexPath);
    } catch (err) {
      console.log(err.message);
      this.emit('error', err);
      this.db?.emit('error', err);
      try {
        if (fs.existsSync(this.tmpIndexPath)) fs.unlinkSync(this.tmpIndexPath);
      } catch (e) {
        console.log(e.message);
      }
    }
  }

  async saveIndexesAsync() {
    if (this.indexFields.length === 0) return;

    try {
      const content = this.pretty
        ? JSON.stringify(this.indexes, null, 2)
        : JSON.stringify(this.indexes);

      await fsp.writeFile(this.tmpIndexPath, content, 'utf8');
      await fsp.rename(this.tmpIndexPath, this.indexPath);
    } catch (err) {
      console.log(err.message);
      this.emit('error', err);
      this.db?.emit('error', err);
      try {
        await fsp.unlink(this.tmpIndexPath).catch(() => {});
      } catch (e) {
        console.log(e.message);
      }
    }
  }

  // ==================== INDEX MANAGEMENT ====================

  rebuildIndexes() {
    this.indexes = {};
    this.indexFields.forEach(field => {
      this.indexes[field] = {};
    });

    this.data.forEach((doc, idx) => {
      this._addToIndex(doc, idx);
    });

    this.saveIndexes();
  }

  _addToIndex(doc, idx) {
    this.indexFields.forEach(field => {
      const value = this.getNestedValue(doc, field);
      if (value === undefined || value === null) return;

      const key = typeof value === 'object' ? JSON.stringify(value) : String(value);
      if (!this.indexes[field]) this.indexes[field] = {};

      const current = this.indexes[field][key];

      if (current === undefined) {
        this.indexes[field][key] = idx;
      } else if (typeof current === 'number') {
        this.indexes[field][key] = [current, idx];
      } else if (Array.isArray(current)) {
        if (!current.includes(idx)) current.push(idx);
      }
    });
  }

  _removeFromIndex(doc, idx) {
    this.indexFields.forEach(field => {
      const value = this.getNestedValue(doc, field);
      if (value === undefined || value === null) return;

      const key = typeof value === 'object' ? JSON.stringify(value) : String(value);
      const current = this.indexes[field] && this.indexes[field][key];

      if (current === undefined) return;

      if (typeof current === 'number') {
        if (current === idx) delete this.indexes[field][key];
      } else if (Array.isArray(current)) {
        const filtered = current.filter(i => i !== idx);
        if (filtered.length === 0) {
          delete this.indexes[field][key];
        } else if (filtered.length === 1) {
          this.indexes[field][key] = filtered[0];
        } else {
          this.indexes[field][key] = filtered;
        }
      }
    });
  }

  // ==================== QUERY HELPERS ====================

  matchesFilter(doc, filter) {
    if (!filter || Object.keys(filter).length === 0) return true;

    return Object.entries(filter).every(([key, value]) => {
      if (key === '$or') {
        return Array.isArray(value) && value.some(cond => this.matchesFilter(doc, cond));
      }
      if (key === '$and') {
        return Array.isArray(value) && value.every(cond => this.matchesFilter(doc, cond));
      }
      if (key === '$nor') {
        return Array.isArray(value) && !value.some(cond => this.matchesFilter(doc, cond));
      }

      const docValue = this.getNestedValue(doc, key);

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        if (value.$eq !== undefined) return docValue === value.$eq;
        if (value.$ne !== undefined) return docValue !== value.$ne;
        if (value.$gt !== undefined) return docValue > value.$gt;
        if (value.$gte !== undefined) return docValue >= value.$gte;
        if (value.$lt !== undefined) return docValue < value.$lt;
        if (value.$lte !== undefined) return docValue <= value.$lte;
        if (value.$in !== undefined) return Array.isArray(value.$in) && value.$in.includes(docValue);
        if (value.$nin !== undefined) return Array.isArray(value.$nin) && !value.$nin.includes(docValue);
        if (value.$exists !== undefined) return (docValue !== undefined) === value.$exists;
        if (value.$regex !== undefined) {
          try {
            const regex = new RegExp(value.$regex, value.$options || '');
            return regex.test(String(docValue));
          } catch {
            return false;
          }
        }
        if (value.$type !== undefined) {
          const typeMap = {
            string: 'string',
            number: 'number',
            boolean: 'boolean',
            array: 'object',
            object: 'object',
            null: 'object'
          };
          return typeof docValue === typeMap[value.$type] ||
            (value.$type === 'null' && docValue === null) ||
            (value.$type === 'array' && Array.isArray(docValue));
        }
        if (value.$size !== undefined) {
          return Array.isArray(docValue) && docValue.length === value.$size;
        }
        if (value.$elemMatch !== undefined) {
          if (!Array.isArray(docValue)) return false;
          return docValue.some(item => this.matchesFilter(item, value.$elemMatch));
        }
      }

      return docValue === value;
    });
  }

  applyUpdate(doc, update) {
    if (!update || typeof update !== 'object') return;

    if (update.$set) {
      Object.entries(update.$set).forEach(([k, v]) => {
        this.setNestedValue(doc, k, v);
      });
    }

    if (update.$inc) {
      Object.entries(update.$inc).forEach(([k, v]) => {
        const current = this.getNestedValue(doc, k) || 0;
        this.setNestedValue(doc, k, current + v);
      });
    }

    if (update.$push) {
      Object.entries(update.$push).forEach(([k, v]) => {
        let arr = this.getNestedValue(doc, k);
        if (!Array.isArray(arr)) {
          arr = [];
          this.setNestedValue(doc, k, arr);
        }
        arr.push(v);
      });
    }

    if (update.$pull) {
      Object.entries(update.$pull).forEach(([k, v]) => {
        const arr = this.getNestedValue(doc, k);
        if (Array.isArray(arr)) {
          const filtered = arr.filter(item => JSON.stringify(item) !== JSON.stringify(v));
          this.setNestedValue(doc, k, filtered);
        }
      });
    }

    if (update.$unset) {
      Object.keys(update.$unset).forEach(k => {
        const keys = k.split('.');
        let current = doc;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!current[keys[i]]) return;
          current = current[keys[i]];
        }
        delete current[keys[keys.length - 1]];
      });
    }
  }

  // ==================== INSERT ====================

  insert(document) {
    try {
      const doc = { ...document };

      if (this.autoId && this.getNestedValue(doc, this.idField) === undefined) {
        this.setNestedValue(doc, this.idField, this.generateId());
      }

      const index = this.data.length;
      this.data.push(doc);
      this._addToIndex(doc, index);

      this.saveData();
      this.saveIndexes();

      this.emit('insert', doc);
      this.db?.emit('insert', { collection: this.name, document: doc });
      return doc;
    } catch (err) {
      console.log(err.message);
      this.emit('error', err);
      this.db?.emit('error', err);
      return null;
    }
  }

  async insertAsync(document) {
    return this._withLock(async () => {
      try {
        const doc = { ...document };

        if (this.autoId && this.getNestedValue(doc, this.idField) === undefined) {
          this.setNestedValue(doc, this.idField, this.generateId());
        }

        const index = this.data.length;
        this.data.push(doc);
        this._addToIndex(doc, index);

        await this.saveDataAsync();
        await this.saveIndexesAsync();

        this.emit('insert', doc);
        this.db?.emit('insert', { collection: this.name, document: doc });
        return doc;
      } catch (err) {
        console.log(err.message);
        this.emit('error', err);
        this.db?.emit('error', err);
        return null;
      }
    });
  }

  insertMany(documents) {
    try {
      if (!Array.isArray(documents)) return [];

      const inserted = [];
      for (const raw of documents) {
        const doc = { ...raw };
        if (this.autoId && this.getNestedValue(doc, this.idField) === undefined) {
          this.setNestedValue(doc, this.idField, this.generateId());
        }
        const index = this.data.length;
        this.data.push(doc);
        this._addToIndex(doc, index);
        inserted.push(doc);
      }

      this.saveData();
      this.saveIndexes();

      this.emit('insertMany', inserted);
      this.db?.emit('insertMany', { collection: this.name, documents: inserted });
      return inserted;
    } catch (err) {
      console.log(err.message);
      this.emit('error', err);
      this.db?.emit('error', err);
      return [];
    }
  }

  async insertManyAsync(documents) {
    return this._withLock(async () => {
      try {
        if (!Array.isArray(documents)) return [];

        const inserted = [];
        for (const raw of documents) {
          const doc = { ...raw };
          if (this.autoId && this.getNestedValue(doc, this.idField) === undefined) {
            this.setNestedValue(doc, this.idField, this.generateId());
          }
          const index = this.data.length;
          this.data.push(doc);
          this._addToIndex(doc, index);
          inserted.push(doc);
        }

        await this.saveDataAsync();
        await this.saveIndexesAsync();

        this.emit('insertMany', inserted);
        this.db?.emit('insertMany', { collection: this.name, documents: inserted });
        return inserted;
      } catch (err) {
        console.log(err.message);
        this.emit('error', err);
        this.db?.emit('error', err);
        return [];
      }
    });
  }

  // ==================== FIND ====================

  find(query = {}) {
    return new QueryBuilder(this.data, query, this);
  }

  findOne(query = {}) {
    // Fast path using index for simple equality
    const keys = Object.keys(query || {});
    if (keys.length === 1) {
      const field = keys[0];
      const value = query[field];

      if (this.indexes[field] && (typeof value !== 'object' || value === null)) {
        const key = String(value);
        const idx = this.indexes[field][key];

        if (typeof idx === 'number') {
          return this.data[idx] || null;
        }
        if (Array.isArray(idx) && idx.length > 0) {
          return this.data[idx[0]] || null;
        }
        return null;
      }
    }

    const results = this.find(query).toArray();
    return results[0] || null;
  }

  async findAsync(query = {}) {
    return this.find(query);
  }

  async findOneAsync(query = {}) {
    return this.findOne(query);
  }

  // ==================== UPDATE ====================

  updateOne(filter, update) {
    try {
      const index = this.data.findIndex(doc => this.matchesFilter(doc, filter));
      if (index === -1) return null;

      const oldDoc = this.data[index];
      const updatedDoc = { ...oldDoc };
      this.applyUpdate(updatedDoc, update);

      this._removeFromIndex(oldDoc, index);
      this.data[index] = updatedDoc;
      this._addToIndex(updatedDoc, index);

      this.saveData();
      this.saveIndexes();

      this.emit('update', updatedDoc);
      this.db?.emit('update', { collection: this.name, document: updatedDoc });
      return updatedDoc;
    } catch (err) {
      console.log(err.message);
      this.emit('error', err);
      this.db?.emit('error', err);
      return null;
    }
  }

  async updateOneAsync(filter, update) {
    return this._withLock(async () => {
      try {
        const index = this.data.findIndex(doc => this.matchesFilter(doc, filter));
        if (index === -1) return null;

        const oldDoc = this.data[index];
        const updatedDoc = { ...oldDoc };
        this.applyUpdate(updatedDoc, update);

        this._removeFromIndex(oldDoc, index);
        this.data[index] = updatedDoc;
        this._addToIndex(updatedDoc, index);

        await this.saveDataAsync();
        await this.saveIndexesAsync();

        this.emit('update', updatedDoc);
        this.db?.emit('update', { collection: this.name, document: updatedDoc });
        return updatedDoc;
      } catch (err) {
        console.log(err.message);
        this.emit('error', err);
        this.db?.emit('error', err);
        return null;
      }
    });
  }

  updateMany(filter, update) {
    try {
      const results = [];

      this.data.forEach((doc, index) => {
        if (this.matchesFilter(doc, filter)) {
          const oldDoc = { ...doc };
          const updatedDoc = { ...doc };
          this.applyUpdate(updatedDoc, update);

          this._removeFromIndex(oldDoc, index);
          this.data[index] = updatedDoc;
          this._addToIndex(updatedDoc, index);

          results.push(updatedDoc);
        }
      });

      if (results.length > 0) {
        this.saveData();
        this.saveIndexes();
      }

      this.emit('updateMany', results);
      this.db?.emit('updateMany', { collection: this.name, documents: results });
      return results;
    } catch (err) {
      console.log(err.message);
      this.emit('error', err);
      this.db?.emit('error', err);
      return [];
    }
  }

  async updateManyAsync(filter, update) {
    return this._withLock(async () => {
      try {
        const results = [];

        for (let i = 0; i < this.data.length; i++) {
          if (this.matchesFilter(this.data[i], filter)) {
            const oldDoc = { ...this.data[i] };
            const updatedDoc = { ...this.data[i] };
            this.applyUpdate(updatedDoc, update);

            this._removeFromIndex(oldDoc, i);
            this.data[i] = updatedDoc;
            this._addToIndex(updatedDoc, i);

            results.push(updatedDoc);
          }
        }

        if (results.length > 0) {
          await this.saveDataAsync();
          await this.saveIndexesAsync();
        }

        this.emit('updateMany', results);
        this.db?.emit('updateMany', { collection: this.name, documents: results });
        return results;
      } catch (err) {
        console.log(err.message);
        this.emit('error', err);
        this.db?.emit('error', err);
        return [];
      }
    });
  }

  // ==================== DELETE ====================

  deleteOne(filter) {
    try {
      const index = this.data.findIndex(doc => this.matchesFilter(doc, filter));
      if (index === -1) return null;

      const deleted = this.data[index];
      this.data.splice(index, 1);
      this.rebuildIndexes(); // safest after splice

      this.saveData();

      this.emit('delete', deleted);
      this.db?.emit('delete', { collection: this.name, document: deleted });
      return deleted;
    } catch (err) {
      console.log(err.message);
      this.emit('error', err);
      this.db?.emit('error', err);
      return null;
    }
  }

  async deleteOneAsync(filter) {
    return this._withLock(async () => {
      try {
        const index = this.data.findIndex(doc => this.matchesFilter(doc, filter));
        if (index === -1) return null;

        const deleted = this.data[index];
        this.data.splice(index, 1);
        this.rebuildIndexes();

        await this.saveDataAsync();

        this.emit('delete', deleted);
        this.db?.emit('delete', { collection: this.name, document: deleted });
        return deleted;
      } catch (err) {
        console.log(err.message);
        this.emit('error', err);
        this.db?.emit('error', err);
        return null;
      }
    });
  }

  deleteMany(filter) {
    try {
      const deleted = [];
      const remaining = [];

      for (const doc of this.data) {
        if (this.matchesFilter(doc, filter)) {
          deleted.push(doc);
        } else {
          remaining.push(doc);
        }
      }

      this.data = remaining;
      this.rebuildIndexes();

      this.saveData();

      this.emit('deleteMany', deleted);
      this.db?.emit('deleteMany', { collection: this.name, documents: deleted });
      return deleted;
    } catch (err) {
      console.log(err.message);
      this.emit('error', err);
      this.db?.emit('error', err);
      return [];
    }
  }

  async deleteManyAsync(filter) {
    return this._withLock(async () => {
      try {
        const deleted = [];
        const remaining = [];

        for (const doc of this.data) {
          if (this.matchesFilter(doc, filter)) {
            deleted.push(doc);
          } else {
            remaining.push(doc);
          }
        }

        this.data = remaining;
        this.rebuildIndexes();

        await this.saveDataAsync();

        this.emit('deleteMany', deleted);
        this.db?.emit('deleteMany', { collection: this.name, documents: deleted });
        return deleted;
      } catch (err) {
        console.log(err.message);
        this.emit('error', err);
        this.db?.emit('error', err);
        return [];
      }
    });
  }

  // ==================== IMPORT ====================

  import(filePath, options = {}) {
    try {
      if (!fs.existsSync(filePath)) {
        console.log('Import file not found');
        return false;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const docs = JSON.parse(content);

      if (!Array.isArray(docs)) {
        console.log('Import file must contain an array of documents');
        return false;
      }

      if (options.clear === true) {
        this.data = [];
        this.indexes = {};
        this._idCounter = 1;
      }

      for (const raw of docs) {
        const doc = { ...raw };
        if (this.autoId && this.getNestedValue(doc, this.idField) === undefined) {
          this.setNestedValue(doc, this.idField, this.generateId());
        }
        const index = this.data.length;
        this.data.push(doc);
        this._addToIndex(doc, index);
      }

      this.saveData();
      this.saveIndexes();

      this.emit('import', { collection: this.name, count: docs.length });
      this.db?.emit('import', { collection: this.name, count: docs.length });
      return true;
    } catch (err) {
      console.log(err.message);
      this.emit('error', err);
      this.db?.emit('error', err);
      return false;
    }
  }

  async importAsync(filePath, options = {}) {
    return this._withLock(async () => {
      try {
        await fsp.access(filePath);
        const content = await fsp.readFile(filePath, 'utf8');
        const docs = JSON.parse(content);

        if (!Array.isArray(docs)) {
          console.log('Import file must contain an array of documents');
          return false;
        }

        if (options.clear === true) {
          this.data = [];
          this.indexes = {};
          this._idCounter = 1;
        }

        for (const raw of docs) {
          const doc = { ...raw };
          if (this.autoId && this.getNestedValue(doc, this.idField) === undefined) {
            this.setNestedValue(doc, this.idField, this.generateId());
          }
          const index = this.data.length;
          this.data.push(doc);
          this._addToIndex(doc, index);
        }

        await this.saveDataAsync();
        await this.saveIndexesAsync();

        this.emit('import', { collection: this.name, count: docs.length });
        this.db?.emit('import', { collection: this.name, count: docs.length });
        return true;
      } catch (err) {
        console.log(err.message);
        this.emit('error', err);
        this.db?.emit('error', err);
        return false;
      }
    });
  }

  // ==================== TRANSACTIONS ====================

  startTransaction() {
    return new Transaction(this);
  }

  // ==================== AGGREGATION (basic) ====================

  aggregate(pipeline = []) {
    let result = [...this.data];

    for (const stage of pipeline) {
      if (stage.$match) {
        result = result.filter(doc => this.matchesFilter(doc, stage.$match));
      }

      if (stage.$project) {
        result = result.map(doc => {
          const projected = {};
          for (const [key, val] of Object.entries(stage.$project)) {
            if (val === 1) {
              projected[key] = this.getNestedValue(doc, key);
            } else if (typeof val === 'string' && val.startsWith('$')) {
              projected[key] = this.getNestedValue(doc, val.slice(1));
            }
          }
          return projected;
        });
      }

      if (stage.$group) {
        const groups = {};
        for (const doc of result) {
          const idVal = stage.$group._id === null
            ? null
            : this.getNestedValue(doc, String(stage.$group._id).replace(/^\$/, ''));

          const groupKey = idVal === null || idVal === undefined ? 'null' : String(idVal);

          if (!groups[groupKey]) {
            groups[groupKey] = { _id: idVal };
          }

          for (const [key, expr] of Object.entries(stage.$group)) {
            if (key === '_id') continue;

            if (expr.$sum !== undefined) {
              const v = expr.$sum === 1 ? 1 : (this.getNestedValue(doc, String(expr.$sum).replace(/^\$/, '')) || 0);
              groups[groupKey][key] = (groups[groupKey][key] || 0) + v;
            }
            if (expr.$avg !== undefined) {
              const field = String(expr.$avg).replace(/^\$/, '');
              const v = this.getNestedValue(doc, field) || 0;
              if (!groups[groupKey][`__${key}_sum`]) {
                groups[groupKey][`__${key}_sum`] = 0;
                groups[groupKey][`__${key}_count`] = 0;
              }
              groups[groupKey][`__${key}_sum`] += v;
              groups[groupKey][`__${key}_count`] += 1;
              groups[groupKey][key] = groups[groupKey][`__${key}_sum`] / groups[groupKey][`__${key}_count`];
            }
            if (expr.$max !== undefined) {
              const v = this.getNestedValue(doc, String(expr.$max).replace(/^\$/, ''));
              if (groups[groupKey][key] === undefined || v > groups[groupKey][key]) {
                groups[groupKey][key] = v;
              }
            }
            if (expr.$min !== undefined) {
              const v = this.getNestedValue(doc, String(expr.$min).replace(/^\$/, ''));
              if (groups[groupKey][key] === undefined || v < groups[groupKey][key]) {
                groups[groupKey][key] = v;
              }
            }
            if (expr.$push !== undefined) {
              if (!groups[groupKey][key]) groups[groupKey][key] = [];
              groups[groupKey][key].push(this.getNestedValue(doc, String(expr.$push).replace(/^\$/, '')));
            }
          }
        }

        // Clean temporary avg fields
        result = Object.values(groups).map(g => {
          const clean = { ...g };
          Object.keys(clean).forEach(k => {
            if (k.startsWith('__')) delete clean[k];
          });
          return clean;
        });
      }

      if (stage.$sort) {
        result.sort((a, b) => {
          for (const [key, order] of Object.entries(stage.$sort)) {
            const aVal = this.getNestedValue(a, key);
            const bVal = this.getNestedValue(b, key);
            if (aVal < bVal) return order === 1 ? -1 : 1;
            if (aVal > bVal) return order === 1 ? 1 : -1;
          }
          return 0;
        });
      }

      if (stage.$limit) {
        result = result.slice(0, stage.$limit);
      }

      if (stage.$skip) {
        result = result.slice(stage.$skip);
      }
    }

    return result;
  }
}

// ==================== QUERY BUILDER ====================

class QueryBuilder {
  constructor(data, query, collection) {
    this.data = data;
    this.query = query || {};
    this.collection = collection;
    this._limit = null;
    this._skip = 0;
    this._sort = null;
    this._project = null;
  }

  limit(n) {
    this._limit = n;
    return this;
  }

  skip(n) {
    this._skip = n;
    return this;
  }

  sort(obj) {
    this._sort = obj;
    return this;
  }

  project(obj) {
    this._project = obj;
    return this;
  }

  toArray() {
    let results = this.data.filter(doc => this.collection.matchesFilter(doc, this.query));

    if (this._sort) {
      results.sort((a, b) => {
        for (const [key, order] of Object.entries(this._sort)) {
          const aVal = this.collection.getNestedValue(a, key);
          const bVal = this.collection.getNestedValue(b, key);
          if (aVal < bVal) return order === 1 ? -1 : 1;
          if (aVal > bVal) return order === 1 ? 1 : -1;
        }
        return 0;
      });
    }

    if (this._skip) {
      results = results.slice(this._skip);
    }

    if (this._limit !== null) {
      results = results.slice(0, this._limit);
    }

    if (this._project) {
      results = results.map(doc => {
        const projected = {};
        for (const [key, val] of Object.entries(this._project)) {
          if (val === 1) {
            projected[key] = this.collection.getNestedValue(doc, key);
          }
        }
        // Always include _id unless explicitly excluded
        if (this._project._id !== 0 && doc._id !== undefined) {
          projected._id = doc._id;
        }
        return projected;
      });
    }

    return results;
  }

  first() {
    const arr = this.toArray();
    return arr[0] || null;
  }

  count() {
    return this.data.filter(doc => this.collection.matchesFilter(doc, this.query)).length;
  }
}

// ==================== TRANSACTION ====================

class Transaction {
  constructor(collection) {
    this.collection = collection;
    this.snapshotData = JSON.parse(JSON.stringify(collection.data));
    this.snapshotIndexes = JSON.parse(JSON.stringify(collection.indexes));
    this.snapshotIdCounter = collection._idCounter;
    this.active = true;
  }

  insert(doc) {
    if (!this.active) throw new Error('Transaction is not active');
    return this.collection.insert(doc);
  }

  insertAsync(doc) {
    if (!this.active) throw new Error('Transaction is not active');
    return this.collection.insertAsync(doc);
  }

  insertMany(docs) {
    if (!this.active) throw new Error('Transaction is not active');
    return this.collection.insertMany(docs);
  }

  insertManyAsync(docs) {
    if (!this.active) throw new Error('Transaction is not active');
    return this.collection.insertManyAsync(docs);
  }

  updateOne(filter, update) {
    if (!this.active) throw new Error('Transaction is not active');
    return this.collection.updateOne(filter, update);
  }

  updateOneAsync(filter, update) {
    if (!this.active) throw new Error('Transaction is not active');
    return this.collection.updateOneAsync(filter, update);
  }

  updateMany(filter, update) {
    if (!this.active) throw new Error('Transaction is not active');
    return this.collection.updateMany(filter, update);
  }

  updateManyAsync(filter, update) {
    if (!this.active) throw new Error('Transaction is not active');
    return this.collection.updateManyAsync(filter, update);
  }

  deleteOne(filter) {
    if (!this.active) throw new Error('Transaction is not active');
    return this.collection.deleteOne(filter);
  }

  deleteOneAsync(filter) {
    if (!this.active) throw new Error('Transaction is not active');
    return this.collection.deleteOneAsync(filter);
  }

  deleteMany(filter) {
    if (!this.active) throw new Error('Transaction is not active');
    return this.collection.deleteMany(filter);
  }

  deleteManyAsync(filter) {
    if (!this.active) throw new Error('Transaction is not active');
    return this.collection.deleteManyAsync(filter);
  }

  async commit() {
    if (!this.active) return false;

    try {
      await this.collection.saveDataAsync();
      await this.collection.saveIndexesAsync();
      this.active = false;
      this.collection.emit('transactionCommit', { collection: this.collection.name });
      this.collection.db?.emit('transactionCommit', { collection: this.collection.name });
      return true;
    } catch (err) {
      console.log(err.message);
      this.collection.emit('error', err);
      await this.rollback();
      return false;
    }
  }

  async rollback() {
    if (!this.active) return false;

    this.collection.data = this.snapshotData;
    this.collection.indexes = this.snapshotIndexes;
    this.collection._idCounter = this.snapshotIdCounter;

    this.active = false;
    this.collection.emit('transactionRollback', { collection: this.collection.name });
    this.collection.db?.emit('transactionRollback', { collection: this.collection.name });
    return true;
  }
}

// ==================== EXPORT ====================

module.exports = { JSONDB, Collection, QueryBuilder, Transaction };
