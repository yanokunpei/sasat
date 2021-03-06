import { Table, TableHandler } from './serializable/table';
import { SerializedStore } from './serialized/serializedStore';
import { ReferenceColumn } from './serializable/column';

export interface DataStore {
  table(tableName: string): Table;
}

export class DataStoreHandler implements DataStore {
  tables: TableHandler[];
  constructor(store: SerializedStore) {
    this.tables = store.tables.map(it => new TableHandler(it, this));
  }
  table(tableName: string): Table {
    const table = this.tables.find(it => it.tableName === tableName);
    if (!table) throw new Error(`Table: ${tableName} is Not Found`);
    return table;
  }

  referencedBy(tableName: string): ReferenceColumn[] {
    return this.tables
      .map(
        it => it.columns.find(it => it.isReference() && it.data.reference.targetTable === tableName) as ReferenceColumn,
      )
      .filter(it => it);
  }
}
