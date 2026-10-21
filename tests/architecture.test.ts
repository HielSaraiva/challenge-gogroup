import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";

const sourceRoot = path.resolve("src");
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(file)
      : /\.tsx?$/.test(file)
        ? [file]
        : [];
  });
}
const files = sourceFiles(sourceRoot);
const sources = new Map(
  files.map((file) => [
    file,
    ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    ),
  ]),
);
const imports = new Map(
  files.map((file) => {
    const dependencies: string[] = [];
    function visit(node: ts.Node) {
      if (ts.isImportDeclaration(node)) {
        const clause = node.importClause;
        const named = clause?.namedBindings;
        const typeOnly =
          clause?.isTypeOnly ||
          (!clause?.name &&
            named &&
            ts.isNamedImports(named) &&
            named.elements.every((item) => item.isTypeOnly));
        if (!typeOnly && ts.isStringLiteral(node.moduleSpecifier))
          dependencies.push(node.moduleSpecifier.text);
      } else if (ts.isExportDeclaration(node)) {
        if (
          !node.isTypeOnly &&
          node.moduleSpecifier &&
          ts.isStringLiteral(node.moduleSpecifier)
        )
          dependencies.push(node.moduleSpecifier.text);
      } else if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        dependencies.push(node.arguments[0].text);
      }
      ts.forEachChild(node, visit);
    }
    visit(sources.get(file)!);
    return [file, dependencies];
  }),
);
function resolve(from: string, specifier: string) {
  const base = specifier.startsWith("@/")
    ? path.join(sourceRoot, specifier.slice(2))
    : specifier.startsWith(".")
      ? path.resolve(path.dirname(from), specifier)
      : undefined;
  return (
    base &&
    [
      base + ".ts",
      base + ".tsx",
      path.join(base, "index.ts"),
      path.join(base, "index.tsx"),
    ].find((file) => sources.has(file))
  );
}
const relative = (file: string) =>
  path.relative(sourceRoot, file).split(path.sep).join("/");

describe("architecture boundaries", () => {
  it("keeps domain rules independent of UI, HTTP and persistence", () => {
    const violations = files
      .filter((file) => relative(file).startsWith("domain/"))
      .flatMap((file) =>
        imports.get(file)!.flatMap((specifier) => {
          const target = resolve(file, specifier);
          const forbidden = target
            ? !relative(target).startsWith("domain/")
            : /^(react|next|groq-sdk|drizzle-orm|@neondatabase)(\/|$)/.test(
                specifier,
              );
          return forbidden ? [`${relative(file)} -> ${specifier}`] : [];
        }),
      );
    expect(violations).toEqual([]);
  });
  it("keeps server modules independent of React pages and components", () => {
    const violations = files
      .filter((file) => relative(file).startsWith("server/"))
      .flatMap((file) =>
        imports.get(file)!.flatMap((specifier) => {
          const target = resolve(file, specifier);
          return target && /^(app|components)\//.test(relative(target))
            ? [`${relative(file)} -> ${relative(target)}`]
            : [];
        }),
      );
    expect(violations).toEqual([]);
  });
  it("prevents client import graphs from reaching server code, providers or Node APIs", () => {
    const violations = new Set<string>();
    const visited = new Set<string>();
    function visit(file: string) {
      if (visited.has(file)) return;
      visited.add(file);
      for (const specifier of imports.get(file)!) {
        const target = resolve(file, specifier);
        if (
          (target && relative(target).startsWith("server/")) ||
          /^(node:|groq-sdk|drizzle-orm|@neondatabase)/.test(specifier)
        )
          violations.add(`${relative(file)} -> ${specifier}`);
        else if (target) visit(target);
      }
    }
    for (const [file, source] of sources)
      if (
        source.statements.some(
          (node) =>
            ts.isExpressionStatement(node) &&
            ts.isStringLiteral(node.expression) &&
            node.expression.text === "use client",
        )
      )
        visit(file);
    expect([...violations]).toEqual([]);
  });
  it("does not introduce circular runtime imports", () => {
    const visited = new Set<string>();
    const cycles: string[] = [];
    function visit(file: string, ancestors: string[]) {
      if (ancestors.includes(file)) {
        cycles.push(
          [...ancestors.slice(ancestors.indexOf(file)), file]
            .map(relative)
            .join(" -> "),
        );
        return;
      }
      if (visited.has(file)) return;
      for (const specifier of imports.get(file)!) {
        const target = resolve(file, specifier);
        if (target) visit(target, [...ancestors, file]);
      }
      visited.add(file);
    }
    for (const file of files) visit(file, []);
    expect(cycles).toEqual([]);
  });
});
