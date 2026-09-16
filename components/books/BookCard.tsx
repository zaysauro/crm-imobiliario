'use client'

import styles from './BookCard.module.css'

export interface BookCardProps {
  nome: string
  localizacao?: string
  tipo?: string
  faixaMcmv?: string
  metragem?: string
  lancamento?: string
  dica?: string
  pdfUrl?: string
  criadoEm: Date | string
  onOpen?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

const faixaClass: Record<string, string> = {
  'Faixa 1': styles.faixa1,
  'Faixa 2': styles.faixa2,
  'Faixa 3': styles.faixa3,
}

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const isToday = target.getTime() === today.getTime()
  return isToday ? 'Cadastrado hoje' : `Cadastrado em ${date.toLocaleDateString('pt-BR')}`
}

export default function BookCard({
  nome,
  localizacao,
  tipo,
  faixaMcmv,
  metragem,
  lancamento,
  dica,
  pdfUrl,
  criadoEm,
  onOpen,
  onEdit,
  onDelete,
}: BookCardProps) {
  const faixa = faixaMcmv?.trim()

  return (
    <article className={styles.card}>
      <div className={styles.cover}>
        <span className={styles.pdfBadge}>PDF</span>
        <span className={styles.building} aria-hidden="true">🏗️</span>
        {faixa && faixaClass[faixa] && <span className={`${styles.faixa} ${faixaClass[faixa]}`}>{faixa}</span>}
      </div>

      <div className={styles.body}>
        <h3 className={styles.title}>{nome}</h3>
        {localizacao && <p className={styles.location}>📍 {localizacao}</p>}

        <div className={styles.chips}>
          {tipo && <span className={styles.tipoChip}>{tipo}</span>}
          {metragem && <span className={styles.metragemChip}>{metragem}</span>}
        </div>

        <div className={`${styles.tip} ${!dica ? styles.tipEmpty : ''}`}>
          {dica ? dica : 'Nenhuma dica cadastrada ainda.'}
        </div>

        <div className={styles.footer}>
          <span className={styles.date}>{formatDate(criadoEm)}</span>
          <div className={styles.footerActions}>
            {onEdit && <button type="button" className={styles.secondaryAction} onClick={onEdit}>Editar</button>}
            {onDelete && <button type="button" className={styles.deleteAction} onClick={onDelete}>Excluir</button>}
            {pdfUrl || onOpen ? (
              <button type="button" className={styles.pdfAction} onClick={onOpen}>
                ↗ Abrir PDF
              </button>
            ) : (
              <span className={styles.noPdf}>Sem PDF</span>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
