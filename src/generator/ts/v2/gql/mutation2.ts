import { TsFile } from '../file';
import { VariableDeclaration } from '../code/node/variableDeclaration';
import { NumericLiteral, ObjectLiteral } from '../code/node/literal/literal';
import { MutationNode } from '../../../../node/gql/mutationNode';
import { PropertyAssignment } from '../code/node/propertyAssignment';
import { EntityName } from '../../../../entity/entityName';
import { ArrowFunction } from '../code/node/ArrowFunction';
import { TypeReference } from '../code/node/type/typeReference';
import { Identifier } from '../code/node/Identifier';
import { Parameter } from '../code/node/parameter';
import { TypeLiteral } from '../code/node/type/typeLiteral';
import { GeneratedPath, getEntityPath } from '../../../../constants/directory';
import { Block } from '../code/node/Block';
import { ReturnStatement } from '../code/node/returnStatement';
import { CallExpression } from '../code/node/callExpression';
import { PropertyAccessExpression } from '../code/node/propertyAccessExpression';
import { NewExpression } from '../code/node/newExpression';
import { SpreadAssignment } from '../code/node/spreadAssignment';
import { AwaitExpression } from '../code/node/awaitExpression';
import { ExpressionStatement } from '../code/node/ExpressionStatement';
import { AsyncExpression } from '../code/node/asyncExpression';
import { IntersectionType } from '../code/node/type/intersectionType';
import { TsType } from '../code/node/type/type';
import { ContextParamNode } from '../../../../node/gql/contextParamNode';
import { BinaryExpression } from '../code/node/binaryExpression';
import { KeywordTypeNode } from '../code/node/type/typeKeyword';
import { IfStatement } from '../code/node/ifStatement';

export class MutationGenerator {
  generate(mutations: MutationNode[]): TsFile {
    return new TsFile(
      new VariableDeclaration(
        'const',
        new Identifier('mutation'),
        new ObjectLiteral(...mutations.flatMap(MutationGenerator.mutationToProperty)),
      ).export(),
    );
  }

  private static createFunctionName(entityName: EntityName) {
    return `create${entityName}`;
  }

  private static updateFunctionName(entityName: EntityName) {
    return `update${entityName}`;
  }

  private static deleteFunctionName(entityName: EntityName) {
    return `delete${entityName}`;
  }

  private static functionParams(paramType: TsType, useContext: boolean) {
    const params = [new Parameter('_', new TypeLiteral()), new Parameter('params', paramType)];
    if (!useContext) return params;
    return [...params, new Parameter('context', new TypeReference('GqlContext').importFrom('../context'))];
  }

  private static mutationToProperty(node: MutationNode): PropertyAssignment[] {
    const result = [];
    if (node.onCreate.enabled) {
      const property = new PropertyAssignment(
        MutationGenerator.createFunctionName(node.entityName),
        new AsyncExpression(
          new ArrowFunction(
            this.functionParams(
              new TypeReference(node.entityName.creatableInterface()).importFrom(
                getEntityPath(GeneratedPath, node.entityName),
              ),
              node.useContextParams(),
            ),
            new TypeReference('Promise', [node.entityName.toIdentifier()]),
            this.createFunctionBody(node),
          ),
        ),
      );
      result.push(property);
    }

    if (node.onUpdate.enabled) {
      const property = new PropertyAssignment(
        this.updateFunctionName(node.entityName),
        new AsyncExpression(
          new ArrowFunction(
            this.functionParams(
              new IntersectionType(
                new TypeReference(node.entityName.identifiableInterfaceName()).importFrom(
                  getEntityPath(GeneratedPath, node.entityName),
                ),
                new TypeReference(node.entityName.name).partial(),
              ),
              node.useContextParams(),
            ),
            KeywordTypeNode.boolean,
            this.updateFunctionBody(node),
          ),
        ),
      );
      result.push(property);
    }
    if (node.onDelete.enabled) {
      const property = new PropertyAssignment(
        this.deleteFunctionName(node.entityName),
        new AsyncExpression(
          new ArrowFunction(
            this.functionParams(
              new TypeReference(node.entityName.identifiableInterfaceName()).importFrom(
                getEntityPath(GeneratedPath, node.entityName),
              ),
              node.useContextParams(),
            ),
            new TypeReference('Promise', [KeywordTypeNode.boolean]),
            this.deleteFunctionBody(node),
          ),
        ),
      );
      result.push(property);
    }

    return result;
  }

