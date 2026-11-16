import { Ban, Check, CircleAlert, PauseCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Text } from '../../../shared/ui/text';
import { useThemeColors } from '../../../shared/theme/theme-provider';
import type { FileJob, FileQueue } from '../../../shared/api/file-transfer';
import { activityPastJobs, type ActivityFilter, type ActivityTab } from '../../../features/file-transfer/model/activity-journal';

const tabs: readonly ActivityTab[] = ['now', 'past'];
const filters: readonly ActivityFilter[] = ['all', 'done', 'issues'];
const filterLabels = { all: 'transfer.journal.filterAll', done: 'transfer.journal.filterDone', issues: 'transfer.journal.filterIssues' } as const;

function Segment({ label, selected, role, onPress }: { label: string; selected: boolean; role: 'tab' | 'radio'; onPress: () => void }) {
  return <Pressable accessibilityRole={role} accessibilityLabel={label} accessibilityState={role === 'tab' ? { selected } : { checked: selected }} onPress={onPress}
    className={`min-h-11 flex-1 items-center justify-center rounded-[9px] px-2 ${selected ? 'bg-surface-2' : ''}`}>
    <Text className={`text-center text-sm font-inter-semibold ${selected ? 'text-primary-text' : 'text-secondary-text'}`}>{label}</Text>
  </Pressable>;
}

// Selecting a tab is presentation only: it never reads, runs, pauses or persists anything.
export function ActivitySegments({ tab, onChange }: { tab: ActivityTab; onChange: (tab: ActivityTab) => void }) {
  const { t } = useTranslation();
  return <View accessibilityRole="tablist" accessibilityLabel={t('transfer.journal.segments')} className="flex-row rounded-xl border border-border-subtle bg-surface-1 p-1">
    {tabs.map((key) => <Segment key={key} role="tab" label={t(`transfer.journal.${key}`)} selected={tab === key} onPress={() => onChange(key)} />)}
  </View>;
}

function JournalRow({ job }: { job: FileJob }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const Icon = job.state === 'completed' ? Check : job.state === 'owner_deleted' ? Ban : job.state === 'paused' ? PauseCircle : CircleAlert;
  const tone = job.state === 'completed' ? colors['brand-text'] : job.state === 'owner_deleted' ? colors['text-secondary'] : colors['attention-base'];
  return <View className="flex-row gap-3 px-4 py-3">
    <Icon color={tone} size={20} />
    <View className="min-w-0 flex-1 gap-1">
      <Text className="text-base font-inter-semibold text-primary-text">{job.name}</Text>
      <Text className="font-sans text-sm leading-5 text-secondary-text">{t(`transfer.states.${job.state}`)}</Text>
      <Text className="font-sans text-sm leading-5 text-secondary-text">{t('transfer.bytes', { acknowledged: job.acknowledgedBytes, total: job.totalBytes ?? t('transfer.unknownBytes') })}</Text>
      {job.errorCode && <Text className="font-sans text-sm leading-5 text-danger-text">{t(`transfer.errors.${job.errorCode}`, { defaultValue: t('transfer.errors.outcome_unknown') })}</Text>}
    </View>
  </View>;
}

// Read-only latest-state view of the shared queue snapshot; no dates, sessions or totals are derived from it.
export function ActivityJournalPanel({ queue, error, filter, onFilter }: { queue?: FileQueue | null; error?: string | null; filter: ActivityFilter; onFilter: (filter: ActivityFilter) => void }) {
  const { t } = useTranslation();
  // A failed queue read clears `queue`; an unrelated error (e.g. Photos status) keeps the verified Files snapshot.
  const jobs = queue ? activityPastJobs(queue, filter) : [];
  return <View className="gap-4">
    <Text className="font-sans text-sm leading-5 text-secondary-text">{t('transfer.journal.scope')}</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel={t('transfer.journal.filters')} className="flex-row rounded-xl border border-border-subtle bg-surface-1 p-1">
      {filters.map((key) => <Segment key={key} role="radio" label={t(filterLabels[key])} selected={filter === key} onPress={() => onFilter(key)} />)}
    </View>
    {queue?.hasMore && <Text accessibilityLiveRegion="polite" className="font-sans text-sm leading-5 text-secondary-text">{t('transfer.journal.limited', { shown: queue.jobs.length, count: queue.totalJobs })}</Text>}
    {!queue && !error && <Text className="font-sans text-sm leading-5 text-secondary-text">{t('pairing.loading')}</Text>}
    {error && <Text accessibilityRole="alert" className="font-sans text-sm leading-5 text-danger-text">{t(`transfer.errors.${error}`, { defaultValue: t('transfer.errors.outcome_unknown') })}</Text>}
    {queue && (jobs.length > 0
      ? <View className="rounded-2xl border border-border-subtle bg-surface-1">{jobs.map((job) => <JournalRow key={job.id} job={job} />)}</View>
      : <Text className="font-sans text-sm leading-5 text-secondary-text">{t(queue.hasMore ? 'transfer.journal.emptyLimited' : 'transfer.journal.empty')}</Text>)}
  </View>;
}
