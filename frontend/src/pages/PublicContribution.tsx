import { FormEvent, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, Copy, ExternalLink, KeyRound, Loader2, Mail, PlusCircle, RotateCcw, Send, ShieldCheck, Trash2 } from 'lucide-react'
import { api } from '../api'
import { DEFAULT_SITE_LOGO, useBranding } from '../branding'
import type { ContributionLookupAccount, OAuthURLResponse, PublicContributionAPIKeyResponse, PublicContributionStatusResponse } from '../types'
import { getErrorMessage } from '../utils/error'

const TEXT = {
  title: '\u8d26\u53f7\u8d21\u732e',
  subtitle: '\u8f93\u5165\u8054\u7cfb\u90ae\u7bb1\uff0c\u67e5\u8be2\u4f60\u662f\u5426\u5df2\u7ecf\u8d21\u732e\u8fc7\u8d26\u53f7',
  email: '\u8054\u7cfb\u90ae\u7bb1',
  invalidEmail: '\u8bf7\u8f93\u5165\u6709\u6548\u7684\u90ae\u7bb1\u5730\u5740',
  query: '\u67e5\u8be2\u8d21\u732e\u72b6\u6001',
  querying: '\u67e5\u8be2\u4e2d',
  contributed: '\u5df2\u8d21\u732e\u8d26\u53f7',
  notContributed: '\u8fd8\u672a\u8d21\u732e\u8d26\u53f7',
  matchedPrefix: '\u5df2\u5339\u914d\u5230 ',
  matchedSuffix: ' \u4e2a\u8d21\u732e\u8d26\u53f7',
  notMatchedDesc: '\u6ca1\u6709\u627e\u5230\u8be5\u90ae\u7bb1\u8d21\u732e\u8fc7\u7684\u8d26\u53f7\uff0c\u53ef\u4ee5\u7ee7\u7eed\u6dfb\u52a0\u8d26\u53f7',
  accountList: '\u8d26\u53f7\u5217\u8868',
  accountCount: '\u4e2a\u8d26\u53f7',
  usage: '\u7528\u91cf',
  health: '\u72b6\u6001',
  accountStatus: '\u8d26\u53f7\u72b6\u6001',
  testStatus: '\u6d4b\u8bd5\u72b6\u6001',
  available: '\u53ef\u7528',
  unavailable: '\u4e0d\u53ef\u7528',
  limited: '\u9650\u6d41\u4e2d',
  needsCheck: '\u9700\u786e\u8ba4',
  testPassed: '\u6d4b\u8bd5\u901a\u8fc7',
  testRateLimited: '\u6d4b\u8bd5\u9650\u6d41',
  testFailed: '\u6d4b\u8bd5\u5931\u8d25',
  notTested: '\u672a\u6d4b\u8bd5',
  credits: '\u91cd\u7f6e\u989d\u5ea6',
  updatedAt: '\u66f4\u65b0\u65f6\u95f4',
  delete: '\u5220\u9664',
  deleting: '\u5220\u9664\u4e2d',
  confirmDeletePrefix: '\u786e\u5b9a\u8981\u5220\u9664\u8fd9\u4e2a\u8d26\u53f7\u5417\uff1a',
  apiKeyDisableWarning: '\u5220\u9664\u540e\uff0c\u8be5\u8054\u7cfb\u90ae\u7bb1\u4e0b\u5c06\u6ca1\u6709\u8d21\u732e\u8d26\u53f7\uff0c\u5df2\u751f\u6210\u7684 API Key \u4f1a\u56e0\u6b64\u88ab\u505c\u7528\u3002',
  addTitle: '\u7ee7\u7eed\u6dfb\u52a0\u8d26\u53f7',
  addDesc: '\u53ef\u4ee5\u4e3a\u540c\u4e00\u8054\u7cfb\u90ae\u7bb1\u591a\u6b21\u6dfb\u52a0\u8d26\u53f7\uff0c\u6dfb\u52a0\u540e\u5217\u8868\u4f1a\u81ea\u52a8\u66f4\u65b0\u3002',
  nameLabel: '\u8d26\u53f7\u5907\u6ce8\uff08\u53ef\u9009\uff09',
  namePlaceholder: '\u4f8b\u5982\uff1a\u6211\u7684 Codex \u8d26\u53f7',
  generate: '\u751f\u6210\u6388\u6743\u94fe\u63a5',
  openAuth: '\u6253\u5f00\u6388\u6743\u9875\u9762',
  copyAuth: '\u590d\u5236\u6388\u6743\u94fe\u63a5',
  copyFailed: '\u590d\u5236\u5931\u8d25',
  apiKeyTitle: 'API Key',
  apiKeyDesc: '\u5df2\u8d21\u732e\u8d26\u53f7\u540e\u53ef\u751f\u6210\u4e00\u4e2a API Key \u548c\u670d\u52a1\u5730\u5740\u3002',
  apiKeyPlanRequired: '\u5f53\u524d\u8d26\u53f7\u7c7b\u578b\u4e0d\u5728 API Key \u53d1\u653e\u5141\u8bb8\u8303\u56f4\u5185\u3002',
  apiKeyName: 'Key \u540d\u79f0',
  apiKeyNamePlaceholder: '\u4f8b\u5982\uff1a\u6211\u7684 ChatGPT Key',
  generateApiKey: '\u751f\u6210 API Key',
  generatingApiKey: '\u751f\u6210\u4e2d',
  savedApiKey: '\u5df2\u751f\u6210 API Key',
  apiKeyValue: 'API Key',
  serviceBaseUrl: '\u670d\u52a1\u5730\u5740',
  providerGroup: '\u4f9b\u5e94\u5546\u5206\u7ec4',
  copyApiKey: '\u590d\u5236 Key',
  copyBaseUrl: '\u590d\u5236\u5730\u5740',
  existingApiKey: '\u5df2\u6709 Key\uff0c\u67e5\u8be2\u540e\u5df2\u81ea\u52a8\u663e\u793a\u3002',
  createdApiKey: 'API Key \u751f\u6210\u6210\u529f\u3002',
  callbackUrl: '\u56de\u8c03 URL',
  updateLink: '\u66f4\u65b0\u94fe\u63a5',
  completeAdd: '\u5b8c\u6210\u6dfb\u52a0',
  addSuccess: '\u8d26\u53f7\u6dfb\u52a0\u6210\u529f',
  invalidCallback: '\u8bf7\u7c98\u8d34\u5305\u542b code \u548c state \u53c2\u6570\u7684\u56de\u8c03 URL',
  privacy: '\u4ec5\u7528\u4e8e\u8d26\u53f7\u8d21\u732e\u67e5\u8be2\u4e0e\u7ed1\u5b9a\uff0c\u5220\u9664\u4f1a\u8fdb\u5165\u56de\u6536\u7ad9',
  unknown: '\u672a\u77e5',
  none: '\u65e0',
}

