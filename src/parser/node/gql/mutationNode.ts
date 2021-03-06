import { ContextParamNode } from './contextParamNode';
import { SubscriptionFilterNode } from './subscriptionFilterNode';
import { EntityNode } from '../entityNode';
import { ParameterNode } from '../parameterNode';
import { TypeNode } from '../typeNode';
import { DBColumnTypes } from '../../../migration/column/columnTypes';
import { EntityName } from '../entityName';

type MutationType = 'Created' | 'Deleted' | 'Updated';

export abstract class MutationNode {
  protected constructor(
    readonly entity: EntityNode,
    readonly entityName: EntityName,
    readonly type: MutationType,
    readonly requestParams: ParameterNode[],
    readonly contextParams: ContextParamNode[],
    readonly returnType: TypeNode,
    readonly primaryKeys: string[],
    readonly primaryFindQueryName: string,
    readonly subscribed: boolean,
    readonly subscriptionFilters: SubscriptionFilterNode[],
  ) {}

  publishFunctionName(): string {
    return `publish${this.entityName}${this.type}`;
  }

  useContextParams(): boolean {
    return this.contextParams.length !== 0;
  }

  toTypeDefString(): string {
    return (
      this.functionName() +
      ParameterNode.parametersToGqlString(...this.requestParams) +
      ':' +
      this.returnType.toGqlString()
    );
  }

  abstract functionName(): string;

  static isCreateMutation(node: MutationNode): node is CreateMutationNode {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return node instanceof CreateMutationNode;
  }
  static isUpdateMutation(node: MutationNode): node is UpdateMutationNode {
    return node.type === 'Updated';
  }
  static isDeleteMutation(node: MutationNode): node is DeleteMutationNode {
    return node.type === 'Deleted';
  }
}

export class CreateMutationNode extends MutationNode {
  private __created = true;
  constructor(
    entity: EntityNode,
    primaryKeys: string[],
    primaryFindQueryName: string,
    contextParams: ContextParamNode[],
    subscribed: boolean,
    subscriptionFilters: SubscriptionFilterNode[],
  ) {
    super(
      entity,
      entity.entityName,
      'Created',
      [
        ...entity.onCreateRequiredFields().map(it => it.toParam()),
        ...entity.onCreateOptionalFields().map(it => it.toOptionalParam()),
      ],
      contextParams,
      new TypeNode(entity.entityName, false, false),
      primaryKeys,
      primaryFindQueryName,
      subscribed,
      subscriptionFilters,
    );
  }

  functionName(): string {
    return `create${this.entityName}`;
  }
}

export class UpdateMutationNode extends MutationNode {
  private __updated = true;
  constructor(
    entity: EntityNode,
    primaryKeys: string[],
    primaryFindQueryName: string,
    contextParams: ContextParamNode[],
    subscribed: boolean,
    subscriptionFilters: SubscriptionFilterNode[],
  ) {
    super(
      entity,
      entity.entityName,
      'Updated',
      [...entity.identifiableFields().map(it => it.toParam()), ...entity.dataFields().map(it => it.toOptionalParam())],
      contextParams,
      new TypeNode(DBColumnTypes.boolean, false, false),
      primaryKeys,
      primaryFindQueryName,
      subscribed,
      subscriptionFilters,
    );
  }
  functionName(): string {
    return `update${this.entityName}`;
  }
}

export class DeleteMutationNode extends MutationNode {
  private __deleted = true;
  constructor(
    entity: EntityNode,
    primaryKeys: string[],
    primaryFindQueryName: string,
    contextParams: ContextParamNode[],
    subscribed: boolean,
    subscriptionFilters: SubscriptionFilterNode[],
  ) {
    super(
      entity,
      entity.entityName,
      'Deleted',
      [...entity.identifiableFields().map(it => it.toParam())],
      contextParams,
      new TypeNode(DBColumnTypes.boolean, false, false),
      primaryKeys,
      primaryFindQueryName,
      subscribed,
      subscriptionFilters,
    );
  }
  functionName(): string {
    return `delete${this.entityName}`;
  }
}
