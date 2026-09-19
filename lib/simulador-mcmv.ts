export type McmvBand = 1 | 2 | 3 | null

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
  prazoAnos: 10 | 15 | 20 | 25 | 30
}

export type McmvResult = {
  faixa: McmvBand
  faixaLabel: string
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
  1: { maxIncome: 2850, subsidyMax: 55000, annualRate: 4 },
  2: { maxIncome: 4700, subsidyMax: 29000, annualRate: (4.75 + 7) / 2 },
  3: { maxIncome: 8000, subsidyMax: 0, annualRate: (7.66 + 8.16) / 2 },
} as const

function money(value: number) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Math.max(0, Number.isFinite(parsed) ? parsed : 0)
}
function monthlyRate(annualPercent: number) { return Math.pow(1 + annualPercent / 100, 1 / 12) - 1 }

export function classifyMcmvBand(income: number): McmvBand {
  const value = money(income)
  if (value <= 2850) return 1
  if (value <= 4700) return 2
  if (value <= 8000) return 3
  return null
}

export function estimateSubsidy(input: McmvInput, band: McmvBand): number {
  if (!band || input.possuiImovel || input.usouBeneficio) return 0
  const maximum = BANDS[band].subsidyMax
  const availableAfterOwnResources = money(input.valorImovel) - money(input.entrada) - Math.min(money(input.fgtsUtilizado), money(input.saldoFgts))
  return Math.min(maximum, Math.max(0, availableAfterOwnResources))
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
  if (input.possuiImovel) warnings.push('O cliente informa que já possui imóvel próprio; a elegibilidade ao MCMV fica comprometida.')
  if (input.usouBeneficio) warnings.push('O cliente informa que já utilizou benefício habitacional; é necessária verificação da regra aplicável antes de considerar novo benefício.')
  if (!input.primeiroImovel && !input.possuiImovel) warnings.push('O cliente informa que não é o primeiro imóvel; confirme as regras de enquadramento antes da contratação.')
  if (!band) warnings.push('A renda familiar informada está acima de R$ 8.000 e fica fora das faixas consideradas neste simulador.')
  if (requestedFgts > availableFgts) warnings.push('O FGTS utilizado foi limitado ao saldo informado.')
  const fgtsUsed = Math.min(requestedFgts, availableFgts)
  const subsidyMax = band ? BANDS[band].subsidyMax : 0
  const subsidyUsed = Math.min(
    estimateSubsidy(input, band),
    Math.max(0, propertyValue - entry - fgtsUsed)
  )
  const financed = Math.max(0, propertyValue - entry - fgtsUsed - subsidyUsed)
  if (propertyValue > 0 && entry + fgtsUsed + subsidyUsed > propertyValue) {
    warnings.push('Os recursos informados foram ajustados para não ultrapassar o valor do imóvel.')
  }
  if (financed <= 0 && propertyValue > 0) {
    warnings.push('Com os recursos informados, não há saldo a financiar nesta estimativa.')
  }
  const annualRate = band ? BANDS[band].annualRate : 0
  const rate = monthlyRate(annualRate)
  const months = Math.max(1, termYears * 12)
  const amortization = financed / months
  const initialPayment = amortization + financed * rate
  const finalPayment = amortization + amortization * rate
  const averagePayment = (initialPayment + finalPayment) / 2
  const commitment = income > 0 ? (initialPayment / income) * 100 : 0
  const totalInterest = financed * rate * (months + 1) / 2
  const totalPaid = financed + totalInterest
  if (commitment > 30) warnings.push('A parcela inicial estimada supera 30% da renda familiar informada. O comprometimento real depende da análise de crédito e das demais obrigações do cliente.')

  return { faixa:band, faixaLabel:band?`Faixa ${band} do MCMV`:'Fora do MCMV', subsidyMax, subsidyUsed, fgtsUsed, financed, annualRate, monthlyRate:rate, months, initialPayment, finalPayment, averagePayment, commitment, totalPaid, warnings }
}

export function formatMoney(value: number) {
  return money(value).toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
}
