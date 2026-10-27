// Static FK charset/collation analysis; Prisma migrate deploy remains authoritative.
const CREATE = /CREATE\s+TABLE\s+\x60([^\x60]+)\x60\s*\(([\s\S]*?)\)\s*DEFAULT\s+CHARACTER\s+SET\s+(\w+)\s+COLLATE\s+(\w+)\s*;/gi;
const ALTER = /ALTER\s+TABLE\s+\x60([^\x60]+)\x60\s+([\s\S]*?);/gi;
// Accept compound organization-scoped FKs and inspect every paired column.
const FK = /CONSTRAINT\s+\x60([^\x60]+)\x60\s+FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+\x60([^\x60]+)\x60\s*\(([^)]+)\)/gi;
function fkColumns(list) {
  const names = [...list.matchAll(/\x60([^\x60]+)\x60/g)].map(x => x[1]);
  return names.length > 0 && /^\s*\x60[^\x60]+\x60(?:\s*,\s*\x60[^\x60]+\x60)*\s*$/.test(list) ? names : [];
}
const TEXTUAL = new Set(['VARCHAR', 'CHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT']);
function columnType(sql, column) {
  if (!/^[a-zA-Z_][a-zA-Z_0-9]*$/.test(column)) return null;
  const rx = new RegExp('(?:^|[,\\n])\\s*(?:ADD\\s+COLUMN\\s+)?\\x60' + column +
    '\\x60\\s+(VARCHAR|CHAR|TEXT|TINYTEXT|MEDIUMTEXT|LONGTEXT|INT|INTEGER|BIGINT|SMALLINT|TINYINT|BOOLEAN|DATETIME|DECIMAL)\\b', 'i');
  return sql.match(rx)?.[1]?.toUpperCase() ?? null;
}
export function auditMigrationSources(sources) {
  const tables = new Map();
  const fks = new Map();
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
      tables.set(table, { charset, collation, declaration: body, columnOverrides: new Map() });
      for (const key of body.matchAll(FK)) fks.set(table + '.' + key[1], { path, table, name: key[1], columns: fkColumns(key[2]), parent: key[3], targets: fkColumns(key[4]) });
    }
    for (const match of sql.matchAll(ALTER)) {
      const [, table, body] = match;
      const existing = tables.get(table);
      if (!existing) {
        findings.push(path + ': ALTER TABLE has no previously declared table ' + table + '.');
        continue;
      }
      existing.declaration += '\n' + body;
      for (const modified of body.matchAll(/MODIFY\s+COLUMN\s+`([^`]+)`\s+(?:VARCHAR|CHAR)\([0-9]+\)\s+CHARACTER\s+SET\s+(\w+)\s+COLLATE\s+(\w+)/gi)) {
        existing.columnOverrides.set(modified[1], { charset: modified[2], collation: modified[3] });
      }
      for (const dropped of body.matchAll(/DROP\s+FOREIGN\s+KEY\s+`([^`]+)`/gi)) {
        const key = table + '.' + dropped[1];
        if (!fks.delete(key)) findings.push(path + ': attempted to drop unknown FK ' + key + '.');
      }
      for (const key of body.matchAll(FK)) fks.set(table + '.' + key[1], { path, table, name: key[1], columns: fkColumns(key[2]), parent: key[3], targets: fkColumns(key[4]) });
    }
    const total = (sql.match(/\bFOREIGN\s+KEY\b/gi) ?? []).length - (sql.match(/\bDROP\s+FOREIGN\s+KEY\b/gi) ?? []).length;
    const recognized = [...sql.matchAll(FK)].length;
    if (total !== recognized) findings.push(path + ': parsed ' + recognized + '/' + total + ' FK constraints.');
  }
  for (const fk of fks.values()) {
    const source = tables.get(fk.table), destination = tables.get(fk.parent);
    if (!source || !destination) {
      findings.push(fk.path + ': ' + fk.name + ': FK table not found.');
      continue;
    }
    if (fk.columns.length === 0 || fk.columns.length !== fk.targets.length) {
      findings.push(fk.path + ': ' + fk.name + ': malformed or mismatched FK column list.');
      continue;
    }
    for (let index = 0; index < fk.columns.length; index++) {
      const column = fk.columns[index];
      const target = fk.targets[index];
      const sourceType = columnType(source.declaration, column);
      const destinationType = columnType(destination.declaration, target);
      if (!sourceType || !destinationType) {
        findings.push(fk.path + ': ' + fk.name + ': FK column declaration not found (' + column + ' -> ' + target + ').');
        continue;
      }
      const sourceText = TEXTUAL.has(sourceType);
      const targetText = TEXTUAL.has(destinationType);
      if (sourceText !== targetText) {
        findings.push(fk.path + ': ' + fk.name + ': incompatible FK column categories (' + column + ' -> ' + target + ').');
      } else if (sourceText) {
        const sourceEffective = source.columnOverrides.get(column) ?? source;
        const targetEffective = destination.columnOverrides.get(target) ?? destination;
        if (sourceEffective.charset !== targetEffective.charset || sourceEffective.collation !== targetEffective.collation) {
          findings.push(fk.path + ': ' + fk.name + ': ' + fk.table + '.' + column + ' (' + sourceEffective.collation +
            ') -> ' + fk.parent + '.' + target + ' (' + targetEffective.collation + '): incompatible FK charset/collation.');
        }
      }
    }
  }
  return { tables: tables.size, foreignKeys: fks.size, findings };
}
