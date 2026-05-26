<template>
  <main class="app-shell">
    <section class="phone-frame" aria-label="糖糖记录本">
      <div class="screen-scroll">
        <header class="app-header">
          <div>
            <p class="eyebrow">给我的老婆 · 蜜桃陪伴版</p>
            <h1>糖糖记录本</h1>
          </div>
          <button class="icon-button mascot-button" type="button" aria-label="查看设置" @click="activeTab = 'settings'">
            <Sparkles :size="19" />
          </button>
        </header>

        <section v-if="activeTab === 'home'" class="page-stack page-enter">
          <div class="hero-panel">
            <div class="hero-copy">
              <span class="section-label">最近一次 · {{ latestRecord?.period || '还未记录' }}</span>
              <strong class="hero-value">{{ latestRecord ? latestRecord.value : '--' }}</strong>
              <span class="hero-unit">{{ latestRecord ? latestRecord.unit : 'mmol/L' }}</span>
              <p>{{ latestRecord ? `${formatDateTime(latestRecord.measuredAt)} · ${latestRecord.note || '无备注'}` : '先记录一次，曲线会自动出现。' }}</p>
            </div>
            <div class="peach-mascot" aria-hidden="true">
              <span></span>
            </div>
          </div>

          <button class="primary-action" type="button" @click="openNewRecord">
            <Plus :size="22" />
            记录一次血糖
          </button>

          <div class="summary-grid">
            <article>
              <span>记录数</span>
              <strong>{{ stats.count }}</strong>
            </article>
            <article>
              <span>平均值</span>
              <strong>{{ stats.average || '--' }}</strong>
            </article>
            <article>
              <span>最高值</span>
              <strong>{{ stats.highest || '--' }}</strong>
            </article>
          </div>

          <section class="card chart-card">
            <div class="card-heading">
              <div>
                <span class="section-label">趋势预览</span>
                <h2>最近血糖曲线</h2>
              </div>
              <button class="text-button" type="button" @click="activeTab = 'chart'">查看</button>
            </div>
            <GlucoseChart :records="records" compact />
          </section>

          <section class="quick-export">
            <div>
              <span class="section-label">导出记录</span>
              <p>可生成图片或 PDF，方便保存。</p>
            </div>
            <button class="round-command" type="button" aria-label="去导出" @click="activeTab = 'export'">
              <Download :size="20" />
            </button>
          </section>
        </section>

        <section v-else-if="activeTab === 'chart'" class="page-stack page-enter">
          <div class="page-title">
            <div>
              <p class="eyebrow">趋势曲线</p>
              <h2>看看最近变化</h2>
            </div>
            <button class="soft-button" type="button" @click="openNewRecord">
              <Plus :size="16" />
              新增
            </button>
          </div>

          <section class="card full-chart-card">
            <GlucoseChart :records="records" />
            <div class="range-note">
              <span></span>
              参考区间仅作日常记录参考，请以医生建议为准。
            </div>
          </section>

          <div class="summary-grid">
            <article>
              <span>最低</span>
              <strong>{{ stats.lowest || '--' }}</strong>
            </article>
            <article>
              <span>平均</span>
              <strong>{{ stats.average || '--' }}</strong>
            </article>
            <article>
              <span>最高</span>
              <strong>{{ stats.highest || '--' }}</strong>
            </article>
          </div>

          <section class="card insight-card">
            <span class="section-label">小提示</span>
            <p>{{ chartInsight }}</p>
          </section>
        </section>

        <section v-else-if="activeTab === 'records'" class="page-stack page-enter">
          <div class="page-title">
            <div>
              <p class="eyebrow">历史记录</p>
              <h2>{{ records.length }} 条血糖记录</h2>
            </div>
            <button class="soft-button" type="button" @click="openNewRecord">
              <Plus :size="16" />
              新增
            </button>
          </div>

          <div v-if="records.length" class="record-list">
            <article v-for="record in sortedRecords" :key="record.id" class="record-card" @click="detailRecord = record">
              <div class="record-date">
                <span>{{ dayLabel(record.measuredAt) }}</span>
                <small>{{ timeLabel(record.measuredAt) }}</small>
              </div>
              <div class="record-info">
                <span>{{ record.period }}</span>
                <p>{{ record.note || '没有备注' }}</p>
              </div>
              <div class="record-actions">
                <strong>{{ record.value }}</strong>
                <button
                  class="record-delete-button"
                  type="button"
                  :aria-label="`删除${record.period}记录`"
                  @click.stop="confirmDelete = record"
                >
                  <Trash2 :size="16" />
                </button>
              </div>
            </article>
          </div>

          <EmptyState v-else title="还没有记录" body="点一下新增按钮，先记录最近一次测量。" />
        </section>

        <section v-else-if="activeTab === 'export'" class="page-stack page-enter">
          <div class="page-title">
            <div>
              <p class="eyebrow">导出中心</p>
              <h2>保存这份记录</h2>
            </div>
            <button class="soft-button" type="button" @click="openNewRecord">
              <Plus :size="16" />
              补一条
            </button>
          </div>

          <section ref="reportRef" class="report-card">
            <div class="report-head">
              <div>
                <span>使用人：我的老婆</span>
                <h3>血糖记录汇总</h3>
              </div>
              <div class="report-badge">{{ stats.count }} 条</div>
            </div>
            <div class="report-stats">
              <div><span>平均</span><strong>{{ stats.average || '--' }}</strong></div>
              <div><span>最高</span><strong>{{ stats.highest || '--' }}</strong></div>
              <div><span>最低</span><strong>{{ stats.lowest || '--' }}</strong></div>
            </div>
            <GlucoseChart :records="records" compact />
            <div class="report-list">
              <div v-for="record in sortedRecords.slice(0, 5)" :key="record.id">
                <span>{{ formatDateTime(record.measuredAt) }} · {{ record.period }}</span>
                <strong>{{ record.value }} {{ record.unit }}</strong>
              </div>
            </div>
          </section>

          <div class="export-actions">
            <button class="primary-action" type="button" :disabled="isExporting || !records.length" @click="exportReport('png')">
              <ImageDown :size="20" />
              导出图片
            </button>
            <button class="secondary-action" type="button" :disabled="isExporting || !records.length" @click="exportReport('pdf')">
              <FileText :size="20" />
              导出 PDF
            </button>
          </div>

          <p class="export-note">导出内容来自后端数据库 API，当前页面只负责展示和生成文件。</p>
        </section>

        <section v-else class="page-stack page-enter">
          <div class="page-title">
            <div>
              <p class="eyebrow">我的设置</p>
              <h2>我的老婆的记录设置</h2>
            </div>
          </div>

          <section class="card settings-list">
            <div>
              <span>使用人</span>
              <strong>我的老婆</strong>
            </div>
            <div>
              <span>默认单位</span>
              <strong>mmol/L</strong>
            </div>
            <div>
              <span>数据存储</span>
              <strong>Node API + MySQL</strong>
            </div>
            <div>
              <span>记录字段</span>
              <strong>数值 / 时段 / 时间 / 备注</strong>
            </div>
          </section>

          <button class="secondary-action danger" type="button" @click="showResetConfirm = true">
            <Trash2 :size="19" />
            清空全部记录
          </button>
        </section>
      </div>

      <nav class="bottom-nav" aria-label="底部导航">
        <button v-for="tab in tabs" :key="tab.key" type="button" :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">
          <component :is="tab.icon" :size="20" />
          <span>{{ tab.label }}</span>
        </button>
      </nav>
    </section>

    <Teleport to="body">
      <div v-if="showForm" class="modal-backdrop" @click.self="!isSavingRecord && closeForm()">
        <form class="sheet" :aria-busy="isSavingRecord" @submit.prevent="saveRecord">
          <div class="sheet-handle"></div>
          <div class="sheet-head">
            <h2>{{ editingRecord ? '编辑记录' : '记录一次血糖' }}</h2>
            <button class="icon-button" type="button" aria-label="关闭" :disabled="isSavingRecord" @click="closeForm">
              <X :size="20" />
            </button>
          </div>

          <label class="field">
            <span>血糖值</span>
            <div class="value-input">
              <input v-model="form.value" type="number" inputmode="decimal" min="0" max="30" step="0.1" placeholder="例如 6.2" required />
              <em>mmol/L</em>
            </div>
          </label>

          <label class="field">
            <span>测量时段</span>
            <select v-model="form.period">
              <option v-for="period in periods" :key="period" :value="period">{{ period }}</option>
            </select>
          </label>

          <label class="field">
            <span>测量时间</span>
            <input v-model="form.measuredAt" type="datetime-local" required />
          </label>

          <label class="field">
            <span>备注</span>
            <textarea v-model="form.note" rows="3" placeholder="比如饭后散步、今天吃得偏甜"></textarea>
          </label>

          <button class="primary-action" type="submit" :disabled="isSavingRecord">
            <Check :size="20" />
            {{ isSavingRecord ? '保存中...' : '保存记录' }}
          </button>
        </form>
      </div>

      <div v-if="detailRecord" class="modal-backdrop" @click.self="detailRecord = null">
        <section class="sheet detail-sheet">
          <div class="sheet-handle"></div>
          <div class="sheet-head">
            <h2>记录详情</h2>
            <button class="icon-button" type="button" aria-label="关闭" @click="detailRecord = null">
              <X :size="20" />
            </button>
          </div>
          <div class="detail-value">{{ detailRecord.value }} <span>{{ detailRecord.unit }}</span></div>
          <p>{{ detailRecord.period }} · {{ formatDateTime(detailRecord.measuredAt) }}</p>
          <div class="detail-note">{{ detailRecord.note || '没有备注' }}</div>
          <div class="split-actions">
            <button class="secondary-action" type="button" @click="startEdit(detailRecord)">
              <Pencil :size="18" />
              编辑
            </button>
            <button class="secondary-action danger" type="button" @click="confirmDelete = detailRecord">
              <Trash2 :size="18" />
              删除
            </button>
          </div>
        </section>
      </div>

      <div v-if="confirmDelete" class="modal-backdrop" @click.self="confirmDelete = null">
        <section class="confirm-box">
          <h2>删除这条记录？</h2>
          <p>删除后首页、曲线、历史列表和导出数据会同步更新。</p>
          <div class="split-actions">
            <button class="secondary-action" type="button" @click="confirmDelete = null">取消</button>
            <button class="secondary-action danger solid-danger" type="button" @click="removeRecord(confirmDelete.id)">删除</button>
          </div>
        </section>
      </div>

      <div v-if="showResetConfirm" class="modal-backdrop" @click.self="showResetConfirm = false">
        <section class="confirm-box">
          <h2>清空全部记录？</h2>
          <p>会移除当前使用人的所有血糖记录。</p>
          <div class="split-actions">
            <button class="secondary-action" type="button" @click="showResetConfirm = false">取消</button>
            <button class="secondary-action danger solid-danger" type="button" @click="resetRecords">清空</button>
          </div>
        </section>
      </div>

      <div v-if="toast" class="toast">
        <CheckCircle2 :size="18" />
        {{ toast }}
      </div>
    </Teleport>
  </main>
