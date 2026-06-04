<template>
  <main class="app-shell">
    <section v-if="!isAuthReady" class="auth-card auth-loading" aria-label="正在加载">
      <HeartPulse :size="34" />
      <h1>糖糖记录本</h1>
      <p>正在确认登录状态...</p>
    </section>

    <section v-else class="phone-frame" aria-label="糖糖记录本">
      <div class="screen-scroll">
        <header class="app-header">
          <div>
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
              <strong class="hero-value">{{ latestRecord ? formatGlucoseValue(latestRecord.value) : '--' }}</strong>
              <span class="hero-unit">{{ latestRecord ? latestRecord.unit : 'mmol/L' }}</span>
              <p>{{ latestRecord ? `${formatDateTime(latestRecord.measuredAt)} · ${latestRecord.note || '无备注'}` : '先记录一次，曲线会自动出现。' }}</p>
            </div>
            <div class="peach-mascot" aria-hidden="true">
              <span></span>
            </div>
          </div>

          <div class="home-actions three-actions">
            <button class="primary-action glucose-action" type="button" @click="openNewRecord">
              <HeartPulse :size="21" />
              记录血糖
            </button>
            <button class="secondary-action pressure-action" type="button" @click="openNewBloodPressureRecord">
              <Activity :size="21" />
              记录血压
            </button>
            <button class="secondary-action food-action" type="button" @click="openNewFoodRecord">
              <Utensils :size="21" />
              记录饮食
            </button>
          </div>

          <div class="summary-grid">
            <article>
              <span>记录数</span>
              <strong>{{ stats.count }}</strong>
            </article>
            <article>
              <span>平均值</span>
              <strong>{{ formattedStats.average }}</strong>
            </article>
            <article>
              <span>最高值</span>
              <strong>{{ formattedStats.highest }}</strong>
            </article>
          </div>

          <section class="card pressure-summary-card">
            <div class="card-heading">
              <div>
                <span class="section-label">最近血压</span>
                <h2>{{ latestBloodPressureRecord ? `${latestBloodPressureRecord.systolic}/${latestBloodPressureRecord.diastolic}` : '--/--' }}</h2>
              </div>
              <button class="text-button" type="button" @click="openNewBloodPressureRecord">记录</button>
            </div>
            <p v-if="latestBloodPressureRecord">
              {{ formatDateTime(latestBloodPressureRecord.measuredAt) }}
              <span v-if="latestBloodPressureRecord.pulse"> · 心率 {{ latestBloodPressureRecord.pulse }} bpm</span>
              <span> · {{ latestBloodPressureRecord.note || '无备注' }}</span>
            </p>
            <p v-else>记录一次血压后，这里会显示最近读数。</p>
          </section>

          <section class="card chart-card">
            <div class="card-heading">
              <div>
                <span class="section-label">趋势预览</span>
                <h2>最近血糖曲线</h2>
              </div>
              <button class="text-button" type="button" @click="activeTab = 'chart'">查看</button>
            </div>
            <GlucoseChart :records="records" :reference-limit="chartReferenceLimit" compact />
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
            <button class="soft-button" type="button" @click="openActiveChartRecord">
              <Plus :size="16" />
              新增
            </button>
          </div>

          <div class="record-switch" role="tablist" aria-label="曲线类型">
            <button type="button" :class="{ active: activeChartKind === 'glucose' }" @click="activeChartKind = 'glucose'">血糖趋势</button>
            <button type="button" :class="{ active: activeChartKind === 'pressure' }" @click="activeChartKind = 'pressure'">血压趋势</button>
          </div>

          <template v-if="activeChartKind === 'glucose'">
            <section class="card full-chart-card">
              <GlucoseChart :records="records" :reference-limit="chartReferenceLimit" />
              <div class="range-note">
                <span></span>
                参考上限 {{ formattedChartReferenceLimit }} mmol/L，仅作日常记录参考，请以医生建议为准。
              </div>
            </section>

            <div class="summary-grid">
              <article>
                <span>最低</span>
                <strong>{{ formattedStats.lowest }}</strong>
              </article>
              <article>
                <span>平均</span>
                <strong>{{ formattedStats.average }}</strong>
              </article>
              <article>
                <span>最高</span>
                <strong>{{ formattedStats.highest }}</strong>
              </article>
            </div>
          </template>

          <template v-else>
            <section class="card full-chart-card">
              <BloodPressureChart :records="bloodPressureRecords" />
              <div class="pressure-legend" aria-label="血压曲线说明">
                <span><i class="systolic-mark"></i>收缩压</span>
                <span><i class="diastolic-mark"></i>舒张压</span>
              </div>
            </section>

            <div class="summary-grid">
              <article>
                <span>平均收缩压</span>
                <strong>{{ bloodPressureStats.averageSystolic || '--' }}</strong>
              </article>
              <article>
                <span>平均舒张压</span>
                <strong>{{ bloodPressureStats.averageDiastolic || '--' }}</strong>
              </article>
              <article>
                <span>平均心率</span>
                <strong>{{ bloodPressureStats.averagePulse || '--' }}</strong>
              </article>
            </div>
          </template>

          <section class="card insight-card">
            <span class="section-label">小提示</span>
            <p>{{ activeChartInsight }}</p>
          </section>
        </section>

        <section v-else-if="activeTab === 'records'" class="page-stack page-enter">
          <div class="page-title">
            <div>
              <p class="eyebrow">历史记录</p>
              <h2>{{ recordPageTitle }}</h2>
            </div>
            <button class="soft-button" type="button" @click="openActiveRecordForm">
              <Plus :size="16" />
              新增
            </button>
          </div>

          <div class="record-switch three-way" role="tablist" aria-label="记录类型">
            <button type="button" :class="{ active: activeRecordKind === 'glucose' }" @click="activeRecordKind = 'glucose'">血糖记录</button>
            <button type="button" :class="{ active: activeRecordKind === 'pressure' }" @click="activeRecordKind = 'pressure'">血压记录</button>
            <button type="button" :class="{ active: activeRecordKind === 'food' }" @click="activeRecordKind = 'food'">饮食记录</button>
          </div>

          <div v-if="activeRecordKind === 'glucose' && records.length" class="record-list">
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
                <strong>{{ formatGlucoseValue(record.value) }}</strong>
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

          <div v-else-if="activeRecordKind === 'pressure' && bloodPressureRecords.length" class="record-list">
            <article v-for="record in sortedBloodPressureRecords" :key="record.id" class="record-card pressure-record-card" @click="detailBloodPressureRecord = record">
              <div class="record-date pressure-date">
                <span>{{ dayLabel(record.measuredAt) }}</span>
                <small>{{ timeLabel(record.measuredAt) }}</small>
              </div>
              <div class="record-info">
                <span>{{ formatDateTime(record.measuredAt) }}</span>
                <p>{{ record.note || '没有备注' }}</p>
              </div>
              <div class="record-actions">
                <strong>{{ record.systolic }}/{{ record.diastolic }}</strong>
                <small>{{ pressurePulseText(record) }}</small>
                <button
                  class="record-delete-button"
                  type="button"
                  :aria-label="`删除${record.systolic}/${record.diastolic}血压记录`"
                  @click.stop="confirmBloodPressureDelete = record"
                >
                  <Trash2 :size="16" />
                </button>
              </div>
            </article>
          </div>

          <div v-else-if="activeRecordKind === 'food' && foodRecords.length" class="record-list">
            <article v-for="record in sortedFoodRecords" :key="record.id" class="record-card food-record-card" @click="detailFoodRecord = record">
              <div class="food-thumb" aria-hidden="true">
                <img v-if="foodImageUrls[record.imageKey]" :src="foodImageUrls[record.imageKey]" alt="" />
                <Utensils v-else :size="22" />
              </div>
              <div class="record-info">
                <span>{{ record.mealType }} · {{ formatDateTime(record.eatenAt) }}</span>
                <p>{{ record.content }}</p>
              </div>
              <div class="record-actions">
                <small>{{ record.note || '无备注' }}</small>
                <button
                  class="record-delete-button"
                  type="button"
                  :aria-label="`删除${record.mealType}饮食记录`"
                  @click.stop="confirmFoodDelete = record"
                >
                  <Trash2 :size="16" />
                </button>
              </div>
            </article>
          </div>

          <EmptyState
            v-else
            :title="emptyRecordTitle"
            :body="emptyRecordBody"
          />
        </section>

        <section v-else-if="activeTab === 'export'" class="page-stack page-enter">
          <div class="page-title">
            <div>
              <p class="eyebrow">导出中心</p>
              <h2>保存这份记录</h2>
            </div>
            <button class="soft-button" type="button" @click="openActiveReportRecord">
              <Plus :size="16" />
              补一条
            </button>
          </div>

          <div class="record-switch" role="tablist" aria-label="报告类型">
            <button type="button" :class="{ active: activeReportKind === 'glucose' }" @click="activeReportKind = 'glucose'">血糖报告</button>
            <button type="button" :class="{ active: activeReportKind === 'pressure' }" @click="activeReportKind = 'pressure'">血压报告</button>
          </div>

          <section ref="reportRef" class="report-card">
            <template v-if="activeReportKind === 'glucose'">
              <div class="report-head">
                <div>
                  <span>使用人：{{ currentUser?.displayName || '访客预览' }}</span>
                  <h3>血糖记录汇总</h3>
                </div>
                <div class="report-badge">{{ stats.count }} 条</div>
              </div>
              <div class="report-stats">
                <div><span>平均</span><strong>{{ formattedStats.average }}</strong></div>
                <div><span>最高</span><strong>{{ formattedStats.highest }}</strong></div>
                <div><span>最低</span><strong>{{ formattedStats.lowest }}</strong></div>
              </div>
              <GlucoseChart :records="records" :reference-limit="chartReferenceLimit" compact />
              <div class="report-list">
                <div v-for="record in sortedRecords" :key="record.id">
                  <span>
                    <b>{{ formatDateTime(record.measuredAt) }} · {{ record.period }}</b>
                    <small>{{ record.note || '无备注' }}</small>
                  </span>
                  <strong>{{ formatGlucoseValue(record.value) }} {{ record.unit }}</strong>
                </div>
              </div>
            </template>

            <template v-else>
              <div class="report-head">
                <div>
                  <span>使用人：{{ currentUser?.displayName || '访客预览' }}</span>
                  <h3>血压记录汇总</h3>
                </div>
                <div class="report-badge">{{ bloodPressureStats.count }} 条</div>
              </div>
              <div class="report-stats">
                <div><span>平均收缩压</span><strong>{{ bloodPressureStats.averageSystolic || '--' }}</strong></div>
                <div><span>平均舒张压</span><strong>{{ bloodPressureStats.averageDiastolic || '--' }}</strong></div>
                <div><span>平均心率</span><strong>{{ bloodPressureStats.averagePulse || '--' }}</strong></div>
              </div>
              <BloodPressureChart :records="bloodPressureRecords" compact />
              <div class="report-list">
                <div v-for="record in sortedBloodPressureRecords" :key="record.id">
                  <span>
                    <b>{{ formatDateTime(record.measuredAt) }}</b>
                    <small>{{ record.note || pressurePulseText(record) }}</small>
                  </span>
                  <strong>{{ record.systolic }}/{{ record.diastolic }} mmHg</strong>
                </div>
              </div>
            </template>
          </section>

          <div class="export-actions">
            <button class="primary-action" type="button" :disabled="isExporting || !canExportActiveReport" @click="exportReport('png')">
              <ImageDown :size="20" />
              导出图片
            </button>
            <button class="secondary-action" type="button" :disabled="isExporting || !canExportActiveReport" @click="exportReport('pdf')">
              <FileText :size="20" />
              导出 PDF
            </button>
          </div>

          <p class="export-note">导出内容来自后端数据库 API，当前页面只负责展示和生成文件。</p>
        </section>

        <section v-else class="page-stack page-enter">
          <div class="page-title">
            <div>
              <p class="eyebrow">个人中心</p>
              <h2>{{ currentUser ? '我的糖糖账户' : '先逛逛也可以' }}</h2>
            </div>
          </div>

          <section v-if="!currentUser" class="profile-card guest-profile-card">
            <div class="profile-main">
              <div class="profile-avatar guest-avatar" aria-hidden="true">
                <span>糖</span>
              </div>
              <div class="profile-copy">
                <span>访客预览</span>
                <h3>登录后保存记录</h3>
                <p>首页、曲线和表单都能先看看；保存数据时再登录。</p>
              </div>
            </div>
            <div class="guest-auth-actions">
              <button class="primary-action compact" type="button" @click="openAuthModal('login')">
                <Check :size="18" />
                登录
              </button>
              <button class="secondary-action compact" type="button" @click="openAuthModal('register')">注册账号</button>
            </div>
          </section>

          <section v-if="currentUser" class="profile-card">
            <div class="profile-main">
              <div class="profile-avatar" :style="avatarStyle" aria-hidden="true">
                <span>{{ avatarInitial }}</span>
              </div>
              <div class="profile-copy">
                <span>当前使用人</span>
                <h3>{{ currentUser.displayName }}</h3>
                <p>@{{ currentUser.username }}</p>
              </div>
            </div>
            <button v-if="!isEditingProfile" class="soft-button profile-edit-button" type="button" @click="startEditProfile">
              <Pencil :size="16" />
              编辑资料
            </button>
            <form v-else class="profile-edit-form" @submit.prevent="saveProfile">
              <label class="field">
                <span>昵称</span>
                <input v-model.trim="profileForm.displayName" aria-label="昵称" maxlength="30" placeholder="输入昵称" required />
              </label>
              <p v-if="profileError" class="auth-error">{{ profileError }}</p>
              <div class="profile-edit-actions">
                <button class="secondary-action compact" type="button" :disabled="isSavingProfile" @click="cancelEditProfile">取消</button>
                <button class="primary-action compact" type="submit" :disabled="isSavingProfile">
                  <Check :size="18" />
                  {{ isSavingProfile ? '保存中...' : '保存资料' }}
                </button>
              </div>
            </form>
          </section>

          <section v-if="currentUser" class="profile-stats">
            <article>
              <span>记录数</span>
              <strong>{{ stats.count }}</strong>
            </article>
            <article>
              <span>平均值</span>
              <strong>{{ formattedStats.average }}</strong>
            </article>
            <article>
              <span>参考线</span>
              <strong>{{ formattedChartReferenceLimit }}</strong>
            </article>
          </section>

          <section v-if="currentUser" class="card settings-list">
            <div class="settings-item">
              <span>账号</span>
              <strong>{{ currentUser.username }}</strong>
            </div>
            <div class="settings-item">
              <span>默认单位</span>
              <strong>mmol/L</strong>
            </div>
            <label class="settings-row reference-setting">
              <span>图表参考上限</span>
              <div class="settings-number-control">
                <input
                  v-model.number="chartReferenceLimit"
                  aria-label="图表参考上限"
                  type="number"
                  inputmode="decimal"
                  min="0.1"
                  max="40"
                  step="0.1"
                  @blur="saveChartReferenceLimit"
                  @change="saveChartReferenceLimit"
                />
                <em>mmol/L</em>
              </div>
            </label>
          </section>

          <button v-if="currentUser" class="secondary-action" type="button" @click="logout">
            <X :size="19" />
            退出登录
          </button>

          <button v-if="currentUser" class="secondary-action danger" type="button" @click="showResetConfirm = true">
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
      <div v-if="showAuthModal" class="modal-backdrop auth-backdrop" @click.self="!isAuthenticating && closeAuthModal()">
        <section class="auth-card auth-sheet page-enter" aria-label="账号登录">
          <div class="auth-brand">
            <div>
              <p class="eyebrow">多用户血糖记录</p>
              <h1>登录糖糖记录本</h1>
            </div>
            <button class="icon-button" type="button" aria-label="关闭登录" :disabled="isAuthenticating" @click="closeAuthModal">
              <X :size="20" />
            </button>
          </div>

          <div class="auth-switch" role="tablist" aria-label="登录或注册">
            <button type="button" :class="{ active: authMode === 'login' }" @click="switchAuthMode('login')">登录</button>
            <button type="button" :class="{ active: authMode === 'register' }" @click="switchAuthMode('register')">注册账号</button>
          </div>

          <form class="auth-form" @submit.prevent="submitAuth">
            <label class="field">
              <span>用户名</span>
              <input v-model.trim="authForm.username" autocomplete="username" placeholder="例如 tangtang" required />
            </label>

            <label v-if="authMode === 'register'" class="field">
              <span>昵称</span>
              <input v-model.trim="authForm.displayName" autocomplete="nickname" placeholder="比如 我的老婆" required />
            </label>

            <label class="field">
              <span>密码</span>
              <input
                v-model="authForm.password"
                type="password"
                :autocomplete="authMode === 'login' ? 'current-password' : 'new-password'"
                placeholder="至少 6 位"
                required
              />
            </label>

            <label v-if="authMode === 'register'" class="field">
              <span>确认密码</span>
              <input v-model="authForm.confirmPassword" type="password" autocomplete="new-password" placeholder="再输入一次" required />
            </label>

            <label class="field captcha-field">
              <span>验证码</span>
              <div class="captcha-control">
                <strong class="captcha-question" aria-live="polite">{{ captchaChallenge?.question || '加载中...' }}</strong>
                <button class="icon-button" type="button" aria-label="刷新验证码" :disabled="isLoadingCaptcha || isAuthenticating" @click="refreshCaptcha">
                  <RefreshCw :size="18" />
                </button>
              </div>
              <input v-model.trim="authForm.captchaAnswer" aria-label="验证码答案" inputmode="numeric" autocomplete="off" placeholder="输入答案" required />
            </label>

            <p v-if="authError" class="auth-error">{{ authError }}</p>

            <button class="primary-action" type="submit" :disabled="isAuthenticating || isLoadingCaptcha || !captchaChallenge">
              <Check :size="20" />
              {{ isAuthenticating ? '处理中...' : authMode === 'login' ? '登录' : '注册并进入' }}
            </button>
          </form>
        </section>
      </div>

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

      <div v-if="showBloodPressureForm" class="modal-backdrop" @click.self="!isSavingBloodPressureRecord && closeBloodPressureForm()">
        <form class="sheet" :aria-busy="isSavingBloodPressureRecord" @submit.prevent="saveBloodPressureRecord">
          <div class="sheet-handle"></div>
          <div class="sheet-head">
            <h2>{{ editingBloodPressureRecord ? '编辑血压' : '记录一次血压' }}</h2>
            <button class="icon-button" type="button" aria-label="关闭" :disabled="isSavingBloodPressureRecord" @click="closeBloodPressureForm">
              <X :size="20" />
            </button>
          </div>

          <div class="pressure-input-grid">
            <label class="field">
              <span>收缩压</span>
              <div class="value-input">
                <input v-model="bloodPressureForm.systolic" aria-label="收缩压" type="number" inputmode="numeric" min="50" max="260" step="1" placeholder="120" required />
                <em>mmHg</em>
              </div>
            </label>

            <label class="field">
              <span>舒张压</span>
              <div class="value-input">
                <input v-model="bloodPressureForm.diastolic" aria-label="舒张压" type="number" inputmode="numeric" min="30" max="180" step="1" placeholder="80" required />
                <em>mmHg</em>
              </div>
            </label>
          </div>

          <label class="field">
            <span>心率（可选）</span>
            <div class="value-input">
              <input v-model="bloodPressureForm.pulse" aria-label="心率" type="number" inputmode="numeric" min="30" max="220" step="1" placeholder="72" />
              <em>bpm</em>
            </div>
          </label>

          <label class="field">
            <span>测量时间</span>
            <input v-model="bloodPressureForm.measuredAt" type="datetime-local" required />
          </label>

          <label class="field">
            <span>备注</span>
            <textarea v-model="bloodPressureForm.note" rows="3" maxlength="500" placeholder="比如早起、睡前、运动后"></textarea>
          </label>

          <button class="primary-action" type="submit" :disabled="isSavingBloodPressureRecord">
            <Check :size="20" />
            {{ isSavingBloodPressureRecord ? '保存中...' : '保存血压' }}
          </button>
        </form>
      </div>

      <div v-if="showFoodForm" class="modal-backdrop" @click.self="!isSavingFoodRecord && closeFoodForm()">
        <form class="sheet" :aria-busy="isSavingFoodRecord" @submit.prevent="saveFoodRecord">
          <div class="sheet-handle"></div>
          <div class="sheet-head">
            <h2>{{ editingFoodRecord ? '编辑饮食' : '记录饮食' }}</h2>
            <button class="icon-button" type="button" aria-label="关闭" :disabled="isSavingFoodRecord" @click="closeFoodForm">
              <X :size="20" />
            </button>
          </div>

          <label class="field">
            <span>餐次</span>
            <select v-model="foodForm.mealType">
              <option v-for="mealType in foodMealTypes" :key="mealType" :value="mealType">{{ mealType }}</option>
            </select>
          </label>

          <label class="field">
            <span>饮食时间</span>
            <input v-model="foodForm.eatenAt" type="datetime-local" required />
          </label>

          <label class="field">
            <span>饮食内容</span>
            <textarea v-model.trim="foodForm.content" rows="3" maxlength="500" placeholder="比如杂粮饼半个，牛奶 250ml" required></textarea>
          </label>

          <label class="field">
            <span>备注</span>
            <textarea v-model.trim="foodForm.note" rows="2" maxlength="500" placeholder="比如饭后散步、吃得偏甜"></textarea>
          </label>

          <label class="field">
            <span>图片</span>
            <div class="food-upload">
              <div class="food-upload-preview">
                <img v-if="foodForm.previewUrl || foodImageUrls[editingFoodRecord?.imageKey]" :src="foodForm.previewUrl || foodImageUrls[editingFoodRecord?.imageKey]" alt="饮食图片预览" />
                <ImagePlus v-else :size="26" />
              </div>
              <div>
                <strong>{{ foodForm.imageFile ? foodForm.imageFile.name : editingFoodRecord?.imageKey ? '已保留原图' : '添加一张照片' }}</strong>
                <small>支持 jpg、png、webp，最大 5MB</small>
              </div>
              <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="饮食图片" @change="handleFoodImageChange" />
            </div>
          </label>

          <button class="primary-action" type="submit" :disabled="isSavingFoodRecord">
            <Check :size="20" />
            {{ isSavingFoodRecord ? '保存中...' : '保存饮食' }}
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
          <div class="detail-value">{{ formatGlucoseValue(detailRecord.value) }} <span>{{ detailRecord.unit }}</span></div>
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

      <div v-if="detailBloodPressureRecord" class="modal-backdrop" @click.self="detailBloodPressureRecord = null">
        <section class="sheet detail-sheet">
          <div class="sheet-handle"></div>
          <div class="sheet-head">
            <h2>血压详情</h2>
            <button class="icon-button" type="button" aria-label="关闭" @click="detailBloodPressureRecord = null">
              <X :size="20" />
            </button>
          </div>
          <div class="detail-value pressure-detail-value">
            {{ detailBloodPressureRecord.systolic }}/{{ detailBloodPressureRecord.diastolic }} <span>mmHg</span>
          </div>
          <p>{{ formatDateTime(detailBloodPressureRecord.measuredAt) }} · {{ pressurePulseText(detailBloodPressureRecord) }}</p>
          <div class="detail-note">{{ detailBloodPressureRecord.note || '没有备注' }}</div>
          <div class="split-actions">
            <button class="secondary-action" type="button" @click="startEditBloodPressure(detailBloodPressureRecord)">
              <Pencil :size="18" />
              编辑
            </button>
            <button class="secondary-action danger" type="button" @click="confirmBloodPressureDelete = detailBloodPressureRecord">
              <Trash2 :size="18" />
              删除
            </button>
          </div>
        </section>
      </div>

      <div v-if="detailFoodRecord" class="modal-backdrop" @click.self="detailFoodRecord = null">
        <section class="sheet detail-sheet food-detail-sheet">
          <div class="sheet-handle"></div>
          <div class="sheet-head">
            <h2>饮食详情</h2>
            <button class="icon-button" type="button" aria-label="关闭" @click="detailFoodRecord = null">
              <X :size="20" />
            </button>
          </div>
          <div class="food-detail-image">
            <img v-if="foodImageUrls[detailFoodRecord.imageKey]" :src="foodImageUrls[detailFoodRecord.imageKey]" alt="饮食图片" />
            <Utensils v-else :size="34" />
          </div>
          <p>{{ detailFoodRecord.mealType }} · {{ formatDateTime(detailFoodRecord.eatenAt) }}</p>
          <div class="detail-note">{{ detailFoodRecord.content }}</div>
          <div v-if="detailFoodRecord.note" class="detail-note muted-note">{{ detailFoodRecord.note }}</div>
          <div class="split-actions">
            <button class="secondary-action" type="button" @click="startEditFood(detailFoodRecord)">
              <Pencil :size="18" />
              编辑
            </button>
            <button class="secondary-action danger" type="button" @click="confirmFoodDelete = detailFoodRecord">
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

      <div v-if="confirmFoodDelete" class="modal-backdrop" @click.self="confirmFoodDelete = null">
        <section class="confirm-box">
          <h2>删除这条饮食？</h2>
          <p>删除后饮食列表和对应图片会一起清理。</p>
          <div class="split-actions">
            <button class="secondary-action" type="button" @click="confirmFoodDelete = null">取消</button>
            <button class="secondary-action danger solid-danger" type="button" @click="removeFoodRecord(confirmFoodDelete.id)">删除</button>
          </div>
        </section>
      </div>

      <div v-if="confirmBloodPressureDelete" class="modal-backdrop" @click.self="confirmBloodPressureDelete = null">
        <section class="confirm-box">
          <h2>删除这条血压？</h2>
          <p>删除后首页、曲线、历史列表和导出数据会同步更新。</p>
          <div class="split-actions">
            <button class="secondary-action" type="button" @click="confirmBloodPressureDelete = null">取消</button>
            <button class="secondary-action danger solid-danger" type="button" @click="removeBloodPressureRecord(confirmBloodPressureDelete.id)">删除</button>
          </div>
        </section>
      </div>

      <div v-if="showResetConfirm" class="modal-backdrop" @click.self="showResetConfirm = false">
        <section class="confirm-box">
          <h2>清空全部记录？</h2>
          <p>会移除当前使用人的血糖、血压和饮食记录。</p>
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
import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  Activity,
  BarChart3,
  Check,
  CheckCircle2,
  Download,
  FileText,
  HeartPulse,
  Home,
  ImageDown,
  ImagePlus,
  ListChecks,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Trash2,
  Utensils,
  X
} from 'lucide-vue-next';
import {
  CHART_REFERENCE_LIMIT_STORAGE_KEY,
  DEFAULT_CHART_REFERENCE_LIMIT,
  PERIODS,
  formatDateTime,
  formatGlucoseLimit,
  formatGlucoseValue,
  getBloodPressureStats,
  getLatestBloodPressureRecord,
  getLatestRecord,
  getRecordStats,
  normalizeChartReferenceLimit,
  normalizeGlucoseValue,
  sortBloodPressureRecordsByTime,
  sortRecordsByTime,
  toLocalInputValue
} from './lib/records.js';
import {
  clearAuthSession,
  clearBloodPressureRecordsOnServer,
  clearFoodRecordsOnServer,
  clearRecordsOnServer,
  createBloodPressureRecordOnServer,
  createFoodRecordOnServer,
  createRecordOnServer,
  deleteBloodPressureRecordOnServer,
  deleteFoodRecordOnServer,
  deleteRecordOnServer,
  fetchFoodImageBlob,
  getCaptchaChallenge,
  getCurrentUser,
  getStoredAuthSession,
  loginAccount,
  listBloodPressureRecords,
  listFoodRecords,
  listRecords,
  registerAccount,
  setAuthSession,
  updateBloodPressureRecordOnServer,
  updateCurrentUserProfile,
  updateFoodRecordOnServer,
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
const foodMealTypes = ['早餐', '午餐', '晚餐', '加餐', '其他'];
const activeTab = ref('home');
const activeRecordKind = ref('glucose');
const activeChartKind = ref('glucose');
const activeReportKind = ref('glucose');
const records = ref([]);
const bloodPressureRecords = ref([]);
const foodRecords = ref([]);
const foodImageUrls = ref({});
const showAuthModal = ref(false);
const showForm = ref(false);
const showBloodPressureForm = ref(false);
const showFoodForm = ref(false);
const editingRecord = ref(null);
const editingBloodPressureRecord = ref(null);
const editingFoodRecord = ref(null);
const detailRecord = ref(null);
const detailBloodPressureRecord = ref(null);
const detailFoodRecord = ref(null);
const confirmDelete = ref(null);
const confirmBloodPressureDelete = ref(null);
const confirmFoodDelete = ref(null);
const showResetConfirm = ref(false);
const toast = ref('');
const authMode = ref('login');
const authError = ref('');
const isAuthReady = ref(false);
const isAuthenticating = ref(false);
const isLoadingCaptcha = ref(false);
const isExporting = ref(false);
const isLoadingRecords = ref(false);
const isSavingRecord = ref(false);
const isSavingBloodPressureRecord = ref(false);
const isSavingFoodRecord = ref(false);
const isEditingProfile = ref(false);
const isSavingProfile = ref(false);
const reportRef = ref(null);
const chartReferenceLimit = ref(DEFAULT_CHART_REFERENCE_LIMIT);
const currentAuth = ref(null);
const captchaChallenge = ref(null);
const profileError = ref('');

const authForm = ref({
  username: '',
  displayName: '',
  password: '',
  confirmPassword: '',
  captchaAnswer: ''
});
const profileForm = ref({
  displayName: ''
});
const form = ref({
  value: '',
  period: '早餐后',
  measuredAt: toLocalInputValue(),
  note: ''
});
const bloodPressureForm = ref({
  systolic: '',
  diastolic: '',
  pulse: '',
  measuredAt: toLocalInputValue(),
  note: ''
});
const foodForm = ref({
  mealType: '早餐',
  eatenAt: toLocalInputValue(),
  content: '',
  note: '',
  imageFile: null,
  previewUrl: ''
});

const sortedRecords = computed(() => sortRecordsByTime(records.value));
const sortedBloodPressureRecords = computed(() => sortBloodPressureRecordsByTime(bloodPressureRecords.value));
const sortedFoodRecords = computed(() => [...foodRecords.value].sort((left, right) => new Date(right.eatenAt) - new Date(left.eatenAt)));
const latestRecord = computed(() => getLatestRecord(records.value));
const latestBloodPressureRecord = computed(() => getLatestBloodPressureRecord(bloodPressureRecords.value));
const stats = computed(() => getRecordStats(records.value));
const bloodPressureStats = computed(() => getBloodPressureStats(bloodPressureRecords.value));
const currentUser = computed(() => currentAuth.value?.user || null);
const formattedStats = computed(() => ({
  average: stats.value.count ? formatGlucoseValue(stats.value.average) : '--',
  highest: stats.value.count ? formatGlucoseValue(stats.value.highest) : '--',
  lowest: stats.value.count ? formatGlucoseValue(stats.value.lowest) : '--'
}));
const formattedChartReferenceLimit = computed(() => formatGlucoseLimit(chartReferenceLimit.value));
const recordPageTitle = computed(() => {
  if (activeRecordKind.value === 'pressure') return `${bloodPressureRecords.value.length} 条血压记录`;
  if (activeRecordKind.value === 'food') return `${foodRecords.value.length} 条饮食记录`;
  return `${records.value.length} 条血糖记录`;
});
const emptyRecordTitle = computed(() => {
  if (activeRecordKind.value === 'pressure') return '还没有血压记录';
  if (activeRecordKind.value === 'food') return '还没有饮食记录';
  return '还没有血糖记录';
});
const emptyRecordBody = computed(() => {
  if (activeRecordKind.value === 'pressure') return '点一下新增按钮，记录最近一次血压。';
  if (activeRecordKind.value === 'food') return '拍一张饭菜，顺手记下吃了什么。';
  return '点一下新增按钮，先记录最近一次测量。';
});
const canExportActiveReport = computed(() => (
  activeReportKind.value === 'pressure' ? bloodPressureRecords.value.length > 0 : records.value.length > 0
));
const avatarInitial = computed(() => {
  const source = currentUser.value?.displayName || currentUser.value?.username || '糖';
  return source.trim().slice(0, 1).toUpperCase();
});
const avatarStyle = computed(() => {
  const source = currentUser.value?.username || 'tangtang';
  const hue = [...source].reduce((total, char) => total + char.charCodeAt(0), 0) % 360;
  return {
    background: `linear-gradient(135deg, hsl(${hue} 84% 76%), hsl(${(hue + 42) % 360} 82% 64%))`
  };
});
const chartInsight = computed(() => {
  if (!records.value.length) return '还没有可分析的数据，先记录一次血糖。';
  if (stats.value.highest >= 8) return '最近有偏高记录，建议保留备注，复盘饮食或运动情况。';
  if (stats.value.count < 3) return '记录还比较少，再补几条后曲线会更有参考感。';
  return '最近记录整体比较平稳，继续按需要偶尔记录就好。';
});
const pressureChartInsight = computed(() => {
  if (!bloodPressureRecords.value.length) return '还没有可分析的数据，先记录一次血压。';
  if (bloodPressureStats.value.count < 3) return '血压记录还比较少，多补几条后趋势会更清楚。';
  return '血压趋势已按收缩压和舒张压分开展示，方便复盘日常变化。';
});
const activeChartInsight = computed(() => (
  activeChartKind.value === 'pressure' ? pressureChartInsight.value : chartInsight.value
));

const GlucoseChart = defineComponent({
  name: 'GlucoseChart',
  props: {
    records: { type: Array, required: true },
    referenceLimit: { type: Number, default: DEFAULT_CHART_REFERENCE_LIMIT },
    compact: { type: Boolean, default: false }
  },
  setup(props) {
    const activePoint = ref(null);

    return () => {
      const width = props.compact ? 320 : 340;
      const height = props.compact ? 128 : 186;
      const padding = props.compact ? 18 : 24;
      const ordered = sortRecordsByTime(props.records).reverse().slice(-10);
      const referenceLimit = normalizeChartReferenceLimit(props.referenceLimit);

      if (!ordered.length) {
        return h('div', { class: ['chart-empty', props.compact && 'compact'] }, [
          h(HeartPulse, { size: 28 }),
          h('span', '记录后这里会出现曲线')
        ]);
      }

      const values = ordered.map((record) => Number(record.value));
      const min = Math.min(4, referenceLimit, ...values) - 0.4;
      const max = Math.max(9, referenceLimit, ...values) + 0.4;
      const xStep = ordered.length === 1 ? 0 : (width - padding * 2) / (ordered.length - 1);
      const pointFor = (record, index) => {
        const x = ordered.length === 1 ? width / 2 : padding + index * xStep;
        const y = height - padding - ((Number(record.value) - min) / (max - min)) * (height - padding * 2);
        return { x, y, record };
      };
      const points = ordered.map(pointFor);
      const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
      const referenceY = height - padding - ((referenceLimit - min) / (max - min)) * (height - padding * 2);
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
              'aria-label': `${formatDateTime(point.record.measuredAt)} 血糖 ${formatGlucoseValue(point.record.value)} ${point.record.unit}`
            }),
            !props.compact && h('text', { x: point.x, y: point.y - 10, class: 'chart-label', 'text-anchor': 'middle' }, formatGlucoseValue(point.record.value))
          ])),
        ]),
        tooltipPoint && h('div', {
          class: ['chart-tooltip', tooltipSide],
          style: {
            left: `${(tooltipPoint.x / width) * 100}%`,
            top: `${(tooltipPoint.y / height) * 100}%`
          }
        }, [
          h('span', `血糖 ${formatGlucoseValue(tooltipPoint.record.value)} ${tooltipPoint.record.unit}`),
          h('strong', tooltipPoint.record.period),
          h('small', `记录时间：${formatDateTime(tooltipPoint.record.measuredAt)}`)
        ]),
        h('div', { class: 'chart-axis' }, [
          h('span', ordered[0] ? shortDate(ordered[0].measuredAt) : ''),
          h('span', `参考上限 ${formatGlucoseLimit(referenceLimit)}`),
          h('span', ordered.at(-1) ? shortDate(ordered.at(-1).measuredAt) : '')
        ])
      ]);
    };
  }
});

