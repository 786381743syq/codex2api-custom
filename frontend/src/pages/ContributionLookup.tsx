import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2, Copy, KeyRound, Loader2, Mail, PlusCircle, RefreshCw, Save, Search, Share2, X, XCircle } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Pagination from '../components/Pagination'
import StateShell from '../components/StateShell'
import { api } from '../api'
import type { ContributionContactListItem, ContributionLookupResponse } from '../types'
import { getErrorMessage } from '../utils/error'
import { formatBeijingTime } from '../utils/time'
import { useToast } from '../hooks/useToast'
import { DEFAULT_PAGE_SIZE_OPTIONS, usePersistedPageSize } from '../hooks/usePersistedPageSize'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const DEFAULT_CONTRIBUTION_PLAN_TYPES = ['plus', 'pro', 'team', 'free']

function normalizePlanType(value: string): string {
  return value.trim().toLowerCase()
}

function isValidPlanType(value: string): boolean {
  return /^[a-z0-9_.-]{1,64}$/.test(value)
}

function normalizePlanTypes(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  values.forEach((value) => {
    const item = normalizePlanType(value)
    if (!item || !isValidPlanType(item) || seen.has(item)) return
    seen.add(item)
    result.push(item)
  })
  return result
}

function isValidEmail(value: string): boolean {
  const email = value.trim()
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) && email.length <= 254
}

function statusBadgeClassName(status: string): string {
  const normalized = status.toLowerCase()
  if (normalized === 'deleted') {
    return 'border-transparent bg-slate-500/12 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300'
  }
  if (normalized === 'active' || normalized === 'ready') {
    return 'border-transparent bg-emerald-500/12 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300'
  }
  if (normalized.includes('rate') || normalized.includes('cooldown') || normalized.includes('quota')) {
    return 'border-transparent bg-amber-500/12 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300'
  }
  if (normalized.includes('error') || normalized.includes('unauthorized')) {
    return 'border-transparent bg-red-500/12 text-red-600 dark:bg-red-500/20 dark:text-red-300'
  }
  return 'border-transparent bg-blue-500/12 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300'
}

function apiKeyBadgeClassName(generated: boolean): string {
  return generated
    ? 'border-transparent bg-sky-500/12 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300'
    : 'border-transparent bg-slate-500/12 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300'
}
function contributionBadgeClassName(contributed: boolean): string {
  return contributed
    ? 'border-transparent bg-emerald-500/12 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300'
    : 'border-transparent bg-slate-500/12 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300'
}

