# low-json-db

> A lightweight, zero-dependency, file-based document database for Node.js.

`low-json-db` is a small document database that stores collections as ordinary JSON files while providing a MongoDB-style API for common database operations.

It is designed for projects that need persistent structured data without setting up a separate database server.

**Current version:** `1.0.2`
**License:** MIT
**Module system:** CommonJS
**Dependencies:** 0

---

## Features

* 📄 File-based JSON storage
* 🪶 Zero runtime dependencies
* 🧩 MongoDB-style document API
* ➕ Insert one or many documents
* 🔎 Query documents with filters
* ✏️ Update one or many documents
* 🗑️ Delete one or many documents
* 🔢 Automatic IDs
* 🆔 Auto-increment, UUID, and ObjectId-style IDs
* 🌳 Nested field access
* ⚡ Synchronous and asynchronous APIs
* 📇 Optional indexes
* 💾 Atomic file replacement
* 🔄 Transactions with commit and rollback
* 📊 Basic aggregation pipeline
* 📥 Import JSON documents
* 💿 Database backups
* 📢 EventEmitter events
* 📦 TypeScript declarations
* 🔧 No database server required

---

## Installation

```bash
npm install low-json-db
```

Or:

```bash
npm i low-json-db
```

The package can also be used by copying `db.js` into your project. TypeScript users can additionally copy `db.d.ts`.

---

## Quick Start

```js
const { JSONDB } = require('low-json-db');

const db = new JSONDB('./data');

const users = db.collection({
  name: 'users',
  autoId: true,
  indexes: ['email']
});

const user = users.insert({
  name: 'Alice',
  email: 'alice@example.com',
  age: 28
});

console.log(user);

const found = users.findOne({
  email: 'alice@example.com'
});

console.log(found);

users.updateOne(
  { name: 'Alice' },
  {
    $set: { age: 29 },
    $push: { tags: 'admin' }
  }
);
```

The database directory is created automatically if it does not already exist.

---

# How Storage Works

Each collection is stored as a separate JSON file.

For example:

```text
data/
├── users.json
├── products.json
├── orders.json
└── users.idx.json
```

The main collection file contains an array of documents:

```json
[
  {
    "_id": 1,
    "name": "Alice",
    "email": "alice@example.com"
  },
  {
    "_id": 2,
    "name": "Bob",
    "email": "bob@example.com"
  }
]
```

When indexes are configured, index information is stored separately in an `.idx.json` file.

Temporary files are used while saving:

```text
users.tmp.json
users.json
users.tmp.idx.json
users.idx.json
```

The implementation writes the new contents to a temporary file and then renames it to the destination file.

---

# Creating a Database

```js
const { JSONDB } = require('low-json-db');

const db = new JSONDB('./data');
```

The constructor accepts an optional database directory.

```js
const db = new JSONDB('./my-database');
```

If the directory doesn't exist, `low-json-db` creates it automatically.

Default:

```js
const db = new JSONDB();
```

This uses:

```text
./database
```

---

# Collections

A collection is a group of documents.

## Create a collection

```js
const users = db.collection('users');
```

You can also configure the collection:

```js
const users = db.collection({
  name: 'users',
  autoId: true,
  indexes: ['email']
});
```

The collection name is required.

---

## `createCollection()`

`createCollection()` is an alias for `collection()`.

```js
const users = db.createCollection('users');
```

Or:

```js
const users = db.createCollection({
  name: 'users',
  autoId: true
});
```

---

# Collection Options

A collection accepts the following options:

```js
{
  name: 'users',
  autoId: true,
  idField: '_id',
  idType: 'auto',
  indexes: ['email'],
  pretty: true,
  lazy: false
}
```