function isValidEmail(value: string): boolean {
  const email = value.trim()
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) && email.length <= 254
}

function parseOAuthCallbackParams(raw: string): { code: string; state: string } {
  const value = raw.trim()
  if (!value) return { code: '', state: '' }
  try {
    const parsed = new URL(value)
    return { code: parsed.searchParams.get('code') ?? '', state: parsed.searchParams.get('state') ?? '' }
  } catch {
    const params = new URLSearchParams(value.startsWith('?') ? value.slice(1) : value)
    return { code: params.get('code') ?? '', state: params.get('state') ?? '' }
  }
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function formatPercent(value?: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  return clampPercent(value).toFixed(1) + '%'
}

function formatDateTime(value?: string): string {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function normalizedStatus(status?: string | null): string {
  return (status || '').trim().toLowerCase()
}

function statusClass(status: string): string {
  const normalized = normalizedStatus(status)
  if (normalized === 'active' || normalized === 'ready') return 'border-emerald-500/20 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
  if (normalized.includes('rate') || normalized.includes('cooldown') || normalized.includes('quota')) return 'border-amber-500/20 bg-amber-500/12 text-amber-700 dark:text-amber-300'
  if (normalized.includes('error') || normalized.includes('unauthorized') || normalized.includes('deleted')) return 'border-red-500/20 bg-red-500/12 text-red-700 dark:text-red-300'
  return 'border-sky-500/20 bg-sky-500/12 text-sky-700 dark:text-sky-300'
}

function accountAvailability(status: string): string {
  const normalized = normalizedStatus(status)
  if (normalized === 'active' || normalized === 'ready') return TEXT.available
  if (normalized.includes('rate') || normalized.includes('cooldown') || normalized.includes('quota')) return TEXT.limited
  if (normalized.includes('error') || normalized.includes('unauthorized') || normalized.includes('deleted')) return TEXT.unavailable
  return status || TEXT.needsCheck
}

function testStatusLabel(account: ContributionLookupAccount): string {
  const testStatus = normalizedStatus(account.last_test_status)
  if (testStatus === 'success') return TEXT.testPassed
  if (testStatus === 'rate_limited') return TEXT.testRateLimited
  if (testStatus === 'failed' || testStatus === 'banned' || testStatus === 'error') return TEXT.testFailed
  if (testStatus) return account.last_test_status || TEXT.notTested

  const status = normalizedStatus(account.status)
  if (status === 'active' || status === 'ready') return TEXT.testPassed
  if (status.includes('rate') || status.includes('cooldown') || status.includes('quota')) return TEXT.testRateLimited
  if (status.includes('error') || status.includes('unauthorized') || status.includes('deleted')) return TEXT.testFailed
  return TEXT.notTested
}

function UsageBar({ label, value }: { label: string; value?: number | null }) {
  const hasValue = typeof value === 'number' && Number.isFinite(value)
  const width = hasValue ? clampPercent(value) : 0
  const barClass = width >= 90 ? 'bg-red-500' : width >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-semibold text-foreground">{formatPercent(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={'h-full rounded-full ' + barClass} style={{ width: hasValue ? width + '%' : '0%' }} />
      </div>
    </div>
  )
}

function AccountCard({ account, deleting, onDelete }: { account: ContributionLookupAccount; deleting: boolean; onDelete: (account: ContributionLookupAccount) => void }) {
  const displayName = account.name || account.email || 'ID ' + account.id
  const updatedAt = account.codex_usage_updated_at || account.codex_5h_usage_updated_at || account.updated_at
  return (
    <article className="grid min-w-0 gap-4 rounded-lg border border-border bg-background/60 p-4 shadow-sm xl:grid-cols-[minmax(180px,1fr)_minmax(180px,.95fr)_minmax(132px,.6fr)_88px] xl:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-sky-500/12 px-2 py-1 text-xs font-bold text-sky-700 ring-1 ring-sky-500/20 dark:text-sky-300">#{account.id}</span>
          <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground ring-1 ring-border">{account.plan_type || TEXT.unknown}</span>
        </div>
        <h3 className="mt-3 break-all text-base font-bold text-foreground xl:mt-2">{displayName}</h3>
        <p className="mt-1 break-all text-xs font-mono text-muted-foreground">{account.email || TEXT.unknown}</p>
      </div>

      <div className="space-y-3 border-t border-border pt-4 xl:border-t-0 xl:pt-0">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Clock3 className="size-3.5 text-sky-600 dark:text-sky-300" />
          {TEXT.usage}
        </div>
        <UsageBar label="7d" value={account.usage_percent_7d} />
        <UsageBar label="5h" value={account.usage_percent_5h} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm text-foreground xl:grid-cols-1 xl:gap-2">
        <div>
          <div className="text-xs text-muted-foreground">{TEXT.accountStatus}</div>
          <div className={'mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ' + statusClass(account.status)}>{accountAvailability(account.status)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{TEXT.testStatus}</div>
          <div className={'mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ' + statusClass(account.last_test_status || account.status)}>{testStatusLabel(account)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{TEXT.credits}</div>
          <div className="mt-1 font-semibold text-foreground">{account.rate_limit_reset_credits ?? 0}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{TEXT.updatedAt}</div>
          <div className="mt-1 font-semibold text-foreground">{formatDateTime(updatedAt)}</div>
        </div>
      </div>

      <button type="button" onClick={() => onDelete(account)} disabled={deleting} className="inline-flex h-9 w-full min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-red-500/25 bg-red-500/10 px-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300">
        {deleting ? <Loader2 className="size-4 shrink-0 animate-spin" /> : <Trash2 className="size-4 shrink-0" />}
        <span className="truncate">{deleting ? TEXT.deleting : TEXT.delete}</span>
      </button>
    </article>
  )
}

export default function PublicContribution() {
  const { siteName, siteLogo } = useBranding()
  const logoSrc = siteLogo || DEFAULT_SITE_LOGO
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<PublicContributionStatusResponse | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [oauthName, setOauthName] = useState('')
  const [oauthSession, setOauthSession] = useState<OAuthURLResponse | null>(null)
  const [callbackUrl, setCallbackUrl] = useState('')
  const [oauthLoading, setOauthLoading] = useState(false)
  const [oauthDone, setOauthDone] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [apiKeyName, setApiKeyName] = useState('')
  const [apiKeyResult, setApiKeyResult] = useState<PublicContributionAPIKeyResponse | null>(null)
  const [apiKeyLoading, setApiKeyLoading] = useState(false)

  const trimmedEmail = email.trim().toLowerCase()
  const canSubmit = useMemo(() => isValidEmail(trimmedEmail), [trimmedEmail])
  const accounts = status?.accounts ?? []
  const hasSavedApiKey = Boolean(apiKeyResult?.key_id)
  const apiKeyEligible = Boolean(status?.api_key_eligible)
  const apiKeyBlockedMessage = status?.api_key_eligibility_message || TEXT.apiKeyPlanRequired
  const canGenerateApiKey = Boolean(status?.contributed && apiKeyEligible && status.email && apiKeyName.trim() && !hasSavedApiKey)

  const resetOAuth = () => {
    setOauthSession(null)
    setCallbackUrl('')
    setOauthDone(false)
  }

  const refreshStatus = async (targetEmail: string) => {
    const next = await api.getPublicContributionStatus(targetEmail)
    const normalized = { ...next, accounts: next.accounts ?? [] }
    setStatus(normalized)
    setError('')
    setApiKeyResult(normalized.api_key ?? null)
    if (normalized.api_key?.key_name) {
      setApiKeyName(normalized.api_key.key_name)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return
    if (!canSubmit) {
      setError(TEXT.invalidEmail)
      return
    }
    setSubmitting(true)
    setError('')
    resetOAuth()
    try {
      try {
        await api.submitContributionContact(trimmedEmail)
      } catch {
        // Contact recording is best-effort; status lookup must remain available.
      }
      await refreshStatus(trimmedEmail)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleGenerateOAuth = async () => {
    if (!status?.email) return
    setOauthLoading(true)
    setError('')
    try {
      const result = await api.generateContributionOAuthURL({ email: status.email, name: oauthName.trim() || undefined })
      setOauthSession(result)
      setCallbackUrl('')
      setOauthDone(false)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setOauthLoading(false)
    }
  }

  const handleCompleteOAuth = async () => {
    if (!status?.email || !oauthSession) return
    const { code, state } = parseOAuthCallbackParams(callbackUrl)
    if (!code || !state) {
      setError(TEXT.invalidCallback)
      return
    }
    setOauthLoading(true)
    setError('')
    try {
      await api.exchangeContributionOAuthCode({ email: status.email, session_id: oauthSession.session_id, code, state, name: oauthName.trim() || undefined })
      await refreshStatus(status.email)
      setOauthDone(true)
      setOauthSession(null)
      setCallbackUrl('')
      setOauthName('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setOauthLoading(false)
    }
  }

  const copyText = async (value?: string) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setError('')
    } catch {
      setError(TEXT.copyFailed)
    }
  }

  const copyAuthUrl = async () => {
    await copyText(oauthSession?.auth_url)
  }

  const handleGenerateApiKey = async () => {
    if (!status?.email || !canGenerateApiKey) return
    setApiKeyLoading(true)
    setApiKeyResult(null)
    setError('')
    try {
      const result = await api.generateContributionAPIKey({ email: status.email, key_name: apiKeyName.trim() })
      setApiKeyResult(result)
      setStatus((current) => current ? { ...current, api_key: result } : current)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setApiKeyLoading(false)
    }
  }

  const handleDelete = async (account: ContributionLookupAccount) => {
    if (!status?.email || deletingId !== null) return
    const label = account.email || account.name || 'ID ' + account.id
    const willDisableApiKey = accounts.length <= 1 && hasSavedApiKey
    const warning = willDisableApiKey ? '\n\n' + TEXT.apiKeyDisableWarning : ''
    if (!window.confirm(TEXT.confirmDeletePrefix + '\n' + label + warning)) return
    setDeletingId(account.id)
    setError('')
    try {
      await api.deletePublicContributionAccount(account.id, status.email)
      await refreshStatus(status.email)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="min-h-dvh bg-background px-4 py-8 text-foreground">
      <div className={('mx-auto flex w-full flex-col gap-5 ' + (status ? 'max-w-6xl' : 'max-w-2xl'))}>
        <header className="text-center">
          <img src={logoSrc} alt={siteName} className="mx-auto mb-4 size-14 rounded-lg object-cover shadow-sm" />
          <h1 className="text-[26px] font-bold">{TEXT.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{TEXT.subtitle}</p>
        </header>

        <section className="rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm">
          <form className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px] lg:items-end" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground" htmlFor="contribution-email">{TEXT.email}</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="contribution-email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setStatus(null)
                    setError('')
                    resetOAuth()
                    setApiKeyResult(null)
                  }}
                  placeholder="name@example.com"
                  autoComplete="email"
                  className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-3.5 text-[15px] text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-70"
                />
              </div>
            </div>
            <button type="submit" disabled={submitting || !trimmedEmail} className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-primary text-[15px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {submitting ? TEXT.querying : TEXT.query}
            </button>
          </form>
          {error ? <div className="mt-4 rounded-md border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-200">{error}</div> : null}
        </section>

        {status ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
            <section className="rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm">
              <div className="flex items-start gap-3">
                <div className={status.contributed ? 'flex size-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'flex size-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300'}>
                  {status.contributed ? <CheckCircle2 className="size-5" /> : <KeyRound className="size-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold">{status.contributed ? TEXT.contributed : TEXT.notContributed}</h2>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-foreground ring-1 ring-border">{status.count} {TEXT.accountCount}</span>
                  </div>
                  <p className="mt-1 break-all text-sm leading-relaxed text-muted-foreground">
                    {status.contributed ? TEXT.matchedPrefix + status.count + TEXT.matchedSuffix : TEXT.notMatchedDesc}
                  </p>
                </div>
              </div>

              {accounts.length > 0 ? (
                <div className="mt-5 space-y-3 border-t border-border pt-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-foreground">{TEXT.accountList}</h3>
                    <span className="text-xs text-muted-foreground">{accounts.length} {TEXT.accountCount}</span>
                  </div>
                  <div className="space-y-2">
                    {accounts.map((account) => (
                      <AccountCard key={account.id} account={account} deleting={deletingId === account.id} onDelete={handleDelete} />
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            <section className="rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <PlusCircle className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold">{TEXT.addTitle}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{TEXT.addDesc}</p>
                </div>
              </div>

              <div className="mt-5 space-y-4 border-t border-border pt-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground" htmlFor="oauth-name">{TEXT.nameLabel}</label>
                  <input id="oauth-name" value={oauthName} onChange={(event) => setOauthName(event.target.value)} placeholder={TEXT.namePlaceholder} className="h-10 w-full rounded-md border border-input bg-background px-3.5 text-[15px] text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-70" />
                </div>

                {oauthSession ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      <a href={oauthSession.auth_url} target="_blank" rel="noreferrer" className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300 transition-colors hover:bg-emerald-500/15">
                        <ExternalLink className="size-4 shrink-0" />
                        <span className="truncate">{TEXT.openAuth}</span>
                      </a>
                      <button type="button" onClick={() => void copyAuthUrl()} className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
                        <Copy className="size-4 shrink-0" />
                        <span className="truncate">{TEXT.copyAuth}</span>
                      </button>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-foreground" htmlFor="callback-url">{TEXT.callbackUrl}</label>
                      <textarea id="callback-url" rows={4} value={callbackUrl} onChange={(event) => setCallbackUrl(event.target.value)} placeholder="http://localhost:1455/auth/callback?code=...&state=..." className="w-full resize-none rounded-md border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-70" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button type="button" onClick={handleGenerateOAuth} disabled={oauthLoading} className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-border text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50">
                        <RotateCcw className="size-4" />
                        {TEXT.updateLink}
                      </button>
                      <button type="button" onClick={handleCompleteOAuth} disabled={oauthLoading || !callbackUrl.trim()} className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
                        {oauthLoading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                        {TEXT.completeAdd}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={handleGenerateOAuth} disabled={oauthLoading} className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
                    {oauthLoading ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                    {TEXT.generate}
                  </button>
                )}
              </div>
              {oauthDone ? <div className="mt-4 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">{TEXT.addSuccess}</div> : null}

              {status.contributed ? (
                <div className="mt-5 border-t border-border pt-5">
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 items-center justify-center rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300">
                      <KeyRound className="size-[18px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-semibold">{TEXT.apiKeyTitle}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{TEXT.apiKeyDesc}</p>
                      {!apiKeyEligible ? (
                        <p className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-2 text-xs font-medium text-amber-700 dark:text-amber-200">
                          {apiKeyBlockedMessage}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-foreground" htmlFor="api-key-name">{TEXT.apiKeyName}</label>
                      <input
                        id="api-key-name"
                        value={apiKeyName}
                        onChange={(event) => {
                          if (hasSavedApiKey) return
                          setApiKeyName(event.target.value)
                          setApiKeyResult(null)
                        }}
                        disabled={hasSavedApiKey || apiKeyLoading || !apiKeyEligible}
                        placeholder={TEXT.apiKeyNamePlaceholder}
                        className="h-10 w-full rounded-md border border-input bg-background px-3.5 text-[15px] text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-70"
                      />
                    </div>
                    <button type="button" onClick={handleGenerateApiKey} disabled={apiKeyLoading || !canGenerateApiKey} className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-sky-500 text-sm font-semibold text-white transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50">
                      {apiKeyLoading ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                      {hasSavedApiKey ? TEXT.savedApiKey : (apiKeyLoading ? TEXT.generatingApiKey : TEXT.generateApiKey)}
                    </button>
                  </div>

                  {apiKeyResult ? (
                    <div className="mt-4 space-y-3 rounded-md border border-sky-500/20 bg-sky-500/10 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-sky-700 dark:text-sky-200">
                        <span>{apiKeyResult.already_created ? TEXT.existingApiKey : TEXT.createdApiKey}</span>
                        <span className="rounded-full border border-sky-500/25 px-2 py-0.5 font-semibold">{TEXT.providerGroup}: {apiKeyResult.provider_group}</span>
                      </div>
                      <div>
                        <div className="mb-1.5 text-xs font-semibold text-muted-foreground">{TEXT.serviceBaseUrl}</div>
                        <div className="flex min-w-0 items-center gap-2">
                          <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2.5 py-2 text-xs text-foreground">{apiKeyResult.base_url}</code>
                          <button type="button" onClick={() => void copyText(apiKeyResult.base_url)} className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted">
                            <Copy className="size-3.5" />
                            {TEXT.copyBaseUrl}
                          </button>
                        </div>
                      </div>
                      <div>
                        <div className="mb-1.5 text-xs font-semibold text-muted-foreground">{TEXT.apiKeyValue}</div>
                        <div className="flex min-w-0 items-center gap-2">
                          <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2.5 py-2 text-xs text-foreground">{apiKeyResult.api_key}</code>
                          <button type="button" onClick={() => void copyText(apiKeyResult.api_key)} className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted">
                            <Copy className="size-3.5" />
                            {TEXT.copyApiKey}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>
        ) : null}

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          <span>{TEXT.privacy}</span>
        </div>
      </div>
    </div>
  )
}

