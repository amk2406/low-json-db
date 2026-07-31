const fs = require('fs');
const path = require('path');

class JSONDB {
  constructor(dbPath = './database') {
    this.dbPath = dbPath;
    this.collections = {};
    this.currentCollection = null;
    this.query = null;
   
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath, { recursive: true });
    }
  }

  // Collection operations
  collection(name) {
    let nam
    if (!this.collections[name]) {
      nam = new Collection(name, this.dbPath);
      this.collections[name] = nam
    }
    this.currentCollection = this.collections[name];
    return nam
  }

  createCollection(name) {
    return this.collection(name);
  }

  listCollections() {
    const files = fs.readdirSync(this.dbPath);
    return files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
  }

  dropCollection(name) {
    const filePath = path.join(this.dbPath, `${name}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      delete this.collections[name];
      return true;
    }
    return false;
  }
}

class Collection {
  constructor(name, dbPath) {
    this.name = name;
    this.dbPath = dbPath;
    this.filePath = path.join(dbPath, `${name}.json`);
    this.data = this.loadData();
    this._idCounter = this.getNextId();
  }

  loadData() {
    if (fs.existsSync(this.filePath)) {
      try {
        const content = fs.readFileSync(this.filePath, 'utf8');
        return JSON.parse(content);
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  saveData() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  getNextId() {
    if (this.data.length === 0) return 1;
    const maxId = Math.max(...this.data.map(doc => doc._id || 0));
    return maxId + 1;
  }

  generateId() {
    return this._idCounter++;
  }

  // Insert operations
  insert(document) {
    const doc = { ...document, _id: this.generateId() };
    this.data.push(doc);
    this.saveData();
    return doc;
  }

  insertMany(documents) {
    const inserted = documents.map(doc => ({
      ...doc,
      _id: this.generateId()
    }));
    this.data.push(...inserted);
    this.saveData();
    return inserted;
  }

  // Query builder
  find(query = {}) {
    this.query = new QueryBuilder(this.data, query);
    return this.query;
  }

  findOne(query = {}) {
    const results = this.find(query).toArray();
    return results[0] || null;
  }

  // Update operations
  updateOne(filter, update) {
    const index = this.data.findIndex(doc => this.matchesFilter(doc, filter));
    if (index === -1) return null;

    const updatedDoc = { ...this.data[index] };
   
    // Handle $set
    if (update.$set) {
      Object.assign(updatedDoc, update.$set);
    }
   
    // Handle $inc
    if (update.$inc) {
      Object.entries(update.$inc).forEach(([key, value]) => {
        updatedDoc[key] = (updatedDoc[key] || 0) + value;
      });
    }
   
    // Handle $push
    if (update.$push) {
      Object.entries(update.$push).forEach(([key, value]) => {
        if (!updatedDoc[key]) updatedDoc[key] = [];
        updatedDoc[key].push(value);
      });
    }
   
    // Handle $pull
    if (update.$pull) {
      Object.entries(update.$pull).forEach(([key, value]) => {
        if (updatedDoc[key] && Array.isArray(updatedDoc[key])) {
          updatedDoc[key] = updatedDoc[key].filter(item =>
            JSON.stringify(item) !== JSON.stringify(value)
          );
        }
      });
    }

    // Handle $unset
    if (update.$unset) {
      Object.keys(update.$unset).forEach(key => {
        delete updatedDoc[key];
      });
    }

    this.data[index] = updatedDoc;
    this.saveData();
    return updatedDoc;
  }

  updateMany(filter, update) {
    const results = [];
    this.data.forEach((doc, index) => {
      if (this.matchesFilter(doc, filter)) {
        const updatedDoc = { ...doc };
       
        if (update.$set) {
          Object.assign(updatedDoc, update.$set);
        }
        if (update.$inc) {
          Object.entries(update.$inc).forEach(([key, value]) => {
            updatedDoc[key] = (updatedDoc[key] || 0) + value;
          });
        }
        if (update.$push) {
          Object.entries(update.$push).forEach(([key, value]) => {
            if (!updatedDoc[key]) updatedDoc[key] = [];
            updatedDoc[key].push(value);
          });
        }
        if (update.$pull) {
          Object.entries(update.$pull).forEach(([key, value]) => {
            if (updatedDoc[key] && Array.isArray(updatedDoc[key])) {
              updatedDoc[key] = updatedDoc[key].filter(item =>
                JSON.stringify(item) !== JSON.stringify(value)
              );
            }
          });
        }
        if (update.$unset) {
          Object.keys(update.$unset).forEach(key => {
            delete updatedDoc[key];
          });
        }

        this.data[index] = updatedDoc;
        results.push(updatedDoc);
      }
    });
    this.saveData();
    return results;
  }

  // Delete operations
  deleteOne(filter) {
    const index = this.data.findIndex(doc => this.matchesFilter(doc, filter));
    if (index === -1) return null;
   
    const deleted = this.data.splice(index, 1)[0];
    this.saveData();
    return deleted;
  }

  deleteMany(filter) {
    const deleted = [];
    const remaining = this.data.filter(doc => {
      if (this.matchesFilter(doc, filter)) {
        deleted.push(doc);
        return false;
      }
      return true;
    });
    this.data = remaining;
    this.saveData();
    return deleted;
  }

  // Helper to match filters
  matchesFilter(doc, filter) {
    if (!filter || Object.keys(filter).length === 0) return true;
   
    return Object.entries(filter).every(([key, value]) => {
      if (key === '$or') {
        return value.some(condition => this.matchesFilter(doc, condition));
      }
      if (key === '$and') {
        return value.every(condition => this.matchesFilter(doc, condition));
      }
      if (key === '$nor') {
        return !value.some(condition => this.matchesFilter(doc, condition));
      }
     
      // Handle nested paths
      const keys = key.split('.');
      let current = doc;
      for (const k of keys) {
        if (current === undefined || current === null) return false;
        current = current[k];
      }
     
      // Handle operators
      if (typeof value === 'object' && value !== null) {
        if (value.$eq !== undefined) return current === value.$eq;
        if (value.$ne !== undefined) return current !== value.$ne;
        if (value.$gt !== undefined) return current > value.$gt;
        if (value.$gte !== undefined) return current >= value.$gte;
        if (value.$lt !== undefined) return current < value.$lt;
        if (value.$lte !== undefined) return current <= value.$lte;
        if (value.$in !== undefined) return Array.isArray(value.$in) && value.$in.includes(current);
        if (value.$nin !== undefined) return Array.isArray(value.$nin) && !value.$nin.includes(current);
        if (value.$exists !== undefined) return (current !== undefined) === value.$exists;
        if (value.$regex !== undefined) {
          const regex = new RegExp(value.$regex, value.$options || '');
          return regex.test(current);
        }
        if (value.$type !== undefined) {
          const types = {
            'string': 'string',
            'number': 'number',
            'boolean': 'boolean',
            'array': 'object',
            'object': 'object',
            'null': 'object'
          };
          return typeof current === types[value.$type] ||
                 (value.$type === 'null' && current === null);
        }
        if (value.$size !== undefined) {
          return Array.isArray(current) && current.length === value.$size;
        }
        if (value.$elemMatch !== undefined) {
          if (!Array.isArray(current)) return false;
          return current.some(item => this.matchesFilter(item, value.$elemMatch));
        }
      }
     
      // Direct equality
      return current === value;
    });
  }

  // Aggregation
  aggregate(pipeline) {
    let result = [...this.data];
   
    pipeline.forEach(stage => {
      if (stage.$match) {
        result = result.filter(doc => this.matchesFilter(doc, stage.$match));
      }
      if (stage.$project) {
        result = result.map(doc => {
          const projected = {};
          Object.entries(stage.$project).forEach(([key, value]) => {
            if (value === 1) {
              projected[key] = doc[key];
            } else if (value === 0) {
              // Exclude field
            } else if (typeof value === 'string') {
              projected[key] = this.getValueByPath(doc, value);
            }
          });
          return projected;
        });
      }
      if (stage.$group) {
        const groups = {};
        result.forEach(doc => {
          const id = this.getValueByPath(doc, stage.$group._id);
          if (!groups[id]) {
            groups[id] = { _id: id };
          }
          Object.entries(stage.$group).forEach(([key, value]) => {
            if (key === '_id') return;
            if (value.$sum) {
              groups[id][key] = (groups[id][key] || 0) +
                (this.getValueByPath(doc, value.$sum) || 0);
            }
            if (value.$avg) {
              groups[id][`_${key}_count`] = (groups[id][`_${key}_count`] || 0) + 1;
              groups[id][`_${key}_sum`] = (groups[id][`_${key}_sum`] || 0) +
                (this.getValueByPath(doc, value.$avg) || 0);
            }
            if (value.$max) {
              const val = this.getValueByPath(doc, value.$max);
              if (groups[id][key] === undefined || val > groups[id][key]) {
                groups[id][key] = val;
              }
            }
            if (value.$min) {
              const val = this.getValueByPath(doc, value.$min);
              if (groups[id][key] === undefined || val < groups[id][key]) {
                groups[id][key] = val;
              }
            }
            if (value.$push) {
              if (!groups[id][key]) groups[id][key] = [];
              groups[id][key].push(this.getValueByPath(doc, value.$push));
            }
          });
        });
        // Calculate averages
        Object.values(groups).forEach(group => {
          Object.keys(group).forEach(key => {
            if (key.startsWith('_') && key.endsWith('_count')) {
              const baseKey = key.slice(1, -6);
              if (group[`_${baseKey}_sum`] !== undefined) {
                group[baseKey] = group[`_${baseKey}_sum`] / group[key];
                delete group[`_${baseKey}_sum`];
                delete group[key];
              }
            }
          });
        });
        result = Object.values(groups);
      }
      if (stage.$sort) {
        result.sort((a, b) => {
          for (const [key, order] of Object.entries(stage.$sort)) {
            const aVal = this.getValueByPath(a, key);
            const bVal = this.getValueByPath(b, key);
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
      if (stage.$unwind) {
        const newResult = [];
        result.forEach(doc => {
          const array = this.getValueByPath(doc, stage.$unwind);
          if (Array.isArray(array)) {
            array.forEach(item => {
              const newDoc = { ...doc };
              this.setValueByPath(newDoc, stage.$unwind, item);
              newResult.push(newDoc);
            });
          }
        });
        result = newResult;
      }
    });
   
    return result;
  }

  getValueByPath(obj, path) {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
      if (current === undefined || current === null) return undefined;
      current = current[key];
    }
    return current;
  }

  setValueByPath(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }
}

class QueryBuilder {
  constructor(data, query) {
    this.data = data;
    this.query = query;
    this._limit = null;
    this._skip = null;
    this._sort = null;
    this._projection = null;
  }

  limit(n) {
    this._limit = n;
    return this;
  }

  skip(n) {
    this._skip = n;
    return this;
  }

  sort(sortObj) {
    this._sort = sortObj;
    return this;
  }

  project(projection) {
    this._projection = projection;
    return this;
  }

  toArray() {
    let result = [...this.data];
   
    // Apply query filter
    if (this.query && Object.keys(this.query).length > 0) {
      result = result.filter(doc => this.matchesFilter(doc, this.query));
    }
   
    // Apply sort
    if (this._sort) {
      result.sort((a, b) => {
        for (const [key, order] of Object.entries(this._sort)) {
          const aVal = this.getNestedValue(a, key);
          const bVal = this.getNestedValue(b, key);
          if (aVal < bVal) return order === 1 ? -1 : 1;
          if (aVal > bVal) return order === 1 ? 1 : -1;
        }
        return 0;
      });
    }
   
    // Apply skip
    if (this._skip) {
      result = result.slice(this._skip);
    }
   
    // Apply limit
    if (this._limit) {
      result = result.slice(0, this._limit);
    }
   
    // Apply projection
    if (this._projection) {
      result = result.map(doc => {
        const projected = {};
        const includeFields = Object.entries(this._projection)
          .filter(([_, value]) => value === 1)
          .map(([key]) => key);
       
        if (includeFields.length > 0) {
          includeFields.forEach(key => {
            projected[key] = this.getNestedValue(doc, key);
          });
        } else {
          const excludeFields = Object.entries(this._projection)
            .filter(([_, value]) => value === 0)
            .map(([key]) => key);
         
          Object.keys(doc).forEach(key => {
            if (!excludeFields.includes(key)) {
              projected[key] = doc[key];
            }
          });
        }
        return projected;
      });
    }
   
    return result;
  }

  first() {
    const results = this.toArray();
    return results.length > 0 ? results[0] : null;
  }

  count() {
    return this.toArray().length;
  }

  // Helper methods
  matchesFilter(doc, filter) {
    if (!filter || Object.keys(filter).length === 0) return true;
   
    return Object.entries(filter).every(([key, value]) => {
      if (key === '$or') {
        return value.some(condition => this.matchesFilter(doc, condition));
      }
      if (key === '$and') {
        return value.every(condition => this.matchesFilter(doc, condition));
      }
      if (key === '$nor') {
        return !value.some(condition => this.matchesFilter(doc, condition));
      }
     
      const docValue = this.getNestedValue(doc, key);
     
      if (typeof value === 'object' && value !== null) {
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
          const regex = new RegExp(value.$regex, value.$options || '');
          return regex.test(docValue);
        }
        if (value.$type !== undefined) {
          const types = {
            'string': 'string',
            'number': 'number',
            'boolean': 'boolean',
            'array': 'object',
            'object': 'object',
            'null': 'object'
          };
          return typeof docValue === types[value.$type] ||
                 (value.$type === 'null' && docValue === null);
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

  getNestedValue(obj, path) {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
      if (current === undefined || current === null) return undefined;
      current = current[key];
    }
    return current;
  }
}

// Export the main class
module.exports = { JSONDB };