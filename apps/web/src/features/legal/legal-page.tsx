import { ArrowLeft, ArrowRight, FileText } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { usePageTitle } from '@/hooks/use-page-title'
import { legalDocuments, legalRevision, operator } from './legal-documents'
import './legal.css'

export function LegalEntry({ onNavigate }: { onNavigate?: () => void }) {
  return <Link to="/legal" className="legal-entry" onClick={onNavigate}><FileText aria-hidden="true" />Información legal</Link>
}

function DocumentLink({ href, label }: { href: string; label: string }) {
  return href.startsWith('/') ? <Link to={href}>{label}</Link> : <a href={href}>{label}</a>
}

export function LegalPage() {
  const { document: slug } = useParams()
  const document = legalDocuments.find(item => item.slug === slug)
  usePageTitle(document?.title ?? (slug ? 'Página legal no encontrada' : 'Información legal'))

  return <main className="forum-main legal-main" id="forum-content" tabIndex={-1}>
    {slug && <Link to="/legal" className="legal-back"><ArrowLeft aria-hidden="true" />Información legal</Link>}
    {document ? <article className="legal-article">
      <header className="legal-heading">
        <h1>{document.title}</h1>
        <p>{document.description}</p>
        <p className="legal-revision">Revisado el <time dateTime={legalRevision}>12 de noviembre de 2026</time></p>
      </header>
      <details className="legal-outline">
        <summary>En esta página</summary>
        <nav aria-label="Índice del documento">
          <ul>{document.sections.map(section => <li key={section.id}><Link to={'#' + section.id}>{section.heading}</Link></li>)}</ul>
        </nav>
      </details>
      {document.sections.map(section => <section key={section.id} className="legal-section" aria-labelledby={section.id}>
        <h2 id={section.id} tabIndex={-1}>{section.heading}</h2>
        {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        {section.points && <ul>{section.points.map(point => <li key={point}>{point}</li>)}</ul>}
        {section.links && <ul className="legal-references" aria-label="Enlaces relacionados">
          {section.links.map(link => <li key={link.href}><DocumentLink {...link} /></li>)}
        </ul>}
      </section>)}
    </article> : slug ? <header className="legal-heading">
      <h1>Página legal no encontrada</h1>
      <p>Consulta el índice para encontrar el documento que necesitas.</p>
    </header> : <>
      <header className="legal-heading">
        <h1>Información legal</h1>
        <p>Condiciones, privacidad y normas para participar en Foris.</p>
      </header>
      <nav aria-label="Documentos legales">
        <ul className="legal-index">
          {legalDocuments.map(item => <li key={item.slug}>
            <Link to={'/legal/' + item.slug} aria-labelledby={'legal-title-' + item.slug}>
              <div><h2 id={'legal-title-' + item.slug}>{item.title}</h2><p>{item.description}</p></div>
              <ArrowRight aria-hidden="true" />
            </Link>
          </li>)}
        </ul>
      </nav>
      <footer className="legal-contact">
        <p>Foris es operado por {operator.name} desde {operator.country}.</p>
        <a href={'mailto:' + operator.email}>{operator.email}</a>
      </footer>
    </>}
  </main>
}
