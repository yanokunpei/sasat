import { columnTypeToTsType, DBColumnTypes } from '../column/columnTypes';
import { GqlPrimitive } from '../../generator/gql/types';
import { columnTypeToGqlPrimitive } from '../../generator/gql/columnToGqlType';
import { columnToSql } from '../../db/sql/columnToSql';
import { Serializable } from './serializable';
import {
  Reference,
  SerializedColumn,
  SerializedNormalColumn,
  SerializedReferenceColumn,
} from '../serialized/serializedColumn';
import { Table } from './table';

export interface Column extends Serializable<SerializedColumn> {
  fieldName(): string;
  columnName(): string;
  dataType(): DBColumnTypes;
  toSql(): string;
  isReference(): this is ReferenceColumn;
  isNullable(): boolean;
  tsType(): string;
  gqlType(): GqlPrimitive;
  isNullableOnCreate(): boolean;
}

export class BaseColumn implements Column {
  constructor(public data: SerializedColumn, public table: Table) {}
  fieldName(): string {
    return this.data.fieldName;
  }

  columnName(): string {
    return this.data.columnName;
  }

  dataType(): DBColumnTypes {
    return this.data.type;
  }
  tsType(): string {
    return columnTypeToTsType(this.dataType());
  }
  gqlType(): GqlPrimitive {
    return columnTypeToGqlPrimitive(this.dataType());
  }

  isNullable(): boolean {
    return !this.data.notNull;
  }

  isNullableOnCreate(): boolean {
    if (this.data.hasReference) return false;
    return !this.data.notNull || this.data.default !== undefined || this.data.autoIncrement;
  }

  isReference(): this is ReferenceColumn {
    return this.data.hasReference;
  }

  serialize(): SerializedColumn {
    return this.data;
  }

  toSql(): string {
    return columnToSql(this.data);
  }
}

export class NormalColumn extends BaseColumn {
  constructor(public data: SerializedNormalColumn, table: Table) {
    super(data, table);
  }

  addReference(reference: Reference): ReferenceColumn {
    return new ReferenceColumn({ ...this.data, hasReference: true, reference }, this.table);
  }
}

export class ReferenceColumn extends BaseColumn {
  constructor(public data: SerializedReferenceColumn, table: Table) {
    super(data, table);
  }

  getConstraintName(): string {
    return `ref_${this.table.tableName}_${this.fieldName()}__${this.data.reference.targetTable}_${
      this.data.reference.targetColumn
    }`;
  }
}
