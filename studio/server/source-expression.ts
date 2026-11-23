import type ts from 'typescript';
import { createRequire } from 'node:module';
import { SourceFileError } from './source-files.ts';

const require = createRequire(import.meta.url);
let compiler: typeof import('typescript') | undefined;
/** Parse supported literals without importing or executing the source module. */
export function sourceExpression(source: string, name: string, wrapper: string, importPath: string) {
  // Keep synchronous validation intact; load the compiler only when a data.ts is actually read.
  const ts = compiler ??= require('typescript') as typeof import('typescript');
  const ast = ts.createSourceFile('data.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const invalid = () => { throw new SourceFileError('UNSUPPORTED_FORMAT'); };
  if ((ast as ts.SourceFile & { parseDiagnostics: readonly unknown[] }).parseDiagnostics.length) invalid();
  const bindings = ast.statements.filter(ts.isImportDeclaration).flatMap(statement => {
    if (!ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== importPath) return [];
    const bindings = statement.importClause?.namedBindings;
    return bindings && ts.isNamedImports(bindings) ? bindings.elements.filter(item => item.name.text === wrapper && !item.propertyName) : [];
  });
  if (bindings.length !== 1) invalid();
  const declarations = ast.statements.filter(ts.isVariableStatement).filter(statement => statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword))
    .flatMap(statement => statement.declarationList.flags & ts.NodeFlags.Const ? [...statement.declarationList.declarations] : []).filter(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === name);
  if (declarations.length !== 1) invalid();
  const call = declarations[0]!.initializer;
  if (!call || !ts.isCallExpression(call) || !ts.isIdentifier(call.expression) || call.expression.text !== wrapper || call.arguments.length !== 1 || call.typeArguments) return invalid();
  const expression = call.arguments[0]!;
  let count = 0;
  function literal(node: ts.Node, depth = 0): unknown {
    if (depth > 20 || ++count > 20000) return invalid();
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isArrayLiteralExpression(node)) return node.elements.map(item => literal(item, depth + 1));
    if (ts.isObjectLiteralExpression(node)) {
      const result: Record<string, unknown> = {};
      for (const member of node.properties) {
        if (!ts.isPropertyAssignment(member) || !ts.isIdentifier(member.name) && !ts.isStringLiteral(member.name)) return invalid();
        const key = member.name.text;
        if (['__proto__', 'constructor', 'prototype'].includes(key) || Object.hasOwn(result, key)) return invalid();
        result[key] = literal(member.initializer, depth + 1);
      }
      return result;
    }
    return invalid();
  }
  const value = literal(expression);
  return {
    value,
    /** Publication of one Build entry must preserve every other entry's exact source bytes. */
    serializeEntry(index:number,candidate:unknown):string {
      if(!ts.isArrayLiteralExpression(expression)||!Array.isArray(value)||!Number.isInteger(index)||index<0||index>value.length)return invalid();
      if(index<value.length&&JSON.stringify(candidate)===JSON.stringify(value[index]))return source;
      const json=JSON.stringify(candidate,null,2);if(json===undefined)return invalid();
      const newline=source.includes('\r\n')?'\r\n':'\n',text=json.replaceAll('\n',newline);
      if(index===value.length){const point=expression.end-1,comma=expression.elements.length&&!expression.elements.hasTrailingComma?',':'';return source.slice(0,point)+comma+newline+text+newline+source.slice(point);}
      const entry=expression.elements[index]!,start=entry.getStart(ast),end=entry.end;
      const scanner=ts.createScanner(ts.ScriptTarget.Latest,false,ts.LanguageVariant.Standard,source.slice(start,end));
      for(let token=scanner.scan();token!==ts.SyntaxKind.EndOfFileToken;token=scanner.scan())if(token===ts.SyntaxKind.SingleLineCommentTrivia||token===ts.SyntaxKind.MultiLineCommentTrivia)return invalid();
      return source.slice(0,start)+text+source.slice(end);
    },
    serialize(candidate: unknown): string {
      if (JSON.stringify(candidate) === JSON.stringify(value)) return source;
      const start = expression.getStart(ast), end = expression.end;
      const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, source.slice(start, end));
      for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
        if (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia) invalid();
      }
      const newline = source.includes('\r\n') ? '\r\n' : '\n';
      return source.slice(0, start) + JSON.stringify(candidate, null, 2).replaceAll('\n', newline) + source.slice(end);
    },
  };
}