| Option    | Type       | Default  | Description                    |
| --------- | ---------- | -------- | ------------------------------ |
| `name`    | `string`   | required | Collection name                |
| `autoId`  | `boolean`  | `false`  | Automatically generate IDs     |
| `idField` | `string`   | `"_id"`  | Field used for generated IDs   |
| `idType`  | `string`   | `"auto"` | `auto`, `uuid`, or `objectid`  |
| `indexes` | `string[]` | `[]`     | Fields to index                |
| `pretty`  | `boolean`  | `true`   | Pretty-print JSON files        |
| `lazy`    | `boolean`  | `false`  | Collection lazy-loading option |

These options are defined in the TypeScript declarations and implemented by `Collection`.

---

# Automatic IDs

Enable automatic IDs with:

```js
const users = db.collection({
  name: 'users',
  autoId: true
});
```

Then:

```js
users.insert({
  name: 'Alice'
});
```

A document will receive an `_id` automatically.

---

## Auto-increment IDs

```js
const users = db.collection({
  name: 'users',
  autoId: true,
  idType: 'auto'
});
```

Example:

```json
{
  "_id": 1,
  "name": "Alice"
}
```

The next document receives the next numeric ID.

---

## UUID IDs

```js
const users = db.collection({
  name: 'users',
  autoId: true,
  idType: 'uuid'
});
```

IDs are generated using Node.js's `crypto.randomUUID()`.

---

## ObjectId-style IDs

```js
const users = db.collection({
  name: 'users',
  autoId: true,
  idType: 'objectid'
});
```

The implementation creates a hexadecimal timestamp component followed by random bytes.

---

## Custom ID field

You can change the field used for automatic IDs:

```js
const users = db.collection({
  name: 'users',
  autoId: true,
  idField: 'id'
});
```

A document can then look like:

```json
{
  "id": 1,
  "name": "Alice"
}
```

---

# Insert Documents

## Insert one document

```js
const user = users.insert({
  name: 'Alice',
  age: 28
});
```

The inserted document is returned.

---

## Insert many documents

```js
const usersInserted = users.insertMany([
  {
    name: 'Alice',
    age: 28
  },
  {
    name: 'Bob',
    age: 32
  }
]);
```

---

# Async Inserts

Every major write operation also has an asynchronous version.

```js
const user = await users.insertAsync({
  name: 'Alice',
  age: 28
});
```

For multiple documents:

```js
const inserted = await users.insertManyAsync([
  { name: 'Alice' },
  { name: 'Bob' }
]);
```

The async write methods use an internal lock/queue so asynchronous operations on the same collection are serialized.

---

# Find Documents

## Find one

```js
const user = users.findOne({
  name: 'Alice'
});
```

Returns the first matching document or `null`.

---

## Find many

```js
const results = users.find({
  age: 28
}).toArray();
```

---

## First result

```js
const user = users
  .find({ age: 28 })
  .first();
```

---

## Count results

```js
const count = users
  .find({ age: 28 })
  .count();
```

---

# Query Builder

`find()` returns a query builder.

```js
const results = users
  .find({ age: { $gte: 18 } })
  .sort({ age: -1 })
  .skip(10)
  .limit(20)
  .toArray();
```

Available query-builder methods:

```text
limit()
skip()
sort()
project()
toArray()
first()
count()
```

---

# Query Operators

`low-json-db` supports several MongoDB-style query operators.

## Equality

```js
users.find({
  age: 20
}).toArray();
```

---

## `$eq`

```js
users.find({
  age: { $eq: 20 }
}).toArray();
```

## `$ne`

```js
users.find({
  age: { $ne: 20 }
}).toArray();
```

## `$gt`

```js
users.find({
  age: { $gt: 20 }
}).toArray();
```

## `$gte`

```js
users.find({
  age: { $gte: 20 }
}).toArray();
```

## `$lt`

```js
users.find({
  age: { $lt: 20 }
}).toArray();
```

## `$lte`

```js
users.find({
  age: { $lte: 20 }
}).toArray();
```

## `$in`

```js
users.find({
  role: {
    $in: ['admin', 'moderator']
  }
}).toArray();
```

