import React from 'react';
import { Link } from 'react-router-dom';
import Header from './Header';
import LandingSidebar from './LandingSidebar';
import { useStore } from '../store/useStore';
import { LegalBlock, parseLegalDocument } from '../utils/legalDocument';
import '../styles/legal.css';

type LegalDocumentPageProps = {
  icon: React.ReactNode;
  badge: string;
  fallbackTitle: string;
  description: string;
  raw: string;
  alertTitle: string;
  alertText: string;
  alertTone?: 'success' | 'danger';
};

function renderMetaChip(label: string, value: string) {
  return (
    <div key={label} className="legal-meta-chip">
      <strong>{label}:</strong>
      <span>{value}</span>
    </div>
  );
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
}: LegalDocumentPageProps) {
  const { user } = useStore();
  const doc = React.useMemo(() => parseLegalDocument(raw, fallbackTitle), [raw, fallbackTitle]);
  const sectionLinks = doc.blocks.filter((block): block is Extract<LegalBlock, { type: 'section' }> => block.type === 'section');
  const leadingParagraph = doc.blocks.find((block): block is Extract<LegalBlock, { type: 'paragraph' }> => block.type === 'paragraph');

  let bullets: string[] = [];
  let leadingParagraphSkipped = false;

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
            {doc.version ? renderMetaChip('Версия документа', doc.version) : null}
            {doc.updatedAt ? renderMetaChip('Последнее обновление', doc.updatedAt) : null}
            {doc.part ? renderMetaChip('Раздел документа', doc.part) : null}
          </div>
        </section>

        <section className="legal-grid">
          <aside className="legal-toc">
            <h2>Оглавление</h2>
            <p>Структура документа синхронизирована с новым PDF. Ниже - основные разделы для быстрого перехода.</p>
            <div className="legal-toc-list">
              {sectionLinks.map((section) => (
                <a key={section.id} href={`#${section.id}`} className="legal-toc-link">
                  {section.text}
                </a>
              ))}
            </div>
          </aside>

          <article className="legal-card">
            <div className={`legal-alert${alertTone === 'danger' ? ' danger' : ''}`}>
              <strong>{alertTitle}</strong>
              <p>{alertText}</p>
            </div>

            {leadingParagraph ? <p className="legal-paragraph">{leadingParagraph.text}</p> : null}

            {doc.blocks.map((block, index) => {
              if (!leadingParagraphSkipped && block === leadingParagraph) {
                leadingParagraphSkipped = true;
                return null;
              }

              if (block.type === 'section') {
                if (bullets.length) bullets = [];
                return (
                  <section key={block.id} id={block.id} className="legal-section">
                    <h2 className="legal-section-title">{block.text}</h2>
                  </section>
                );
              }

              if (block.type === 'subsection') {
                if (bullets.length) bullets = [];
                return (
                  <h3 key={block.id} id={block.id} className="legal-subsection-title">
                    {block.text}
                  </h3>
                );
              }

              if (block.type === 'bullet') {
                bullets.push(block.text);
                const next = doc.blocks[index + 1];
                const shouldFlush = !next || next.type !== 'bullet';
                if (!shouldFlush) return null;
                const items = [...bullets];
                bullets = [];
                return (
                  <ul key={`bullets-${index}`} className="legal-bullet-list">
                    {items.map((item, itemIndex) => (
                      <li key={`${index}-${itemIndex}`}>{item}</li>
                    ))}
                  </ul>
                );
              }

              if (block.type === 'paragraph') {
                return (
                  <p key={`paragraph-${index}`} className="legal-paragraph">
                    {block.text}
                  </p>
                );
              }

              return null;
            })}

            <div className="legal-footer-note">
              Если вы заметили неточность, конфликт формулировок или юридически важную ошибку, сообщите об этом через{' '}
              <Link to="/support">Техподдержку SafeGram</Link>. Мы обновим опубликованный текст после проверки.
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