</template>

<script setup>
import { computed, defineComponent, h, nextTick, onMounted, ref } from 'vue';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  BarChart3,
  Check,
  CheckCircle2,
  Download,
  FileText,
  HeartPulse,
  Home,
  ImageDown,
  ListChecks,
  Pencil,
  Plus,
  Settings,
  Sparkles,
  Trash2,
  X
} from 'lucide-vue-next';
import {
  PERIODS,
  formatDateTime,
  getLatestRecord,
  getRecordStats,
  sortRecordsByTime,
  toLocalInputValue
} from './lib/records.js';
import {
  clearRecordsOnServer,
  createRecordOnServer,
  deleteRecordOnServer,
  listRecords,
  updateRecordOnServer
} from './lib/api.js';

const tabs = [
  { key: 'home', label: '首页', icon: Home },
  { key: 'records', label: '记录', icon: ListChecks },
  { key: 'chart', label: '曲线', icon: BarChart3 },
  { key: 'export', label: '导出', icon: Download },
  { key: 'settings', label: '我的', icon: Settings }
];

const periods = PERIODS;
const activeTab = ref('home');
const records = ref([]);
const showForm = ref(false);
const editingRecord = ref(null);
const detailRecord = ref(null);
const confirmDelete = ref(null);
const showResetConfirm = ref(false);
const toast = ref('');
const isExporting = ref(false);
const isLoadingRecords = ref(false);
const isSavingRecord = ref(false);
const reportRef = ref(null);