## `$nin`

```js
users.find({
  role: {
    $nin: ['banned', 'deleted']
  }
}).toArray();
```

## `$exists`

```js
users.find({
  email: {
    $exists: true
  }
}).toArray();
```

## `$regex`

```js
users.find({
  name: {
    $regex: '^A',
    $options: 'i'
  }
}).toArray();
```

## `$type`

Supported type names include:

```text
string
number
boolean
array
object
null
```

Example:

```js
users.find({
  age: {
    $type: 'number'
  }
}).toArray();
```

## `$size`

For arrays:

```js
users.find({
  tags: {
    $size: 3
  }
}).toArray();
```

## `$elemMatch`

For arrays containing matching elements:

```js
users.find({
  scores: {
    $elemMatch: {
      value: {
        $gt: 90
      }
    }
  }
}).toArray();
```

These operators are implemented by the collection's filter matcher.

---

# Logical Operators

## `$or`

```js
users.find({
  $or: [
    { role: 'admin' },
    { role: 'moderator' }
  ]
}).toArray();
```

## `$and`

```js
users.find({
  $and: [
    { age: { $gte: 18 } },
    { active: true }
  ]
}).toArray();
```

## `$nor`

```js
users.find({
  $nor: [
    { role: 'banned' },
    { role: 'deleted' }
  ]
}).toArray();
```

---

# Nested Fields

Nested properties can be accessed using dot notation.

Given:

```js
{
  name: 'Alice',
  profile: {
    address: {
      city: 'Abuja'
    }
  }
}
```

You can query:

```js
users.find({
  'profile.address.city': 'Abuja'
}).toArray();
```

Nested fields can also be used with updates and indexes.

---

# Update Documents

## `$set`

```js
users.updateOne(
  { name: 'Alice' },
  {
    $set: {
      age: 29
    }
  }
);
```

---

## `$inc`

Increment a numeric field:

```js
users.updateOne(
  { name: 'Alice' },
  {
    $inc: {
      age: 1
    }
  }
);
```

---

## `$push`

Add an item to an array:

```js
users.updateOne(
  { name: 'Alice' },
  {
    $push: {
      tags: 'admin'
    }
  }
);
```

---

## `$pull`

Remove matching array values:

```js
users.updateOne(
  { name: 'Alice' },
  {
    $pull: {
      tags: 'admin'
    }
  }
);
```

---

## `$unset`

Remove a field:

```js
users.updateOne(
  { name: 'Alice' },
  {
    $unset: {
      temporaryField: true
    }
  }
);
```

The implemented update operators are `$set`, `$inc`, `$push`, `$pull`, and `$unset`.

---

# Update Many

```js
users.updateMany(
  { active: false },
  {
    $set: {
      status: 'inactive'
    }
  }
);
```

Async:

```js
await users.updateManyAsync(
  { active: false },
  {
    $set: {
      status: 'inactive'
    }
  }
);
```

---

# Delete Documents

## Delete one

```js
const deleted = users.deleteOne({
  name: 'Alice'
});
```

## Delete many

```js
const deleted = users.deleteMany({
  active: false
});
```

Async versions are also available:

```js
await users.deleteOneAsync({
  name: 'Alice'
});

await users.deleteManyAsync({
  active: false
});
```

---

# Sorting

Use `sort()` on a query.

Ascending:

```js
const users = collection
  .find({})
  .sort({ age: 1 })
  .toArray();
```

Descending:

```js
const users = collection
  .find({})
  .sort({ age: -1 })
  .toArray();
```

Multiple fields can be supplied:

```js
collection
  .find({})
  .sort({
    age: 1,
    name: 1
  })
  .toArray();
```

---

# Pagination

Use `skip()` and `limit()`.

```js
const page = users
  .find({})
  .skip(20)
  .limit(10)
  .toArray();
```

For example:

```text
Page 1 → skip 0
Page 2 → skip 10
Page 3 → skip 20
```

