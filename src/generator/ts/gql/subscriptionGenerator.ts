import { TsFile } from '../file';
import { VariableDeclaration } from '../code/node/variableDeclaration';
import { EnumDeclaration } from '../code/node/enumDeclaration';
import { EnumMember } from '../code/node/enumMember';
import { PropertyAssignment } from '../code/node/propertyAssignment';
import { Parameter } from '../code/node/parameter';
import { TypeReference } from '../code/node/type/typeReference';
import { KeywordTypeNode } from '../code/node/type/typeKeyword';
import { Block } from '../code/node/block';
import { ReturnStatement } from '../code/node/returnStatement';
import {
  ArrayLiteral,
  ArrowFunction,
  AwaitExpression,
  BinaryExpression,
  Identifier,
  ObjectLiteral,
  PropertyAccessExpression,
  StringLiteral,
} from '../code/node/expressions';
import { tsg } from '../code/factory';
import { Directory } from '../../../constants/directory';
import { MutationNode } from '../../../parser/node/gql/mutationNode';
import { EntityName } from '../../../parser/node/entityName';

interface Subscription {
  entity: EntityName;
  event: 'Created' | 'Updated' | 'Deleted';
  filters: string[];
}

export class SubscriptionGenerator {
  generate(nodes: MutationNode[]): TsFile {
    const data = this.createData(nodes);
    return this.createFile(data);
  }

  private createAsyncIteratorCall(event: string): ArrowFunction {
    return new ArrowFunction(
      [],
      undefined,
      new PropertyAccessExpression(new Identifier('pubsub').importFrom('../pubsub'), 'asyncIterator').call(
        new ArrayLiteral([new Identifier(`SubscriptionName.${event}`)]),
      ),
    );
  }

  private createFile(data: Subscription[]) {
    const subscriptionEnum = new EnumDeclaration(new Identifier('SubscriptionName'), []).export();
    const subscriptions = new ObjectLiteral();
    const publishFunctions: VariableDeclaration[] = [];
    data.forEach(it => {
      const event = it.entity.name + it.event;
      subscriptionEnum.addMembers(new EnumMember(new Identifier(event), new StringLiteral(event)));
      const fn =
        it.filters.length === 0 ? this.createAsyncIteratorCall(event) : this.createWithFilter(event, it.filters);
      subscriptions.addProperties(
        new PropertyAssignment(event, new ObjectLiteral(new PropertyAssignment('subscribe', fn))),
      );
      publishFunctions.push(
        tsg
          .variable(
            'const',
            new Identifier(`publish${event}`),
            new ArrowFunction(
              [
                tsg.parameter(
                  'entity',
                  tsg
                    .typeRef(it.event === 'Deleted' ? it.entity.identifiableInterfaceName() : it.entity.name)
                    .importFrom(Directory.entityPath(Directory.paths.generated, it.entity.name)),
                ),
              ],
              tsg.typeRef('Promise', [KeywordTypeNode.void]),
              new Identifier('pubsub.publish').call(
                new Identifier(`SubscriptionName.${event}`),
                new ObjectLiteral(tsg.propertyAssign(event, new Identifier('entity'))),
              ),
            ),
          )
          .export(),
      );
    });
    return new TsFile(
      subscriptionEnum,
      new VariableDeclaration('const', new Identifier('subscription'), subscriptions).export(),
      ...publishFunctions,
    );
  }

  private createWithFilter(event: string, filters: string[]) {
    const binaryExpressions = filters
      .map(it => new BinaryExpression(tsg.identifier(`result.${it}`), '===', new Identifier(`variables.${it}`)))
      .reduce((previousValue, currentValue) => new BinaryExpression(previousValue, '&&', currentValue));

    return new Identifier('withFilter')
      .importFrom('graphql-subscriptions')
      .call(
        this.createAsyncIteratorCall(event),
        new ArrowFunction(
          [new Parameter('payload', KeywordTypeNode.any), new Parameter('variables', KeywordTypeNode.any)],
          new TypeReference('Promise', [KeywordTypeNode.boolean]),
          new Block(
            new VariableDeclaration(
              'const',
              new Identifier('result'),
              new AwaitExpression(new Identifier(`payload.${event}`)),
            ),
            new ReturnStatement(binaryExpressions),
          ),
        ).toAsync(),
      );
  }

  private createData(nodes: MutationNode[]): Subscription[] {
    return nodes
      .filter(it => it.subscribed)
      .map(it => ({
        entity: it.entityName,
        event: it.type,
        filters: it.subscriptionFilters.map(it => it.columnName),
      }));
  }
}
