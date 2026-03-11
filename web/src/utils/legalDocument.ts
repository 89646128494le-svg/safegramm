export type LegalBlock =
  | { type: 'part'; text: string }
  | { type: 'title'; text: string }
  | { type: 'meta'; label: string; value: string }
  | { type: 'section'; text: string; id: string }
  | { type: 'subsection'; text: string; id: string }
  | { type: 'bullet'; text: string }
  | { type: 'paragraph'; text: string };

export type LegalDocument = {
  part?: string;
  title: string;
  version?: string;
  updatedAt?: string;
  intro?: string;
  blocks: LegalBlock[];
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeInlineBreaks(line: string) {
  return line
    .replace(/\s+/g, ' ')
    .replace(/\s+-\s+/g, ' - ')
    .trim();
}

function isUpperHeadingFragment(line: string) {
  return /^[\p{Lu}0-9\s().&/-]+$/u.test(line);
}

function isSection(line: string) {
  return /^\d+\.\s/u.test(line);
}

function isSubsection(line: string) {
  return /^\d+\.\d+\.\s/u.test(line);
}

function isBullet(line: string) {
  return /^[-•●]\s/u.test(line);
}

function isMeta(line: string) {
  return /^Версия документа:|^Дата последнего обновления:/iu.test(line);
}

function isPart(line: string) {
  return /^ЧАСТЬ\s+[IVX]+\./iu.test(line);
}

function isNewBlock(line: string) {
  return isPart(line) || isMeta(line) || isSection(line) || isSubsection(line) || isBullet(line);
}

function flushParagraph(buffer: string[], blocks: LegalBlock[]) {
  if (!buffer.length) return;
  const text = normalizeInlineBreaks(buffer.join(' '));
  if (text) blocks.push({ type: 'paragraph', text });
  buffer.length = 0;
}

export function parseLegalDocument(raw: string, fallbackTitle: string): LegalDocument {
  const lines = raw
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks: LegalBlock[] = [];
  const paragraphBuffer: string[] = [];
  let part: string | undefined;
  let title = fallbackTitle;
  let version: string | undefined;
  let updatedAt: string | undefined;
  let intro: string | undefined;
  let titleSet = false;

  for (let i = 0; i < lines.length; i += 1) {
    let line = normalizeInlineBreaks(lines[i]);
    const next = normalizeInlineBreaks(lines[i + 1] || '');

    if (!titleSet && isPart(line)) {
      part = line;
      if (next && !isNewBlock(next) && !titleSet) {
        part = `${part} ${next}`;
        i += 1;
      }
      blocks.push({ type: 'part', text: part });
      continue;
    }

    if (!titleSet && !isNewBlock(line) && isUpperHeadingFragment(line)) {
      title = line;
      if (next && !isNewBlock(next) && next.length < 80 && !isMeta(next)) {
        title = `${title} ${next}`;
        i += 1;
      }
      titleSet = true;
      blocks.push({ type: 'title', text: title });
      continue;
    }

    if (isMeta(line)) {
      const [label, ...rest] = line.split(':');
      const value = normalizeInlineBreaks(rest.join(':'));
      if (/^Версия документа/i.test(line)) version = value;
      if (/^Дата последнего обновления/i.test(line)) updatedAt = value;
      blocks.push({ type: 'meta', label, value });
      continue;
    }

    if (isSection(line)) {
      flushParagraph(paragraphBuffer, blocks);
      if (next && !isNewBlock(next) && next.length < 72) {
        line = `${line} ${next}`;
        i += 1;
      }
      blocks.push({ type: 'section', text: line, id: slugify(line) });
      continue;
    }

    if (isSubsection(line)) {
      flushParagraph(paragraphBuffer, blocks);
      if (next && !isNewBlock(next) && next.length < 72) {
        line = `${line} ${next}`;
        i += 1;
      }
      blocks.push({ type: 'subsection', text: line, id: slugify(line) });
      continue;
    }

    if (isBullet(line)) {
      flushParagraph(paragraphBuffer, blocks);
      let bullet = line.replace(/^[-•●]\s*/u, '');
      if (next && !isNewBlock(next)) {
        bullet = `${bullet} ${next}`;
        i += 1;
      }
      blocks.push({ type: 'bullet', text: normalizeInlineBreaks(bullet) });
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph(paragraphBuffer, blocks);

  const introBlock = blocks.find(
    (block): block is Extract<LegalBlock, { type: 'paragraph' }> => block.type === 'paragraph',
  );
  intro = introBlock?.text;

  return {
    part,
    title,
    version,
    updatedAt,
    intro,
    blocks,
  };
}
