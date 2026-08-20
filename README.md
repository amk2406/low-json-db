# low-json-db

A lightweight, zero-dependency, file-based document database for Node.js.

It stores each collection as a plain JSON file and offers a familiar MongoDB-style API, with indexes, transactions, async support, and more.

## Features

- Simple MongoDB-like API (`insert`, `find`, `update`, `delete`, aggregation)
- Atomic writes for crash safety
- Optional indexes (stored in separate `.idx.json` files)
- Sync + Async methods
- Transactions
- Auto ID generation (auto-increment, UUID, or ObjectId-style)
- Nested field support
- Import & Backup
- EventEmitter support
- TypeScript declarations included
- Zero dependencies

## Installation

```bash
npm i low-json-db
```

Or just copy `db.js` (and optionally `db.d.ts`) into your project.

## Quick Start

```js
const { JSONDB } = require('low-json-db');
// or
const { JSONDB } = require('./db');

const db = new JSONDB('./data');

const users = db.collection({
  name: 'users',
  autoId: true,
  indexes: ['email']
});

// Insert
const user = users.insert({
  name: 'Alice',
  email: 'alice@example.com',
  age: 28
});

// Find
const found = users.findOne({ email: 'alice@example.com' });

// Update
users.updateOne(
  { name: 'Alice' },
  { $set: { age: 29 }, $push: { tags: 'admin' } }
);

// Async example
await users.insertAsync({ name: 'Bob', email: 'bob@example.com' });
```

## Documentation

Full documentation and examples:  
**https://amk2406.github.io/low-json-db**

## License

MIT

## Contributing

Feel free to contribute! Open issues or pull requests on the repository.

Happy coding!
