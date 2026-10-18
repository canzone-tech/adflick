// Static FK charset/collation analysis; Prisma migrate deploy remains authoritative.
const CREATE = /CREATE\s+TABLE\s+\x60([^\x60]+)\x60\s*\(([\s\S]*?)\)\s*DEFAULT\s+CHARACTER\s+SET\s+(\w+)\s+COLLATE\s+(\w+)\s*;/gi;
const ALTER = /ALTER\s+TABLE\s+\x60([^\x60]+)\x60\s+([\s\S]*?);/gi;
const FK = /CONSTRAINT\s+\x60([^\x60]+)\x60\s+FOREIGN\s+KEY\s*\(\s*\x60([^\x60]+)\x60\s*\)\s+REFERENCES\s+\x60([^\x60]+)\x60\s*\(\s*\x60([^\x60]+)\x60\s*\)/gi;
const TEXTUAL = new Set(['VARCHAR', 'CHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT']);
function columnType(sql, column) {
  if (!/^[a-zA-Z_][a-zA-Z_0-9]*$/.test(column)) return null;
  const rx = new RegExp('(?:^|[,\\n])\\s*(?:ADD\\s+COLUMN\\s+)?\\x60' + column +
    '\\x60\\s+(VARCHAR|CHAR|TEXT|TINYTEXT|MEDIUMTEXT|LONGTEXT|INT|INTEGER|BIGINT|SMALLINT|TINYINT|BOOLEAN|DATETIME|DECIMAL)\\b', 'i');
  return sql.match(rx)?.[1]?.toUpperCase() ?? null;
}
export function auditMigrationSources(sources) {
  const tables = new Map();
  const fks = [];
  const findings = [];
  for (const { path, sql } of sources) {
    const declarations = [...sql.matchAll(CREATE)];
    if (declarations.length !== (sql.match(/\bCREATE\s+TABLE\b/gi) ?? []).length) {
      findings.push(path + ': CREATE TABLE parsing incomplete.');
    }
    for (const match of declarations) {
      const [, table, body, charset, collation] = match;
      if (tables.has(table)) {
        findings.push(path + ': duplicate CREATE TABLE ' + table + '.');
        continue;
      }
      tables.set(table, { charset, collation, declaration: body });
      for (const key of body.matchAll(FK)) fks.push({ path, table, name: key[1], column: key[2], parent: key[3], target: key[4] });
    }
    for (const match of sql.matchAll(ALTER)) {
      const [, table, body] = match;
      const existing = tables.get(table);
      if (!existing) {
        findings.push(path + ': ALTER TABLE has no previously declared table ' + table + '.');
        continue;
      }
      existing.declaration += '\n' + body;
      for (const key of body.matchAll(FK)) fks.push({ path, table, name: key[1], column: key[2], parent: key[3], target: key[4] });
    }
    const total = (sql.match(/\bFOREIGN\s+KEY\b/gi) ?? []).length;
    const recognized = fks.filter(f => f.path === path).length;
    if (total !== recognized) findings.push(path + ': parsed ' + recognized + '/' + total + ' FK constraints.');
  }
  for (const fk of fks) {
    const source = tables.get(fk.table), destination = tables.get(fk.parent);
    if (!source || !destination) {
      findings.push(fk.path + ': ' + fk.name + ': FK table not found.');
      continue;
    }
    const sourceType = columnType(source.declaration, fk.column);
    const destinationType = columnType(destination.declaration, fk.target);
    if (!sourceType || !destinationType) {
      findings.push(fk.path + ': ' + fk.name + ': FK column declaration not found.');
      continue;
    }
    const sourceText = TEXTUAL.has(sourceType);
    const targetText = TEXTUAL.has(destinationType);
    if (sourceText !== targetText) {
      findings.push(fk.path + ': ' + fk.name + ': incompatible FK column categories.');
    } else if (sourceText && (source.charset !== destination.charset || source.collation !== destination.collation)) {
      findings.push(fk.path + ': ' + fk.name + ': ' + fk.table + '.' + fk.column + ' (' + source.collation +
        ') -> ' + fk.parent + '.' + fk.target + ' (' + destination.collation + '): incompatible FK charset/collation.');
    }
  }
  return { tables: tables.size, foreignKeys: fks.length, findings };
}
