import { ColumnCreator } from './columnCreator';
import { NestedPartial } from '../../util/type';
import { ColumnBuilder } from './columnBuilder';
import { NormalColumn } from '../serializable/column';
import { Reference } from '../serialized/serializedColumn';
import { TableHandler } from '../serializable/table';
import { GqlOption } from '../data/gqlOption';
import { DataStore } from '../dataStore';

export interface TableBuilder {
  column(columnName: string): ColumnCreator;
  references(reference: Reference): TableBuilder;
  setPrimaryKey(...columnNames: string[]): TableBuilder;
  addUniqueKey(...columnNames: string[]): TableBuilder;
  createdAt(): TableBuilder;
  updatedAt(): TableBuilder;
  addIndex(...columns: string[]): TableBuilder;
  setGqlOption(option: NestedPartial<GqlOption>): TableBuilder;
}

export class TableCreator implements TableBuilder {
  private readonly table: TableHandler;
  private readonly columns: ColumnBuilder[] = [];

  constructor(public tableName: string, store: DataStore) {
    this.table = new TableHandler({ tableName }, store);
  }

  column(name: string): ColumnCreator {
    if (this.table.hasColumn(name)) throw new Error(`${this.tableName}.${name} already exists`);
    return new ColumnCreator(this, name);
  }

  addColumn(column: ColumnBuilder): void {
    this.columns.push(column);
  }

  addUniqueKey(...columnNames: string[]): TableBuilder {
    this.table.addUniqueKey(...columnNames);
    return this;
  }

  references(ref: Reference): TableBuilder {
    this.table.addReferences(ref);
    return this;
  }

  setPrimaryKey(...columnNames: string[]): TableBuilder {
    this.table.setPrimaryKey(...columnNames);
    return this;
  }

  create(): TableHandler {
    this.columns.forEach(column => {
      const { data, isPrimary, isUnique } = column.build();
      this.table.addColumn(new NormalColumn(data, this.table), isPrimary, isUnique);
    });
    return this.table;
  }

  createdAt(): TableBuilder {
    this.column('createdAt').timestamp().defaultCurrentTimeStamp().notNull();
    return this;
  }

  updatedAt(): TableBuilder {
    this.column('updatedAt').timestamp().defaultCurrentTimeStamp().onUpdateCurrentTimeStamp().notNull();
    return this;
  }

  addIndex(...columns: string[]): TableBuilder {
    this.table.addIndex(`index_${this.tableName}__${columns.join('_')}`, ...columns);
    return this;
  }

  setGqlOption(option: NestedPartial<GqlOption>): TableBuilder {
    this.table.setGqlOption(option);
    return this;
  }
}
