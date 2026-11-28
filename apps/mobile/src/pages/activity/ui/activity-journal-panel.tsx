import { Ban, Check, ChevronDown, CircleAlert, PauseCircle } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { IconTile, RichCard } from '../../../shared/ui/rich';
import { Text } from '../../../shared/ui/text';
import { useThemeColors } from '../../../shared/theme/theme-provider';
import type { FileJob, FileQueue } from '../../../shared/api/file-transfer';
import { formatBytes } from '../../../shared/lib/format-bytes';
import { activityPastJobs, type ActivityFilter, type ActivityTab } from '../../../features/file-transfer/model/activity-journal';

const tabs: readonly ActivityTab[] = ['now', 'past'];
const filters: readonly ActivityFilter[] = ['all', 'done', 'issues'];
const filterLabels = { all: 'transfer.journal.filterAll', done: 'transfer.journal.filterDone', issues: 'transfer.journal.filterIssues' } as const;

// Selecting a tab or filter is presentation only: it never reads, runs, pauses or persists anything.
export function ActivitySegments({ tab, onChange }: { tab: ActivityTab; onChange: (tab: ActivityTab) => void }) {
  const { t } = useTranslation();
  return <View accessibilityRole="tablist" accessibilityLabel={t('transfer.journal.segments')} className="flex-row gap-1 rounded-full border border-border-subtle bg-surface-2 p-1">
    {tabs.map((key) => <Pressable key={key} accessibilityRole="tab" accessibilityLabel={t(`transfer.journal.${key}`)} accessibilityState={{ selected: tab === key }} onPress={() => onChange(key)}
      className={`min-h-[40px] flex-1 items-center justify-center rounded-full px-3 ${tab === key ? 'bg-surface-1' : 'bg-transparent'}`}>
      <Text className={`text-center text-sm font-inter-medium ${tab === key ? 'text-brand-text' : 'text-secondary-text'}`}>{t(`transfer.journal.${key}`)}</Text>
    </Pressable>)}
  </View>;
}

// M11 header dropdown: the trigger shows the current filter; the in-flow menu keeps touch and focus inside the header.
export function ActivityFilterMenu({ filter, onFilter }: { filter: ActivityFilter; onFilter: (filter: ActivityFilter) => void }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  return <View className="items-end gap-2">
    <Pressable accessibilityRole="button" accessibilityLabel={t(filterLabels[filter])} accessibilityHint={t('transfer.journal.filters')} accessibilityState={{ expanded: open }}
      onPress={() => setOpen((value) => !value)} className="min-h-11 flex-row items-center gap-1 px-1">
      <Text className="font-sans text-base text-brand-text">{t(filterLabels[filter])}</Text>
      <ChevronDown color={colors['brand-text']} size={16} />
    </Pressable>
    {open && <View accessibilityRole="menu" accessibilityLabel={t('transfer.journal.filters')} className="rounded-xl border border-border-subtle bg-surface-1 p-1">
      {filters.map((key) => <Pressable key={key} accessibilityRole="menuitem" accessibilityLabel={t(filterLabels[key])} accessibilityState={{ checked: filter === key }}
        onPress={() => { onFilter(key); setOpen(false); }} className="min-h-11 flex-row items-center gap-2 rounded-[9px] px-3">
        <View className="w-4">{filter === key && <Check color={colors['brand-text']} size={16} />}</View>
        <Text className="font-sans text-base text-primary-text">{t(filterLabels[key])}</Text>
      </Pressable>)}
    </View>}
  </View>;
}

function JournalRow({ job, divider = false }: { job: FileJob; divider?: boolean }) {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const Icon = job.state === 'completed' ? Check : job.state === 'owner_deleted' ? Ban : job.state === 'paused' ? PauseCircle : CircleAlert;
  const tone = job.state === 'completed' ? colors['brand-text'] : job.state === 'owner_deleted' ? colors['text-secondary'] : colors['attention-base'];
  return <View className={`flex-row items-start gap-3 px-4 py-3 ${divider ? 'border-t border-border-subtle' : ''}`}>
    <IconTile tone={job.state === 'completed' ? 'brand' : 'neutral'}>
      <Icon color={tone} size={18} />
    </IconTile>
    <View className="min-w-0 flex-1 gap-1">
      <Text className="text-base font-inter-semibold text-primary-text">{job.name}</Text>
      <Text className="font-sans text-sm leading-5 text-secondary-text">{t(`transfer.states.${job.state}`)}</Text>
      <Text className="font-sans text-sm leading-5 text-secondary-text">
        {t('transfer.bytes', {
          acknowledged: formatBytes(job.acknowledgedBytes, i18n.language),
          total: job.totalBytes !== undefined ? formatBytes(job.totalBytes, i18n.language) : t('transfer.unknownBytes'),
        })}
      </Text>
      {job.errorCode && <Text className="font-sans text-sm leading-5 text-danger-text">{t(`transfer.errors.${job.errorCode}`, { defaultValue: t('transfer.errors.outcome_unknown') })}</Text>}
    </View>
  </View>;
}

// Read-only latest-state view of the shared queue snapshot; no dates, sessions or totals are derived from it.
export function ActivityJournalPanel({ queue, error, filter }: { queue?: FileQueue | null; error?: string | null; filter: ActivityFilter }) {
  const { t } = useTranslation();
  // A failed queue read clears `queue`; an unrelated error (e.g. Photos status) keeps the verified Files snapshot.
  const jobs = queue ? activityPastJobs(queue, filter) : [];
  return <View className="gap-4">
    <Text className="font-sans text-sm leading-5 text-secondary-text">{t('transfer.journal.scope')}</Text>
    {queue?.hasMore && <Text accessibilityLiveRegion="polite" className="font-sans text-sm leading-5 text-secondary-text">{t('transfer.journal.limited', { shown: queue.jobs.length, count: queue.totalJobs })}</Text>}
    {!queue && !error && <Text className="font-sans text-sm leading-5 text-secondary-text">{t('pairing.loading')}</Text>}
    {error && <Text accessibilityRole="alert" className="font-sans text-sm leading-5 text-danger-text">{t(`transfer.errors.${error}`, { defaultValue: t('transfer.errors.outcome_unknown') })}</Text>}
    {queue && (jobs.length > 0
      ? <RichCard>{jobs.map((job, index) => <JournalRow key={job.id} job={job} divider={index > 0} />)}</RichCard>
      : <Text className="font-sans text-sm leading-5 text-secondary-text">{t(queue.hasMore ? 'transfer.journal.emptyLimited' : 'transfer.journal.empty')}</Text>)}
  </View>;
}