const BloodPressureChart = defineComponent({
  name: 'BloodPressureChart',
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
      const ordered = sortBloodPressureRecordsByTime(props.records).reverse().slice(-10);

      if (!ordered.length) {
        return h('div', { class: ['chart-empty', props.compact && 'compact'] }, [
          h(Activity, { size: 28 }),
          h('span', '记录后这里会出现血压曲线')
        ]);
      }

      const values = ordered.flatMap((record) => [record.systolic, record.diastolic]);
      const min = Math.min(60, ...values) - 8;
      const max = Math.max(150, ...values) + 8;
      const xStep = ordered.length === 1 ? 0 : (width - padding * 2) / (ordered.length - 1);
      const pointFor = (record, index, key) => {
        const x = ordered.length === 1 ? width / 2 : padding + index * xStep;
        const y = height - padding - ((record[key] - min) / (max - min)) * (height - padding * 2);
        return { x, y, record };
      };
      const systolicPoints = ordered.map((record, index) => pointFor(record, index, 'systolic'));
      const diastolicPoints = ordered.map((record, index) => pointFor(record, index, 'diastolic'));
      const pathFor = (points) => {
        if (points.length === 1) {
          return `M ${points[0].x - 12} ${points[0].y} L ${points[0].x + 12} ${points[0].y + 1}`;
        }
        return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
      };
      const tooltipPoint = activePoint.value;
      const tooltipSide = tooltipPoint?.x < width * 0.22
        ? 'align-left'
        : tooltipPoint?.x > width * 0.78
          ? 'align-right'
          : 'align-center';

      return h('div', { class: ['chart-wrap', 'pressure-chart-wrap', props.compact && 'compact'] }, [
        h('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': '血压趋势曲线' }, [
          h('path', { d: pathFor(systolicPoints), class: 'chart-line pressure-systolic-line' }),
          h('path', { d: pathFor(diastolicPoints), class: 'chart-line pressure-diastolic-line' }),
          systolicPoints.map((point, index) => h('g', {
            key: `${point.record.id}-pressure`,
            class: ['chart-point', tooltipPoint?.record.id === point.record.id && 'active'],
            onMouseenter: () => { activePoint.value = point; },
            onMouseleave: () => { activePoint.value = null; },
            onFocusin: () => { activePoint.value = point; },
            onFocusout: () => { activePoint.value = null; },
            onClick: () => { activePoint.value = point; }
          }, [
            h('circle', { cx: point.x, cy: point.y, r: props.compact ? 4 : 5, class: 'chart-dot pressure-systolic-dot' }),
            h('circle', {
              cx: point.x,
              cy: point.y,
              r: props.compact ? 15 : 18,
              class: 'chart-hit-area',
              tabindex: 0,
              role: 'button',
              'aria-label': `${formatDateTime(point.record.measuredAt)} 血压 ${point.record.systolic}/${point.record.diastolic} mmHg`
            }),
            h('circle', {
              cx: diastolicPoints[index].x,
              cy: diastolicPoints[index].y,
              r: props.compact ? 3 : 4,
              class: 'chart-dot pressure-diastolic-dot'
            }),
            !props.compact && h('text', { x: point.x, y: point.y - 10, class: 'chart-label', 'text-anchor': 'middle' }, `${point.record.systolic}/${point.record.diastolic}`)
          ]))
        ]),
        tooltipPoint && h('div', {
          class: ['chart-tooltip', tooltipSide],
          style: {
            left: `${(tooltipPoint.x / width) * 100}%`,
            top: `${(tooltipPoint.y / height) * 100}%`
          }
        }, [
          h('span', `血压 ${tooltipPoint.record.systolic}/${tooltipPoint.record.diastolic} mmHg`),
          h('strong', pressurePulseText(tooltipPoint.record)),
          h('small', `记录时间：${formatDateTime(tooltipPoint.record.measuredAt)}`)
        ]),
        h('div', { class: 'chart-axis' }, [
          h('span', ordered[0] ? shortDate(ordered[0].measuredAt) : ''),
          h('span', '收缩压 / 舒张压'),
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
  loadChartReferenceLimit();
  restoreAuth();
});

onBeforeUnmount(() => {
  revokeFoodImageUrls();
  revokeFoodPreviewUrl();
});

async function restoreAuth() {
  const storedAuth = getStoredAuthSession();
  if (!storedAuth?.token) {
    await refreshCaptcha();
    isAuthReady.value = true;
    return;
  }

  try {
    setAuthSession(storedAuth);
    const user = await getCurrentUser();
    currentAuth.value = { token: storedAuth.token, user };
    setAuthSession(currentAuth.value);
    await loadRecords(false);
  } catch {
    clearAuthSession();
    currentAuth.value = null;
    records.value = [];
    bloodPressureRecords.value = [];
    foodRecords.value = [];
    revokeFoodImageUrls();
  } finally {
    if (!currentAuth.value) {
      await refreshCaptcha();
    }
    isAuthReady.value = true;
  }
}

function switchAuthMode(mode) {
  authMode.value = mode;
  authError.value = '';
  authForm.value.captchaAnswer = '';
}

function openAuthModal(mode = 'login') {
  switchAuthMode(mode);
  showAuthModal.value = true;
  if (!captchaChallenge.value) {
    refreshCaptcha();
  }
}

function closeAuthModal() {
  if (isAuthenticating.value) return;
  showAuthModal.value = false;
  authError.value = '';
}

async function refreshCaptcha() {
  if (currentUser.value || isLoadingCaptcha.value) return;

  isLoadingCaptcha.value = true;
  try {
    captchaChallenge.value = await getCaptchaChallenge();
    authForm.value.captchaAnswer = '';
  } catch {
    captchaChallenge.value = null;
    authError.value = '验证码加载失败，请刷新页面';
  } finally {
    isLoadingCaptcha.value = false;
  }
}

async function submitAuth() {
  if (isAuthenticating.value) return;

  authError.value = '';
  if (authMode.value === 'register' && authForm.value.password !== authForm.value.confirmPassword) {
    authError.value = '两次输入的密码不一致';
    return;
  }
  if (!captchaChallenge.value?.token) {
    authError.value = '验证码还没加载好，请稍后再试';
    await refreshCaptcha();
    return;
  }

  isAuthenticating.value = true;
  try {
    const payload = {
      username: authForm.value.username,
      password: authForm.value.password,
      captchaToken: captchaChallenge.value.token,
      captchaAnswer: authForm.value.captchaAnswer
    };
    const auth = authMode.value === 'register'
      ? await registerAccount({
        ...payload,
        displayName: authForm.value.displayName
      })
      : await loginAccount(payload);

    currentAuth.value = auth;
    setAuthSession(auth);
    if (!showForm.value && !showBloodPressureForm.value && !showFoodForm.value) {
      activeTab.value = 'home';
    }
    authForm.value = {
      username: '',
      displayName: '',
      password: '',
      confirmPassword: '',
      captchaAnswer: ''
    };
    captchaChallenge.value = null;
    showAuthModal.value = false;
    await loadRecords(false);
    showToast(authMode.value === 'register' ? '注册成功' : '登录成功');
  } catch (error) {
    if (error.status === 409) {
      authError.value = '这个用户名已经被注册了';
    } else if (error.status === 401) {
      authError.value = '用户名或密码不正确';
    } else if (error.body?.error === 'INVALID_CAPTCHA') {
      authError.value = '验证码不正确，请重新输入';
      await refreshCaptcha();
    } else {
      authError.value = '处理失败，请稍后再试';
      await refreshCaptcha();
    }
  } finally {
    isAuthenticating.value = false;
  }
}

function logout() {
  clearAuthSession();
  currentAuth.value = null;
  records.value = [];
  bloodPressureRecords.value = [];
  foodRecords.value = [];
  revokeFoodImageUrls();
  revokeFoodPreviewUrl();
  activeTab.value = 'home';
  showAuthModal.value = false;
  showForm.value = false;
  showBloodPressureForm.value = false;
  showFoodForm.value = false;
  detailRecord.value = null;
  detailBloodPressureRecord.value = null;
  detailFoodRecord.value = null;
  confirmDelete.value = null;
  confirmBloodPressureDelete.value = null;
  confirmFoodDelete.value = null;
  showToast('已退出登录');
  refreshCaptcha();
}

function startEditProfile() {
  profileForm.value.displayName = currentUser.value?.displayName || '';
  profileError.value = '';
  isEditingProfile.value = true;
}

function cancelEditProfile() {
  isEditingProfile.value = false;
  profileError.value = '';
}

async function saveProfile() {
  if (isSavingProfile.value) return;

  profileError.value = '';
  if (!profileForm.value.displayName.trim()) {
    profileError.value = '昵称不能为空';
    return;
  }

  isSavingProfile.value = true;
  try {
    const auth = await updateCurrentUserProfile({
      displayName: profileForm.value.displayName
    });
    currentAuth.value = auth;
    setAuthSession(auth);
    isEditingProfile.value = false;
    showToast('个人资料已更新');
  } catch {
    profileError.value = '资料保存失败，请稍后再试';
  } finally {
    isSavingProfile.value = false;
  }
}

function loadChartReferenceLimit() {
  try {
    chartReferenceLimit.value = normalizeChartReferenceLimit(
      window.localStorage.getItem(CHART_REFERENCE_LIMIT_STORAGE_KEY)
    );
  } catch {
    chartReferenceLimit.value = DEFAULT_CHART_REFERENCE_LIMIT;
  }
}

function saveChartReferenceLimit() {
  chartReferenceLimit.value = normalizeChartReferenceLimit(chartReferenceLimit.value);

  try {
    window.localStorage.setItem(CHART_REFERENCE_LIMIT_STORAGE_KEY, String(chartReferenceLimit.value));
  } catch {
    // Local storage can be unavailable in private or embedded webviews.
  }
}

async function loadRecords(showError = true) {
  if (!currentUser.value) return;

  isLoadingRecords.value = true;
  try {
    const [nextRecords, nextBloodPressureRecords, nextFoodRecords] = await Promise.all([
      listRecords(),
      listBloodPressureRecords(),
      listFoodRecords()
    ]);
    records.value = nextRecords;
    bloodPressureRecords.value = nextBloodPressureRecords;
    foodRecords.value = nextFoodRecords;
    await refreshFoodImageUrls(nextFoodRecords);
  } catch (error) {
    records.value = [];
    bloodPressureRecords.value = [];
    foodRecords.value = [];
    revokeFoodImageUrls();
    if (error.status === 401) {
      clearAuthSession();
      currentAuth.value = null;
      if (showError) showToast('登录已过期');
    } else if (showError) {
      showToast('后端 API 未连接');
    }
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

function openNewBloodPressureRecord() {
  editingBloodPressureRecord.value = null;
  bloodPressureForm.value = {
    systolic: '',
    diastolic: '',
    pulse: '',
    measuredAt: toLocalInputValue(),
    note: ''
  };
  showBloodPressureForm.value = true;
}

function closeBloodPressureForm() {
  showBloodPressureForm.value = false;
  editingBloodPressureRecord.value = null;
}

function openNewFoodRecord() {
  editingFoodRecord.value = null;
  revokeFoodPreviewUrl();
  foodForm.value = {
    mealType: '早餐',
    eatenAt: toLocalInputValue(),
    content: '',
    note: '',
    imageFile: null,
    previewUrl: ''
  };
  showFoodForm.value = true;
}

function closeFoodForm() {
  showFoodForm.value = false;
  editingFoodRecord.value = null;
  revokeFoodPreviewUrl();
}

function openActiveRecordForm() {
  if (activeRecordKind.value === 'pressure') {
    openNewBloodPressureRecord();
  } else if (activeRecordKind.value === 'food') {
    openNewFoodRecord();
  } else {
    openNewRecord();
  }
}

function openActiveChartRecord() {
  if (activeChartKind.value === 'pressure') {
    openNewBloodPressureRecord();
  } else {
    openNewRecord();
  }
}

function openActiveReportRecord() {
  if (activeReportKind.value === 'pressure') {
    openNewBloodPressureRecord();
  } else {
    openNewRecord();
  }
}

function handleFoodImageChange(event) {
  const file = event.target.files?.[0] || null;
  revokeFoodPreviewUrl();

  if (!file) {
    foodForm.value.imageFile = null;
    foodForm.value.previewUrl = '';
    return;
  }

  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type) || file.size > 5 * 1024 * 1024) {
    event.target.value = '';
    showToast('图片仅支持 jpg/png/webp，最大 5MB');
    return;
  }

  foodForm.value.imageFile = file;
  foodForm.value.previewUrl = URL.createObjectURL(file);
}

function revokeFoodPreviewUrl() {
  if (foodForm.value.previewUrl) {
    URL.revokeObjectURL(foodForm.value.previewUrl);
    foodForm.value.previewUrl = '';
  }
}

function buildFoodFormData() {
  const payload = new FormData();
  payload.set('mealType', foodForm.value.mealType);
  payload.set('eatenAt', foodForm.value.eatenAt);
  payload.set('content', foodForm.value.content);
  payload.set('note', foodForm.value.note || '');
  if (foodForm.value.imageFile) {
    payload.set('image', foodForm.value.imageFile);
  }
  return payload;
}

async function saveRecord() {
  if (isSavingRecord.value) return;
  if (!currentUser.value) {
    showToast('登录后再保存记录');
    openAuthModal('login');
    return;
  }

  isSavingRecord.value = true;
  const wasEditing = Boolean(editingRecord.value);

  const payload = {
    value: normalizeGlucoseValue(form.value.value),
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

async function saveBloodPressureRecord() {
  if (isSavingBloodPressureRecord.value) return;
  if (!currentUser.value) {
    showToast('登录后再保存血压');
    openAuthModal('login');
    return;
  }

  isSavingBloodPressureRecord.value = true;
  const wasEditing = Boolean(editingBloodPressureRecord.value);
  const payload = {
    systolic: Number(bloodPressureForm.value.systolic),
    diastolic: Number(bloodPressureForm.value.diastolic),
    pulse: bloodPressureForm.value.pulse === '' ? null : Number(bloodPressureForm.value.pulse),
    measuredAt: bloodPressureForm.value.measuredAt,
    note: bloodPressureForm.value.note
  };

  try {
    if (wasEditing) {
      await updateBloodPressureRecordOnServer(editingBloodPressureRecord.value.id, payload);
    } else {
      await createBloodPressureRecordOnServer(payload);
    }
    await loadRecords(false);
    closeBloodPressureForm();
    activeTab.value = 'records';
    activeRecordKind.value = 'pressure';
    showToast(wasEditing ? '血压已更新' : '血压已保存');
  } catch {
    showToast('血压保存失败');
  } finally {
    isSavingBloodPressureRecord.value = false;
  }
}

async function saveFoodRecord() {
  if (isSavingFoodRecord.value) return;
  if (!foodForm.value.content.trim()) {
    showToast('先写一下吃了什么');
    return;
  }
  if (!currentUser.value) {
    showToast('登录后再保存饮食');
    openAuthModal('login');
    return;
  }

  isSavingFoodRecord.value = true;
  const wasEditing = Boolean(editingFoodRecord.value);

  try {
    if (wasEditing) {
      await updateFoodRecordOnServer(editingFoodRecord.value.id, buildFoodFormData());
    } else {
      await createFoodRecordOnServer(buildFoodFormData());
    }
    await loadRecords(false);
    closeFoodForm();
    activeTab.value = 'records';
    activeRecordKind.value = 'food';
    showToast(wasEditing ? '饮食已更新' : '饮食已保存');
  } catch (error) {
    showToast(error.body?.error === 'INVALID_FOOD_IMAGE' ? '图片格式或大小不支持' : '饮食保存失败');
  } finally {
    isSavingFoodRecord.value = false;
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

function startEditBloodPressure(record) {
  detailBloodPressureRecord.value = null;
  editingBloodPressureRecord.value = record;
  bloodPressureForm.value = {
    systolic: record.systolic,
    diastolic: record.diastolic,
    pulse: record.pulse ?? '',
    measuredAt: record.measuredAt,
    note: record.note
  };
  showBloodPressureForm.value = true;
}

function startEditFood(record) {
  detailFoodRecord.value = null;
  editingFoodRecord.value = record;
  revokeFoodPreviewUrl();
  foodForm.value = {
    mealType: record.mealType,
    eatenAt: record.eatenAt,
    content: record.content,
    note: record.note,
    imageFile: null,
    previewUrl: ''
  };
  showFoodForm.value = true;
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

async function removeBloodPressureRecord(id) {
  try {
    await deleteBloodPressureRecordOnServer(id);
    await loadRecords(false);
    confirmBloodPressureDelete.value = null;
    detailBloodPressureRecord.value = null;
    showToast('血压已删除');
  } catch {
    showToast('删除失败，请检查 API 服务');
  }
}

async function removeFoodRecord(id) {
  try {
    await deleteFoodRecordOnServer(id);
    await loadRecords(false);
    confirmFoodDelete.value = null;
    detailFoodRecord.value = null;
    showToast('饮食已删除');
  } catch {
    showToast('删除失败，请检查 API 服务');
  }
}

async function resetRecords() {
  try {
    await Promise.all([
      clearRecordsOnServer(),
      clearBloodPressureRecordsOnServer(),
      clearFoodRecordsOnServer()
    ]);
    records.value = [];
    bloodPressureRecords.value = [];
    foodRecords.value = [];
    revokeFoodImageUrls();
    showResetConfirm.value = false;
    activeTab.value = 'home';
    showToast('记录已清空');
  } catch {
    showToast('清空失败，请检查 API 服务');
  }
}

function revokeFoodImageUrls() {
  Object.values(foodImageUrls.value).forEach((url) => {
    if (url) URL.revokeObjectURL(url);
  });
  foodImageUrls.value = {};
}

async function refreshFoodImageUrls(nextFoodRecords) {
  revokeFoodImageUrls();
  const recordsWithImages = nextFoodRecords.filter((record) => record.imageKey);
  const imageEntries = await Promise.all(recordsWithImages.map(async (record) => {
    try {
      const blob = await fetchFoodImageBlob(record.imageKey);
      return [record.imageKey, URL.createObjectURL(blob)];
    } catch {
      return [record.imageKey, ''];
    }
  }));
  foodImageUrls.value = Object.fromEntries(imageEntries.filter(([, url]) => url));
}

function getCanvasPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error('PNG_EXPORT_FAILED'));
    }, 'image/png');
  });
}

function downloadPngBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = fileName;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function shareOrDownloadPng(canvas, fileName, title) {
  const blob = await getCanvasPngBlob(canvas);
  const file = new File([blob], fileName, { type: 'image/png' });
  const shareData = {
    title,
    files: [file]
  };

  if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare(shareData)) {
    showToast('请在系统面板中选择保存图片');
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }

  downloadPngBlob(blob, fileName);
  showToast('图片已下载，可从浏览器下载中保存');
}

async function exportReport(type) {
  if (!reportRef.value) return;

  isExporting.value = true;
  await nextTick();

  try {
    const reportName = activeReportKind.value === 'pressure' ? '血压记录' : '血糖记录';
    const canvas = await html2canvas(reportRef.value, {
      backgroundColor: '#fff7fb',
      scale: 2,
      useCORS: true
    });

    if (type === 'png') {
      await shareOrDownloadPng(canvas, `${reportName}-${Date.now()}.png`, reportName);
      return;
    }

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 28;
    const imageWidth = pageWidth - margin * 2;
    const imageHeight = (canvas.height * imageWidth) / canvas.width;
    const pageContentHeight = pageHeight - margin * 2;
    const imageData = canvas.toDataURL('image/png');
    let renderedHeight = 0;

    pdf.addImage(imageData, 'PNG', margin, margin, imageWidth, imageHeight);
    renderedHeight += pageContentHeight;

    while (renderedHeight < imageHeight) {
      pdf.addPage();
      pdf.addImage(imageData, 'PNG', margin, margin - renderedHeight, imageWidth, imageHeight);
      renderedHeight += pageContentHeight;
    }

    pdf.save(`${reportName}-${Date.now()}.pdf`);
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

function pressurePulseText(record) {
  return record?.pulse ? `心率 ${record.pulse} bpm` : '未记录心率';
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
