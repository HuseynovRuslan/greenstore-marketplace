/**
 * The frontend contract as data: the property names of every interface and the values of every string-literal union
 * in src/types/index.ts and src/services/repository.ts. Written to backend/contracts/frontend-types.json by
 * backend/seed/export.mjs; the API's contract tests (ContractShapeTests) compare every response with it, so a renamed
 * field or enum value on either side fails a test. src/test/backendSeed.test.ts checks the file is current.
 */
import ts from 'typescript'

export interface ContractProperty {
  optional: boolean
  /** The TypeScript type as written, e.g. "string", "PlantFacts", "Array<{ date: string; views: number }>" */
  type: string
}

export interface FrontendContract {
  interfaces: Record<string, Record<string, ContractProperty>>
  unions: Record<string, string[]>
}

/** Interfaces that are not JSON shapes. */
const skipped = new Set(['MarketplaceRepository'])

function nameOf(name: ts.PropertyName, source: ts.SourceFile): string {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : name.getText(source)
}

/** `'a' | 'b'` → ['a', 'b']; undefined when the alias is anything else. */
function stringUnion(type: ts.TypeNode): string[] | undefined {
  const members = ts.isUnionTypeNode(type) ? type.types : [type]
  const values: string[] = []
  for (const member of members) {
    if (!ts.isLiteralTypeNode(member) || !ts.isStringLiteral(member.literal)) return undefined
    values.push(member.literal.text)
  }
  return values
}

/** Reads the given files (path → source text). Declarations merge as TypeScript merges them. */
export function extractFrontendContract(files: Record<string, string>): FrontendContract {
  const interfaces: FrontendContract['interfaces'] = {}
  const unions: FrontendContract['unions'] = {}

  for (const [path, text] of Object.entries(files)) {
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS)
    source.forEachChild((node) => {
      if (ts.isInterfaceDeclaration(node) && !skipped.has(node.name.text)) {
        const properties = (interfaces[node.name.text] ??= {})
        // `interface X extends PageResult<T>`: the inherited properties are listed under the base interface.
        for (const member of node.members) {
          if (ts.isPropertySignature(member) && member.type) {
            properties[nameOf(member.name, source)] = { optional: Boolean(member.questionToken), type: member.type.getText(source).replace(/\s+/g, ' ') }
          }
        }
      } else if (ts.isTypeAliasDeclaration(node)) {
        const values = stringUnion(node.type)
        if (values) unions[node.name.text] = values
      }
    })
  }

  const sorted = <T,>(record: Record<string, T>) => Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)))
  return {
    interfaces: sorted(Object.fromEntries(Object.entries(interfaces).map(([name, props]) => [name, sorted(props)]))),
    unions: sorted(unions),
  }
}

/** The files the contract is read from, relative to the repository root. */
export const contractSources = ['src/types/index.ts', 'src/services/repository.ts']