export default function ContributionLookup() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [email, setEmail] = useState('')
  const [filterEmail, setFilterEmail] = useState('')
  const [result, setResult] = useState<ContributionLookupResponse | null>(null)
  const [items, setItems] = useState<ContributionContactListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = usePersistedPageSize('contribution_contacts', 20, DEFAULT_PAGE_SIZE_OPTIONS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [allowedPlanTypes, setAllowedPlanTypes] = useState<string[]>(['plus', 'pro', 'team'])
  const [planTypeDraft, setPlanTypeDraft] = useState('')

  const trimmedEmail = email.trim()
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)

  const copy = {
    title: t('contributions.title', { defaultValue: '贡献查询' }),
    description: t('contributions.description', { defaultValue: '查看通过公开链接提交的联系方式，并查询邮箱是否贡献过账号。' }),
    emailLabel: t('contributions.emailLabel', { defaultValue: '联系邮箱' }),
    emailPlaceholder: t('contributions.emailPlaceholder', { defaultValue: 'name@example.com' }),
    submit: t('contributions.submit', { defaultValue: '查询' }),
    checking: t('contributions.checking', { defaultValue: '查询中' }),
    invalidEmail: t('contributions.invalidEmail', { defaultValue: '请输入有效的邮箱地址' }),
    resultTitle: t('contributions.resultTitle', { defaultValue: '查询结果' }),
    matched: t('contributions.matched', { defaultValue: '已贡献' }),
    notMatched: t('contributions.notMatched', { defaultValue: '未匹配' }),
    matchedDesc: t('contributions.matchedDesc', { count: result?.count ?? 0, defaultValue: '匹配到 {{count}} 个账号。' }),
    notMatchedDesc: t('contributions.notMatchedDesc', { defaultValue: '没有找到该邮箱贡献过的账号。' }),
    accountList: t('contributions.accountList', { defaultValue: '匹配账号' }),
    contactList: t('contributions.contactList', { defaultValue: '联系方式列表' }),
    listDesc: t('contributions.listDesc', { defaultValue: '默认展示公开贡献链接提交的联系方式。' }),
    emptyTitle: t('contributions.emptyTitle', { defaultValue: '暂无联系方式' }),
    emptyDesc: t('contributions.emptyDesc', { defaultValue: '公开贡献链接提交后会在这里显示。' }),
    emptyFilteredDesc: t('contributions.emptyFilteredDesc', { defaultValue: '没有找到符合当前邮箱筛选的联系方式。' }),
    colContactEmail: t('contributions.colContactEmail', { defaultValue: '联系邮箱' }),
    colSubmitCount: t('contributions.colSubmitCount', { defaultValue: '查询/提交次数' }),
    colContribution: t('contributions.colContribution', { defaultValue: '账号匹配' }),
    colApiKey: t('contributions.colApiKey', { defaultValue: 'API Key' }),
    colCreated: t('contributions.colCreated', { defaultValue: '首次记录' }),
    colUpdated: t('contributions.colUpdated', { defaultValue: '最近记录' }),
    colAccount: t('contributions.colAccount', { defaultValue: '账号' }),
    colPlan: t('contributions.colPlan', { defaultValue: '套餐' }),
    colStatus: t('contributions.colStatus', { defaultValue: '状态' }),
    reset: t('common.reset', { defaultValue: '重置' }),
    refresh: t('common.refresh', { defaultValue: '刷新' }),
    recordsCount: t('usage.recordsCount', { count: total, defaultValue: '{{count}} 条记录' }),
    apiKeyGenerated: t('contributions.apiKeyGenerated', { defaultValue: '已生成' }),
    apiKeyNotGenerated: t('contributions.apiKeyNotGenerated', { defaultValue: '未生成' }),
    planTypeSettingsTitle: t('contributions.planTypeSettingsTitle', { defaultValue: '\u0041\u0050\u0049\u0020\u004b\u0065\u0079 \u53d1\u653e\u7c7b\u578b' }),
    planTypeSettingsDesc: t('contributions.planTypeSettingsDesc', { defaultValue: '\u52fe\u9009\u5141\u8bb8\u751f\u6210\u0020\u0041\u0050\u0049\u0020\u004b\u0065\u0079\u0020\u7684\u8d26\u53f7\u0020\u0070\u006c\u0061\u006e\u005f\u0074\u0079\u0070\u0065\uff0c\u4e5f\u53ef\u4ee5\u521b\u5efa\u65b0\u7c7b\u578b\u3002' }),
    planTypePlaceholder: t('contributions.planTypePlaceholder', { defaultValue: '\u4f8b\u5982\uff1a\u0065\u006e\u0074\u0065\u0072\u0070\u0072\u0069\u0073\u0065' }),
    addPlanType: t('contributions.addPlanType', { defaultValue: '\u521b\u5efa\u7c7b\u578b' }),
    savePlanTypes: t('contributions.savePlanTypes', { defaultValue: '\u4fdd\u5b58\u7c7b\u578b' }),
    savingPlanTypes: t('contributions.savingPlanTypes', { defaultValue: '\u4fdd\u5b58\u4e2d' }),
    planTypeSaved: t('contributions.planTypeSaved', { defaultValue: '\u53d1\u653e\u7c7b\u578b\u5df2\u4fdd\u5b58' }),
    planTypeInvalid: t('contributions.planTypeInvalid', { defaultValue: '\u7c7b\u578b\u53ea\u80fd\u5305\u542b\u5c0f\u5199\u5b57\u6bcd\u3001\u6570\u5b57\u3001\u4e0b\u5212\u7ebf\u3001\u4e2d\u5212\u7ebf\u6216\u70b9\uff0c\u6700\u591a\u0020\u0036\u0034\u0020\u4e2a\u5b57\u7b26\u3002' }),
    planTypeAtLeastOne: t('contributions.planTypeAtLeastOne', { defaultValue: '\u81f3\u5c11\u4fdd\u7559\u4e00\u4e2a\u53d1\u653e\u7c7b\u578b' }),
  }

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/contribute'
    return `${window.location.origin}/contribute`
  }, [])

  const shareCopy = {
    shareLink: t('contributions.shareLink', { defaultValue: '分享贡献链接' }),
    copied: t('common.copied', { defaultValue: '已复制' }),
    copyFailed: t('common.copyFailed', { defaultValue: '复制失败' }),
    contactRecorded: t('contributions.contactRecorded', { defaultValue: '已记录联系方式' }),
    contactNotRecorded: t('contributions.contactNotRecorded', { defaultValue: '未记录联系方式' }),
    contactRecordedDesc: t('contributions.contactRecordedDesc', {
      count: result?.contact?.submit_count ?? 0,
      time: result?.contact ? formatBeijingTime(result.contact.updated_at) : '-',
      defaultValue: '公开链接已提交 {{count}} 次，最近提交时间 {{time}}。',
    }),
  }

  const loadContacts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.listContributionContacts({ page, pageSize, email: filterEmail })
      setItems(response.items ?? [])
      setTotal(response.total ?? 0)
    } catch (err) {
      setItems([])
      setTotal(0)
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [filterEmail, page, pageSize])


  const loadContributionSettings = useCallback(async () => {
    setSettingsLoading(true)
    try {
      const response = await api.getSettings()
      const next = normalizePlanTypes(response.contribution_api_key_allowed_plan_types ?? [])
      setAllowedPlanTypes(next.length > 0 ? next : ['plus', 'pro', 'team'])
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setSettingsLoading(false)
    }
  }, [showToast])
  useEffect(() => {
    void loadContacts()
  }, [loadContacts])

  useEffect(() => {
    void loadContributionSettings()
  }, [loadContributionSettings])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      showToast(shareCopy.copied)
    } catch {
      showToast(shareCopy.copyFailed, 'error')
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (trimmedEmail && !isValidEmail(trimmedEmail)) {
      setError(copy.invalidEmail)
      return
    }

    setPage(1)
    setFilterEmail(trimmedEmail.toLowerCase())
    setResult(null)

    if (!trimmedEmail) {
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await api.checkContribution(trimmedEmail)
      setResult(response)
    } catch (err) {
      setResult(null)
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const resetFilters = () => {
    setEmail('')
    setFilterEmail('')
    setResult(null)
    setPage(1)
    setError('')
  }


  const knownPlanTypes = useMemo(() => {
    return normalizePlanTypes([
      ...DEFAULT_CONTRIBUTION_PLAN_TYPES,
      ...allowedPlanTypes,
      ...(result?.accounts ?? []).map((account) => account.plan_type),
    ])
  }, [allowedPlanTypes, result])

  const toggleAllowedPlanType = (planType: string) => {
    const normalized = normalizePlanType(planType)
    if (!isValidPlanType(normalized)) return
    setAllowedPlanTypes((current) => {
      const next = current.includes(normalized)
        ? current.filter((item) => item !== normalized)
        : normalizePlanTypes([...current, normalized])
      if (next.length === 0) {
        showToast(copy.planTypeAtLeastOne, 'error')
        return current
      }
      return next
    })
  }

  const handleAddPlanType = () => {
    const normalized = normalizePlanType(planTypeDraft)
    if (!isValidPlanType(normalized)) {
      showToast(copy.planTypeInvalid, 'error')
      return
    }
    setAllowedPlanTypes((current) => normalizePlanTypes([...current, normalized]))
    setPlanTypeDraft('')
  }

  const handleSavePlanTypes = async () => {
    const next = normalizePlanTypes(allowedPlanTypes)
    if (next.length === 0) {
      showToast(copy.planTypeAtLeastOne, 'error')
      return
    }
    setSettingsSaving(true)
    try {
      const response = await api.updateSettings({ contribution_api_key_allowed_plan_types: next })
      setAllowedPlanTypes(normalizePlanTypes(response.contribution_api_key_allowed_plan_types ?? next))
      showToast(copy.planTypeSaved)
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setSettingsSaving(false)
    }
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.title}
        description={copy.description}
        actionMeta={<span className="break-all font-mono">{shareUrl}</span>}
      />

      <Card className="py-0">
        <CardContent className="p-5">
          <form className="flex flex-col gap-3 lg:flex-row lg:items-end" onSubmit={handleSubmit}>
            <label className="min-w-0 flex-1 space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground">{copy.emailLabel}</span>
              <Input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setError('')
                }}
                placeholder={copy.emailPlaceholder}
                autoComplete="email"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2 max-sm:[&>button]:flex-1">
              <Button type="submit" disabled={loading} className="min-w-[112px]">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                {loading ? copy.checking : copy.submit}
              </Button>
              <Button type="button" variant="outline" onClick={() => void handleCopyShareLink()}>
                <Share2 className="size-4" />
                {shareCopy.shareLink}
              </Button>
              {filterEmail ? (
                <Button type="button" variant="outline" onClick={resetFilters}>
                  <X className="size-4" />
                  {copy.reset}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => void loadContacts()} disabled={loading}>
                <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
                {copy.refresh}
              </Button>
            </div>
          </form>
          {error ? (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              {error}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">{copy.planTypeSettingsTitle}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{copy.planTypeSettingsDesc}</p>
            </div>
            <Button type="button" variant="outline" onClick={() => void handleSavePlanTypes()} disabled={settingsSaving || settingsLoading}>
              {settingsSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {settingsSaving ? copy.savingPlanTypes : copy.savePlanTypes}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {knownPlanTypes.map((planType) => {
              const checked = allowedPlanTypes.includes(planType)
              return (
                <button
                  key={planType}
                  type="button"
                  aria-pressed={checked}
                  onClick={() => toggleAllowedPlanType(planType)}
                  className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors ${checked ? 'border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' : 'border-border text-muted-foreground hover:bg-muted/60'}`}
                >
                  {checked ? <CheckCircle2 className="size-3.5" /> : null}
                  {planType}
                </button>
              )
            })}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={planTypeDraft}
              onChange={(event) => setPlanTypeDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleAddPlanType()
                }
              }}
              placeholder={copy.planTypePlaceholder}
            />
            <Button type="button" variant="outline" onClick={handleAddPlanType} className="shrink-0">
              <PlusCircle className="size-4" />
              {copy.addPlanType}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result ? (
        <div className="space-y-4">
          <Card className="py-0">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex size-12 shrink-0 items-center justify-center rounded-full ${result.contributed ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300' : 'bg-slate-500/12 text-slate-600 dark:text-slate-300'}`}>
                  {result.contributed ? <CheckCircle2 className="size-6" /> : <XCircle className="size-6" />}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground">{copy.resultTitle}</h3>
                    <Badge variant="outline" className={contributionBadgeClassName(result.contributed)}>
                      {result.contributed ? copy.matched : copy.notMatched}
                    </Badge>
                  </div>
                  <p className="mt-1 break-all text-sm text-muted-foreground">
                    {result.email} - {result.contributed ? copy.matchedDesc : copy.notMatchedDesc}
                  </p>
                  <p className="mt-1 break-all text-sm text-muted-foreground">
                    {result.contact_recorded && result.contact ? shareCopy.contactRecordedDesc : shareCopy.contactNotRecorded}
                  </p>
                </div>
              </div>
              <Button type="button" variant="outline" onClick={() => void handleCopyShareLink()}>
                <Copy className="size-4" />
                {shareCopy.shareLink}
              </Button>
            </CardContent>
          </Card>

          {result.accounts.length > 0 ? (
            <Card className="py-0">
              <CardContent className="p-0">
                <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
                  {copy.accountList}
                </div>
                <div className="data-table-shell">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{copy.colAccount}</TableHead>
                        <TableHead>{copy.colPlan}</TableHead>
                        <TableHead>{copy.colStatus}</TableHead>
                        <TableHead>{copy.colCreated}</TableHead>
                        <TableHead>{copy.colUpdated}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.accounts.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell>
                            <div className="min-w-0">
                              <div className="font-medium text-foreground">{account.name || `ID ${account.id}`}</div>
                              <div className="break-all font-mono text-xs text-muted-foreground">{account.email}</div>
                            </div>
                          </TableCell>
                          <TableCell><span className="text-sm text-muted-foreground">{account.plan_type || '-'}</span></TableCell>
                          <TableCell><Badge variant="outline" className={statusBadgeClassName(account.status)}>{account.status || '-'}</Badge></TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatBeijingTime(account.created_at)}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatBeijingTime(account.deleted_at || account.updated_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      <Card className="py-0">
        <CardContent className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">{copy.contactList}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{copy.listDesc}</p>
            </div>
            <span className="text-xs text-muted-foreground">{copy.recordsCount}</span>
          </div>

          <StateShell
            loading={loading && items.length === 0}
            error={error && items.length === 0 ? error : null}
            onRetry={() => void loadContacts()}
            isEmpty={!loading && items.length === 0}
            emptyTitle={copy.emptyTitle}
            emptyDescription={filterEmail ? copy.emptyFilteredDesc : copy.emptyDesc}
          >
            <div className="data-table-shell">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{copy.colContactEmail}</TableHead>
                    <TableHead>{copy.colSubmitCount}</TableHead>
                    <TableHead>{copy.colContribution}</TableHead>
                    <TableHead>{copy.colApiKey}</TableHead>
                    <TableHead>{copy.colCreated}</TableHead>
                    <TableHead>{copy.colUpdated}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.email}>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-2">
                          <Mail className="size-4 shrink-0 text-muted-foreground" />
                          <span className="break-all font-mono text-sm text-foreground">{item.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{item.submit_count}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={contributionBadgeClassName(item.contributed)}>
                          {item.contributed ? `${copy.matched} (${item.matched_account_count})` : copy.notMatched}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-[140px] flex-col items-start gap-1">
                          <Badge variant="outline" className={apiKeyBadgeClassName(item.api_key_generated)}>
                            <KeyRound className="size-3" />
                            {item.api_key_generated ? copy.apiKeyGenerated : copy.apiKeyNotGenerated}
                          </Badge>
                          {item.api_key_generated ? (
                            <span className="max-w-[180px] truncate font-mono text-xs text-muted-foreground" title={item.api_key_name || copy.apiKeyGenerated}>
                              {item.api_key_name || '-'}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatBeijingTime(item.created_at)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatBeijingTime(item.updated_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={total}
              pageSize={pageSize}
              pageSizeOptions={DEFAULT_PAGE_SIZE_OPTIONS}
              onPageSizeChange={(next) => {
                setPage(1)
                setPageSize(next)
              }}
            />
          </StateShell>
        </CardContent>
      </Card>
    </div>
  )
}
