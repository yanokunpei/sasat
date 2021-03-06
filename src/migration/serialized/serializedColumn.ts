import { DBColumnTypes } from '../column/columnTypes';
import { SqlValueType } from '../../db/connectors/dbClient';
import { Relation } from '../..';
import { ForeignKeyReferentialAction } from '../data/foreignKey';
import { SqlString } from '../../runtime/sql/sqlString';

interface SerializedColumnBase {
  hasReference: boolean;
  fieldName: string;
  columnName: string;
  type: DBColumnTypes;
  notNull: boolean;
  default: SqlValueType | undefined;
  zerofill: boolean;
  signed: boolean | undefined;
  autoIncrement: boolean;
  length: number | undefined;
  scale: number | undefined;
  defaultCurrentTimeStamp: boolean;
  onUpdateCurrentTimeStamp: boolean;
}

export interface SerializedNormalColumn extends SerializedColumnBase {
  hasReference: false;
}

export interface Reference {
  targetTable: string;
  targetColumn: string;
  columnName: string;
  relation: Relation;
  relationName?: string;
  onUpdate?: ForeignKeyReferentialAction;
  onDelete?: ForeignKeyReferentialAction;
}

export const referenceToSql = (constraintName: string, ref: Reference): string => {
  const onUpdate = ref.onUpdate ? ` ON UPDATE ${ref.onUpdate}` : '';
  const onDelete = ref.onDelete ? ` ON DELETE ${ref.onDelete}` : '';
  return (
    `CONSTRAINT ${constraintName} ` +
    `FOREIGN KEY(${ref.columnName}) ` +
    `REFERENCES ${SqlString.escapeId(ref.targetTable)}(${SqlString.escapeId(ref.targetColumn)})` +
    onUpdate +
    onDelete
  );
};

export interface SerializedReferenceColumn extends SerializedColumnBase {
  hasReference: true;
  reference: Reference;
}

export type SerializedColumn = SerializedNormalColumn | SerializedReferenceColumn;