---

# Projection

Select fields with `project()`:

```js
const results = users
  .find({})
  .project({
    name: 1,
    email: 1
  })
  .toArray();
```

`_id` is included by default when present.

Exclude it with:

```js
const results = users
  .find({})
  .project({
    name: 1,
    email: 1,
    _id: 0
  })
  .toArray();
```

---

# Indexes

Indexes can be configured when creating a collection:

```js
const users = db.collection({
  name: 'users',
  indexes: ['email']
});
```

Multiple indexes:

```js
const users = db.collection({
  name: 'users',
  indexes: [
    'email',
    'username'
  ]
});
```

Index data is stored separately:

```text
data/
├── users.json
└── users.idx.json
```

The implementation maintains index entries as documents are inserted, updated, or deleted. It can also rebuild indexes from the collection data.

Rebuild manually:

```js
users.rebuildIndexes();
```

Indexes are especially useful for simple equality lookups through `findOne()`.

---

# Transactions

Create a transaction:

```js
const tx = users.startTransaction();
```

Perform operations:

```js
tx.insert({
  name: 'Alice'
});

tx.updateOne(
  { name: 'Bob' },
  {
    $set: {
      active: false
    }
  }
);
```

Commit:

```js
await tx.commit();
```

Or roll back:

```js
await tx.rollback();
```

Transactions maintain snapshots of the collection's data, indexes, and ID counter. A rollback restores those snapshots.

### Important

Transactions are implemented as an in-process snapshot/rollback mechanism around a collection. They should not be treated as equivalent to the full transactional guarantees of a server database such as PostgreSQL.

---

# Aggregation

`aggregate()` supports a basic MongoDB-style pipeline.

```js
const result = users.aggregate([
  {
    $match: {
      active: true
    }
  }
]);
```

Supported pipeline stages include:

```text
$match
$project
$group
$sort
$limit
$skip
```

---

## `$match`

```js
users.aggregate([
  {
    $match: {
      age: {
        $gte: 18
      }
    }
  }
]);
```

---

## `$project`

```js
users.aggregate([
  {
    $project: {
      name: 1,
      email: 1
    }
  }
]);
```

Fields can also reference another field:

```js
users.aggregate([
  {
    $project: {
      username: '$name'
    }
  }
]);
```

---

## `$group`

The implementation supports:

```text
$sum
$avg
$max
$min
$push
```

Example:

```js
const result = users.aggregate([
  {
    $group: {
      _id: '$role',
      total: {
        $sum: 1
      }
    }
  }
]);
```

---

## `$sort`

```js
users.aggregate([
  {
    $sort: {
      age: -1
    }
  }
]);
```

---

## `$limit`

```js
users.aggregate([
  {
    $limit: 10
  }
]);
```

---

## `$skip`

```js
users.aggregate([
  {
    $skip: 10
  }
]);
```

Aggregation is intentionally basic and is implemented in memory over the collection data.

---

# Import

Import documents from a JSON file:

```js
users.import('./users.json');
```

The imported file must contain an array:

```json
[
  {
    "name": "Alice"
  },
  {
    "name": "Bob"
  }
]
```

---

## Clear before importing

```js
users.import('./users.json', {
  clear: true
});
```

When `clear` is `true`, the existing collection data is cleared before importing.

Async:

```js
await users.importAsync('./users.json');
```

The implementation validates that the imported JSON is an array of documents.

---

# Backups

Create a full database backup:

```js
const backupPath = db.backup();
```

By default backups are placed under:

```text
./backups
```

You can specify another directory:

```js
const backupPath = db.backup('./my-backups');
```

Async:

```js
const backupPath = await db.backupAsync('./my-backups');
```

A timestamped backup directory is created containing the database JSON files. Temporary files are excluded.

---

# Collections Management

## List collections

```js
const collections = db.listCollections();

console.log(collections);
```

Example:

