# JSONDB

A lightweight, zero-dependency, file-based document database for Node.js.  
It stores each collection as a plain JSON file and offers a familiar MongoDB-style API.

---

## Table of Contents

1. [Installation & Setup](#1-installation--setup)
2. [Creating a Database](#2-creating-a-database)
3. [Working with Collections](#3-working-with-collections)
4. [Inserting Documents](#4-inserting-documents)
5. [Querying Documents](#5-querying-documents)
6. [Query Builder Methods](#6-query-builder-methods)
7. [Update Operations](#7-update-operations)
8. [Delete Operations](#8-delete-operations)
9. [Aggregation Pipeline](#9-aggregation-pipeline)
10. [Supported Query Operators](#10-supported-query-operators)
11. [Supported Update Operators](#11-supported-update-operators)
12. [Complete Example](#12-complete-example)
13. [API Reference](#13-api-reference)
14. [Limitations & Notes](#14-limitations--notes)

---

## 1. Installation & Setup

JSONDB is a single file. Just copy `db.js` into your project.
OR
```bash
# Install via CLI
npm i low-json-db
```

```bash
# Project structure example
my-app/
├── db.js          ← the library
├── index.js       ← your code
└── data/          ← will be created automatically
```

Require it like any other module:

```js
const JSONDB = require('./db');   // or the correct relative path
```

No npm install needed. It only uses Node.js built-in modules (`fs` and `path`).

---

## 2. Creating a Database

```js
const JSONDB = require('./db');

// Create (or open) a database in the folder "./data"
const db = new JSONDB('./data');

// You can choose any path
const db2 = new JSONDB('./my-database');
const db3 = new JSONDB('/absolute/path/to/db');
```

- If the folder does not exist, it is created automatically.
- Each collection becomes a separate `.json` file inside that folder.

---

## 3. Working with Collections

### Get or create a collection

```js
const users = db.collection('users');
// or
const products = db.createCollection('products'); // same thing
```

### List all collections

```js
const names = db.listCollections();
console.log(names); // ['users', 'products', ...]
```

### Drop (delete) a collection

```js
db.dropCollection('users'); // returns true if it existed, false otherwise
```

---

## 4. Inserting Documents

Every document automatically receives a unique numeric `_id`.

### Insert one document

```js
const user = users.insert({
  name: 'Alice',
  age: 28,
  email: 'alice@example.com',
  tags: ['admin', 'developer']
});

console.log(user);
// {
//   name: 'Alice',
//   age: 28,
//   email: 'alice@example.com',
//   tags: ['admin', 'developer'],
//   _id: 1
// }
```

### Insert many documents

```js
const inserted = users.insertMany([
  { name: 'Bob', age: 34, city: 'Lagos' },
  { name: 'Carol', age: 22, city: 'Abuja' },
  { name: 'David', age: 41, city: 'Lagos' }
]);

console.log(inserted.length); // 3
```

---

## 5. Querying Documents

### Find many documents

```js
// All documents
const all = users.find().toArray();

// With a filter
const adults = users.find({ age: { $gte: 18 } }).toArray();

// Multiple conditions (AND)
const result = users.find({
  city: 'Lagos',
  age: { $gt: 30 }
}).toArray();
```

### Find one document

```js
const alice = users.findOne({ name: 'Alice' });
// returns the document or null
```

### Nested fields

```js
// Documents that look like: { profile: { city: 'Lagos' } }
users.find({ 'profile.city': 'Lagos' }).toArray();
```

---

## 6. Query Builder Methods

`find()` returns a **QueryBuilder**. You can chain methods:

### limit

```js
users.find().limit(5).toArray();          // first 5 documents
```

### skip (pagination)

```js
users.find().skip(10).limit(10).toArray(); // page 2 (items 11-20)
```

### sort

```js
// Ascending
users.find().sort({ age: 1 }).toArray();

// Descending
users.find().sort({ age: -1 }).toArray();

// Multiple fields
users.find().sort({ city: 1, age: -1 }).toArray();
```

### project (select / exclude fields)

```js
// Include only certain fields
users.find()
  .project({ name: 1, age: 1, _id: 1 })
  .toArray();

// Exclude fields
users.find()
  .project({ password: 0, secret: 0 })
  .toArray();
```

### first

```js
const youngest = users.find().sort({ age: 1 }).first();
```

### count

```js
const total = users.find({ city: 'Lagos' }).count();
```

### Full chaining example

```js
const page = users
  .find({ age: { $gte: 25 } })
  .sort({ name: 1 })
  .skip(0)
  .limit(10)
  .project({ name: 1, age: 1, city: 1 })
  .toArray();
```

---

## 7. Update Operations

### updateOne

Updates the **first** matching document and returns the updated document (or `null`).

```js
const updated = users.updateOne(
  { name: 'Alice' },
  { $set: { age: 29, city: 'Port Harcourt' } }
);
```

### updateMany

Updates **all** matching documents and returns an array of the updated ones.

```js
users.updateMany(
  { city: 'Lagos' },
  { $inc: { age: 1 } }          // increase age by 1 for everyone in Lagos
);
```

### Available update operators

| Operator | Description                          | Example                                      |
|----------|--------------------------------------|----------------------------------------------|
| `$set`   | Set field values                     | `{ $set: { age: 30, active: true } }`        |
| `$inc`   | Increment a number                   | `{ $inc: { age: 1, score: 10 } }`            |
| `$push`  | Add item to an array                 | `{ $push: { tags: 'vip' } }`                 |
| `$pull`  | Remove item from an array            | `{ $pull: { tags: 'old' } }`                 |
| `$unset` | Remove a field                       | `{ $unset: { temporary: '' } }`              |

You can combine several operators in one update:

```js
users.updateOne(
  { name: 'Bob' },
  {
    $set: { lastLogin: new Date().toISOString() },
    $inc: { loginCount: 1 },
    $push: { tags: 'active' }
  }
);
```

---

## 8. Delete Operations

### deleteOne

Deletes the first matching document and returns it (or `null`).

```js
const deleted = users.deleteOne({ name: 'David' });
```

### deleteMany

Deletes all matching documents and returns an array of the deleted ones.

```js
const removed = users.deleteMany({ age: { $lt: 18 } });
console.log(`Removed ${removed.length} underage users`);
```

To delete **everything** in a collection:

```js
users.deleteMany({});   // empty filter matches all
```

---

## 9. Aggregation Pipeline

JSONDB supports a subset of the MongoDB aggregation pipeline.

```js
const result = users.aggregate([
  // Stage 1 – filter
  { $match: { age: { $gte: 18 } } },

  // Stage 2 – group
  {
    $group: {
      _id: '$city',                 // group by city
      totalUsers: { $sum: 1 },
      averageAge: { $avg: '$age' },
      maxAge: { $max: '$age' },
      minAge: { $min: '$age' },
      names: { $push: '$name' }
    }
  },

  // Stage 3 – sort
  { $sort: { totalUsers: -1 } },

  // Stage 4 – limit
  { $limit: 5 }
]);
```

### Supported aggregation stages

| Stage      | Purpose                              |
|------------|--------------------------------------|
| `$match`   | Filter documents (same as find)      |
| `$project` | Reshape / select fields              |
| `$group`   | Group documents and compute values   |
| `$sort`    | Sort the results                     |
| `$limit`   | Limit number of results              |
| `$skip`    | Skip documents                       |
| `$unwind`  | Deconstruct an array field           |

### Supported accumulators inside `$group`

- `$sum`
- `$avg`
- `$max`
- `$min`
- `$push`

---

## 10. Supported Query Operators

These operators can be used inside `find()`, `findOne()`, `update*`, `delete*` and `$match`.

| Operator     | Meaning                          | Example                                      |
|--------------|----------------------------------|----------------------------------------------|
| `$eq`        | Equal                            | `{ age: { $eq: 30 } }`                       |
| `$ne`        | Not equal                        | `{ status: { $ne: 'banned' } }`              |
| `$gt`        | Greater than                     | `{ age: { $gt: 18 } }`                       |
| `$gte`       | Greater than or equal            | `{ age: { $gte: 18 } }`                      |
| `$lt`        | Less than                        | `{ price: { $lt: 100 } }`                    |
| `$lte`       | Less than or equal               | `{ price: { $lte: 99.99 } }`                 |
| `$in`        | Value is in array                | `{ city: { $in: ['Lagos', 'Abuja'] } }`      |
| `$nin`       | Value is **not** in array        | `{ role: { $nin: ['guest'] } }`              |
| `$exists`    | Field exists (or not)            | `{ email: { $exists: true } }`               |
| `$regex`     | Regular expression               | `{ name: { $regex: '^A', $options: 'i' } }`  |
| `$type`      | JavaScript type                  | `{ tags: { $type: 'array' } }`               |
| `$size`      | Array length                     | `{ tags: { $size: 3 } }`                     |
| `$elemMatch` | Array element matches condition  | `{ scores: { $elemMatch: { $gt: 90 } } }`    |
| `$or`        | Logical OR                       | `{ $or: [{ age: 20 }, { city: 'Lagos' }] }`  |
| `$and`       | Logical AND                      | `{ $and: [{ age: { $gt: 18 } }, { active: true }] }` |
| `$nor`       | Logical NOR                      | `{ $nor: [{ banned: true }] }`               |

**Simple equality** (no operator) is also supported:

```js
users.find({ name: 'Alice', active: true })
```

---

## 11. Supported Update Operators

| Operator | Action                     | Example                                      |
|----------|----------------------------|----------------------------------------------|
| `$set`   | Set one or more fields     | `{ $set: { age: 31 } }`                      |
| `$inc`   | Increment numeric fields   | `{ $inc: { views: 1 } }`                     |
| `$push`  | Push value into an array   | `{ $push: { tags: 'new' } }`                 |
| `$pull`  | Remove value from array    | `{ $pull: { tags: 'old' } }`                 |
| `$unset` | Delete a field             | `{ $unset: { temp: '' } }`                   |

---

## 12. Complete Example

```js
const JSONDB = require('./db');

// 1. Create database
const db = new JSONDB('./data');

// 2. Get collection
const users = db.collection('users');

// 3. Insert sample data
users.insertMany([
  { name: 'Alice', age: 28, city: 'Lagos', tags: ['admin'], active: true },
  { name: 'Bob',   age: 34, city: 'Abuja', tags: ['user'],  active: true },
  { name: 'Carol', age: 22, city: 'Lagos', tags: ['user'],  active: false },
  { name: 'David', age: 41, city: 'Lagos', tags: ['admin', 'vip'], active: true }
]);

// 4. Simple query
console.log('Adults in Lagos:');
console.log(
  users.find({ city: 'Lagos', age: { $gte: 18 } }).toArray()
);

// 5. Pagination + sorting + projection
console.log('\nPage 1 (sorted by age):');
console.log(
  users
    .find({ active: true })
    .sort({ age: 1 })
    .skip(0)
    .limit(2)
    .project({ name: 1, age: 1, city: 1 })
    .toArray()
);

// 6. Update
users.updateOne(
  { name: 'Alice' },
  {
    $set: { city: 'Port Harcourt' },
    $push: { tags: 'founder' },
    $inc: { age: 1 }
  }
);

// 7. Aggregation
console.log('\nUsers per city:');
console.log(
  users.aggregate([
    { $match: { active: true } },
    {
      $group: {
        _id: '$city',
        count: { $sum: 1 },
        avgAge: { $avg: '$age' }
      }
    },
    { $sort: { count: -1 } }
  ])
);

// 8. Delete inactive users
const deleted = users.deleteMany({ active: false });
console.log(`\nDeleted ${deleted.length} inactive user(s)`);

// 9. List collections
console.log('\nCollections:', db.listCollections());
```

---

## 13. API Reference

### JSONDB

| Method                    | Description                              | Returns                  |
|---------------------------|------------------------------------------|--------------------------|
| `new JSONDB(path)`        | Create / open a database                 | `JSONDB` instance        |
| `collection(name)`        | Get or create a collection               | `Collection`             |
| `createCollection(name)`  | Alias of `collection`                    | `Collection`             |
| `listCollections()`       | List all collection names                | `string[]`               |
| `dropCollection(name)`    | Delete a collection file                 | `boolean`                |

### Collection

| Method                         | Description                              | Returns                  |
|--------------------------------|------------------------------------------|--------------------------|
| `insert(doc)`                  | Insert one document                      | the inserted document    |
| `insertMany(docs)`             | Insert multiple documents                | array of documents       |
| `find(query?)`                 | Start a query                            | `QueryBuilder`           |
| `findOne(query?)`              | Find the first matching document         | document or `null`       |
| `updateOne(filter, update)`    | Update first match                       | updated document or null |
| `updateMany(filter, update)`   | Update all matches                       | array of updated docs    |
| `deleteOne(filter)`            | Delete first match                       | deleted document or null |
| `deleteMany(filter)`           | Delete all matches                       | array of deleted docs    |
| `aggregate(pipeline)`          | Run an aggregation pipeline              | array of results         |

### QueryBuilder

| Method              | Description                              | Returns          |
|---------------------|------------------------------------------|------------------|
| `limit(n)`          | Limit number of results                  | `this`           |
| `skip(n)`           | Skip the first n results                 | `this`           |
| `sort(obj)`         | Sort by fields (`1` = asc, `-1` = desc)  | `this`           |
| `project(obj)`      | Include (`1`) or exclude (`0`) fields    | `this`           |
| `toArray()`         | Execute and return all matching docs     | `array`          |
| `first()`           | Execute and return the first document    | document or null |
| `count()`           | Execute and return the number of matches | `number`         |

---

## 14. Limitations & Notes

- **Synchronous** – All file operations use the synchronous Node.js API. Suitable for small-to-medium apps, scripts, CLI tools and prototypes.
- **No concurrency control** – Do not open the same database from multiple processes at the same time without external locking.
- **In-memory + file** – The whole collection is loaded into memory. Very large collections (hundreds of thousands of documents) may become slow or memory-heavy.
- **IDs** – Simple auto-increment integers. They are unique within a collection but not globally unique across collections.
- **No transactions** – Each write is atomic at the file level, but multi-document transactions are not supported.
- **No indexes** – Every query scans the entire collection.
- **Best for** – Prototypes, local tools, small backends, configuration stores, personal projects, and learning how document databases work.

---

### License

MIT (or whatever license you prefer). Feel free to use, modify and distribute.

Happy coding! 🚀