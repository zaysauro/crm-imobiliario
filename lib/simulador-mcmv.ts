export type McmvBand = 1 | 2 | 3 | 4 | null

export type McmvInput = {
  rendaFamiliar: number
  rendaIndividual: number
  idade: number
  estadoCivil: string
  dependentes: number
  possuiImovel: boolean
  usouBeneficio: boolean
  primeiroImovel: boolean
  saldoFgts: number
  tempoFgts: number
  uf: string
  cidade: string
  valorImovel: number
  entrada: number
  fgtsUtilizado: number
  tipoImovel: 'Apartamento' | 'Casa'
  situacao: 'Novo' | 'Usado'
  prazoAnos: 10 | 15 | 20 | 25 | 30 | 35
}

export type McmvResult = {
  faixa: McmvBand
  faixaLabel: string
  propertyLimit: number
  propertyEligible: boolean
  subsidyMax: number
  subsidyUsed: number
  fgtsUsed: number
  financed: number
  annualRate: number
  monthlyRate: number
  months: number
  initialPayment: number
  finalPayment: number
  averagePayment: number
  commitment: number
  totalPaid: number
  warnings: string[]
}

const BANDS = {
  1: { maxIncome: 3200, propertyLimit: 275000, subsidyMax: 55000, annualRate: 4.5 },
  2: { maxIncome: 5000, propertyLimit: 275000, subsidyMax: 55000, annualRate: 5.5 },
  3: { maxIncome: 9600, propertyLimit: 400000, subsidyMax: 0, annualRate: 7.66 },
  4: { maxIncome: 13000, propertyLimit: 600000, subsidyMax: 0, annualRate: 10 },
} as const

function money(value: number) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Math.max(0, Number.isFinite(parsed) ? parsed : 0)
}

function monthlyRate(annualPercent: number) {
  return Math.pow(1 + annualPercent / 100, 1 / 12) - 1
}

export function classifyMcmvBand(income: number): McmvBand {
  const value = money(income)
  if (value <= 3200) return 1
  if (value <= 5000) return 2
  if (value <= 9600) return 3
  if (value <= 13000) return 4
  return null
}

export function getPropertyLimit(band: McmvBand) {
  return band ? BANDS[band].propertyLimit : 0
}

export function estimateSubsidy(input: McmvInput, band: McmvBand): number {
  if (!band || (band !== 1 && band !== 2) || input.possuiImovel || input.usouBeneficio) return 0
  const maximum = BANDS[band].subsidyMax
  const fgtsEffective = Math.min(money(input.fgtsUtilizado), money(input.saldoFgts))
  const remainingAfterEntry = money(input.valorImovel) - money(input.entrada) - fgtsEffective
  return Math.min(maximum, Math.max(0, remainingAfterEntry))
}

export function calculateMcmv(input: McmvInput): McmvResult {
  const income = money(input.rendaFamiliar)
  const propertyValue = money(input.valorImovel)
  const entry = money(input.entrada)
  const requestedFgts = money(input.fgtsUtilizado)
  const availableFgts = money(input.saldoFgts)
  const termYears = Number(input.prazoAnos) || 30
  const band = classifyMcmvBand(income)
  const warnings: string[] = []

  if (input.possuiImovel) warnings.push('O cliente informa que já possui imóvel próprio. A elegibilidade ao MCMV precisa ser verificada.')
  if (input.usouBeneficio) warnings.push('O cliente informa que já utilizou benefício habitacional. É necessária verificação da regra aplicável.')
  if (!input.primeiroImovel && !input.possuiImovel) warnings.push('O cliente informa que não é o primeiro imóvel. Confirme as regras de enquadramento antes da contratação.')
  if (!band) warnings.push('A renda familiar está acima de R$ 13.000 e não se enquadra nas faixas atuais do Minha Casa, Minha Vida.')

  const propertyLimit = getPropertyLimit(band)
  const propertyEligible = band !== null && propertyValue <= propertyLimit
  if (band && propertyValue > propertyLimit) warnings.push(`O valor do imóvel (${formatMoney(propertyValue)}) ultrapassa o limite de ${formatMoney(propertyLimit)} permitido para a Faixa ${band}.`)

  const fgtsUsed = Math.min(requestedFgts, availableFgts)
  if (requestedFgts > availableFgts) warnings.push('O FGTS utilizado foi limitado ao saldo informado.')

  const subsidyMax = band ? BANDS[band].subsidyMax : 0
  const subsidyUsed = estimateSubsidy(input, band)

  const entryEffective = Math.min(entry, propertyValue)
  const remainingAfterEntry = Math.max(0, propertyValue - entryEffective)
  const fgtsEffective = Math.min(fgtsUsed, remainingAfterEntry)
  const remainingAfterFgts = Math.max(0, propertyValue - entryEffective - fgtsEffective)
  const subsidyEffective = Math.min(subsidyUsed, remainingAfterFgts)
  const financed = Math.max(0, propertyValue - entryEffective - fgtsEffective - subsidyEffective)

  if (financed === 0 && propertyValue > 0) warnings.push('A entrada, o FGTS e o subsídio estimado cobrem o valor total do imóvel. Não há saldo a financiar.')

  const annualRate = band ? BANDS[band].annualRate : 0
  const rate = monthlyRate(annualRate)
  const normalizedYears = Math.min(35, Math.max(1, termYears))
  const months = normalizedYears * 12
  const amortization = financed > 0 ? financed / months : 0
  const initialPayment = amortization + financed * rate
  const finalPayment = amortization + amortization * rate
  const averagePayment = (initialPayment + finalPayment) / 2
  const commitment = income > 0 ? (initialPayment / income) * 100 : 0
  const totalInterest = financed * rate * (months + 1) / 2
  const totalPaid = financed + totalInterest

  if (commitment > 30) warnings.push('A parcela inicial estimada supera 30% da renda familiar informada. O comprometimento real depende da análise de crédito e das demais obrigações do cliente.')

  return {
    faixa: band,
    faixaLabel: band === 4 ? 'Faixa 4 — Classe Média' : band ? `Faixa ${band} do MCMV` : 'Fora do MCMV',
    propertyLimit,
    propertyEligible,
    subsidyMax,
    subsidyUsed: subsidyEffective,
    fgtsUsed: fgtsEffective,
    financed,
    annualRate,
    monthlyRate: rate,
    months,
    initialPayment,
    finalPayment,
    averagePayment,
    commitment,
    totalPaid,
    warnings
  }
}

export function formatMoney(value: number) {
  return money(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
