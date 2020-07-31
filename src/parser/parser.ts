import { DataStoreHandler } from '../entity/dataStore';
import { TableHandler } from '../entity/table';
import { capitalizeFirstLetter } from '../util/stringUtil';
import { ReferenceColumn } from '../entity/referenceColumn';
import { Relation } from '..';
import { CodeGeneratable } from '../node/codeGeneratable';
import { RepositoryNode } from '../node/repository';
import { EntityNode } from '../node/entity';
import { FieldNode } from '../node/field';
import { FindMethodNode } from '../node/findMethod';
import { ParameterNode } from '../node/parameterNode';
import { TypeNode } from '../node/typeNode';

export class Parser {
  constructor(private store: DataStoreHandler) {}
  parse(): CodeGeneratable {
    const repositories = this.store.tables.map(
      it =>
        new RepositoryNode(
          it.getEntityName(),
          it.primaryKey,
          this.tableToEntityNode(it),
          this.getQueries(it),
          it.columns.find(it => it.getData().autoIncrement)?.name,
        ),
    );
    return {
      repositories,
      entities: repositories.map(it => it.entity),
    };
  }

  static paramsToQueryName(...params: string[]) {
    return 'findBy' + params.map(capitalizeFirstLetter).join('And');
  }

  private createPrimaryQuery(table: TableHandler): FindMethodNode {
    return new FindMethodNode(
      Parser.paramsToQueryName(...table.primaryKey),
      table.primaryKey.map(it => {
        const column = table.column(it)!;
        return new ParameterNode(it, new TypeNode(column.type, false, false));
      }),
      new TypeNode(table.getEntityName(), false, true),
    );
  }

  private tableToEntityNode(table: TableHandler) {
    return new EntityNode(
      table.getEntityName(),
      table.columns.map(
        column =>
          new FieldNode(
            column.name,
            column.type,
            table.isColumnPrimary(column.name),
            column.getData().default,
            column.isNullable(),
            column.getData().autoIncrement,
            column.getData().defaultCurrentTimeStamp,
          ),
      ),
    );
  }

  private createRefQuery(ref: ReferenceColumn): FindMethodNode {
    return new FindMethodNode(
      Parser.paramsToQueryName(ref.getTargetColumn().getData().columnName),
      [new ParameterNode(ref.getTargetColumn().getData().columnName, new TypeNode(ref.type, false, false))],
      new TypeNode(ref.table.getEntityName(), ref.data.relation === Relation.Many, false),
    );
  }

  private getQueries(table: TableHandler): FindMethodNode[] {
    const methods: FindMethodNode[] = [];
    if (table.primaryKey.length > 1 || !table.column(table.primaryKey[0])!.isReference()) {
      methods.push(this.createPrimaryQuery(table));
    }
    methods.push(
      ...table.columns.filter(column => column.isReference()).map(it => this.createRefQuery(it as ReferenceColumn)),
    );
    return methods;
  }
}
