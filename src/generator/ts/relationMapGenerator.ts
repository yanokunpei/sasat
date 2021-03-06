import { TsFile } from './file';
import { tsg } from './code/factory';
import { Relation } from '../..';
import { Directory } from '../../constants/directory';
import { RootNode } from '../../parser/node/rootNode';
import { EntityNode } from '../../parser/node/entityNode';
import { KeywordTypeNode } from './code/node/type/typeKeyword';
import { EntityName } from '../../parser/node/entityName';

export class RelationMapGenerator {
  generate(root: RootNode): TsFile {
    return new TsFile(
      this.relationMap(root),
      this.tableInfo(root),
      tsg
        .variable(
          'const',
          'dataStoreInfo',
          tsg.object(tsg.propertyAssign('tableInfo'), tsg.propertyAssign('relationMap')),
          tsg.typeRef('DataStoreInfo').importFrom('sasat'),
        )
        .export(),
      ...root.entities().flatMap(this.entityRelationType),
    );
  }

  private relationMap(root: RootNode) {
    return tsg.variable(
      'const',
      tsg.identifier('relationMap'),
      tsg.object(...root.entities().map(it => this.entityRelationMap(it))),
      tsg.typeRef('RelationMap').importFrom('sasat'),
    );
  }

  private entityRelationType(node: EntityNode) {
    const importEntity = (entity: EntityName) => Directory.entityPath(Directory.paths.generated, entity);
    const typeProperties = [
      ...node.relations.map(it =>
        tsg.propertySignature(
          it.refPropertyName(),
          it.refType().toTsType().addImport([it.toEntityName.name], importEntity(it.toEntityName)),
        ),
      ),
      ...node
        .findReferencedRelations()
        .map(it =>
          tsg.propertySignature(
            it.referencedByPropertyName(),
            it.referenceByType().toTsType().addImport([it.parent.entityName.name], importEntity(it.parent.entityName)),
          ),
        ),
    ];
    return [
      tsg
        .typeAlias(
          node.entityName.relationTypeName(),
          typeProperties.length !== 0 ? tsg.typeLiteral(typeProperties) : tsg.typeRef('Record<never, never>'),
        )
        .export(),
      tsg
        .typeAlias(
          node.entityName.entityWithRelationTypeName(),
          tsg.intersectionType(
            node.entityName.getTypeReference(Directory.paths.generated),
            tsg.typeRef(node.entityName.relationTypeName()),
          ),
        )
        .export(),
      tsg
        .typeAlias(
          node.entityName.resultType(),
          tsg
            .typeRef('EntityResult', [
              tsg.typeRef(node.entityName.entityWithRelationTypeName()),
              node.entityName.identifiableTypeReference(Directory.paths.generated),
            ])
            .importFrom('sasat'),
        )
        .export(),
    ];
  }

  private entityRelationMap(node: EntityNode) {
    const qExpr = tsg.identifier('QExpr').importFrom('sasat');
    const on = (parentColumn: string, childColumn: string) =>
      tsg.propertyAssign(
        'on',
        tsg.arrowFunc(
          [
            tsg.parameter('parentTableAlias', KeywordTypeNode.string),
            tsg.parameter('childTableAlias', KeywordTypeNode.string),
          ],
          tsg.typeRef('BooleanValueExpression').importFrom('sasat'),
          qExpr
            .property('conditions')
            .property('eq')
            .call(
              qExpr.property('field').call(tsg.identifier('parentTableAlias'), tsg.string(parentColumn)),
              qExpr.property('field').call(tsg.identifier('childTableAlias'), tsg.string(childColumn)),
            ),
        ),
      );

    return tsg.propertyAssign(
      node.repository.tableName,
      tsg.object(
        ...node.relations.map(rel =>
          tsg.propertyAssign(
            rel.refPropertyName(),
            tsg.object(
              tsg.propertyAssign('table', tsg.string(rel.toTableName)),
              on(rel.fromField, rel.toField),
              tsg.propertyAssign('relation', tsg.string(Relation.One)),
            ),
          ),
        ),
        ...node
          .findReferencedRelations()
          .map(rel =>
            tsg.propertyAssign(
              rel.referencedByPropertyName(),
              tsg.object(
                tsg.propertyAssign('table', tsg.string(rel.parent.repository.tableName)),
                on(rel.toField, rel.fromField),
                tsg.propertyAssign('relation', tsg.string(rel.relation)),
              ),
            ),
          ),
      ),
    );
  }

  private tableInfo(root: RootNode) {
    const columnMap = (entity: EntityNode) =>
      tsg.propertyAssign(
        'columnMap',
        tsg.object(...entity.fields.map(field => tsg.propertyAssign(field.fieldName, tsg.string(field.columnName)))),
      );
    return tsg.variable(
      'const',
      'tableInfo',
      tsg.object(
        ...root.repositories.map(repo =>
          tsg.propertyAssign(
            repo.tableName,
            tsg.object(
              tsg.propertyAssign('identifiableKeys', tsg.array(repo.primaryKeys.map(tsg.string))),
              columnMap(repo.entity),
            ),
          ),
        ),
      ),
    );
  }
}
