import { TsCode } from '../abstruct/tsCode';
import { isCode, TsType } from './type/type';
import { MethodModifiers } from './modifier/methodModifiers';
import { Parameter } from './parameter';
import { TsStatement } from '../abstruct/statement';

export class MethodDeclaration extends TsCode {
  private _modifiers: MethodModifiers = new MethodModifiers();
  constructor(
    private methodName: string,
    private params: Parameter[],
    private returnType: TsType,
    private body: TsStatement[],
  ) {
    super();
    this.mergeImport(...params, ...body);
    if (isCode(returnType)) this.mergeImport(returnType);
  }

  modifiers(modifiers: MethodModifiers): this {
    this._modifiers = modifiers;
    return this;
  }

  importFrom(from: string): this {
    this.addImport([this.methodName], from);
    return this;
  }

  protected toTsString(): string {
    const params = this.params.map(it => it.toString()).join(',');
    return (
      this._modifiers.toString() +
      `${this.methodName}(${params}): ${this.returnType}` +
      `{${this.body.map(it => it.toString()).join('')}}\n`
    );
  }
}
