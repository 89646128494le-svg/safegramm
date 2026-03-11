import React from 'react';
import { Link } from 'react-router-dom';
import Header from './Header';
import LandingSidebar from './LandingSidebar';
import { useStore } from '../store/useStore';
import { LegalBlock, parseLegalDocument } from '../utils/legalDocument';
import '../styles/legal.css';

type LegalHighlight = {
  label: string;
  value: string;
};

type LegalDocumentPageProps = {
  icon: React.ReactNode;
  badge: string;
  fallbackTitle: string;
  description: string;
  raw: string;
  alertTitle: string;
  alertText: string;
  alertTone?: 'success' | 'danger';
  highlights?: LegalHighlight[];
};

type SectionGroup = {
  section: Extract<LegalBlock, { type: 'section' }>;
  items: LegalBlock[];
};

function renderMetaChip(label: string, value: string) {
  return (
    <div key={label} className="legal-meta-chip">
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
}

function splitHeading(text: string) {
  const match = text.match(/^(\d+(?:\.\d+)?\.)\s*(.*)$/u);
  if (!match) return { index: '', label: text };
  return { index: match[1], label: match[2] || text };
}

function renderBlocks(blocks: LegalBlock[], prefix: string) {
  const nodes: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = (key: string) => {
    if (!bullets.length) return;
    nodes.push(
      <ul key={key} className="legal-bullet-list">
        {bullets.map((item, itemIndex) => (
          <li key={`${key}-${itemIndex}`}>{item}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  blocks.forEach((block, index) => {
    if (block.type === 'bullet') {
      bullets.push(block.text);
      return;
    }

    flushBullets(`${prefix}-bullets-${index}`);

    if (block.type === 'subsection') {
      const subsection = splitHeading(block.text);
      nodes.push(
        <div key={`${prefix}-subsection-${index}`} className="legal-subsection-card" id={block.id}>
          {subsection.index ? <span className="legal-subsection-index">{subsection.index}</span> : null}
          <h3 className="legal-subsection-title">{subsection.label}</h3>
        </div>,
      );
      return;
    }

    if (block.type === 'paragraph') {
      nodes.push(
        <p key={`${prefix}-paragraph-${index}`} className="legal-paragraph">
          {block.text}
        </p>,
      );
    }
  });

  flushBullets(`${prefix}-bullets-final`);

  return nodes;
}

export default function LegalDocumentPage({
  icon,
  badge,
  fallbackTitle,
  description,
  raw,
  alertTitle,
  alertText,
  alertTone = 'success',
  highlights = [],
}: LegalDocumentPageProps) {
  const { user } = useStore();
  const doc = React.useMemo(() => parseLegalDocument(raw, fallbackTitle), [raw, fallbackTitle]);

  const sectionLinks = doc.blocks.filter(
    (block): block is Extract<LegalBlock, { type: 'section' }> => block.type === 'section',
  );

  const sectionGroups = React.useMemo(() => {
    const groups: SectionGroup[] = [];
    const preface: LegalBlock[] = [];
    let current: SectionGroup | null = null;

    doc.blocks.forEach((block) => {
      if (block.type === 'part' || block.type === 'title' || block.type === 'meta') return;

      if (block.type === 'section') {
        current = { section: block, items: [] };
        groups.push(current);
        return;
      }

      if (current) {
        current.items.push(block);
      } else {
        preface.push(block);
      }
    });

    return { groups, preface };
  }, [doc.blocks]);

  const introParagraphs = sectionGroups.preface.filter(
    (block): block is Extract<LegalBlock, { type: 'paragraph' }> => block.type === 'paragraph',
  );

  return (
    <div className="legal-shell">
      <Header user={user} onLogout={() => {}} />
      <LandingSidebar />
      <main className="legal-main">
        <section className="legal-hero">
          <div className="legal-badge">{badge}</div>
          <div className="legal-title-row">
            <div className="legal-icon">{icon}</div>
            <div>
              <h1 className="legal-title">{doc.title}</h1>
              <p className="legal-subtitle">{description}</p>
            </div>
          </div>

          <div className="legal-meta">
            {doc.version ? renderMetaChip('Версия', doc.version) : null}
            {doc.updatedAt ? renderMetaChip('Последнее обновление', doc.updatedAt) : null}
            {doc.part ? renderMetaChip('Раздел', doc.part) : null}
          </div>

          {highlights.length ? (
            <div className="legal-highlight-grid">
              {highlights.map((item) => (
                <div key={item.label} className="legal-highlight-card">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="legal-grid">
          <aside className="legal-toc">
            <h2>Навигация по документу</h2>
            <p>Основные разделы вынесены отдельно, чтобы можно было быстро перейти к нужному блоку.</p>
            <div className="legal-toc-list">
              {sectionLinks.map((section) => (
                <a key={section.id} href={`#${section.id}`} className="legal-toc-link">
                  {splitHeading(section.text).label}
                </a>
              ))}
            </div>
          </aside>

          <article className="legal-card">
            <div className={`legal-alert${alertTone === 'danger' ? ' danger' : ''}`}>
              <strong>{alertTitle}</strong>
              <p>{alertText}</p>
            </div>

            {introParagraphs.length ? (
              <section className="legal-intro-card">
                <span className="legal-intro-label">Коротко</span>
                {introParagraphs.slice(0, 2).map((paragraph, index) => (
                  <p key={`intro-${index}`} className="legal-paragraph">
                    {paragraph.text}
                  </p>
                ))}
              </section>
            ) : null}

            <div className="legal-section-stack">
              {sectionGroups.groups.map((group, index) => {
                const sectionHeading = splitHeading(group.section.text);
                return (
                  <section key={group.section.id} id={group.section.id} className="legal-section-card">
                    <div className="legal-section-head">
                      <div className="legal-section-badge">{sectionHeading.index || index + 1}</div>
                      <div className="legal-section-copy">
                        <h2 className="legal-section-title">{sectionHeading.label}</h2>
                      </div>
                    </div>
                    <div className="legal-section-body">{renderBlocks(group.items, group.section.id)}</div>
                  </section>
                );
              })}
            </div>

            <div className="legal-footer-note">
              Если вы заметили неточность, конфликт формулировок или юридически важную ошибку, сообщите об этом через{' '}
              <Link to="/support">Техподдержку SafeGram</Link>. Мы проверим замечание и при необходимости обновим
              опубликованный текст.
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
