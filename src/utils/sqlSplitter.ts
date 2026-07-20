/**
 * Split SQL text into individual statements by semicolons,
 * while respecting string literals, quoted identifiers, and comments.
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let i = 0;
  const len = sql.length;

  while (i < len) {
    const ch = sql[i];

    // Single-line comment: -- ...
    if (ch === '-' && i + 1 < len && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i);
      if (end === -1) {
        current += sql.slice(i);
        break;
      } else {
        current += sql.slice(i, end + 1);
        i = end + 1;
        continue;
      }
    }

    // Multi-line comment: /* ... */
    if (ch === '/' && i + 1 < len && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      if (end === -1) {
        current += sql.slice(i);
        break;
      } else {
        current += sql.slice(i, end + 2);
        i = end + 2;
        continue;
      }
    }

    // String literals and quoted identifiers
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      current += ch;
      i++;
      while (i < len) {
        if (sql[i] === quote) {
          // Check for escaped quote (doubled)
          if (i + 1 < len && sql[i + 1] === quote) {
            current += sql[i] + sql[i + 1];
            i += 2;
            continue;
          }
          current += sql[i];
          i++;
          break;
        }
        // Backslash escape
        if (sql[i] === '\\' && i + 1 < len) {
          current += sql[i] + sql[i + 1];
          i += 2;
          continue;
        }
        current += sql[i];
        i++;
      }
      continue;
    }

    // Semicolon - statement delimiter
    if (ch === ';') {
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = '';
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  // Last statement (without trailing semicolon)
  const trimmed = current.trim();
  if (trimmed) {
    statements.push(trimmed);
  }

  return statements;
}
