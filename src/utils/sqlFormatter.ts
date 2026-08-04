/**
 * Lightweight SQL formatter.
 * Uppercases keywords, places major clauses on new lines and indents
 * comma-separated column lists. Preserves string literals and identifiers.
 */

const MAJOR_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET',
  'UNION ALL', 'UNION', 'INTERSECT', 'EXCEPT',
  'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'FULL JOIN', 'CROSS JOIN', 'JOIN',
  'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'ON CONFLICT',
  'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'RETURNING',
];

const TOKEN_REGEX = /('(?:[^']|'')*'|"(?:[^"]|"")*"|`[^`]*`|[^\s'"]+|\s+)/g;

export function formatSql(sql: string): string {
  const trimmed = sql.trim();
  if (!trimmed) return '';

  // Tokenize while keeping quoted literals intact
  const tokens = trimmed.match(TOKEN_REGEX)?.filter((t) => t.trim().length > 0) || [];
  if (tokens.length === 0) return trimmed;

  const majorUpper = MAJOR_KEYWORDS.map((k) => k.toUpperCase());
  const minorIndent = new Set(['AND', 'OR', 'ON', 'WHEN', 'ELSE', 'END']);
  const scalars = new Set(['AS', 'ASC', 'DESC', 'DISTINCT', 'NOT', 'IN', 'IS', 'LIKE', 'BETWEEN', 'BY', 'ALL', 'CASE', 'THEN']);

  const out: string[] = [];
  let i = 0;

  const peekTwo = (): string => {
    if (i + 1 >= tokens.length) return '';
    return (tokens[i] + ' ' + tokens[i + 1]).toUpperCase();
  };

  const isMajor = (): boolean => {
    const two = peekTwo();
    const one = tokens[i].toUpperCase();
    if (majorUpper.includes(two)) return true;
    return majorUpper.includes(one);
  };
  void isMajor;

  let lastWasMajor = false;

  while (i < tokens.length) {
    let token = tokens[i];
    const upper = token.toUpperCase();
    const two = peekTwo();

    // Uppercase known keywords (single or two-word)
    let consumed = 1;
    if (majorUpper.includes(two)) {
      token = two;
      consumed = 2;
    } else if (majorUpper.includes(upper) || minorIndent.has(upper) || scalars.has(upper)) {
      token = upper;
    }

    const major = majorUpper.includes(token.toUpperCase());

    if (major && out.length > 0) {
      out.push('\n');
      lastWasMajor = true;
    } else if (minorIndent.has(token.toUpperCase()) && out.length > 0) {
      out.push('\n  ');
    } else if (token === ',' && lastWasMajor && tokens[i - 1] && tokens[i - 1].toUpperCase() === 'SELECT') {
      // keep inline for SELECT list but newline-indent
      out.push(',\n  ');
      i += consumed;
      continue;
    } else if (out.length > 0 && !out[out.length - 1].endsWith('\n') && !out[out.length - 1].endsWith(' ')) {
      out.push(' ');
    }

    out.push(token);
    if (major) lastWasMajor = true;
    i += consumed;
  }

  const NL = String.fromCharCode(10);
  let result = out
    .join('')
    .split(NL)
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join(NL);
  while (result.includes(NL + NL)) {
    result = result.split(NL + NL).join(NL);
  }
  result = result.trim();
  // Add trailing semicolon if missing
  if (!result.endsWith(';')) result += ';';
  return result;
}
