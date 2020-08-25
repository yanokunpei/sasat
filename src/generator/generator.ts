import { IrGql } from '../ir/gql';
import { IrGqlContext } from '../ir/gql/context';
import { EntityNode } from '../node/entity';
import { RepositoryNode } from '../node/repository';
import { CodeGeneratable } from '../node/codeGeneratable';
import { ContextNode } from '../node/gql/contextNode';
import { MutationNode } from '../node/gql/mutationNode';

export interface CodeGenerator {
  readonly fileExt: string;
  generateEntity(entity: EntityNode): string;
  generateGeneratedRepository(repository: RepositoryNode): string;
  generateRepository(repository: RepositoryNode): string;
  generateGqlTypeDefs(gql: IrGql): string;
  generateGqlResolver(gql: IrGql): string;
  generateGqlQuery(gql: IrGql): string;
  generateGqlMutation(nodes: MutationNode[]): string;
  generateGqlSubscription(nodes: MutationNode[]): string;
  generateGqlContext(contexts: ContextNode[]): string;
  generateOnceFiles(ir: CodeGeneratable): Array<{ name: string; body: string }>;
}
