export function parseMarkdownArtifact(content) {
  const { frontmatterText, body } = splitFrontmatter(content);

  return {
    frontmatter: parseSimpleYaml(frontmatterText),
    headings: extractHeadings(body),
    body
  };
}

export function hasHeading(headings, heading) {
  return headings.includes(heading);
}

function splitFrontmatter(content) {
  const normalized = content.replace(/\r\n/g, "\n");

  if (!normalized.startsWith("---\n")) {
    return { frontmatterText: "", body: normalized };
  }

  const closingIndex = normalized.indexOf("\n---\n", 4);

  if (closingIndex === -1) {
    return { frontmatterText: "", body: normalized };
  }

  return {
    frontmatterText: normalized.slice(4, closingIndex),
    body: normalized.slice(closingIndex + 5)
  };
}

function parseSimpleYaml(text) {
  const result = {};

  if (!text) {
    return result;
  }

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();

    if (!line || line.trimStart().startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    result[key] = stripQuotes(rawValue);
  }

  return result;
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function extractHeadings(body) {
  return body
    .split("\n")
    .filter((line) => /^#{1,6}\s+/.test(line))
    .map((line) => line.trim());
}