const form = ref({
  value: '',
  period: '早餐后',
  measuredAt: toLocalInputValue(),
  note: ''
});

const sortedRecords = computed(() => sortRecordsByTime(records.value));
const latestRecord = computed(() => getLatestRecord(records.value));
const stats = computed(() => getRecordStats(records.value));
const chartInsight = computed(() => {
  if (!records.value.length) return '还没有可分析的数据，先记录一次血糖。';
  if (stats.value.highest >= 8) return '最近有偏高记录，建议保留备注，复盘饮食或运动情况。';
  if (stats.value.count < 3) return '记录还比较少，再补几条后曲线会更有参考感。';
  return '最近记录整体比较平稳，继续按需要偶尔记录就好。';
});

const GlucoseChart = defineComponent({
  name: 'GlucoseChart',
  props: {
    records: { type: Array, required: true },
    compact: { type: Boolean, default: false }
  },
  setup(props) {
    const activePoint = ref(null);

    return () => {
      const width = props.compact ? 320 : 340;
      const height = props.compact ? 128 : 186;
      const padding = props.compact ? 18 : 24;
      const ordered = sortRecordsByTime(props.records).reverse().slice(-10);

      if (!ordered.length) {
        return h('div', { class: ['chart-empty', props.compact && 'compact'] }, [
          h(HeartPulse, { size: 28 }),
          h('span', '记录后这里会出现曲线')
        ]);
      }

      const values = ordered.map((record) => record.value);
      const min = Math.min(4, ...values) - 0.4;
      const max = Math.max(9, ...values) + 0.4;
      const xStep = ordered.length === 1 ? 0 : (width - padding * 2) / (ordered.length - 1);
      const pointFor = (record, index) => {
        const x = ordered.length === 1 ? width / 2 : padding + index * xStep;
        const y = height - padding - ((record.value - min) / (max - min)) * (height - padding * 2);
        return { x, y, record };
      };
      const points = ordered.map(pointFor);
      const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
      const referenceY = height - padding - ((7.8 - min) / (max - min)) * (height - padding * 2);
      const tooltipPoint = activePoint.value;
      const tooltipSide = tooltipPoint?.x < width * 0.22
        ? 'align-left'
        : tooltipPoint?.x > width * 0.78
          ? 'align-right'
          : 'align-center';

      return h('div', { class: ['chart-wrap', props.compact && 'compact'] }, [
        h('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': '血糖趋势曲线' }, [
          h('path', {
            d: `M ${padding} ${referenceY} L ${width - padding} ${referenceY}`,
            class: 'chart-reference'
          }),
          h('path', {
            d: path,
            class: 'chart-line'
          }),
          points.map((point) => h('g', {
            key: point.record.id,
            class: ['chart-point', tooltipPoint?.record.id === point.record.id && 'active'],
            onMouseenter: () => { activePoint.value = point; },
            onMouseleave: () => { activePoint.value = null; },
            onFocusin: () => { activePoint.value = point; },
            onFocusout: () => { activePoint.value = null; },
            onClick: () => { activePoint.value = point; }
          }, [
            h('circle', { cx: point.x, cy: point.y, r: props.compact ? 4 : 5, class: 'chart-dot' }),
            h('circle', {
              cx: point.x,
              cy: point.y,
              r: props.compact ? 15 : 18,
              class: 'chart-hit-area',
              tabindex: 0,
              role: 'button',
              'aria-label': `${formatDateTime(point.record.measuredAt)} 血糖 ${point.record.value} ${point.record.unit}`
            }),
            !props.compact && h('text', { x: point.x, y: point.y - 10, class: 'chart-label', 'text-anchor': 'middle' }, point.record.value)
          ])),
        ]),
        tooltipPoint && h('div', {
          class: ['chart-tooltip', tooltipSide],
          style: {
            left: `${(tooltipPoint.x / width) * 100}%`,
            top: `${(tooltipPoint.y / height) * 100}%`
          }
        }, [
          h('span', `血糖 ${tooltipPoint.record.value} ${tooltipPoint.record.unit}`),
          h('strong', tooltipPoint.record.period),
          h('small', `记录时间：${formatDateTime(tooltipPoint.record.measuredAt)}`)
        ]),
        h('div', { class: 'chart-axis' }, [
          h('span', ordered[0] ? shortDate(ordered[0].measuredAt) : ''),
          h('span', '参考上限 7.8'),
          h('span', ordered.at(-1) ? shortDate(ordered.at(-1).measuredAt) : '')
        ])
      ]);
    };
  }
});