```js
[
  'users',
  'products',
  'orders'
]
```

---

## Drop a collection

```js
db.dropCollection('users');
```

This removes the collection's JSON file and associated index/temp files.

---

## Unload a collection

```js
db.unloadCollection('users');
```

This removes the collection instance from memory without deleting its database file.

The collection can be loaded again later with:

```js
db.collection('users');
```

---

# Async API

The following collection operations have asynchronous equivalents:

```text
insertAsync()
insertManyAsync()

findAsync()
findOneAsync()

updateOneAsync()
updateManyAsync()

deleteOneAsync()
deleteManyAsync()

importAsync()

rebuildIdAsync()
```

Database-level asynchronous operations include:

```text
backupAsync()
```

Example:

```js
const user = await users.insertAsync({
  name: 'Alice'
});

const result = await users.findOneAsync({
  name: 'Alice'
});
```

The TypeScript declarations expose these methods directly.

---

# Events

Both `JSONDB` and `Collection` extend Node.js's `EventEmitter`.

Example:

```js
db.on('insert', info => {
  console.log('Inserted:', info);
});
```

Collection events can also be listened to:

```js
users.on('insert', user => {
  console.log('New user:', user);
});
```

Events include operations such as:

```text
error
save
insert
update
delete
import
backup
unload
transactionCommit
transactionRollback
```

The database and collection emit related events during operations.

---

# TypeScript

TypeScript declarations are included.

```js
const { JSONDB } = require('low-json-db');
```

The package exposes declarations through:

```json
{
  "types": "./db.d.ts"
}
```

The declarations include:

* `JSONDB`
* `Collection`
* `QueryBuilder`
* `Transaction`
* `CollectionOptions`
* `ImportOptions`

---

# Complete Example

```js
const { JSONDB } = require('low-json-db');

async function main() {
  const db = new JSONDB('./data');

  const users = db.collection({
    name: 'users',
    autoId: true,
    idType: 'uuid',
    indexes: ['email']
  });

  // Insert
  const alice = users.insert({
    name: 'Alice',
    email: 'alice@example.com',
    age: 28,
    active: true,
    tags: ['user']
  });

  console.log('Inserted:', alice);

  // Find
  const user = users.findOne({
    email: 'alice@example.com'
  });

  console.log('Found:', user);

  // Update
  users.updateOne(
    {
      email: 'alice@example.com'
    },
    {
      $inc: {
        age: 1
      },
      $push: {
        tags: 'member'
      }
    }
  );

  // Query
  const adults = users
    .find({
      age: {
        $gte: 18
      }
    })
    .sort({
      age: -1
    })
    .limit(10)
    .toArray();

  console.log('Adults:', adults);

  // Async insert
  await users.insertAsync({
    name: 'Bob',
    email: 'bob@example.com',
    age: 31
  });

  // Backup
  const backup = await db.backupAsync('./backups');

  console.log('Backup:', backup);
}

main().catch(console.error);
```

---

# API Reference

## `JSONDB`

```text
new JSONDB(dbPath?)
```

Methods:

```text
collection(nameOrOptions)
createCollection(nameOrOptions)

listCollections()
dropCollection(name)
unloadCollection(name)

backup(backupRoot?)
backupAsync(backupRoot?)
```

---

## `Collection`

### Insert

```text
insert(document)
insertAsync(document)

insertMany(documents)
insertManyAsync(documents)
```

### Find

```text
find(query?)
findOne(query?)

findAsync(query?)
findOneAsync(query?)
```

### Update

```text
updateOne(filter, update)
updateOneAsync(filter, update)

updateMany(filter, update)
updateManyAsync(filter, update)
```

### Delete

```text
deleteOne(filter)
deleteOneAsync(filter)

deleteMany(filter)
deleteManyAsync(filter)
```

### Other

```text
import(filePath, options?)
importAsync(filePath, options?)

startTransaction()

aggregate(pipeline?)

rebuildId()
rebuildIdAsync()

rebuildIndexes()
```

