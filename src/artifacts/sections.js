export function extractSectionBody(content, heading) {
  const normalized = content.replace(/\r\n/g, "\n");
  const startIndex = normalized.indexOf(`${heading}\n`);

  if (startIndex === -1) {
    return "";
  }

  const sectionStart = startIndex + heading.length + 1;
  const remainder = normalized.slice(sectionStart);
  const nextHeadingIndex = remainder.search(/\n##\s+/);

  if (nextHeadingIndex === -1) {
    return remainder.trim();
  }

  return remainder.slice(0, nextHeadingIndex).trim();
}

export function replaceSectionBody(content, heading, nextBody) {
  const normalized = content.replace(/\r\n/g, "\n");
  const startIndex = normalized.indexOf(`${heading}\n`);

  if (startIndex === -1) {
    return content;
  }

  const sectionStart = startIndex + heading.length + 1;
  const remainder = normalized.slice(sectionStart);
  const nextHeadingIndex = remainder.search(/\n##\s+/);
  const before = normalized.slice(0, sectionStart);
  const after = nextHeadingIndex === -1 ? "" : remainder.slice(nextHeadingIndex);
  const trimmedBody = nextBody.trim();

  return `${before}${trimmedBody}\n${after}`.replace(/\n{3,}/g, "\n\n");
}

export function extractBulletValues(sectionBody) {
  return sectionBody
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim().replace(/^`|`$/g, ""));
}

export function bulletList(values) {
  if (!values || values.length === 0) {
    return "- none";
  }

  return values.map((value) => `- ${value}`).join("\n");
}
