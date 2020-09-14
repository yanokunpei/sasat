import { SerializedTable } from '../../../migration/serialized/serializedStore';
import { Reference, SerializedNormalColumn } from '../../../migration/serialized/serializedColumn';
import { Relation } from '../../..';
import { ForeignKeyReferentialAction } from '../../../migration/data/foreignKey';
import { DBColumnTypes } from '../../../migration/column/columnTypes';
import { lexColumn } from './lexer/columnLexer';
import { Token, TokenKind } from './lexer/lexer';

const getInnerStr = (str: string, start: string, end: string, fromIndex = 0) => {
  const startIndex = str.indexOf(start, fromIndex) + 1;
  const endIndex = start.indexOf(end, startIndex);
  return str.slice(startIndex, endIndex);
};

const getInParenValues = (tokens: Token[], fromIndex = 0) => {
  const sliced = tokens.slice(fromIndex);
  const start = sliced.findIndex(it => it.kind === TokenKind.Separator && it.value === '(');
  const end = sliced.findIndex(it => it.kind === TokenKind.Separator && it.value === ')');
  if (start === -1 || end === -1) return [];
  return sliced.slice(start + 1, end);
};

const getReferentialAction = (str: string, from: number) => {
  const slice = str.slice(from);
  if (slice.startsWith('RESTRICT')) return ForeignKeyReferentialAction.Restrict;
  if (slice.startsWith('CASCADE')) return ForeignKeyReferentialAction.Cascade;
  if (slice.startsWith('SET NULL')) return ForeignKeyReferentialAction.SetNull;
  if (slice.startsWith('NO ACTION')) return ForeignKeyReferentialAction.NoAction;
  return undefined;
};

const startStrMap: { word: string; fn: (str: string, table: SerializedTable) => SerializedTable }[] = [
  {
    word: 'PRIMARY KEY',
    fn: (str: string, table) => {
      const tokens = getInParenValues(lexColumn(str));
      return { ...table, primaryKey: tokens.filter(it => it.kind === TokenKind.String).map(it => it.value) };
    },
  },
  {
    word: 'UNIQUE KEY',
    fn: (str: string, table) => {
      const tokens = lexColumn(str);
      const inParen = getInParenValues(tokens);
      return {
        ...table,
        uniqueKeys: [...table.uniqueKeys, inParen.filter(it => it.kind === TokenKind.String).map(it => it.value)],
      };
    },
  },
  {
    word: 'KEY',
    fn: (str, table) => {
      const tokens = lexColumn(str);
      return {
        ...table,
        indexes: [
          ...table.indexes,
          {
            constraintName: tokens[1].value,
            columns: getInParenValues(tokens)
              .filter(it => it.kind === TokenKind.String)
              .map(it => it.value),
          },
        ],
      };
    },
  },
  {
    word: 'CONSTRAINT',
    fn: (str: string, table) => {
      const tokens = lexColumn(str);
      const columnName = getInParenValues(tokens)[0].value;
      const refIndex = tokens.findIndex(it => it.kind === TokenKind.Keyword && it.value === 'REFERENCES');
      const targetTable = tokens[refIndex + 1].value;
      const targetColumn = getInParenValues(tokens, refIndex)[0].value;
      const isColumnUnique = table.uniqueKeys.filter(it => it.length === 1).find(it => it[0] === columnName);
      const sameTableRefs = table.columns.filter(it => it.hasReference && it.reference.targetTable === targetTable);
      const onUpdate = tokens.findIndex(it => it.kind === TokenKind.Keyword && it.value === 'ON UPDATE');
      const onDelete = tokens.findIndex(it => it.kind === TokenKind.Keyword && it.value === 'ON DELETE');

      const reference: Reference = {
        targetTable,
        targetColumn,
        columnName,
        relation: isColumnUnique ? Relation.OneOrZero : Relation.Many,
        relationName: sameTableRefs.length !== 0 ? targetTable + sameTableRefs.length : undefined,
        onUpdate: onUpdate !== -1 ? (tokens[onUpdate + 1].value as ForeignKeyReferentialAction) : undefined,
        onDelete: onDelete !== -1 ? (tokens[onDelete + 1].value as ForeignKeyReferentialAction) : undefined,
      };
      console.log('ref');
      console.log(table.tableName);
      console.log(table.columns.map(it => it.columnName));
      console.log(columnName);
      console.log('----');

      return {
        ...table,
        columns: table.columns.map(it =>
          it.columnName === columnName ? { ...it, hasReference: true, reference } : it,
        ),
      };
    },
  },
  {
    word: '`',
    fn: (str, table) => {
      const tokens = lexColumn(str);
      const keywords = tokens.filter(it => it.kind === TokenKind.Keyword).map(it => it.value);
      const getDefault = () => {
        const index = tokens.findIndex(it => it.kind === TokenKind.Keyword && it.value === 'DEFAULT');
        if (index === -1) return undefined;
        const next = tokens[index + 1];
        if (next.kind === TokenKind.String || next.kind === TokenKind.Number) return next;
        if (next.kind === TokenKind.Identifier && next.value === 'CURRENT_TIMESTAMP') return next;
        return undefined;
      };
      const defaultToken = getDefault();
      const inPrenValues = getInParenValues(tokens);
      const column: SerializedNormalColumn = {
        hasReference: false,
        columnName: tokens[0].value,
        type: tokens[1].value as DBColumnTypes,
        notNull: keywords.includes('NOT NULL'),
        default: defaultToken && defaultToken.kind !== TokenKind.Identifier ? defaultToken.value : undefined,
        zerofill: keywords.includes('zerofill'),
        signed: keywords.includes('unsigned') ? false : keywords.includes('signed') ? true : undefined,
        autoIncrement: keywords.includes('AUTO_INCREMENT'),
        length: inPrenValues.length > 0 ? +inPrenValues[0].value : undefined,
        scale: inPrenValues.length > 1 ? +inPrenValues[1].value : undefined,
        defaultCurrentTimeStamp: defaultToken?.kind === TokenKind.Identifier,
        onUpdateCurrentTimeStamp: keywords.includes('ON UPDATE'),
      };
      return {
        ...table,
        columns: [...table.columns, column],
      };
    },
  },
  { word: ')', fn: (_1, table) => table },
];

const indexOfEndOfFind = (str: string, currentIndex: number, find: string) => {
  const i = str.slice(currentIndex).indexOf(find);
  if (i === -1) return -1;
  return currentIndex + i + find.length;
};

// TODO rewrite
export const serializeCreateTable = (str: string): SerializedTable => {
  const lines = str.split('\n').map(it => it.trim());
  let table: SerializedTable = {
    tableName: lexColumn(lines[0])[1].value,
    columns: [],
    primaryKey: [],
    uniqueKeys: [],
    indexes: [],
    gqlOption: {
      mutation: {
        create: true,
        update: true,
        delete: true,
        fromContextColumns: [],
      },
      subscription: {
        onCreate: false,
        onUpdate: false,
        onDelete: false,
        filter: [],
      },
    },
  };

  lines.slice(1).forEach(line => {
    table = startStrMap.find(it => line.startsWith(it.word))!.fn(line, table);
  });
  return table;
};