const EmptyState = defineComponent({
  name: 'EmptyState',
  props: {
    title: { type: String, required: true },
    body: { type: String, required: true }
  },
  setup(props) {
    return () => h('section', { class: 'empty-state' }, [
      h(HeartPulse, { size: 36 }),
      h('h2', props.title),
      h('p', props.body)
    ]);
  }
});

onMounted(() => {
  loadRecords();
});

async function loadRecords(showError = true) {
  isLoadingRecords.value = true;
  try {
    records.value = await listRecords();
  } catch {
    records.value = [];
    if (showError) showToast('后端 API 未连接');
  } finally {
    isLoadingRecords.value = false;
  }
}

function openNewRecord() {
  editingRecord.value = null;
  form.value = {
    value: '',
    period: latestRecord.value?.period || '早餐后',
    measuredAt: toLocalInputValue(),
    note: ''
  };
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  editingRecord.value = null;
}

async function saveRecord() {
  if (isSavingRecord.value) return;

  isSavingRecord.value = true;
  const wasEditing = Boolean(editingRecord.value);

  const payload = {
    value: Number(form.value.value),
    period: form.value.period,
    measuredAt: form.value.measuredAt,
    note: form.value.note
  };

  try {
    if (wasEditing) {
      await updateRecordOnServer(editingRecord.value.id, payload);
    } else {
      await createRecordOnServer(payload);
    }
    await loadRecords(false);
    closeForm();
    showToast(wasEditing ? '记录已更新' : '记录已保存');
  } catch {
    showToast('保存失败，请检查 API 服务');
  } finally {
    isSavingRecord.value = false;
  }
}

