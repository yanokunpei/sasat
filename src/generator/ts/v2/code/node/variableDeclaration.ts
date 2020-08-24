import { TsStatement } from '../abstruct/statement';
import { TsExpression } from '../abstruct/expression';
import { Identifier } from './Identifier';
import { ExportableDeclaration } from '../abstruct/exportableDeclaration';

type VariableType = 'const' | 'let';

export class VariableDeclaration extends ExportableDeclaration {
  constructor(
    private readonly type: VariableType,
    private readonly variableName: Identifier,
    private readonly expression: TsExpression | Identifier,
  ) {
    super();
    this.mergeImport(expression, variableName);
  }

  protected toTsString(): string {
    return `${this.type} ${this.variableName} = ${this.expression.toString()};`;
  }
}
