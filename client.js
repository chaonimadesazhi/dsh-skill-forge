/* dsh-skill-forge — browser half of the Skill Forge plugin.
 *
 * Loaded lazily by the GUI module loader. No build step, no imports, and no
 * module level DOM access: the only require target is 'react'. Everything else
 * is plain DOM + fetch against document-relative routes.
 *
 * Surfaces:  sidebar.panellist  id = skill-forge (order 26)
 *            main               key = skill-forge
 * Routes:    api/dsh-skill-forge/{health,list,read,save,delete,sessions,distill}
 */
;(function () {
  const loader = typeof window !== 'undefined' ? window.__ModuleLoader__ : undefined
  if (!loader || typeof loader.load !== 'function') return

  loader.load({
    id: 'dsh-skill-forge',
    factory(require) {
      const React = require('react')
      const h = React.createElement

      /* 1. i18n — register both dictionaries, fall back to zh on a miss. */

      const NS = 'dsh-skill-forge'
      const ZH = {
        'entry.label': '技能锻造炉', 'app.title': '技能锻造炉', 'app.subtitle': '把一段对话沉淀成可复用的 SKILL.md',
        'tab.library': '技能库', 'tab.forge': '锻造',
        'status.checking': '正在检查宿主能力…', 'status.ready': '宿主就绪', 'status.llmOk': '默认模型可用',
        'status.noLlm': '无可用默认模型', 'status.sessions': '会话可读', 'status.sessionsOff': '会话源不可用',
        'status.healthFailed': '能力检查失败', 'btn.health': '重新检测', 'btn.refresh': '刷新', 'btn.preview': '预览',
        'btn.delete': '删除', 'btn.back': '返回列表', 'btn.distill': 'AI 提炼', 'btn.distillBusy': '提炼中…',
        'btn.manualDraft': '手动填写草稿', 'btn.save': '保存为技能', 'btn.saveBusy': '保存中…', 'btn.forge': '去锻造',
        'btn.dismiss': '关闭', 'toolbar.search': '搜索技能名称 / 描述', 'count': '{n} 个技能', 'countFiltered': '{n} / {total} 个技能',
        'list.loading': '正在读取技能库…', 'list.empty.title': '还没有锻造过技能',
        'list.empty.body': '去「锻造」把一段对话或粘贴的上下文沉淀成 SKILL.md，下次同类问题直接命中。',
        'list.empty.filtered': '没有匹配的技能。', 'detail.loading': '正在读取正文…', 'detail.description': '描述',
        'detail.whenToUse': '何时使用', 'detail.content': 'SKILL.md 正文', 'detail.meta': '文件',
        'detail.raw': '原文', 'detail.rendered': '渲染',
        'delete.confirm': '删除技能 {name}？将移入 .trash 可恢复', 'delete.done': '已移入回收站：{path}',
        'save.done': '已保存技能 {name}', 'save.exists': '同名技能已存在，覆盖？', 'save.cancelled': '已取消保存（未覆盖同名技能）。',
        'forge.source.label': '来源', 'forge.source.session': '对话', 'forge.source.text': '粘贴文本',
        'forge.session.label': '最近会话', 'forge.session.empty': '没有可读的最近会话。', 'forge.session.loading': '正在读取最近会话…',
        'forge.lastTurns': '最近轮数', 'forge.text.label': '待总结的文本',
        'forge.text.placeholder': '把需要总结的对话/资料粘贴到这里',
        'forge.name': '名称（可选）', 'forge.name.placeholder': '留空由 AI 生成',
        'forge.description': '描述（可选）', 'forge.description.placeholder': '留空由 AI 生成',
        'forge.needInput': '请先选择会话，或粘贴需要总结的文本。', 'forge.distilling': 'AI 提炼中，最长约 45 秒…',
        'forge.draft.title': '草稿（确认后再保存，提炼本身不落盘）', 'forge.draft.name': '技能名（kebab-case）',
        'forge.draft.description': '一句话描述', 'forge.draft.whenToUse': '触发场景', 'forge.draft.content': 'SKILL.md 正文',
        'forge.digest': '上下文 {chars} 字符', 'forge.digest.truncated': '（已截断）', 'forge.digest.source': '来源：{source}',
        'forge.llm.hint': '宿主没有可用的默认模型，无法自动提炼。改走 Agent 路径：让模型调用 skill_forge_context 取上下文，再调 skill_forge_save 落盘；或在此手动填写草稿后直接保存。',
        'error.unknown': '未知错误。', 'error.name': '技能名需为 kebab-case（小写字母/数字/连字符）。',
        'error.content': '正文不能为空，至少写一段可执行内容。',
        'badge.trigger': '带触发条件',
        'btn.cancel': '取消', 'btn.overwrite': '覆盖', 'btn.clearSearch': '清除搜索',
      }
      const EN = {
        'entry.label': 'Skill Forge', 'app.title': 'Skill Forge', 'app.subtitle': 'Distill a conversation into a reusable SKILL.md',
        'tab.library': 'Library', 'tab.forge': 'Forge',
        'status.checking': 'Checking host capabilities…', 'status.ready': 'Host ready', 'status.llmOk': 'default model available',
        'status.noLlm': 'no default model', 'status.sessions': 'sessions readable', 'status.sessionsOff': 'session source unavailable',
        'status.healthFailed': 'capability check failed', 'btn.health': 'Re-check', 'btn.refresh': 'Refresh', 'btn.preview': 'Preview',
        'btn.delete': 'Delete', 'btn.back': 'Back to list', 'btn.distill': 'Distill with AI', 'btn.distillBusy': 'Distilling…',
        'btn.manualDraft': 'Write draft manually', 'btn.save': 'Save as skill', 'btn.saveBusy': 'Saving…', 'btn.forge': 'Go forge',
        'btn.dismiss': 'Dismiss', 'toolbar.search': 'Search name / description', 'count': '{n} skills', 'countFiltered': '{n} / {total} skills',
        'list.loading': 'Reading skill library…', 'list.empty.title': 'No forged skills yet',
        'list.empty.body': 'Open “Forge” to distill a conversation or pasted context into SKILL.md, so the next similar question hits it directly.',
        'list.empty.filtered': 'No matching skill.', 'detail.loading': 'Reading SKILL.md…', 'detail.description': 'Description',
        'detail.whenToUse': 'When to use', 'detail.content': 'SKILL.md body', 'detail.meta': 'File',
        'detail.raw': 'Raw', 'detail.rendered': 'Rendered',
        'delete.confirm': 'Delete skill {name}? It moves to .trash and can be restored.', 'delete.done': 'Moved to trash: {path}',
        'save.done': 'Saved skill {name}', 'save.exists': 'A skill with this name exists. Overwrite?',
        'save.cancelled': 'Save cancelled (existing skill left intact).',
        'forge.source.label': 'Source', 'forge.source.session': 'Conversation', 'forge.source.text': 'Pasted text',
        'forge.session.label': 'Recent session', 'forge.session.empty': 'No readable recent session.',
        'forge.session.loading': 'Reading recent sessions…', 'forge.lastTurns': 'Last turns', 'forge.text.label': 'Text to distill',
        'forge.text.placeholder': 'Paste the conversation / material to summarize here',
        'forge.name': 'Name (optional)', 'forge.name.placeholder': 'Leave blank to let the AI generate',
        'forge.description': 'Description (optional)', 'forge.description.placeholder': 'Leave blank to let the AI generate',
        'forge.needInput': 'Pick a session or paste some text first.', 'forge.distilling': 'Distilling, up to ~45s…',
        'forge.draft.title': 'Draft (review before saving; distilling never writes to disk)',
        'forge.draft.name': 'Skill name (kebab-case)', 'forge.draft.description': 'One-line description',
        'forge.draft.whenToUse': 'Trigger scenarios', 'forge.draft.content': 'SKILL.md body',
        'forge.digest': '{chars} chars of context', 'forge.digest.truncated': ' (truncated)', 'forge.digest.source': 'source: {source}',
        'forge.llm.hint': 'The host has no usable default model, so automatic distillation is unavailable. Take the Agent path: have the model call skill_forge_context to fetch context, then skill_forge_save to write it; or fill in the draft here and save directly.',
        'error.unknown': 'Unknown error.', 'error.name': 'Skill name must be kebab-case (lowercase letters, digits, hyphens).',
        'error.content': 'Body cannot be empty — write at least one actionable step.',
        'badge.trigger': 'has trigger',
        'btn.cancel': 'Cancel', 'btn.overwrite': 'Overwrite', 'btn.clearSearch': 'Clear search',
      }
      let translate
      function tt(key, values) {
        let text
        try {
          text = translate ? translate(key) : undefined
        } catch (err) {
          text = undefined
        }
        // A bound translator that echoes the key means "no entry": fall back to zh.
        if (text === undefined || text === null || text === '' || text === key) text = ZH[key]
        if (text === undefined || text === null) text = key
        let out = String(text)
        const names = values ? Object.keys(values) : []
        for (let i = 0; i < names.length; i += 1) out = out.split('{' + names[i] + '}').join(String(values[names[i]]))
        return out
      }

      /* 2. Stylesheet — injected once into document.head, all sfx_ prefixed. */

      const CSS = [
        // --- shell -------------------------------------------------------
        // The panel is the center column: full height, its own scroll area, and
        // a max content width so a 1400px-wide column does not stretch rows into
        // unreadable 1200px lines.
        '.sfx_view{display:flex;flex-direction:column;height:100%;min-height:0;box-sizing:border-box;padding:16px 20px 0;font-family:var(--dsw-font-family);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base)}',
        '.sfx_inner{display:flex;flex-direction:column;gap:0;width:100%;max-width:880px;height:100%;min-height:0;margin:0 auto}',
        // --- header ------------------------------------------------------
        '.sfx_head{display:flex;align-items:flex-start;gap:12px;flex:none;padding-bottom:12px}',
        '.sfx_headmain{min-width:0;flex:1 1 auto}',
        '.sfx_title{font-size:15px;font-weight:600;line-height:1.35;letter-spacing:-.01em}',
        '.sfx_subtitle{margin-top:2px;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary)}',
        // Status is a quiet inline line of separate facts, not one long smear:
        // each fact is its own chip so the eye can skip it.
        '.sfx_status{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:8px}',
        '.sfx_statustext{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere}',
        '.sfx_statusdot{display:inline-block;width:6px;height:6px;flex:none;border-radius:50%;background:var(--dsw-alias-state-success-primary)}',
        '.sfx_statusdot_warn{background:var(--dsw-alias-state-warn-primary)}',
        '.sfx_statusdot_off{background:var(--dsw-alias-label-tertiary)}',
        '.sfx_statussep{color:var(--dsw-alias-border-l2);font-size:11px;user-select:none}',
        // --- tabs --------------------------------------------------------
        '.sfx_tabs{display:flex;gap:2px;flex:none;border-bottom:1px solid var(--dsw-alias-border-l1);margin-bottom:14px}',
        '.sfx_tab{appearance:none;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:13px;line-height:1.4;padding:6px 10px 8px;cursor:pointer;transition:color .12s ease}',
        '.sfx_tab:hover{color:var(--dsw-alias-label-primary)}',
        '.sfx_tab_active{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-state-business-primary);font-weight:500}',
        // --- body --------------------------------------------------------
        '.sfx_body{flex:1 1 auto;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:10px;padding-bottom:16px}',
        '.sfx_toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex:none}',
        '.sfx_count{margin-left:auto;font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;font-variant-numeric:tabular-nums}',
        // --- form controls ----------------------------------------------
        // IMPORTANT: these controls live inside a COLUMN flex container
        // (.sfx_field). A `flex:1 1 <basis>` there sets the HEIGHT basis and then
        // grows the control to fill the column — that is the bug that stretched
        // these inputs to 180-300px tall. Controls must size by content only.
        '.sfx_input,.sfx_select,.sfx_textarea{flex:0 0 auto;min-width:0;box-sizing:border-box;padding:6px 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;outline:none;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px;line-height:1.5;transition:border-color .12s ease}',
        '.sfx_input:hover,.sfx_select:hover,.sfx_textarea:hover{border-color:var(--dsw-alias-label-tertiary)}',
        '.sfx_input:focus,.sfx_select:focus,.sfx_textarea:focus{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-business-primary) 16%,transparent)}',
        '.sfx_input::placeholder,.sfx_textarea::placeholder{color:var(--dsw-alias-label-tertiary)}',
        // Sizing rule that must not be broken: `.sfx_field` is a COLUMN flex box, so
        // any `flex:<grow> 1 <basis>` on a control inside it sets the HEIGHT basis
        // and stretches the control (the 180px-tall-input defect). Controls therefore
        // size by `width:100%` and `flex:none`; only the toolbar search, which shares
        // a horizontal line, opts into flex growth through its own scoped rule.
        '.sfx_input{width:100%;flex:none;height:30px}',
        '.sfx_input_tiny{width:72px;flex:none}',
        '.sfx_select{width:100%;flex:none;height:30px;cursor:pointer}',
        '.sfx_textarea{width:100%;flex:none;min-height:92px;resize:vertical}',
        // The toolbar is a row: this is the only input that should grow along it.
        '.sfx_toolbar .sfx_input{width:auto;flex:1 1 260px}',
        // Description-sized textarea: two rows tall, grows only when dragged.
        '.sfx_textarea_auto{min-height:0;height:auto;resize:vertical;overflow:auto}',
        // Capped so the draft's save action stays visible without the user having
        // to scroll inside the body and then scroll the page to find it.
        '.sfx_textarea_mono{min-height:200px;max-height:38vh;resize:vertical;overflow:auto;white-space:pre;font-family:var(--dsh-font-family-code);font-size:12px;line-height:1.6}',
        // --- buttons -----------------------------------------------------
        '.sfx_btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;height:28px;padding:0 11px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px;line-height:1;white-space:nowrap;cursor:pointer;transition:background .12s ease,color .12s ease,border-color .12s ease}',
        '.sfx_btn:hover{background:var(--dsw-alias-interactive-bg-hover)}',
        '.sfx_btn:active{transform:translateY(.5px)}',
        '.sfx_btn:disabled{opacity:.45;cursor:not-allowed;transform:none}',
        '.sfx_btn:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}',
        '.sfx_btn_mini{height:22px;padding:0 8px;font-size:11px;border-radius:5px}',
        '.sfx_btn_ghost{border-color:transparent;color:var(--dsw-alias-label-secondary)}',
        '.sfx_btn_ghost:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}',
        // Primary is the one filled control, so the eye lands on the action.
        // The label must be the base surface token, not #fff: a hardcoded white
        // measured 2.59:1 against the dark-theme accent. Base-on-accent gives
        // 4.33:1 light and 6.92:1 dark from the host's own token pair.
        '.sfx_btn_primary{border-color:transparent;background:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-bg-base);font-weight:600}',
        '.sfx_btn_primary:hover{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 88%,var(--dsw-alias-label-primary))}',
        '.sfx_btn_primary:disabled{color:var(--dsw-alias-bg-base)}',
        // Destructive actions read as destructive only on hover/focus, so a list
        // of skills is not a wall of red, but the intent is unmistakable.
        '.sfx_btn_danger{border-color:transparent;color:var(--dsw-alias-label-secondary)}',
        '.sfx_btn_danger:hover{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent)}',
        // The one genuinely destructive confirmation in the panel needs a filled
        // affordance so it cannot be mistaken for the non-destructive choice.
        '.sfx_btn_danger_solid{border-color:transparent;background:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-bg-base);font-weight:600}',
        // --- list rows ---------------------------------------------------
        '.sfx_list{display:flex;flex-direction:column;gap:0;min-height:0}',
        '.sfx_row{display:flex;flex-direction:column;gap:4px;padding:11px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);background:transparent;cursor:pointer;transition:background .12s ease}',
        '.sfx_row:last-child{border-bottom:0}',
        '.sfx_row:hover{background:var(--dsw-alias-interactive-bg-hover)}',
        '.sfx_row_active{background:var(--dsw-alias-interactive-bg-hover);box-shadow:inset 2px 0 0 var(--dsw-alias-state-business-primary)}',
        // The row is a role="button" tabIndex=0 navigation target. Without this
        // rule it inherited the UA's near-black 1px outline, measured 1.06:1 on
        // the dark surface — i.e. no visible focus at all.
        '.sfx_row:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px;border-radius:6px}',
        '.sfx_row:focus-visible .sfx_rowactions{opacity:1}',
        '.sfx_rowhead{display:flex;align-items:center;gap:8px}',
        '.sfx_rowname{flex:1 1 auto;min-width:0;font-size:13px;font-weight:600;line-height:1.4;overflow-wrap:anywhere;font-family:var(--dsh-font-family-code);letter-spacing:-.01em}',
        // Actions stay hidden until the row is hovered/focused: the list reads as
        // content, not as a grid of buttons.
        '.sfx_rowactions{display:flex;gap:2px;flex:none;opacity:0;transition:opacity .12s ease}',
        '.sfx_row:hover .sfx_rowactions,.sfx_row:focus-within .sfx_rowactions{opacity:1}',
        '.sfx_rowdesc{font-size:12px;line-height:1.55;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
        '.sfx_meta{font-family:var(--dsh-font-family-code);font-size:11px;line-height:1.5;color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere}',
        '.sfx_rowfoot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:1px}',
        // --- detail / preview -------------------------------------------
        '.sfx_detail{display:flex;flex-direction:column;gap:12px;min-height:0}',
        '.sfx_detailhead{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding-bottom:2px}',
        '.sfx_detailname{font-size:14px;font-weight:600;overflow-wrap:anywhere;font-family:var(--dsh-font-family-code)}',
        '.sfx_section{display:flex;flex-direction:column;gap:3px}',
        // No text-transform: it does nothing to CJK labels and turned "SKILL.md
        // 正文" into "SKILL.MD 正文", which disagreed with every other surface.
        '.sfx_sectionlabel{font-size:10px;font-weight:600;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary)}',
        '.sfx_sectionbody{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;white-space:pre-wrap}',
        '.sfx_pre{max-height:50vh;overflow:auto;margin:0;padding:12px 14px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);font-family:var(--dsh-font-family-code);font-size:12px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--dsw-alias-label-primary)}',
        // Rendered Markdown pane: prose spacing, not code spacing.
        '.sfx_pre_md{font-family:var(--dsw-font-family);font-size:12.5px;line-height:1.7;white-space:normal}',
        '.sfx_md{display:flex;flex-direction:column;gap:6px}',
        '.sfx_mdhead{margin:6px 0 0;font-weight:600;color:var(--dsw-alias-label-primary);line-height:1.45}',
        '.sfx_mdhead:first-child{margin-top:0}',
        '.sfx_mdhead_1{font-size:15px}',
        '.sfx_mdhead_2{font-size:13.5px;padding-bottom:3px;border-bottom:1px solid var(--dsw-alias-border-l1)}',
        '.sfx_mdhead_3{font-size:12.5px;color:var(--dsw-alias-label-secondary)}',
        '.sfx_mdhead_4{font-size:12px;color:var(--dsw-alias-label-secondary)}',
        '.sfx_mdpara{margin:0;color:var(--dsw-alias-label-secondary)}',
        '.sfx_mdlist{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:3px;color:var(--dsw-alias-label-secondary)}',
        '.sfx_mdlist li{padding-left:1px}',
        '.sfx_mdtask{list-style:none;display:flex;align-items:baseline;gap:6px;margin-left:-16px}',
        '.sfx_mdcheck{color:var(--dsw-alias-state-business-primary);font-size:11px}',
        '.sfx_mdcode{margin:2px 0;padding:9px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-base);font-family:var(--dsh-font-family-code);font-size:11.5px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere;overflow-x:auto}',
        '.sfx_md code{font-family:var(--dsh-font-family-code);font-size:11.5px;padding:1px 4px;border-radius:4px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
        '.sfx_md strong{font-weight:600;color:var(--dsw-alias-label-primary)}',
        '.sfx_mdempty{color:var(--dsw-alias-label-tertiary)}',
        '.sfx_detailmeta{gap:20px;align-items:flex-start}',
        '.sfx_detailmeta>*{flex:1 1 260px}',
        // --- empty / feedback -------------------------------------------
        '.sfx_empty{display:flex;flex-direction:column;gap:6px;align-items:flex-start;padding:28px 20px;border:1px dashed var(--dsw-alias-border-l2);border-radius:10px;text-align:left}',
        '.sfx_emptytitle{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}',
        '.sfx_emptybody{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary);max-width:56ch}',
        '.sfx_error{flex:none;padding:8px 11px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 34%,transparent);border-left:3px solid var(--dsw-alias-state-error-primary);border-radius:7px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,transparent);font-size:12px;line-height:1.55;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}',
        // In-panel destructive confirmation, replacing window.confirm().
        '.sfx_confirm{display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex:none;padding:8px 11px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 34%,transparent);border-radius:7px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,transparent)}',
        '.sfx_confirmtext{flex:1 1 260px;font-size:12px;line-height:1.55;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}',
        '.sfx_notice{display:flex;align-items:flex-start;gap:8px;flex:none;padding:7px 11px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-success-primary) 32%,transparent);border-radius:7px;background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 8%,transparent);font-size:12px;line-height:1.55;color:var(--dsw-alias-label-primary)}',
        '.sfx_noticetext{flex:1 1 auto;overflow-wrap:anywhere}',
        '.sfx_hint{display:flex;flex-direction:column;gap:4px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}',
        '.sfx_hinttitle{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}',
        '.sfx_hint code{font-family:var(--dsh-font-family-code);font-size:11.5px;padding:1px 4px;border-radius:4px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
        // --- form layout -------------------------------------------------
        '.sfx_form{display:flex;flex-direction:column;gap:14px}',
        '.sfx_field{display:flex;flex-direction:column;gap:5px;min-width:0}',
        '.sfx_fieldlabel{font-size:11px;font-weight:600;color:var(--dsw-alias-label-secondary)}',
        '.sfx_fieldhint{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}',
        '.sfx_row_inline{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap}',
        '.sfx_row_inline>*{min-width:0}',
        '.sfx_grow{flex:1 1 240px}',
        '.sfx_field_name{flex:0 1 240px}',
        // Segmented source switch
        '.sfx_switch{display:inline-flex;gap:2px;align-self:flex-start;padding:2px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2)}',
        '.sfx_switchbtn{appearance:none;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:12px;line-height:1;height:26px;padding:0 14px;cursor:pointer;transition:all .12s ease}',
        '.sfx_switchbtn:hover{color:var(--dsw-alias-label-primary)}',
        '.sfx_switchbtn_on{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-weight:500;box-shadow:0 1px 2px rgba(0,0,0,.06),0 0 0 1px var(--dsw-alias-border-l1)}',
        // --- draft card --------------------------------------------------
        '.sfx_draft{display:flex;flex-direction:column;gap:12px;padding:14px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}',
        '.sfx_drafthead{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
        '.sfx_drafttitle{flex:1 1 auto;font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}',
        '.sfx_digest{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere;font-variant-numeric:tabular-nums}',
        '.sfx_footer{display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex:none}',
        // The draft's finish line must never be below the fold: with a 21-line body
        // the save action measured 57px past a 900px viewport, reachable only after
        // scrolling inside the textarea AND then the page. Sticking the footer to
        // the card's bottom edge keeps the primary action visible at any content length.
        '.sfx_draft .sfx_footer{position:sticky;bottom:-14px;z-index:1;margin:0 -14px -14px;padding:10px 14px;background:var(--dsw-alias-bg-layer-1);border-top:1px solid var(--dsw-alias-border-l1);border-radius:0 0 10px 10px}',
        '.sfx_spacer{flex:1 1 auto}',
        '.sfx_loading{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-tertiary);padding:10px 0}',
        '.sfx_badge{padding:1px 7px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;font-size:10px;line-height:1.5;color:var(--dsw-alias-label-secondary);white-space:nowrap;font-weight:500}',
        '.sfx_badge_forged{border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 40%,transparent);color:var(--dsw-alias-state-business-primary)}',
        // --- divider -----------------------------------------------------
        '.sfx_divider{flex:none;height:1px;background:var(--dsw-alias-border-l1);margin:2px 0}',
        // Narrow column fallback
        '@media (max-width:720px){.sfx_view{padding:12px 12px 0}.sfx_row_inline{flex-direction:column;align-items:stretch}.sfx_grow{flex:1 1 auto}}',
      ].join('\n')
      const CSS_TAG = 'dsh-skill-forge/panel.css'
      function injectCss() {
        if (typeof document === 'undefined') return () => {}
        try {
          if (document.querySelector('style[data-plugin-css="' + CSS_TAG + '"]') !== null) return () => {}
          const tag = document.createElement('style')
          tag.dataset.plugin = 'dsh-skill-forge'
          tag.dataset.pluginCss = CSS_TAG
          tag.textContent = CSS
          document.head.appendChild(tag)
          return () => {
            try {
              tag.remove()
            } catch (err) {
              /* already detached */
            }
          }
        } catch (err) {
          return () => {}
        }
      }

      /* 3. API client — document-relative paths, never a leading slash. */

      const API = {
        health: 'api/dsh-skill-forge/health',
        list: 'api/dsh-skill-forge/list',
        read: 'api/dsh-skill-forge/read',
        save: 'api/dsh-skill-forge/save',
        remove: 'api/dsh-skill-forge/delete',
        sessions: 'api/dsh-skill-forge/sessions',
        distill: 'api/dsh-skill-forge/distill',
      }
      async function request(path, options) {
        const opts = options || {}
        const body = opts.body
        const headers = body === undefined ? undefined : { 'content-type': 'application/json' }
        const res = await fetch(path, { method: opts.method || 'GET', headers, body: body === undefined ? undefined : JSON.stringify(body) })
        let data
        try {
          data = await res.json()
        } catch (err) {
          data = undefined
        }
        if (!res.ok) {
          const err = new Error(data && typeof data.error === 'string' ? data.error : 'HTTP ' + res.status)
          err.status = res.status
          err.code = data && data.error
          err.payload = data
          throw err
        }
        return data
      }
      function withQuery(path, params) {
        const names = Object.keys(params || {})
        const parts = []
        for (let i = 0; i < names.length; i += 1) {
          const value = params[names[i]]
          if (value !== undefined && value !== null && value !== '') parts.push(encodeURIComponent(names[i]) + '=' + encodeURIComponent(String(value)))
        }
        return parts.length === 0 ? path : path + '?' + parts.join('&')
      }

      const api = {
        health: () => request(API.health),
        list: () => request(API.list),
        read: (name) => request(withQuery(API.read, { name })),
        save: (body) => request(API.save, { method: 'POST', body }),
        remove: (name) => request(API.remove, { method: 'POST', body: { name } }),
        sessions: (limit) => request(withQuery(API.sessions, { limit: limit === undefined ? 20 : limit })),
        distill: (body) => request(API.distill, { method: 'POST', body }),
      }
      function describeError(err) {
        if (err && err.payload && typeof err.payload.message === 'string' && err.payload.message.trim()) return err.payload.message
        if (err && typeof err.message === 'string' && err.message.trim()) {
          const hasStatus = err.status && err.message.indexOf(String(err.status)) !== -1
          return hasStatus || !err.status ? err.message : err.message + ' (HTTP ' + err.status + ')'
        }
        if (err && typeof err.error === 'string') return err.error
        return tt('error.unknown')
      }

      /* 4. Pure helpers */

      const asString = (v) => (typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v))
      const pad2 = (n) => (n < 10 ? '0' + n : String(n))
      const eventValue = (event) => (event && event.target ? event.target.value : '')
      const isKebabName = (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(asString(value).trim())

      /** Call fn inside try/catch so a bad handler can never unmount the panel. */
      function safe(fn) {
        if (typeof fn !== 'function') return undefined
        try {
          return fn.apply(null, Array.prototype.slice.call(arguments, 1))
        } catch (err) {
          return undefined
        }
      }
      function fmtBytes(value) {
        const n = Number(value)
        if (!isFinite(n) || n <= 0) return ''
        if (n < 1024) return Math.round(n) + ' B'
        if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
        return (n / 1048576).toFixed(2) + ' MB'
      }
      function fmtDate(value) {
        if (value === undefined || value === null || value === '') return ''
        const date = value instanceof Date ? value : new Date(value)
        if (isNaN(date.getTime())) return ''
        return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate()) + ' ' + pad2(date.getHours()) + ':' + pad2(date.getMinutes())
      }
      function truncatePath(value, limit) {
        const text = asString(value)
        const max = typeof limit === 'number' && limit > 12 ? limit : 56
        if (text.length <= max) return text
        const head = Math.ceil((max - 1) * 0.45)
        return text.slice(0, head) + '…' + text.slice(text.length - (max - 1 - head))
      }
      function clampInt(value, fallback, min, max) {
        const n = Number(value)
        if (!isFinite(n)) return fallback
        return Math.min(max, Math.max(min, Math.round(n)))
      }
      function normalizeHealth(data) {
        const source = data && typeof data === 'object' ? data : {}
        return {
          ok: source.ok === true,
          version: asString(source.version),
          root: asString(source.root),
          hasLlm: source.hasLlm === true,
          hasSessionQuery: source.hasSessionQuery === true,
        }
      }
      function normalizeDigest(data) {
        if (!data || typeof data !== 'object') return null
        return { chars: typeof data.chars === 'number' ? data.chars : 0, truncated: data.truncated === true, source: asString(data.source) }
      }
      function normalizeDraft(data, fallbackName, fallbackDescription) {
        const source = data && typeof data === 'object' ? data : {}
        return {
          name: asString(source.name).trim() || asString(fallbackName).trim(),
          description: asString(source.description).trim() || asString(fallbackDescription).trim(),
          whenToUse: asString(source.whenToUse).trim(),
          content: asString(source.content),
        }
      }

      /* ------------------------------------------------------------------ *
       * 5. Controller — capability snapshot + transient notice. The panel
       *    subscribes; every mutation goes through dispatch().
       * ------------------------------------------------------------------ */

      function Controller(client) {
        this.api = client
        this.listeners = []
        this.layout = undefined
        this.noticeSeq = 0
        this.snapshot = { health: null, healthLoading: false, healthError: '', notice: null }
      }

      Object.assign(Controller.prototype, {
        getSnapshot() {
          return this.snapshot
        },
        subscribe(listener) {
          if (typeof listener !== 'function') return () => {}
          this.listeners.push(listener)
          const self = this
          return function unsubscribe() {
            const index = self.listeners.indexOf(listener)
            if (index !== -1) self.listeners.splice(index, 1)
          }
        },
        dispatch(patch) {
          const next = Object.assign({}, this.snapshot, patch || {})
          this.snapshot = next
          const listeners = this.listeners.slice()
          for (let i = 0; i < listeners.length; i += 1) safe(listeners[i], next)
        },
        attachLayout(layout) {
          this.layout = layout
        },
        selectSurface() {
          try {
            if (this.layout && typeof this.layout.selectPanel === 'function') {
              this.layout.selectPanel('skill-forge')
              return true
            }
          } catch (err) {
            return false
          }
          return false
        },
        notify(text) {
          if (!text) return
          this.noticeSeq += 1
          this.dispatch({ notice: { id: this.noticeSeq, text: String(text) } })
        },
        dismissNotice() {
          this.dispatch({ notice: null })
        },
        async refreshHealth(client) {
          const target = client || this.api
          this.dispatch({ healthLoading: true, healthError: '' })
          try {
            const data = await target.health()
            this.dispatch({ healthLoading: false, health: normalizeHealth(data), healthError: '' })
            return data
          } catch (err) {
            this.dispatch({ healthLoading: false, healthError: describeError(err) })
            return null
          }
        },
      })

      /* 6. Sidebar icon — anvil + spark, 16x16, inherits currentColor. */

      const ICON_PATHS = [
        'M2.8 12.9h10.4', 'M4.5 12.9v-1.4h7v1.4', 'M5.7 11.5l.9-2.5h2.8l.9 2.5', 'M4.5 9h6.9',
        'M4.5 9c0-.8.7-1.4 1.5-1.4h3.6', 'M11 7.6h2.2l-.9 1.2', 'M12.2 2.1l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z',
      ]
      function PanelIcon(props) {
        const requested = props && typeof props.size === 'number' ? props.size : 16
        const paths = []
        for (let i = 0; i < ICON_PATHS.length; i += 1) paths.push(h('path', { key: ICON_PATHS[i], d: ICON_PATHS[i] }))
        return h(
          'svg',
          {
            viewBox: '0 0 16 16', width: requested > 0 ? requested : 16, height: requested > 0 ? requested : 16,
            fill: 'none', stroke: 'currentColor', strokeWidth: '1.3', strokeLinecap: 'round', strokeLinejoin: 'round',
            'aria-hidden': 'true', 'data-dsh-panel-entry': 'skill-forge',
          },
          paths,
        )
      }

      /* 7. Presentational atoms */

      function btn(label, onClick, className, disabled) {
        return h('button', {
          type: 'button',
          className: 'sfx_btn ' + (className || ''),
          disabled: disabled === true,
          onClick: (event) => safe(onClick, event),
        }, label)
      }

      const field = (label, child) => h('label', { className: 'sfx_field' }, h('span', { className: 'sfx_fieldlabel' }, label), child)
      const errorBar = (message) => (message ? h('div', { className: 'sfx_error', role: 'alert' }, asString(message)) : null)
      function textInput(value, onChange, extra) {
        const props = Object.assign({ type: 'text', className: 'sfx_input', value: asString(value), spellCheck: 'false' }, extra || {})
        props.onChange = (event) => safe(onChange, eventValue(event))
        return h('input', props)
      }
      function textArea(value, onChange, extra) {
        const props = Object.assign({ className: 'sfx_textarea', value: asString(value) }, extra || {})
        props.onChange = (event) => safe(onChange, eventValue(event))
        return h('textarea', props)
      }
      function TabBar(props) {
        const items = [{ id: 'library', label: tt('tab.library') }, { id: 'forge', label: tt('tab.forge') }]
        return h('div', { className: 'sfx_tabs', role: 'tablist' }, items.map(function renderTab(item) {
          const active = item.id === props.tab
          return h('button', {
            key: item.id, type: 'button', role: 'tab', 'aria-selected': active,
            className: active ? 'sfx_tab sfx_tab_active' : 'sfx_tab',
            onClick: () => safe(props.onChange, item.id),
          }, item.label)
        }))
      }
      function StatusLine(props) {
        // One dot + one short phrase + the rest as quiet chips. The previous
        // version concatenated five facts into a single grey line, which read as
        // noise; each fact now gets its own element so the eye can skip it.
        if (props.loading) {
          return h('div', { className: 'sfx_status' },
            h('span', { className: 'sfx_statusdot sfx_statusdot_off' }),
            h('span', { className: 'sfx_statustext' }, tt('status.checking')),
            btn(tt('btn.health'), props.onRefresh, 'sfx_btn_ghost sfx_btn_mini', true))
        }
        if (props.error) {
          return h('div', { className: 'sfx_status' },
            h('span', { className: 'sfx_statusdot sfx_statusdot_warn' }),
            h('span', { className: 'sfx_statustext' }, tt('status.healthFailed') + '：' + props.error),
            btn(tt('btn.health'), props.onRefresh, 'sfx_btn_ghost sfx_btn_mini'))
        }
        const health = props.health
        if (!health) {
          return h('div', { className: 'sfx_status' },
            h('span', { className: 'sfx_statustext' }, tt('status.checking')))
        }
        const facts = [
          { text: tt('status.ready') + (health.version ? ' v' + health.version : ''), warn: false },
          { text: health.hasLlm ? tt('status.llmOk') : tt('status.noLlm'), warn: health.hasLlm !== true },
          { text: health.hasSessionQuery ? tt('status.sessions') : tt('status.sessionsOff'), warn: health.hasSessionQuery !== true },
        ]
        const children = []
        for (let i = 0; i < facts.length; i += 1) {
          if (i > 0) children.push(h('span', { key: 'sep' + i, className: 'sfx_statussep' }, '·'))
          children.push(h('span', {
            key: 'fact' + i,
            className: facts[i].warn ? 'sfx_statusdot sfx_statusdot_warn' : 'sfx_statusdot',
          }))
          children.push(h('span', {
            key: 'text' + i,
            className: 'sfx_statustext',
          }, facts[i].text))
        }
        children.push(btn(tt('btn.health'), props.onRefresh, 'sfx_btn_ghost sfx_btn_mini'))
        return h('div', { className: 'sfx_status' }, children)
      }
      function EmptyState(props) {
        return h('div', { className: 'sfx_empty' },
          h('div', { className: 'sfx_emptytitle' }, props.title),
          props.body ? h('div', { className: 'sfx_emptybody' }, props.body) : null,
          props.actionLabel ? btn(props.actionLabel, props.onAction, 'sfx_btn_primary') : null)
      }

      /**
       * In-panel confirmation strip.
       *
       * Replacements for window.confirm(): a native modal cannot be themed with
       * the host's tokens, is not localized through ctx.locale, and is the one
       * interaction the surrounding harness never uses. This renders in normal
       * page flow with the same chrome as the error/notice bars.
       */
      function ConfirmBar(props) {
        return h('div', { className: 'sfx_confirm', role: 'alertdialog', 'aria-live': 'assertive' },
          h('span', { className: 'sfx_confirmtext' }, asString(props.message)),
          btn(props.cancelLabel, props.onCancel, 'sfx_btn_mini sfx_btn_ghost', props.busy === true),
          btn(props.confirmLabel, props.onConfirm, 'sfx_btn_mini sfx_btn_danger_solid', props.busy === true))
      }

      /* 8. Tab 1 — 技能库：search / list / preview / delete */

      function SkillRow(props) {
        const skill = props.skill || {}
        // The row shows only what distinguishes one skill from another: name,
        // description, size and date. The absolute path is identical for every
        // row and is shown once in the toolbar, so repeating it here was pure noise.
        const meta = [fmtBytes(skill.bytes), fmtDate(skill.updatedAt)].filter(Boolean).join(' · ')
        return h('div', {
          className: props.active === true ? 'sfx_row sfx_row_active' : 'sfx_row',
          role: 'button',
          tabIndex: 0,
          onClick: () => safe(props.onPreview, asString(skill.name)),
          onKeyDown: (event) => {
            if (event && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault()
              safe(props.onPreview, asString(skill.name))
            }
          },
        },
        h('div', { className: 'sfx_rowhead' },
          h('span', { className: 'sfx_rowname' }, asString(skill.name)),
          h('div', { className: 'sfx_rowactions' },
            btn(tt('btn.delete'), (event) => {
              if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
              safe(props.onDelete, asString(skill.name))
            }, 'sfx_btn_mini sfx_btn_danger', props.busy === true))),
        skill.description ? h('div', { className: 'sfx_rowdesc' }, asString(skill.description)) : null,
        h('div', { className: 'sfx_rowfoot' },
          meta ? h('span', { className: 'sfx_meta' }, meta) : null,
          skill.whenToUse ? h('span', { className: 'sfx_badge sfx_badge_forged' }, tt('badge.trigger')) : null))
      }

      /**
       * Minimal, dependency-free Markdown reader for the preview pane.
       *
       * SKILL.md is authored as Markdown, so dumping it into a <pre> showed raw
       * `##` and backticks — technically truthful but hard to scan. This renders
       * only the constructs a skill body actually uses (headings, bullet and
       * numbered lists, fenced code, checkbox items, inline code, bold) and
       * leaves everything else as plain text. Deliberately NOT a full Markdown
       * implementation: no HTML passthrough, no links, no images.
       */
      const MD_INLINE = /(\*\*[^*]+\*\*|`[^`\r\n]+`)/g

      /** Split one line into text / code / bold React nodes. */
      function mdInline(text, keyPrefix) {
        const nodes = []
        const source = asString(text)
        let last = 0
        let match
        MD_INLINE.lastIndex = 0
        let index = 0
        while ((match = MD_INLINE.exec(source)) !== null) {
          if (match.index > last) nodes.push(source.slice(last, match.index))
          const token = match[0]
          if (token.startsWith('`')) {
            nodes.push(h('code', { key: keyPrefix + 'c' + index }, token.slice(1, -1)))
          } else {
            nodes.push(h('strong', { key: keyPrefix + 'b' + index }, token.slice(2, -2)))
          }
          last = match.index + token.length
          index += 1
        }
        if (last < source.length) nodes.push(source.slice(last))
        return nodes.length === 0 ? '' : nodes
      }

      /** Render a skill body as a small block tree. */
      function renderMarkdown(text) {
        const lines = asString(text).split(/\r?\n/)
        const blocks = []
        let list = null
        let fence = null

        const flushList = () => {
          if (list === null) return
          blocks.push(h(list.ordered ? 'ol' : 'ul', { key: 'l' + blocks.length, className: 'sfx_mdlist' },
            list.items.map((item, i) => h('li', { key: 'li' + i, className: item.done === undefined ? undefined : 'sfx_mdtask' },
              item.done === undefined ? null : h('span', { className: 'sfx_mdcheck' }, item.done ? '☑' : '☐'),
              mdInline(item.text, 'i' + blocks.length + '_' + i)))))
          list = null
        }
        const flushFence = () => {
          if (fence === null) return
          blocks.push(h('pre', { key: 'f' + blocks.length, className: 'sfx_mdcode' }, fence.lines.join('\n')))
          fence = null
        }

        for (let i = 0; i < lines.length; i += 1) {
          const line = lines[i]
          if (fence !== null) {
            if (/^\s*```/.test(line)) flushFence()
            else fence.lines.push(line)
            continue
          }
          if (/^\s*```/.test(line)) {
            flushList()
            fence = { lines: [] }
            continue
          }
          if (line.trim() === '') { flushList(); continue }
          const heading = /^(#{1,4})\s+(.*)$/.exec(line)
          if (heading !== null) {
            flushList()
            const level = Math.min(4, heading[1].length) + 1
            blocks.push(h('h' + level, { key: 'h' + blocks.length, className: 'sfx_mdhead sfx_mdhead_' + heading[1].length },
              mdInline(heading[2], 'h' + blocks.length)))
            continue
          }
          const task = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/.exec(line)
          if (task !== null) {
            if (list === null || list.ordered !== false) { flushList(); list = { ordered: false, items: [] } }
            list.items.push({ done: task[1].toLowerCase() === 'x', text: task[2] })
            continue
          }
          const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
          if (bullet !== null) {
            if (list === null || list.ordered !== false) { flushList(); list = { ordered: false, items: [] } }
            list.items.push({ text: bullet[1] })
            continue
          }
          const ordered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line)
          if (ordered !== null) {
            if (list === null || list.ordered !== true) { flushList(); list = { ordered: true, items: [] } }
            list.items.push({ text: ordered[2] })
            continue
          }
          flushList()
          blocks.push(h('p', { key: 'p' + blocks.length, className: 'sfx_mdpara' }, mdInline(line, 'p' + blocks.length)))
        }
        flushList()
        flushFence()
        if (blocks.length === 0) return h('div', { className: 'sfx_mdempty' }, '—')
        return h('div', { className: 'sfx_md' }, blocks)
      }

      function SkillDetail(props) {
        const detail = props.detail || {}
        const section = (label, text) => (text ? h('div', { className: 'sfx_section' },
          h('div', { className: 'sfx_sectionlabel' }, label),
          h('div', { className: 'sfx_sectionbody' }, text)) : null)
        const [raw, setRaw] = React.useState(false)
        // A skill body almost always opens with its own "何时使用" heading, so the
        // outer section label repeated it 30px above the same words. When the body
        // already starts with a heading, the label is redundant and is dropped.
        const bodyStartsWithHeading = /^\s*#{1,4}\s/.test(asString(detail.content))
        return h('div', { className: 'sfx_detail' },
          h('div', { className: 'sfx_detailhead' },
            btn('← ' + tt('btn.back'), props.onBack, 'sfx_btn_mini'),
            h('span', { className: 'sfx_detailname' }, asString(detail.name)),
            h('span', { className: 'sfx_spacer' }),
            btn(raw ? tt('detail.rendered') : tt('detail.raw'), () => setRaw((v) => !v), 'sfx_btn_mini'),
            btn(tt('btn.delete'), () => props.onDelete(asString(detail.name)), 'sfx_btn_mini sfx_btn_danger', props.busy === true)),
          h('div', { className: 'sfx_row_inline sfx_detailmeta' },
            section(tt('detail.description'), asString(detail.description)),
            section(tt('detail.whenToUse'), asString(detail.whenToUse))),
          h('div', { className: 'sfx_section' },
            bodyStartsWithHeading ? null : h('div', { className: 'sfx_sectionlabel' }, tt('detail.content')),
            raw ? h('pre', { className: 'sfx_pre' }, asString(detail.content)) : h('div', { className: 'sfx_pre sfx_pre_md' }, renderMarkdown(detail.content))),
          detail.path ? h('div', { className: 'sfx_meta' }, tt('detail.meta') + '：' + asString(detail.path)) : null)
      }

      function LibraryTab(props) {
        const client = props.api
        const [items, setItems] = React.useState([])
        const [root, setRoot] = React.useState('')
        const [query, setQuery] = React.useState('')
        const [listLoading, setListLoading] = React.useState(false)
        const [listError, setListError] = React.useState('')
        const [detail, setDetail] = React.useState(null)
        const [detailLoading, setDetailLoading] = React.useState(false)
        const [detailError, setDetailError] = React.useState('')
        const [busyName, setBusyName] = React.useState('')

        const refresh = React.useCallback(async function refresh() {
          setListLoading(true)
          setListError('')
          try {
            const data = await client.list()
            setItems(data && Array.isArray(data.skills) ? data.skills : [])
            setRoot(data && typeof data.root === 'string' ? data.root : '')
          } catch (err) {
            setListError(describeError(err))
          } finally {
            setListLoading(false)
          }
        }, [client])

        React.useEffect(function loadOnMount() {
          void refresh()
          return undefined
        }, [refresh, props.refreshToken])

        const onPreview = React.useCallback(async function onPreview(name) {
          if (!name) return
          setDetailLoading(true)
          setDetailError('')
          try {
            const data = await client.read(name)
            const source = data && typeof data === 'object' ? data : {}
            setDetail({
              name: asString(source.name) || name,
              path: asString(source.path),
              description: asString(source.description),
              whenToUse: asString(source.whenToUse),
              content: asString(source.content),
            })
          } catch (err) {
            setDetailError(describeError(err))
          } finally {
            setDetailLoading(false)
          }
        }, [client])

        // Deletion asks IN the panel, not through window.confirm(). A native
        // browser modal is the one control the host never uses, and it cannot be
        // themed, localized through ctx.locale, or styled like the rest of the page.
        const [pendingDelete, setPendingDelete] = React.useState('')

        const onDelete = React.useCallback(function requestDelete(name) {
          if (!name) return
          setPendingDelete(name)
        }, [])

        const onCancelDelete = React.useCallback(function onCancelDelete() {
          setPendingDelete('')
        }, [])

        const onConfirmDelete = React.useCallback(async function onConfirmDelete() {
          const name = pendingDelete
          if (!name) return
          setPendingDelete('')
          setBusyName(name)
          setListError('')
          setDetailError('')
          try {
            const data = await client.remove(name)
            if (detail && detail.name === name) setDetail(null)
            if (typeof props.onNotice === 'function') props.onNotice(tt('delete.done', { path: asString(data && data.trashPath) || '.trash' }))
            await refresh()
          } catch (err) {
            setListError(describeError(err))
          } finally {
            setBusyName('')
          }
        }, [client, detail, refresh, props.onNotice, pendingDelete])

        const onBack = React.useCallback(function onBack() {
          setDetail(null)
          setDetailError('')
        }, [])

        const needle = query.trim().toLowerCase()
        const visible = needle ? items.filter(function match(skill) {
          const hay = (asString(skill.name) + ' ' + asString(skill.description) + ' ' + asString(skill.whenToUse)).toLowerCase()
          return hay.indexOf(needle) !== -1
        }) : items

        if (detailLoading || detail) {
          return h('div', { className: 'sfx_body' },
            errorBar(listError || detailError),
            pendingDelete ? h(ConfirmBar, {
              message: tt('delete.confirm', { name: pendingDelete }),
              confirmLabel: tt('btn.delete'), cancelLabel: tt('btn.cancel'),
              busy: busyName !== '', onConfirm: onConfirmDelete, onCancel: onCancelDelete,
            }) : null,
            detailLoading && !detail ? h('div', { className: 'sfx_loading' }, tt('detail.loading'))
              : h(SkillDetail, { detail: detail || {}, busy: busyName !== '' || detailLoading, onBack, onDelete }))
        }

        return h('div', { className: 'sfx_body' },
          h('div', { className: 'sfx_toolbar' },
            h('input', {
              type: 'search', className: 'sfx_input', placeholder: tt('toolbar.search'),
              'aria-label': tt('toolbar.search'), value: query,
              onChange: (event) => safe(setQuery, eventValue(event)),
            }),
            btn(listLoading ? tt('list.loading') : tt('btn.refresh'), refresh, '', listLoading),
            h('span', { className: 'sfx_count' },
              needle ? tt('countFiltered', { n: visible.length, total: items.length }) : tt('count', { n: items.length }))),
          // The skills root appears ONCE here, not in every row: it is the same
          // for every skill, so repeating it per row only added truncated noise.
          root ? h('div', { className: 'sfx_meta' }, root) : null,
          errorBar(listError),
          pendingDelete ? h(ConfirmBar, {
            message: tt('delete.confirm', { name: pendingDelete }),
            confirmLabel: tt('btn.delete'), cancelLabel: tt('btn.cancel'),
            busy: busyName !== '', onConfirm: onConfirmDelete, onCancel: onCancelDelete,
          }) : null,
          listLoading && items.length === 0 ? h('div', { className: 'sfx_loading' }, tt('list.loading')) : null,
          !listLoading && visible.length === 0 && listError === ''
            ? h(EmptyState, {
              title: needle ? tt('list.empty.filtered') : tt('list.empty.title'),
              body: needle ? '' : tt('list.empty.body'),
              // A filtered-empty list is a dead end without a way back to the
              // full list; the true-empty state already offers its CTA.
              actionLabel: needle ? tt('btn.clearSearch') : tt('btn.forge'),
              onAction: needle ? function clearSearch() { safe(setQuery, '') } : props.onGoForge,
            })
            : null,
          visible.length > 0 ? h('div', { className: 'sfx_list' }, visible.map(function renderRow(skill, index) {
            return h(SkillRow, {
              key: asString(skill.name) + ':' + index, skill,
              busy: busyName !== '' || detailLoading, onPreview, onDelete,
            })
          })) : null)
      }

      /* 9. Tab 2 — 锻造：source → distill → draft → save */

      function SourceSwitch(props) {
        const options = [{ id: 'session', label: tt('forge.source.session') }, { id: 'text', label: tt('forge.source.text') }]
        return h('div', { className: 'sfx_switch', role: 'radiogroup', 'aria-label': tt('forge.source.label') }, options.map(function renderOption(option) {
          const active = option.id === props.source
          return h('button', {
            key: option.id, type: 'button', role: 'radio', 'aria-checked': active,
            className: active ? 'sfx_switchbtn sfx_switchbtn_on' : 'sfx_switchbtn',
            onClick: () => safe(props.onChange, option.id),
          }, option.label)
        }))
      }
      function DraftEditor(props) {
        const draft = props.draft || {}
        const digest = props.digest
        const bits = []
        if (digest) {
          bits.push(tt('forge.digest', { chars: digest.chars }))
          if (digest.truncated) bits.push(tt('forge.digest.truncated'))
          // `digest.source` is the wire enum ('session' | 'text' | 'session-log' …).
          // Showing it raw leaked English into the Chinese UI; map it to the same
          // words the source switch uses, and fall back to the raw value only when
          // the enum is one this panel does not know.
          if (digest.source) {
            const sourceLabel = digest.source === 'text'
              ? tt('forge.source.text')
              : digest.source === 'session' || digest.source === 'session-log' || digest.source === 'session-surface'
                ? tt('forge.source.session')
                : digest.source
            bits.push(tt('forge.digest.source', { source: sourceLabel }))
          }
        }
        // A "0 字符" digest means the model was never the source (manual draft),
        // so the meta line is suppressed rather than showing a misleading zero.
        const showDigest = bits.length > 0 && !(digest && digest.chars === 0)
        return h('div', { className: 'sfx_draft' },
          h('div', { className: 'sfx_drafthead' },
            h('span', { className: 'sfx_drafttitle' }, tt('forge.draft.title')),
            showDigest ? h('span', { className: 'sfx_digest' }, bits.join(' · ')) : null,
            btn(tt('btn.dismiss'), props.onDiscard, 'sfx_btn_mini sfx_btn_ghost')),
          // Two short fields share a line; the long ones get the full width. The
          // description is a 2-row textarea rather than a single-line input: a
          // distilled description runs 60-120 chars, and a single-line box cut it
          // mid-word exactly on the field the user is asked to review.
          h('div', { className: 'sfx_row_inline' },
            h('div', { className: 'sfx_field sfx_field_name' }, field(tt('forge.draft.name'), textInput(draft.name, (v) => props.onField('name', v)))),
            h('div', { className: 'sfx_field sfx_grow' }, field(tt('forge.draft.description'), textArea(draft.description, (v) => props.onField('description', v), { rows: 2, className: 'sfx_textarea sfx_textarea_auto' })))),
          field(tt('forge.draft.whenToUse'), textArea(draft.whenToUse, (v) => props.onField('whenToUse', v), { rows: 2 })),
          field(tt('forge.draft.content'), textArea(draft.content, (v) => props.onField('content', v), { rows: 14, className: 'sfx_textarea sfx_textarea_mono', spellCheck: 'false' })),
          errorBar(props.error),
          props.pendingOverwrite ? h(ConfirmBar, {
            message: props.pendingOverwrite.message,
            confirmLabel: tt('btn.overwrite'), cancelLabel: tt('btn.cancel'),
            busy: props.saving === true,
            onConfirm: props.onConfirmOverwrite, onCancel: props.onCancelOverwrite,
          }) : null,
          h('div', { className: 'sfx_footer' },
            btn(props.saving ? tt('btn.saveBusy') : tt('btn.save'), props.onSave, 'sfx_btn_primary', props.saving === true),
            h('span', { className: 'sfx_spacer' }),
            props.nameOk === false && props.saving !== true ? h('span', { className: 'sfx_badge' }, tt('error.name')) : null))
      }

      function ForgeTab(props) {
        const client = props.api
        const [source, setSource] = React.useState('session')
        const [sessions, setSessions] = React.useState([])
        const [sessionsLoading, setSessionsLoading] = React.useState(false)
        const [sessionsError, setSessionsError] = React.useState('')
        const [sessionId, setSessionId] = React.useState('')
        const [lastTurns, setLastTurns] = React.useState('10')
        const [text, setText] = React.useState('')
        const [name, setName] = React.useState('')
        const [description, setDescription] = React.useState('')
        const [distilling, setDistilling] = React.useState(false)
        const [distillError, setDistillError] = React.useState('')
        const [digest, setDigest] = React.useState(null)
        const [draft, setDraft] = React.useState(null)
        const [saving, setSaving] = React.useState(false)
        const [saveError, setSaveError] = React.useState('')
        const [llmUnavailable, setLlmUnavailable] = React.useState(false)

        const loadSessions = React.useCallback(async function loadSessions() {
          setSessionsLoading(true)
          setSessionsError('')
          try {
            const data = await client.sessions(20)
            const list = data && Array.isArray(data.sessions) ? data.sessions : []
            setSessions(list)
            if (list.length > 0) setSessionId((previous) => previous || asString(list[0].id))
          } catch (err) {
            setSessionsError(describeError(err))
          } finally {
            setSessionsLoading(false)
          }
        }, [client])

        React.useEffect(function loadSessionsOnMount() {
          void loadSessions()
          return undefined
        }, [loadSessions])

        const setDraftField = React.useCallback(function setDraftField(key, value) {
          setDraft(function patch(previous) {
            if (!previous) return previous
            const next = { name: previous.name, description: previous.description, whenToUse: previous.whenToUse, content: previous.content }
            next[key] = value
            return next
          })
          setSaveError('')
        }, [])

        const onDistill = React.useCallback(async function onDistill() {
          setDistillError('')
          setSaveError('')
          const body = {}
          if (source === 'text') {
            const trimmed = text.trim()
            if (!trimmed) {
              setDistillError(tt('forge.needInput'))
              return
            }
            body.text = trimmed
          } else {
            if (!sessionId) {
              setDistillError(tt('forge.needInput'))
              return
            }
            body.sessionId = sessionId
            body.lastTurns = clampInt(lastTurns, 10, 1, 50)
          }
          if (name.trim()) body.name = name.trim()
          if (description.trim()) body.description = description.trim()
          setDistilling(true)
          try {
            const data = await client.distill(body)
            setDraft(normalizeDraft(data && data.draft, name, description))
            setDigest(normalizeDigest(data && data.digest))
            setLlmUnavailable(false)
          } catch (err) {
            if (err && (err.status === 503 || err.code === 'llm-unavailable')) {
              setLlmUnavailable(true)
              setDigest(normalizeDigest(err.payload && err.payload.digest))
            }
            setDistillError(describeError(err))
          } finally {
            setDistilling(false)
          }
        }, [client, source, text, sessionId, lastTurns, name, description])

        const onManualDraft = React.useCallback(function onManualDraft() {
          setSaveError('')
          setDistillError('')
          setDraft({ name: name.trim(), description: description.trim(), whenToUse: '', content: '' })
          setDigest(null)
        }, [name, description])

        // Overwrite is confirmed in the panel rather than through window.confirm().
        // `pendingOverwrite` holds the payload the host already rejected with
        // SKILL_EXISTS; confirming replays it once with overwrite:true.
        const [pendingOverwrite, setPendingOverwrite] = React.useState(null)

        /** Save one payload; returns true when it landed, false when it was refused. */
        const submitPayload = React.useCallback(async function submitPayload(body, allowOverwrite) {
          setSaving(true)
          try {
            const result = await client.save(body)
            setDraft(null)
            setDigest(null)
            setPendingOverwrite(null)
            if (typeof props.onSaved === 'function') props.onSaved(result)
            return
          } catch (err) {
            const exists = err && (err.code === 'SKILL_EXISTS' || err.status === 409)
            if (exists && !allowOverwrite) {
              setPendingOverwrite({ body, message: tt('save.exists') })
              setSaveError('')
              return
            }
            setSaveError(describeError(err))
          } finally {
            setSaving(false)
          }
        }, [client, props.onSaved])

        const onSave = React.useCallback(function onSave() {
          if (!draft) return
          setSaveError('')
          setPendingOverwrite(null)
          const skillName = asString(draft.name).trim()
          const content = asString(draft.content)
          if (!isKebabName(skillName)) {
            setSaveError(tt('error.name'))
            return
          }
          if (!content.trim()) {
            setSaveError(tt('error.content'))
            return
          }
          const payload = { name: skillName, description: asString(draft.description).trim(), content }
          const whenToUse = asString(draft.whenToUse).trim()
          if (whenToUse) payload.whenToUse = whenToUse
          void submitPayload(payload, false)
        }, [draft, submitPayload])

        const onConfirmOverwrite = React.useCallback(function onConfirmOverwrite() {
          if (!pendingOverwrite) return
          const body = Object.assign({}, pendingOverwrite.body, { overwrite: true })
          setPendingOverwrite(null)
          void submitPayload(body, true)
        }, [pendingOverwrite, submitPayload])

        const onCancelOverwrite = React.useCallback(function onCancelOverwrite() {
          setPendingOverwrite(null)
          setSaveError(tt('save.cancelled'))
        }, [])

        const onDiscard = React.useCallback(function onDiscard() {
          setDraft(null)
          setDigest(null)
          setSaveError('')
        }, [])

        const health = props.health
        const showHint = llmUnavailable || (!!health && health.hasLlm === false)
        // Guards undefined as well as null: never assume the draft exists.
        const nameOk = !draft || isKebabName(asString(draft.name).trim())
        const sessionPicker = sessions.length > 0
          ? h('select', {
            className: 'sfx_select', value: sessionId, disabled: sessionsLoading,
            onChange: (event) => safe(setSessionId, eventValue(event)),
          }, sessions.map(function renderOption(session, index) {
            const id = asString(session && session.id)
            const title = asString(session && session.title)
            return h('option', { key: id + ':' + index, value: id }, title || id || '(untitled)')
          }))
          : h('div', { className: 'sfx_loading' }, sessionsLoading ? tt('forge.session.loading') : sessionsError || tt('forge.session.empty'))

        return h('div', { className: 'sfx_body' },
          h('div', { className: 'sfx_form' },
            field(tt('forge.source.label'), h(SourceSwitch, { source, onChange: setSource })),
            source === 'session'
              ? h('div', { className: 'sfx_row_inline' },
                h('div', { className: 'sfx_field sfx_grow' }, field(tt('forge.session.label'), sessionPicker)),
                field(tt('forge.lastTurns'), h('input', {
                  type: 'number', className: 'sfx_input sfx_input_tiny', min: 1, max: 50, step: 1,
                  value: lastTurns,
                  onChange: (event) => safe(setLastTurns, eventValue(event) || '10'),
                })))
              : field(tt('forge.text.label'), textArea(text, setText, { rows: 7, placeholder: tt('forge.text.placeholder') })),
            errorBar(sessionsError),
            h('div', { className: 'sfx_row_inline' },
              h('div', { className: 'sfx_field sfx_grow' }, field(tt('forge.name'), textInput(name, setName, { placeholder: tt('forge.name.placeholder') }))),
              h('div', { className: 'sfx_field sfx_grow' }, field(tt('forge.description'), textInput(description, setDescription, { placeholder: tt('forge.description.placeholder') })))),
            h('div', { className: 'sfx_footer' },
              btn(distilling ? tt('btn.distillBusy') : tt('btn.distill'), onDistill, 'sfx_btn_primary', distilling),
              btn(tt('btn.manualDraft'), onManualDraft, '', distilling),
              distilling ? h('span', { className: 'sfx_digest' }, tt('forge.distilling')) : null),
            errorBar(distillError),
            showHint ? h('div', { className: 'sfx_hint', role: 'note' },
              h('div', { className: 'sfx_hinttitle' }, tt('status.noLlm')),
              h('div', null, tt('forge.llm.hint'))) : null),
          draft ? h(DraftEditor, {
            draft, digest, error: saveError, saving, nameOk, onField: setDraftField, onSave, onDiscard,
            pendingOverwrite, onConfirmOverwrite, onCancelOverwrite,
          }) : null)
      }

      /* 10. Panel page — header, tabs, notice, active tab body. */

      function PanelPage(props) {
        const controller = props.controller
        const client = props.api || (controller && controller.api)
        const [tab, setTab] = React.useState('library')
        const [error, setError] = React.useState('')
        const [refreshToken, setRefreshToken] = React.useState(0)
        const [snapshot, setSnapshot] = React.useState(function initialSnapshot() {
          try {
            return controller && typeof controller.getSnapshot === 'function' ? controller.getSnapshot() : null
          } catch (err) {
            return null
          }
        })

        React.useEffect(function subscribeController() {
          if (!controller || typeof controller.subscribe !== 'function') return undefined
          let off
          try {
            off = controller.subscribe(() => safe(setSnapshot, controller.getSnapshot()))
          } catch (err) {
            off = undefined
          }
          return typeof off === 'function' ? off : undefined
        }, [controller])

        React.useEffect(function loadHealth() {
          if (!controller || typeof controller.refreshHealth !== 'function') return undefined
          let alive = true
          async function run() {
            try {
              await controller.refreshHealth(client)
            } catch (err) {
              if (alive) setError(describeError(err))
            }
          }
          void run()
          return function cleanup() {
            alive = false
          }
        }, [controller, client])

        const onNotice = React.useCallback(function onNotice(message) {
          if (controller && typeof controller.notify === 'function') safe(controller.notify.bind(controller), message)
        }, [controller])

        const onDismissNotice = React.useCallback(function onDismissNotice() {
          if (controller && typeof controller.dismissNotice === 'function') safe(controller.dismissNotice.bind(controller))
        }, [controller])

        const onGoForge = React.useCallback(function onGoForge() {
          if (controller && typeof controller.selectSurface === 'function') safe(controller.selectSurface.bind(controller))
          setTab('forge')
        }, [controller])

        const onSaved = React.useCallback(function onSaved(result) {
          setTab('library')
          setRefreshToken((previous) => previous + 1)
          onNotice(tt('save.done', { name: asString(result && result.name) }))
        }, [onNotice])

        const health = snapshot ? snapshot.health : null
        const healthLoading = snapshot ? snapshot.healthLoading === true : false
        const healthError = snapshot ? asString(snapshot.healthError) : ''
        const notice = snapshot ? snapshot.notice : null

        if (!client) {
          return h('div', { className: 'sfx_view', 'data-dsh-plugin': 'skill-forge' },
            h('div', { className: 'sfx_inner' },
              h('div', { className: 'sfx_title' }, tt('app.title')), errorBar(tt('error.unknown'))))
        }

        return h('div', { className: 'sfx_view', 'data-dsh-plugin': 'skill-forge' },
          h('div', { className: 'sfx_inner' },
            h('div', { className: 'sfx_head' }, h('div', { className: 'sfx_headmain' },
              h('div', { className: 'sfx_title' }, tt('app.title')),
              h('div', { className: 'sfx_subtitle' }, tt('app.subtitle')),
              h(StatusLine, {
                health, loading: healthLoading, error: healthError,
                onRefresh: function onRefresh() {
                  setError('')
                  safe(() => controller && controller.refreshHealth && controller.refreshHealth(client))
                },
              }))),
            h(TabBar, { tab, onChange: setTab }),
            errorBar(error),
            notice && notice.text ? h('div', { className: 'sfx_notice' },
              h('span', { className: 'sfx_noticetext' }, asString(notice.text)),
              btn(tt('btn.dismiss'), onDismissNotice, 'sfx_btn_mini sfx_btn_ghost')) : null,
            tab === 'library'
              ? h(LibraryTab, { api: client, refreshToken, onNotice, onGoForge })
              : h(ForgeTab, { api: client, health, onSaved })))
      }

      /* 11. Slot registration — two surfaces, each disposed on teardown. */
      function registerPanel(ctx, controller, client) {
        const slots = ctx && ctx.slots ? ctx.slots : undefined
        if (!slots || typeof slots.inject !== 'function' || typeof slots.register !== 'function') return () => {}
        const disposers = []
        try {
          disposers.push(slots.inject('sidebar.panellist', function sidebarRow() {
            return slots.register({
              name: 'sidebar.panellist',
              id: 'skill-forge',
              order: 26,
              label: function label() {
                return tt('entry.label')
              },
            }, PanelIcon)
          }))
        } catch (err) {
          /* sidebar surface unavailable — still mount the main panel */
        }
        try {
          disposers.push(slots.inject('main', function mainPanel() {
            return slots.register({
              name: 'main',
              key: 'skill-forge',
              inject: function injectFace() {
                return { controller, api: client }
              },
            }, PanelPage)
          }))
        } catch (err) {
          /* main surface unavailable */
        }
        return function disposePanel() {
          for (const disposer of disposers.splice(0)) {
            try {
              if (typeof disposer === 'function') disposer()
            } catch (err) {
              /* ignore */
            }
          }
        }
      }

      /* 12. Plugin entry */

      function applyEffect(ctx, setup, label) {
        try {
          if (ctx && typeof ctx.effect === 'function') {
            ctx.effect(setup, label)
            return
          }
        } catch (err) {
          /* fall through to a direct call */
        }
        try {
          setup()
        } catch (err) {
          /* keep apply() non-throwing for tests */
        }
      }

      function apply(ctx) {
        if (!ctx || typeof ctx !== 'object') return
        const controller = new Controller(api)

        applyEffect(ctx, function setupDictionaries() {
          try {
            if (!ctx.locale || typeof ctx.locale.register !== 'function') return function noop() {}
            const off = ctx.locale.register(NS, { zh: ZH, en: EN })
            return function removeDictionaries() {
              try {
                if (typeof off === 'function') off()
              } catch (err) {
                /* ignore */
              }
            }
          } catch (err) {
            return function noop() {}
          }
        }, 'skill-forge: dictionaries')

        try {
          if (ctx.locale && typeof ctx.locale.bind === 'function') {
            const bound = ctx.locale.bind(NS)
            if (typeof bound === 'function') translate = bound
          }
        } catch (err) {
          translate = undefined
        }

        applyEffect(ctx, function setupPanel() {
          const disposers = []
          try {
            disposers.push(injectCss())
          } catch (err) {
            disposers.push(function noop() {})
          }
          try {
            controller.attachLayout(typeof ctx.get === 'function' ? ctx.get('layout') : undefined)
          } catch (err) {
            controller.attachLayout(undefined)
          }
          try {
            disposers.push(registerPanel(ctx, controller, api))
          } catch (err) {
            disposers.push(function noop() {})
          }
          return function disposePanel() {
            for (const disposer of disposers.splice(0)) {
              try {
                if (typeof disposer === 'function') disposer()
              } catch (err) {
                /* ignore */
              }
            }
          }
        }, 'skill-forge: panel + stylesheet')
      }

      const inject = ['slots', 'locale', 'layout']

      return { apply, inject }
    },
  })
})()