  private static toDatasourceParam(contextParams: ContextParamNode[]) {
    const paramsIdentifier = new Identifier('param');
    if (contextParams.length === 0) return paramsIdentifier;
    return new ObjectLiteral(
      new SpreadAssignment(paramsIdentifier),
      ...contextParams.map(it => new PropertyAssignment(it.paramName, new Identifier(`context.${it.contextName}`))),
    );
  }

  private static createFunctionBody(node: MutationNode) {
    const createCallExpression = new CallExpression(
      new PropertyAccessExpression(new NewExpression(new Identifier(node.entityName.dataSourceName())), 'create'),
      this.toDatasourceParam(node.contextParams),
    );
    if (!node.onCreate.subscribed) return createCallExpression;
    const resultIdentifier = new Identifier('result');
    return new Block(
      new VariableDeclaration('const', resultIdentifier, new AwaitExpression(createCallExpression)),
      new ExpressionStatement(
        new AwaitExpression(
          new CallExpression(
            new Identifier(node.publishCreateFunctionName()).importFrom('./subscription'),
            resultIdentifier,
          ),
        ),
      ),
      new ReturnStatement(resultIdentifier),
    );
  }

  private static updateFunctionBody(node: MutationNode) {
    const updateCall = new CallExpression(
      new PropertyAccessExpression(
        new CallExpression(
          new PropertyAccessExpression(new NewExpression(new Identifier(node.entityName.dataSourceName())), 'update'),
          this.toDatasourceParam(node.contextParams),
        ),
        'then',
      ),
      new ArrowFunction(
        [new Parameter('it', new TypeReference('CommandResponse').importFrom('sasat'))],
        new TypeReference('Promise', [new Identifier('boolean')]),
        new BinaryExpression(new Identifier('it.changedRows'), '===', new NumericLiteral(1)),
      ),
    );
    if (!node.onUpdate.subscribed) return updateCall;
    const resultIdentifier = new Identifier('result');
    return new Block(
      new VariableDeclaration('const', resultIdentifier, updateCall),
      new IfStatement(
        resultIdentifier,
        new Block(
          new AwaitExpression(
            new CallExpression(
              new Identifier(node.publishUpdateFunctionName()).importFrom('./subscription'),
              new AwaitExpression(
                new CallExpression(
                  new PropertyAccessExpression(
                    new NewExpression(new Identifier(node.entityName.dataSourceName())),
                    node.primaryFindQueryName,
                  ),
                  ...node.primaryKeys.map(it => new Identifier(`params.${it}`)),
                ),
              ),
            ),
          ).toStatement(),
        ),
      ),
      new ReturnStatement(resultIdentifier),
    );
  }

  private static deleteFunctionBody(node: MutationNode) {
    const deleteCall = new CallExpression(
      new PropertyAccessExpression(
        new CallExpression(
          new PropertyAccessExpression(new NewExpression(new Identifier(node.entityName.dataSourceName())), 'delete'),
          new Identifier('params'),
        ),
        'then',
      ),
      new ArrowFunction(
        [new Parameter('it', new TypeReference('CommandResponse').importFrom('sasat'))],
        new TypeReference('Promise', [new Identifier('boolean')]),
        new BinaryExpression(new Identifier('it.affectedRows'), '===', new NumericLiteral(1)),
      ),
    );

    if (!node.onDelete.subscribed) return deleteCall;
    const result = new Identifier('result');

    return new Block(
      new VariableDeclaration('const', result, deleteCall),
      new IfStatement(
        result,
        new Block(
          new AwaitExpression(
            new CallExpression(new Identifier(node.publishDeleteFunctionName()), new Identifier('params')),
          ).toStatement(),
        ),
      ),
      new ReturnStatement(result),
    );
  }
}
