import { EventEmitter } from 'events';

export interface CollectionOptions {
  name: string;
  autoId?: boolean;
  idField?: string;
  idType?: 'auto' | 'uuid' | 'objectid';
  indexes?: string[];
  pretty?: boolean;
  lazy?: boolean;
}

export interface ImportOptions {
  clear?: boolean;
}

export declare class JSONDB extends EventEmitter {
  constructor(dbPath?: string);

  collection(nameOrOptions: string | CollectionOptions): Collection;
  createCollection(nameOrOptions: string | CollectionOptions): Collection;
  listCollections(): string[];
  dropCollection(name: string): boolean;
  unloadCollection(name: string): boolean;
  backup(backupRoot?: string): string | null;
  backupAsync(backupRoot?: string): Promise<string | null>;

  on(event: 'error', listener: (err: Error) => void): this;
  on(event: 'save' | 'insert' | 'update' | 'delete' | 'import' | 'backup' | 'unload' | 'transactionCommit' | 'transactionRollback', listener: (info: any) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}

export declare class Collection extends EventEmitter {
  readonly name: string;
  readonly autoId: boolean;
  readonly idField: string;
  readonly idType: string;
  readonly indexFields: string[];
  readonly pretty: boolean;

  // Insert
  insert(document: object): object | null;
  insertAsync(document: object): Promise<object | null>;
  insertMany(documents: object[]): object[];
  insertManyAsync(documents: object[]): Promise<object[]>;

  // Find
  find(query?: object): QueryBuilder;
  findOne(query?: object): object | null;
  findAsync(query?: object): Promise<QueryBuilder>;
  findOneAsync(query?: object): Promise<object | null>;

  // Update
  updateOne(filter: object, update: object): object | null;
  updateOneAsync(filter: object, update: object): Promise<object | null>;
  updateMany(filter: object, update: object): object[];
  updateManyAsync(filter: object, update: object): Promise<object[]>;

  // Delete
  deleteOne(filter: object): object | null;
  deleteOneAsync(filter: object): Promise<object | null>;
  deleteMany(filter: object): object[];
  deleteManyAsync(filter: object): Promise<object[]>;

  // Import
  import(filePath: string, options?: ImportOptions): boolean;
  importAsync(filePath: string, options?: ImportOptions): Promise<boolean>;

  // Other
  startTransaction(): Transaction;
  aggregate(pipeline?: object[]): object[];
  rebuildId(): number;
  rebuildIdAsync(): Promise<number>;
  rebuildIndexes(): void;

  on(event: 'error', listener: (err: Error) => void): this;
  on(event: 'save' | 'insert' | 'update' | 'delete' | 'import' | 'transactionCommit' | 'transactionRollback', listener: (info: any) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}

export declare class QueryBuilder {
  limit(n: number): this;
  skip(n: number): this;
  sort(obj: object): this;
  project(obj: object): this;
  toArray(): object[];
  first(): object | null;
  count(): number;
}

export declare class Transaction {
  insert(doc: object): object | null;
  insertAsync(doc: object): Promise<object | null>;
  insertMany(docs: object[]): object[];
  insertManyAsync(docs: object[]): Promise<object[]>;
  updateOne(filter: object, update: object): object | null;
  updateOneAsync(filter: object, update: object): Promise<object | null>;
  updateMany(filter: object, update: object): object[];
  updateManyAsync(filter: object, update: object): Promise<object[]>;
  deleteOne(filter: object): object | null;
  deleteOneAsync(filter: object): Promise<object | null>;
  deleteMany(filter: object): object[];
  deleteManyAsync(filter: object): Promise<object[]>;
  commit(): Promise<boolean>;
  rollback(): Promise<boolean>;
}

export { JSONDB as default };