function startEdit(record) {
  detailRecord.value = null;
  editingRecord.value = record;
  form.value = {
    value: record.value,
    period: record.period,
    measuredAt: record.measuredAt,
    note: record.note
  };
  showForm.value = true;
}

async function removeRecord(id) {
  try {
    await deleteRecordOnServer(id);
    await loadRecords(false);
    confirmDelete.value = null;
    detailRecord.value = null;
    showToast('记录已删除');
  } catch {
    showToast('删除失败，请检查 API 服务');
  }
}

async function resetRecords() {
  try {
    await clearRecordsOnServer();
    records.value = [];
    showResetConfirm.value = false;
    activeTab.value = 'home';
    showToast('记录已清空');
  } catch {
    showToast('清空失败，请检查 API 服务');
  }
}

async function exportReport(type) {
  if (!reportRef.value) return;

  isExporting.value = true;
  await nextTick();

  try {
    const canvas = await html2canvas(reportRef.value, {
      backgroundColor: '#fff7fb',
      scale: 2,
      useCORS: true
    });

    if (type === 'png') {
      const link = document.createElement('a');
      link.download = `血糖记录-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('图片已生成');
      return;
    }

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 28;
    const imageWidth = pageWidth - margin * 2;
    const imageHeight = (canvas.height * imageWidth) / canvas.width;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, imageWidth, imageHeight);
    pdf.save(`血糖记录-${Date.now()}.pdf`);
    showToast('PDF 已生成');
  } finally {
    isExporting.value = false;
  }
}

function showToast(message) {
  toast.value = message;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.value = '';
  }, 1800);
}

function shortDate(value) {
  const date = new Date(value);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function dayLabel(value) {
  const date = new Date(value);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function timeLabel(value) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
</script>
