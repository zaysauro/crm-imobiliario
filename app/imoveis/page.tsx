'use client'

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import AppShell from '../../components/app-shell'
import BookCard from '../../components/books/BookCard'
import styles from './BooksPage.module.css'
import { createClient } from '../../supabase-client'

type Book = {
  id: string
  nome_empreendimento: string
  localizacao: string | null
  tipo: string | null
  faixa_mcmv: string | null
  metragem: string | null
  data_lancamento: string | null
  resumo: string | null
  file_path: string
  file_name: string
  file_size: number | null
  created_at: string
}

type FormState = {
  nome_empreendimento: string
  localizacao: string
  tipo: string
  faixa_mcmv: string
  metragem: string
  data_lancamento: string
  resumo: string
}

const empty: FormState = {
  nome_empreendimento: '',
  localizacao: '',
  tipo: '',
  faixa_mcmv: '',
  metragem: '',
  data_lancamento: '',
  resumo: '',
}

function pick(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      return match[1].trim().replace(/\s+/g, ' ')
    }
  }
  return ''
}

function summarize(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const location = pick(normalized, [
    /(?:localiza(?:ç|c)ão|endereço|fica em)\s*[:\-]?\s*([^.;]{5,100})/i,
  ])
  const type = pick(normalized, [
    /(?:tipo|tipologia)\s*[:\-]?\s*((?:apartamento|casa|sobrado|studio|kitnet)[^.;]{0,50})/i,
  ])
  const area = pick(normalized, [
    /(?:metragem|área privativa|area privativa)\s*[:\-]?\s*([0-9]+(?:[.,][0-9]+)?\s*m²?)/i,
  ])
  const value = pick(normalized, [
    /(?:R\$|valor)\s*([0-9]{2,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?)/i,
  ])
  const launch = pick(normalized, [
    /(?:lançamento|lancamento|entrega prevista|previsão de lançamento)\s*[:\-]?\s*([^.;]{4,50})/i,
  ])
  const faixa = pick(normalized, [
    /(?:MCMV|Minha Casa Minha Vida|faixa)\s*[:\-]?\s*(Faixa\s*[1-4]|Classe\s*[A-C]|[^.;]{0,35})/i,
  ])

  const parts: string[] = []
  if (location) parts.push(`Localização: ${location}`)
  if (type) parts.push(`Tipo: ${type}`)
  if (area) parts.push(`Metragem: ${area}`)
  if (value) parts.push(`Valor encontrado no book: R$ ${value}`)
  if (faixa) parts.push(`MCMV: ${faixa}`)
  if (launch) parts.push(`Lançamento/entrega: ${launch}`)

  return parts.join(' · ')
}

async function extractPdf(file: File) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  }).promise

  let text = ''
  const pages = Math.min(pdf.numPages, 20)

  for (let i = 1; i <= pages; i += 1) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += ' ' + content.items.map((item: any) => ('str' in item ? item.str : '')).join(' ')
  }

  return text
}