---

# Query Builder API

```text
find(query?)
```

returns a `QueryBuilder`.

Methods:

```text
limit(n)
skip(n)
sort(object)
project(object)

toArray()
first()
count()
```

---

# Transaction API

```text
startTransaction()
```

Transaction methods:

```text
insert()
insertAsync()

insertMany()
insertManyAsync()

updateOne()
updateOneAsync()

updateMany()
updateManyAsync()

deleteOne()
deleteOneAsync()

deleteMany()
deleteManyAsync()

commit()
rollback()
```

---

# File Layout

A typical database may look like:

```text
my-project/
├── data/
│   ├── users.json
│   ├── users.idx.json
│   ├── products.json
│   └── orders.json
│
├── backups/
│   └── backup-2026-08-22T10-00-00-000Z/
│       ├── users.json
│       ├── users.idx.json
│       ├── products.json
│       └── orders.json
│
└── app.js
```

The database is therefore easy to inspect and move because the persistent data is stored as normal JSON files.

---

# Atomic Writes

When saving a collection, `low-json-db` first writes the serialized JSON to a temporary file and then renames the temporary file to the final filename.

Conceptually:

```text
data.json
   ▲
   │ rename
   │
data.tmp.json
   ▲
   │ write
   │
new database contents
```

The same approach is used for index files.

This reduces the chance of leaving the main JSON file partially written if a write operation fails.

---

# When Should You Use low-json-db?

`low-json-db` is a good fit when you want:

* A small local database
* A simple Node.js application
* CLI applications
* Small tools
* Prototypes
* Local utilities
* Applications where JSON files are convenient
* A database that doesn't require a separate server

Because the entire collection is maintained as JavaScript data and persisted to JSON, it is best suited to relatively small datasets and workloads.

It is **not intended to replace a full production database server** for large datasets, heavy concurrent workloads, or distributed applications.

---

# Why low-json-db?

Traditional database setup can require:

```text
Application
     │
     ▼
Database driver
     │
     ▼
Database server
     │
     ▼
Persistent storage
```

With `low-json-db`:

```text
Node.js application
        │
        ▼
   low-json-db
        │
        ▼
   JSON files
```

There is no database server to install or configure.

---

# Zero Dependencies

The package uses Node.js built-in modules such as:

```text
fs
path
events
crypto
```

There are no external runtime dependencies in `package.json`.

---

# Limitations

`low-json-db` is intentionally lightweight.

Keep in mind:

* Collections are stored as JSON arrays.
* Querying is generally performed in memory.
* Aggregation is basic.
* Indexes are optional and primarily optimize simple equality lookups.
* The database is local to the filesystem.
* It is not a distributed database.
* It does not provide the complete feature set or concurrency model of MongoDB, PostgreSQL, MySQL, or similar database servers.
* Large datasets may not be appropriate for this architecture.

Use a full database system when your application requires high concurrency, large-scale data, replication, distributed access, or advanced database guarantees.

---

# Repository

GitHub:

https://github.com/amk2406/low-json-db

Documentation:

https://amk2406.github.io/low-json-db

npm:

https://www.npmjs.com/package/low-json-db

---

# Contributing

Contributions are welcome.

You can:

* Open an issue
* Report bugs
* Suggest improvements
* Submit a pull request

Please keep changes focused and include appropriate testing/examples when adding or changing functionality.

---

# License

MIT License.

---

## Author

**Amk**

Repository:

https://github.com/amk2406/low-json-db

---

## Final Note

`low-json-db` aims to provide a simple middle ground:

```text
Plain JSON files
      +
Document database API
      +
Indexes
      +
Transactions
      +
Async support
      +
Backups
      +
TypeScript support
      ↓
   low-json-db
```

If your project needs a small, local, dependency-free document database, `low-json-db` provides the database layer without requiring a separate database server.

Happy coding.