export default function ImoveisPage() {
  const supabase = useMemo(() => createClient(), [])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [role, setRole] = useState('corretor')
  const [books, setBooks] = useState<Book[]>([])
  const [form, setForm] = useState<FormState>(empty)
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Book | null>(null)

  async function load() {
    const { data, error: loadError } = await supabase
      .from('mcmv_books')
      .select('*')
      .order('created_at', { ascending: false })

    if (loadError) {
      setError(loadError.message)
      return
    }

    setBooks((data ?? []) as Book[])
  }

  useEffect(() => {
    let active = true

    async function initialize() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || !active) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (!active) return

      setRole(profile?.role ?? 'corretor')
      await load()
    }

    void initialize()

    return () => {
      active = false
    }
  }, [supabase])

  function handleUploadClick() {
    fileInputRef.current?.click()
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]
    event.target.value = ''

    if (!selected) return

    if (
      selected.type !== 'application/pdf' &&
      !selected.name.toLowerCase().endsWith('.pdf')
    ) {
      setError('Envie um arquivo PDF.')
      return
    }

    setProcessing(true)
    setError('')
    setMessage('')
    setFile(selected)

    try {
      const text = await extractPdf(selected)
      const summary = summarize(text)

      setForm((current) => ({
        ...current,
        resumo: summary,
        nome_empreendimento:
          current.nome_empreendimento ||
          selected.name
            .replace(/\.pdf$/i, '')
            .replace(/[-_]+/g, ' '),
      }))

      setMessage('PDF lido. Revise os campos extraídos antes de salvar.')
    } catch {
      setError(
        'Não foi possível ler o texto deste PDF. Você ainda pode preencher os campos manualmente.',
      )
    } finally {
      setProcessing(false)
    }
  }

  async function save() {
    if (!form.nome_empreendimento.trim()) {
      setError('Preencha o nome do empreendimento.')
      return
    }

    if (!editing && !file) {
      setError('Selecione o book em PDF.')
      return
    }

    setProcessing(true)
    setError('')
    setMessage('Salvando book...')

    let path = editing?.file_path ?? ''

    if (file) {
      path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

      const { error: uploadError } = await supabase.storage
        .from('mcmv-books')
        .upload(path, file, {
          contentType: 'application/pdf',
          upsert: false,
        })

      if (uploadError) {
        setError(uploadError.message)
        setProcessing(false)
        return
      }
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('Sua sessão expirou. Faça login novamente.')
      setProcessing(false)
      return
    }

    const payload = {
      uploaded_by: user.id,
      nome_empreendimento: form.nome_empreendimento.trim(),
      localizacao: form.localizacao.trim() || null,
      tipo: form.tipo.trim() || null,
      faixa_mcmv: form.faixa_mcmv.trim() || null,
      metragem: form.metragem.trim() || null,
      data_lancamento: form.data_lancamento || null,
      resumo: form.resumo.trim() || null,
      file_path: path,
      file_name: file?.name || editing?.file_name || '',
      file_size: file?.size || editing?.file_size || null,
    }

    const result = editing
      ? await supabase.from('mcmv_books').update(payload).eq('id', editing.id)
      : await supabase.from('mcmv_books').insert(payload)

    if (result.error) {
      setError(result.error.message)
      setProcessing(false)
      return
    }

    setForm(empty)
    setFile(null)
    setEditing(null)
    setMessage('✓ Book cadastrado!')
    await load()
    setProcessing(false)
  }

  async function openBook(book: Book) {
    const { data, error: openError } = await supabase.storage
      .from('mcmv-books')
      .createSignedUrl(book.file_path, 3600)

    if (openError || !data?.signedUrl) {
      setError(openError?.message || 'Não foi possível abrir o book.')
      return
    }

    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  function edit(book: Book) {
    setEditing(book)
    setForm({
      nome_empreendimento: book.nome_empreendimento,
      localizacao: book.localizacao || '',
      tipo: book.tipo || '',
      faixa_mcmv: book.faixa_mcmv || '',
      metragem: book.metragem || '',
      data_lancamento: book.data_lancamento || '',
      resumo: book.resumo || '',
    })
    setFile(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function remove(book: Book) {
    if (!confirm(`Excluir o book ${book.nome_empreendimento}?`)) return

    await supabase.storage.from('mcmv-books').remove([book.file_path])
    await supabase.from('mcmv_books').delete().eq('id', book.id)
    await load()
  }

  const canManage = role === 'admin' || role === 'gerente'
  const normalizedSearch = search.toLowerCase()

  const filtered = books.filter((book) => {
    return (
      book.nome_empreendimento.toLowerCase().includes(normalizedSearch) ||
      (book.localizacao || '').toLowerCase().includes(normalizedSearch)
    )
  })

  const nameError = error === 'Preencha o nome do empreendimento.'

  return (
    <AppShell role={role}>
      <main className={styles.page}>
        <div className={styles.breadcrumb}>
          Produtos · Minha Casa Minha Vida
        </div>

        <h1 className={styles.title}>Books MCMV</h1>

        <p className={styles.subtitle}>
          Catálogo interno dos empreendimentos. O gerente cadastra o book e os
          corretores consultam antes de abrir o PDF.
        </p>

        {canManage && (
          <>
            <div className={styles.sectionLabel}>ADICIONAR BOOK</div>

            <section className={styles.card}>
              <div
                className={
                  file ? styles.uploadSelected : styles.uploadZone
                }
                onClick={file ? undefined : handleUploadClick}
                role={file ? 'status' : 'button'}
                tabIndex={file ? -1 : 0}
                onKeyDown={(event) => {
                  if (
                    !file &&
                    (event.key === 'Enter' || event.key === ' ')
                  ) {
                    event.preventDefault()
                    fileInputRef.current?.click()
                  }
                }}
              >
                {file ? (
                  <div className={styles.selectedFile}>
                    <span>
                      ✅ {file.name.replace(/\.pdf$/i, '')}
                    </span>

                    <button
                      type="button"
                      className={styles.removeFile}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        setFile(null)
                      }}
                      aria-label="Remover arquivo"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className={styles.uploadInner}>
                    <div className={styles.uploadIcon}>📄</div>
                    <div className={styles.uploadTitle}>
                      Envie o PDF da construtora
                    </div>
                    <div className={styles.uploadHint}>
                      Arraste ou clique para selecionar · O CRM extrai as
                      informações automaticamente
                    </div>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                className={styles.uploadInput}
                type="file"
                accept="application/pdf,.pdf"
                onChange={chooseFile}
                disabled={processing}
              />
            </section>

            <div className={styles.form}>
              <div className={styles.grid}>
                <label className={styles.field}>
                  <span className={styles.label}>
                    Nome do empreendimento{' '}
                    <span className={styles.required}>*</span>
                  </span>

                  <input
                    className={`${styles.input} ${nameError ? styles.inputError : ''}`}
                    value={form.nome_empreendimento}
                    onChange={(event) => {
                      setForm({
                        ...form,
                        nome_empreendimento: event.target.value,
                      })

                      if (nameError) setError('')
                    }}
                  />

                  {nameError && (
                    <span className={styles.fieldError}>
                      Preencha o nome do empreendimento.
                    </span>
                  )}
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Localização</span>
                  <input
                    className={styles.input}
                    placeholder="ex: Pinhais, PR"
                    value={form.localizacao}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        localizacao: event.target.value,
                      })
                    }
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Tipo</span>
                  <select
                    className={styles.select}
                    value={form.tipo}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        tipo: event.target.value,
                      })
                    }
                  >
                    <option value="">Selecione</option>
                    <option>Apartamento</option>
                    <option>Casa</option>
                    <option>Sobrado</option>
                  </select>
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Faixa MCMV</span>
                  <select
                    className={styles.select}
                    value={form.faixa_mcmv}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        faixa_mcmv: event.target.value,
                      })
                    }
                  >
                    <option value="">Selecione</option>
                    <option>Faixa 1</option>
                    <option>Faixa 2</option>
                    <option>Faixa 3</option>
                  </select>
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Metragem</span>
                  <input
                    className={styles.input}
                    placeholder="ex: 21m² a 54m²"
                    value={form.metragem}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        metragem: event.target.value,
                      })
                    }
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Data de lançamento</span>
                  <input
                    className={styles.input}
                    type="date"
                    value={form.data_lancamento}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        data_lancamento: event.target.value,
                      })
                    }
                  />
                </label>

                <label
                  className={`${styles.field} ${styles.fieldFull}`}
                >
                  <span className={styles.label}>
                    Dica para o corretor
                  </span>

                  <textarea
                    className={styles.textarea}
                    rows={3}
                    placeholder="Destaque o que faz o corretor lembrar desse empreendimento na hora certa — localização, diferenciais, perfil de cliente ideal..."
                    value={form.resumo}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        resumo: event.target.value,
                      })
                    }
                  />
                </label>
              </div>

              {error && !nameError && (
                <div className={styles.formError}>{error}</div>
              )}

              <div className={styles.buttonRow}>
                <button
                  className={styles.primary}
                  onClick={save}
                  disabled={processing}
                >
                  {processing
                    ? 'Processando...'
                    : editing
                      ? 'Salvar alterações'
                      : '+ Cadastrar book'}
                </button>
              </div>
            </div>
          </>
        )}

        <section className={`${styles.card} ${styles.catalog}`}>
          <div className={styles.catalogHeader}>
            <div>
              <h2 className={styles.catalogTitle}>Catálogo MCMV</h2>
              <div className={styles.count}>
                {books.length} empreendimento
                {books.length === 1 ? '' : 's'} cadastrado
                {books.length === 1 ? '' : 's'}
              </div>
            </div>

            <div className={styles.catalogTools}>
              <input
                className={styles.search}
                placeholder="Buscar empreendimento ou localização..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              {editing && (
                <button
                  className={styles.cancel}
                  onClick={() => {
                    setEditing(null)
                    setFile(null)
                    setForm(empty)
                  }}
                >
                  Cancelar edição
                </button>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>📂</span>
              <span>Nenhum book cadastrado ainda.</span>
            </div>
          ) : (
            <div className={styles.gridBooks}>
              {filtered.map((book) => (
                <BookCard
                  key={book.id}
                  nome={book.nome_empreendimento}
                  localizacao={book.localizacao || undefined}
                  tipo={book.tipo || undefined}
                  faixaMcmv={book.faixa_mcmv || undefined}
                  metragem={book.metragem || undefined}
                  lancamento={book.data_lancamento || undefined}
                  dica={book.resumo || undefined}
                  pdfUrl={book.file_path || undefined}
                  criadoEm={book.created_at}
                  onOpen={() => openBook(book)}
                  onEdit={canManage ? () => edit(book) : undefined}
                  onDelete={canManage ? () => remove(book) : undefined}
                />
              ))}
            </div>
          )}
        </section>

        {message === '✓ Book cadastrado!' && (
          <div className={styles.toast}>✓ Book cadastrado!</div>
        )}
      </main>
    </AppShell>
  )
}
