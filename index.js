/**
 * dsh-skill-forge — host half.
 *
 * Two jobs, one plugin row:
 *   1. Four model-facing tools that turn a conversation (or pasted text) into a
 *      reusable `SKILL.md` under `~/.dsh/skills`, so a similar question later
 *      hits the skill catalog instead of re-deriving the answer.
 *   2. The `/api/dsh-skill-forge/*` route family that the Web GUI panel talks
 *      to over same-origin fetch (list / read / save / delete / sessions /
 *      distill / health).
 *
 * Design notes that the code depends on:
 *   - The four tools and the routes share ONE implementation of capture,
 *     frontmatter build/parse, and skill-root scanning, so the agent path and
 *     the panel can never disagree about what a skill looks like.
 *   - Nothing here appends session events. Everything the model sees is
 *     derived from committed events read through `sessionQuery`.
 *   - The skill root is `path.join(dshHome, 'skills')`; `dshHome` resolves
 *     exactly like the official skill-filesystem provider resolves it.
 *   - Only skills this plugin wrote (`metadata.forge === 'skill-forge'`) are
 *     listed by default and are the only ones delete will touch.
 */

import { mkdir, readFile, readdir, rename, rm, stat, writeFile, copyFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { randomBytes } from 'node:crypto'

export const name = 'skill-forge'
export const version = '1.0.0'
export const inject = ['tools', 'webServer']

/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */

const FORGE_TAG = 'skill-forge'
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const ROUTE_PREFIX = '/api/dsh-skill-forge'
const MAX_BODY_BYTES = 1024 * 1024
const DISTILL_TIMEOUT_MS = 45_000
const DEFAULT_LAST_TURNS = 0 // 0 = read every exchange; maxChars still bounds the digest.
const DEFAULT_CAPTURE_CHARS = 20_000
const DEFAULT_TOOL_CHARS = 16_000
const DIGEST_SOURCE_HINT = 'session'

const TOOL_NAMES = {
  context: 'skill_forge_context',
  save: 'skill_forge_save',
  list: 'skill_forge_list',
  remove: 'skill_forge_delete'
}

/* ------------------------------------------------------------------ *
 * Paths
 * ------------------------------------------------------------------ */

/** Resolve the DSH home exactly like the official skill provider does. */
function resolveDshHome() {
  const fromEnv = process.env.DSH_HOME
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) return resolve(fromEnv)
  return join(homedir(), '.dsh')
}

/** The user skill root this plugin owns for writes. */
function skillRoot() {
  return join(resolveDshHome(), 'skills')
}

/** Look up a skill directory by name, rejecting anything that could escape the root. */
function skillDir(name, root) {
  const trimmed = String(name ?? '').trim()
  if (!SKILL_NAME_PATTERN.test(trimmed)) {
    const error = new Error(
      `skill name ${JSON.stringify(trimmed)} is not kebab-case; use lowercase letters, digits and single hyphens`
    )
    error.code = 'SKILL_NAME_INVALID'
    throw error
  }
  const dir = join(root, trimmed)
  // Defence in depth: the grammar already excludes separators, but a caller may
  // reach this helper with a value from a route query.
  if (resolve(dir) !== resolve(join(root, trimmed))) {
    const error = new Error('skill name escapes the skill root')
    error.code = 'SKILL_NAME_INVALID'
    throw error
  }
  return { name: trimmed, dir, file: join(dir, 'SKILL.md') }
}

/* ------------------------------------------------------------------ *
 * Frontmatter: build and parse
 * ------------------------------------------------------------------ */

/**
 * Quote one front-matter scalar as a YAML double-quoted string.
 *
 * JSON string syntax is a subset of YAML double-quoted scalars for the values
 * this plugin writes (no tabs, no bare control characters), so `JSON.stringify`
 * is both the shortest correct quoting and the one the project already trusts
 * elsewhere. Newlines are collapsed first: a multi-line description would
 * otherwise break the one-key-per-line grammar the skill provider parses.
 */
function yamlScalar(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim()
  return JSON.stringify(text)
}

/** Render the complete SKILL.md text for one skill. */
function buildSkillFile({ name: skillName, description, whenToUse, content }) {
  const lines = [
    '---',
    `name: ${skillName}`,
    `description: ${yamlScalar(description)}`
  ]
  if (typeof whenToUse === 'string' && whenToUse.trim().length > 0) {
    lines.push(`whenToUse: ${yamlScalar(whenToUse)}`)
  }
  lines.push('metadata:', `  forge: ${yamlScalar(FORGE_TAG)}`, '  version: 1', '---', '')
  lines.push(String(content ?? '').trimEnd(), '')
  return lines.join('\n')
}

/** Decode one quoted-or-literal front-matter scalar. */
function parseScalar(raw) {
  const text = String(raw ?? '').trim()
  if (text.length === 0) return ''
  if (text.startsWith('"')) {
    try {
      return JSON.parse(text)
    } catch {
      return text.replace(/^"|"$/g, '')
    }
  }
  if (text.startsWith("'") && text.endsWith("'") && text.length >= 2) return text.slice(1, -1)
  if (text === 'true') return true
  if (text === 'false') return false
  if (/^-?\d+$/.test(text)) return Number(text)
  return text
}

/**
 * Parse the subset of YAML front matter the skill provider accepts.
 *
 * A full YAML parser is not available to a dependency-free plugin, and the
 * files this plugin reads are either its own output or hand-edited variants of
 * it, so the supported subset is: `key: scalar`, plus one level of nested
 * mapping (used by `metadata`). Anything else is ignored rather than guessed.
 */
function parseSkillFile(raw) {
  const text = String(raw ?? '')
  const lines = text.split(/\r?\n/)
  if (lines.length === 0 || lines[0].trim() !== '---') return undefined
  let closing = -1
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === '---') {
      closing = index
      break
    }
  }
  if (closing < 0) return undefined
  const fields = Object.create(null)
  let nestedKey
  for (let index = 1; index < closing; index += 1) {
    const line = lines[index]
    if (line.trim().length === 0 || line.trim().startsWith('#')) continue
    const nested = /^\s+([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line)
    if (nested !== null && nestedKey !== undefined) {
      fields[nestedKey][nested[1]] = parseScalar(nested[2])
      continue
    }
    const entry = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line)
    if (entry === null) continue
    if (entry[2].trim().length === 0) {
      nestedKey = entry[1]
      fields[nestedKey] = Object.create(null)
      continue
    }
    nestedKey = undefined
    fields[entry[1]] = parseScalar(entry[2])
  }
  nestedKey = undefined
  const body = lines.slice(closing + 1).join('\n').trim()
  return {
    name: typeof fields.name === 'string' ? fields.name : undefined,
    description: typeof fields.description === 'string' ? fields.description : undefined,
    whenToUse: typeof fields.whenToUse === 'string' ? fields.whenToUse : undefined,
    metadata: fields.metadata !== undefined && typeof fields.metadata === 'object' ? fields.metadata : undefined,
    body
  }
}

/** Whether a parsed file was written by this plugin. */
function isForgeSkill(parsed) {
  return parsed?.metadata?.forge === FORGE_TAG
}

/* ------------------------------------------------------------------ *
 * Skill root scanning
 * ------------------------------------------------------------------ */

/** Read and parse one SKILL.md, returning `undefined` when it is absent or unusable. */
async function readSkillAt(file) {
  let raw
  try {
    raw = await readFile(file, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return undefined
    throw error
  }
  const parsed = parseSkillFile(raw)
  if (parsed === undefined) return undefined
  return { raw, parsed }
}

/**
 * Enumerate skills under the user root.
 * @param {string} root skill root directory
 * @param {{ includeBundled?: boolean }} options `includeBundled` also lists
 *   skills this plugin did not write (flat `.md` files included).
 */
async function scanSkills(root, options = {}) {
  const includeBundled = options.includeBundled === true
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return []
    throw error
  }
  const skills = []
  for (const entry of entries.slice().sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name.startsWith('.')) continue
    const isDir = entry.isDirectory() || entry.isSymbolicLink()
    const file = isDir ? join(root, entry.name, 'SKILL.md') : join(root, entry.name)
    if (!isDir && !entry.name.endsWith('.md')) continue
    const skill = await readSkillAt(file)
    if (skill === undefined) continue
    const parsed = skill.parsed
    if (!includeBundled && !isForgeSkill(parsed)) continue
    if (typeof parsed.name !== 'string' || typeof parsed.description !== 'string') continue
    let mtime
    try {
      const info = await stat(file)
      mtime = info.mtime.toISOString()
    } catch {
      mtime = undefined
    }
    skills.push({
      name: parsed.name,
      description: parsed.description,
      ...(parsed.whenToUse === undefined ? {} : { whenToUse: parsed.whenToUse }),
      path: file,
      bytes: Buffer.byteLength(skill.raw, 'utf8'),
      updatedAt: mtime,
      forged: isForgeSkill(parsed)
    })
  }
  return skills
}

/* ------------------------------------------------------------------ *
 * Conversation capture
 * ------------------------------------------------------------------ */

/** Flatten one message's content into plain text. */
function messageText(message) {
  if (message === undefined || message === null) return ''
  const content = message.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  const parts = []
  for (const block of content) {
    if (block === null || typeof block !== 'object') continue
    if (block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
  }
  return parts.join('\n')
}

/** Extract `{ text, toolNames }` from one raw session log. */
function digestFromEvents(events, options) {
  const includeToolResults = options.includeToolResults === true
  const lastTurns = options.lastTurns
  /** @type {{ user: string, parts: string[], tools: string[], resultTexts: string[] }[]} */
  const exchanges = []
  let current
  const toolNames = new Set()
  for (const event of events) {
    if (event === null || typeof event !== 'object') continue
    if (event.type === 'user/message') {
      const text = messageText(event.data?.message ?? event.data)
      current = { user: text, parts: [], tools: [], resultTexts: [] }
      exchanges.push(current)
      continue
    }
    if (current === undefined) continue
    if (event.type === 'assistant/message') {
      const text = messageText(event.data?.message)
      if (text.length > 0) current.parts.push(text)
      continue
    }
    if (event.type === 'tool/call') {
      const toolName = event.data?.name
      if (typeof toolName === 'string') {
        current.tools.push(toolName)
        toolNames.add(toolName)
      }
      continue
    }
    if (includeToolResults && event.type === 'tool/result') {
      const text = messageText(event.data?.message)
      if (text.length > 0) current.resultTexts.push(text)
    }
  }
  // `lastTurns` 0 / undefined means "every exchange in the log". The digest is
  // still bounded by maxChars, so an unbounded turn count cannot produce an
  // unbounded result — it only stops the count from silently dropping early turns.
  const selected = lastTurns > 0
    ? exchanges.slice(Math.max(0, exchanges.length - lastTurns))
    : exchanges
  const chunks = []
  let index = exchanges.length - selected.length + 1
  for (const exchange of selected) {
    const head = `[#${index} 用户]`
    index += 1
    chunks.push(head, exchange.user.trim() || '(空)')
    if (exchange.tools.length > 0) chunks.push(`[#${index - 1} 工具] ${exchange.tools.join(', ')}`)
    for (const text of exchange.resultTexts) chunks.push(`[#${index - 1} 工具结果]\n${text.trim()}`)
    const answer = exchange.parts.join('\n').trim()
    chunks.push(`[#${index - 1} 助手]`, answer || '(无文本回复)')
  }
  return { text: chunks.join('\n'), toolNames: [...toolNames], exchanges: selected.length }
}

/** Convert derived `Message[]` (live-session fallback) into the same digest shape. */
function digestFromMessages(messages, options) {
  const events = []
  for (const message of messages) {
    if (message?.role === 'user') events.push({ type: 'user/message', data: { message } })
    else if (message?.role === 'assistant') events.push({ type: 'assistant/message', data: { message } })
  }
  return digestFromEvents(events, options)
}

/**
 * Collect a bounded digest of one session.
 *
 * Read order is deliberate: `sessionQuery.readSession` sees the complete raw
 * log (including tool calls), `readSurface` sees only what the model currently
 * has in context, and the live store is the last resort for a session whose
 * persistence is unavailable. Each step is cheaper and narrower than the one
 * before it, so a failure degrades instead of failing the whole call.
 */
async function captureSession(ctx, sessionId, options = {}) {
  // Default is now EVERY exchange (0 = no limit). Callers that want a window can
  // still pass lastTurns; the 500 ceiling exists only to reject absurd input.
  const lastTurns = options.lastTurns === undefined
    ? DEFAULT_LAST_TURNS
    : normalizeInt(options.lastTurns, DEFAULT_LAST_TURNS, 0, 500)
  const maxChars = normalizeInt(options.maxChars, DEFAULT_TOOL_CHARS, 500, DEFAULT_CAPTURE_CHARS * 4)
  const includeToolResults = options.includeToolResults === true
  const query = ctx.get('sessionQuery', false)
  const captureOptions = { lastTurns, includeToolResults }

  if (query !== undefined && typeof query.readSession === 'function') {
    try {
      const snapshot = await query.readSession(sessionId)
      const digest = digestFromEvents(snapshot?.events ?? [], captureOptions)
      if (digest.text.trim().length > 0) {
        return finalizeDigest(digest, maxChars, 'session-log', sessionId, lastTurns)
      }
    } catch {
      /* fall through to the surface read */
    }
  }
  if (query !== undefined && typeof query.readSurface === 'function') {
    try {
      const surface = await query.readSurface(sessionId)
      const digest = digestFromEvents(surface?.events ?? [], captureOptions)
      if (digest.text.trim().length > 0) {
        return finalizeDigest(digest, maxChars, 'session-surface', sessionId, lastTurns)
      }
    } catch {
      /* fall through to the live store */
    }
  }
  const sessions = ctx.get('sessions', false)
  if (sessions !== undefined && typeof sessions.get === 'function') {
    const session = sessions.get(sessionId)
    if (session !== undefined && typeof session.deriveMessages === 'function') {
      const digest = digestFromMessages(session.deriveMessages(), captureOptions)
      if (digest.text.trim().length > 0) {
        return finalizeDigest(digest, maxChars, 'live-session', sessionId, lastTurns)
      }
    }
  }
  return {
    sessionId,
    digest: '',
    chars: 0,
    truncated: false,
    source: 'none',
    userTurns: 0,
    assistantTurns: 0,
    toolNames: []
  }
}

/** Clamp one digest to `maxChars`, keeping the newest tail (the useful part). */
function finalizeDigest(digest, maxChars, source, sessionId, lastTurns) {
  let text = digest.text
  let truncated = false
  if (text.length > maxChars) {
    text = '……（较早内容已省略）\n' + text.slice(text.length - maxChars)
    truncated = true
  }
  return {
    sessionId,
    digest: text,
    chars: text.length,
    truncated,
    source,
    userTurns: digest.exchanges ?? lastTurns,
    assistantTurns: digest.exchanges ?? lastTurns,
    toolNames: digest.toolNames ?? []
  }
}

/** Normalise an optional integer argument. */
function normalizeInt(value, fallback, min, max) {
  // `Number(null) === 0` and `Number('') === 0`, so an absent query parameter or a
  // cleared input box would otherwise clamp to `min` instead of using the fallback.
  // That made a missing ?limit= return exactly 1 session.
  if (value === undefined || value === null || value === '') return fallback
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

/* ------------------------------------------------------------------ *
 * Skill writes
 * ------------------------------------------------------------------ */

/** Write one skill, returning what actually landed on disk. */
async function saveSkill(input, config) {
  const root = skillRoot()
  const target = skillDir(input.name, root)
  const description = String(input.description ?? '').trim()
  const content = String(input.content ?? '').trim()
  if (description.length === 0) {
    const error = new Error('skill description must not be empty')
    error.code = 'SKILL_INVALID'
    throw error
  }
  if (content.length === 0) {
    const error = new Error('skill content must not be empty')
    error.code = 'SKILL_INVALID'
    throw error
  }
  const exists = existsSync(target.file)
  if (exists && input.overwrite !== true) {
    const error = new Error(
      `skill ${target.name} already exists at ${target.file}; pass overwrite:true (or pick another name) to replace it`
    )
    error.code = 'SKILL_EXISTS'
    throw error
  }
  await mkdir(target.dir, { recursive: true })
  if (exists) {
    try {
      await copyFile(target.file, `${target.file}.bak`)
    } catch {
      /* a failed backup must not block the requested overwrite */
    }
  }
  const text = buildSkillFile({
    name: target.name,
    description,
    whenToUse: input.whenToUse,
    content
  })
  await writeFile(target.file, text, 'utf8')
  return {
    ok: true,
    name: target.name,
    path: target.file,
    bytes: Buffer.byteLength(text, 'utf8'),
    overwritten: exists
  }
}

/** Move one forge-owned skill into `<root>/.trash`, keeping it recoverable. */
async function deleteSkill(input) {
  const root = skillRoot()
  const target = skillDir(input.name, root)
  const skill = await readSkillAt(target.file)
  if (skill === undefined) {
    const error = new Error(`skill ${target.name} was not found under ${root}`)
    error.code = 'SKILL_NOT_FOUND'
    throw error
  }
  if (!isForgeSkill(skill.parsed)) {
    const error = new Error(
      `skill ${target.name} was not written by skill-forge, so this plugin will not delete it; remove it manually`
    )
    error.code = 'SKILL_NOT_FORGE'
    throw error
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const trashDir = join(root, '.trash', `${target.name}-${stamp}`)
  await mkdir(dirname(trashDir), { recursive: true })
  try {
    await rename(target.dir, trashDir)
  } catch {
    // A cross-device rename would fail; copy then remove keeps the operation atomic enough.
    await mkdir(trashDir, { recursive: true })
    await copyFile(target.file, join(trashDir, 'SKILL.md'))
    await rm(target.dir, { recursive: true, force: true })
  }
  return { ok: true, name: target.name, trashPath: trashDir }
}

/* ------------------------------------------------------------------ *
 * Distillation (one-shot model call)
 * ------------------------------------------------------------------ */

const DISTILL_SYSTEM = [
  '你是技能蒸馏器。阅读用户提供的对话/资料，把它压缩成一个可复用的 Skill 定义。',
  '只输出一个 JSON 对象，不要 Markdown 围栏，不要解释。对象键：',
  'name：kebab-case 技能名（小写字母/数字/连字符，2-6 个词，能体现领域与动作）。',
  'description：一句话中文描述（不超过 120 字），说明这个技能能解决什么问题。',
  'whenToUse：触发场景，简述什么情况下应加载这个技能。',
  'content：Markdown 正文，必须包含四个二级标题小节：## 何时使用、## 执行步骤、## 验收清单、## 反例。',
  '内容要具体可执行：写真实命令、真实文件路径模式、真实判据；不要写「根据情况处理」这类空话。', '不要编造对话里没有出现的命令、参数或结论。'
].join('\n')

/** Extract the first JSON object from a model reply, tolerating code fences and prose. */
function extractJsonObject(text) {
  const source = String(text ?? '').replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '')
  const start = source.indexOf('{')
  const end = source.lastIndexOf('}')
  if (start < 0 || end <= start) return undefined
  try {
    return JSON.parse(source.slice(start, end + 1))
  } catch {
    return undefined
  }
}

/**
 * Whether the host can make one-shot model calls right now.
 *
 * `override` lets the panel choose which model forges the skill. A route the user
 * picked explicitly wins over the agent default, but the provider must still be
 * registered by some adapter — otherwise the call could only fail at dispatch.
 * `reasoningEffort` belongs to the default model, so it is dropped on override.
 */
function llmFace(ctx, override) {
  const llm = ctx.get('llm', false)
  const selection = ctx.get('agentDefaultModel', false)
  if (llm === undefined || typeof llm.stream !== 'function') return undefined

  let providerOverride
  let modelOverride
  if (override !== undefined && override !== null) {
    if (typeof override.provider === 'string' && override.provider.trim() !== '') providerOverride = override.provider.trim()
    if (typeof override.model === 'string' && override.model.trim() !== '') modelOverride = override.model.trim()
  }

  let current
  if (selection !== undefined && typeof selection.currentSelection === 'function') {
    try {
      current = selection.currentSelection()
    } catch {
      current = undefined
    }
  }

  const provider = providerOverride ?? current?.provider
  const model = modelOverride ?? current?.model
  if (typeof provider !== 'string' || typeof model !== 'string') return undefined
  if (provider === '') return undefined
  // An overridden route carries no inherited effort: it belonged to the default model.
  const reasoningEffort = providerOverride === undefined && modelOverride === undefined
    ? current?.reasoningEffort
    : undefined
  return { llm, provider, model, reasoningEffort, overridden: providerOverride !== undefined || modelOverride !== undefined }
}

/**
 * Enumerate every model the panel may choose: one entry per registered provider,
 * with the models that provider advertises.
 *
 * `listModels` is optional adapter surface, so a provider whose adapter cannot
 * enumerate degrades to "provider known, no model list" instead of failing the
 * whole directory — the panel then offers manual entry for that provider.
 */
async function listForgeModels(ctx) {
  const llm = ctx.get('llm', false)
  if (llm === undefined) return { default: undefined, providers: [] }
  const selection = ctx.get('agentDefaultModel', false)
  let fallback
  if (selection !== undefined && typeof selection.currentSelection === 'function') {
    try {
      const current = selection.currentSelection()
      if (current?.provider && current?.model) fallback = { provider: current.provider, model: current.model }
    } catch {
      /* the directory is still useful without a default */
    }
  }
  let providers = []
  if (typeof llm.listProviders === 'function') {
    try {
      providers = llm.listProviders()
    } catch {
      providers = []
    }
  }
  const entries = []
  for (const info of providers) {
    const id = typeof info?.id === 'string' ? info.id : undefined
    if (id === undefined) continue
    let models = []
    if (typeof llm.listModels === 'function') {
      try {
        const listed = await llm.listModels(id)
        models = (Array.isArray(listed) ? listed : [])
          .filter((m) => typeof m?.id === 'string')
          .map((m) => ({ id: m.id, name: typeof m.name === 'string' ? m.name : m.id }))
      } catch {
        models = []
      }
    }
    entries.push({
      id,
      name: typeof info?.name === 'string' ? info.name : id,
      models,
      enumerable: models.length > 0
    })
  }
  return { default: fallback, providers: entries }
}

/**
 * One one-shot model call, dispatched the way the agent loop dispatches it.
 *
 * `prepareCall` binds the adapter registration so a plugin that replaced the
 * mutable `llm.stream` property cannot break this call; the public method is
 * only the fallback for a runtime that exposes no `prepareCall`.
 */
async function callModel(face, prompt, signal) {
  const config = {
    provider: face.provider,
    model: face.model,
    ...(face.reasoningEffort === undefined ? {} : { reasoningEffort: face.reasoningEffort })
  }
  const request = {
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    system: DISTILL_SYSTEM,
    signal
  }
  // `prepareCall` returns a one-shot handle whose `config` must be carried into
  // the request; resolving it exactly once keeps header and dispatch bound to
  // the same adapter registration.
  let stream
  if (typeof face.llm.prepareCall === 'function') {
    const prepared = await face.llm.prepareCall(config, signal)
    stream = prepared.stream({ ...prepared.config, ...request })
  } else {
    stream = face.llm.stream({ ...config, ...request })
  }
  const parts = []
  for await (const chunk of stream) {
    if (chunk?.type === 'text-delta' && typeof chunk.text === 'string') parts.push(chunk.text)
    if (chunk?.type === 'finish' && chunk.reason && chunk.reason.kind !== 'stop') {
      const failure = chunk.reason.failure ?? chunk.reason
      const error = new Error(`model call failed: ${failure?.message ?? chunk.reason.kind}`)
      error.code = 'LLM_FAILED'
      throw error
    }
  }
  return parts.join('')
}

/** Turn a digest + model reply into a save-ready draft. */
function buildDraft(modelText, fallback) {
  const parsed = extractJsonObject(modelText)
  const name = normalizeName(parsed?.name, fallback.name)
  const description = preferText(parsed?.description, fallback.description)
  const whenToUse = preferText(parsed?.whenToUse, fallback.whenToUse)
  const content = preferText(parsed?.content, String(modelText ?? '').trim())
  return { name, description, whenToUse, content }
}

/** Coerce a model-supplied name into the kebab grammar, or fall back. */
function normalizeName(value, fallback) {
  const candidate = String(value ?? '').trim().toLowerCase()
  if (SKILL_NAME_PATTERN.test(candidate)) return candidate
  const slug = candidate
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
  if (SKILL_NAME_PATTERN.test(slug)) return slug
  return String(fallback ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `forged-skill-${Date.now().toString(36)}`
}

function preferText(value, fallback) {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  if (typeof fallback === 'string' && fallback.trim().length > 0) return fallback.trim()
  return ''
}

/* ------------------------------------------------------------------ *
 * Tool definitions
 * ------------------------------------------------------------------ */

/**
 * Build the four model-facing tools.
 * @param {object} ctx host context
 * @param {{ maxCaptureChars: number, toolCaptureChars: number }} config resolved plugin config
 */
function createTools(ctx, config) {
  const textOutput = (summary, value) => [{ type: 'text', text: `${summary}\n\n${JSON.stringify(value, null, 2)}` }]

  return [
    {
      name: TOOL_NAMES.context,
      description:
        'Capture a bounded digest of the current conversation (or of one named session) before distilling it into a reusable skill. Returns plain text plus the tool names that were used, capped by maxChars so a long history is not re-sent. Call this first, then write the skill with skill_forge_save.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          sessionId: {
            type: 'string',
            description: 'Session to capture. Omit for the current session.'
          },
          lastTurns: {
            type: 'integer',
            minimum: 0,
            maximum: 500,
            description: 'How many of the most recent user/assistant exchanges to keep. Omit or pass 0 to read the whole conversation; the returned digest is still bounded by maxChars.'
          },
          maxChars: {
            type: 'integer',
            minimum: 500,
            maximum: 80000,
            description: 'Hard cap on the returned digest length in characters. Defaults to the plugin toolCaptureChars value.'
          },
          includeToolResults: {
            type: 'boolean',
            description: 'Also include tool-result text. Off by default because it is usually the noisiest part.'
          }
        }
      },
      output: { schema: {}, render: (_args, value) => textOutput(`Captured ${value.chars} chars (${value.source}).`, value) },
      isConcurrencySafe: () => true,
      async execute(args, exec) {
        const sessionId = typeof args?.sessionId === 'string' && args.sessionId.trim().length > 0
          ? args.sessionId.trim()
          : String(exec?.agent?.id ?? '')
        if (sessionId.length === 0) throw new Error('skill_forge_context needs a session: no current agent and no sessionId given')
        const result = await captureSession(ctx, sessionId, {
          lastTurns: args?.lastTurns,
          maxChars: args?.maxChars ?? config.toolCaptureChars,
          includeToolResults: args?.includeToolResults === true
        })
        if (result.digest.length === 0) {
          throw new Error(
            `no readable messages in session ${sessionId}; pass a sessionId explicitly or paste the material into the panel instead`
          )
        }
        return result
      }
    },
    {
      name: TOOL_NAMES.save,
      description:
        'Write a reusable SKILL.md into the user skill root (~/.dsh/skills/<name>). The skill becomes available to later sessions, which is what saves tokens on a repeated question. Requires a kebab-case name, a one-sentence description and the Markdown body. Refuses to replace an existing skill unless overwrite is true.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'description', 'content'],
        properties: {
          name: {
            type: 'string',
            description: 'kebab-case skill name: lowercase letters, digits and single hyphens.'
          },
          description: {
            type: 'string',
            description: 'One sentence describing the problem this skill solves.'
          },
          whenToUse: {
            type: 'string',
            description: 'When the model should load this skill.'
          },
          content: {
            type: 'string',
            description: 'The Markdown body of SKILL.md (the instructions themselves).'
          },
          overwrite: {
            type: 'boolean',
            description: 'Replace an existing skill of the same name. Defaults to false.'
          }
        }
      },
      output: {
        schema: {},
        render: (_args, value) =>
          textOutput(`Saved skill ${value.name} (${value.bytes} bytes) to ${value.path}.`, value)
      },
      isConcurrencySafe: () => true,
      async execute(args) {
        const result = await saveSkill(args ?? {}, config)
        return {
          ...result,
          note: 'The skill catalog may take a moment to pick the new file up; the `skill` tool can be used again if the name is not listed yet.'
        }
      }
    },
    {
      name: TOOL_NAMES.list,
      description:
        'List the skills this plugin wrote into the user skill root, with their paths and sizes. Use it to check for a duplicate before saving, or to tell the user what is already forged.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          includeBundled: {
            type: 'boolean',
            description: 'Also list skills under the root that this plugin did not write. Defaults to false.'
          }
        }
      },
      output: { schema: {}, render: (_args, value) => textOutput(`${value.skills.length} skill(s) under ${value.root}.`, value) },
      isConcurrencySafe: () => true,
      async execute(args) {
        const root = skillRoot()
        const skills = await scanSkills(root, { includeBundled: args?.includeBundled === true })
        return { root, skills }
      }
    },
    {
      name: TOOL_NAMES.remove,
      description:
        'Delete a skill this plugin wrote, by moving it into <root>/.trash (recoverable). Skills written by anything else are refused.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['name'],
        properties: {
          name: { type: 'string', description: 'kebab-case skill name to delete.' }
        }
      },
      output: { schema: {}, render: (_args, value) => textOutput(`Moved ${value.name} to ${value.trashPath}.`, value) },
      isConcurrencySafe: () => true,
      async execute(args) {
        return deleteSkill(args ?? {})
      }
    }
  ]
}

/* ------------------------------------------------------------------ *
 * HTTP plumbing
 * ------------------------------------------------------------------ */

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'referrer-policy': 'no-referrer',
  'cache-control': 'no-store'
}

function writeJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, JSON_HEADERS)
  res.end(payload)
}

/** 127/8 predicate over four decimal octets. */
function isIPv4Loopback(value) {
  const parts = String(value).split('.')
  return parts.length === 4 && parts[0] === '127' && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

function isLoopbackAddress(address) {
  if (address === undefined) return false
  const normalized = String(address).toLowerCase()
  if (normalized === '::1') return true
  if (normalized.startsWith('::ffff:')) return isIPv4Loopback(normalized.slice(7))
  return isIPv4Loopback(normalized)
}

function isLoopbackHostname(hostname) {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  return isIPv4Loopback(hostname)
}

/**
 * Trust fence for every route in this family: a loopback socket address AND a
 * loopback Host header, no cross-site browser marker, and same-origin when an
 * Origin header is present. The socket address is authoritative; forwarding
 * headers are never trusted.
 */
function isLoopbackRequest(req) {
  if (!isLoopbackAddress(req.socket?.remoteAddress)) return false
  const host = req.headers?.host
  if (typeof host !== 'string') return false
  let hostUrl
  try {
    hostUrl = new URL(`http://${host}`)
  } catch {
    return false
  }
  if (!isLoopbackHostname(hostUrl.hostname)) return false
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = req.headers.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

/** Read a JSON request body with a hard byte cap. */
async function readJsonBody(req) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > MAX_BODY_BYTES) {
      const error = new Error(`request body exceeds ${MAX_BODY_BYTES} bytes`)
      error.code = 'BODY_TOO_LARGE'
      throw error
    }
    chunks.push(chunk)
  }
  if (total === 0) return undefined
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    const error = new Error('request body is not valid JSON')
    error.code = 'BAD_JSON'
    throw error
  }
}

/* ------------------------------------------------------------------ *
 * Route handlers
 * ------------------------------------------------------------------ */

/**
 * Build the whole `/api/dsh-skill-forge` route family.
 * @param {object} ctx host context
 * @param {{ maxCaptureChars: number, toolCaptureChars: number }} config
 */
function createRoutes(ctx, config) {
  const route = (path, method, handler) => ({
    kind: 'exact',
    path: `${ROUTE_PREFIX}/${path}`,
    handler: async (req, res) => {
      if (!isLoopbackRequest(req)) {
        writeJson(res, 403, { error: 'forbidden', message: 'this route family only answers loopback same-origin requests' })
        return
      }
      if (req.method !== method) {
        writeJson(res, 405, { error: 'method-not-allowed', message: `use ${method}` })
        return
      }
      try {
        await handler(req, res)
      } catch (error) {
        const code = typeof error?.code === 'string' ? error.code : 'INTERNAL'
        const status = code === 'BODY_TOO_LARGE'
          ? 413
          : code === 'BAD_JSON'
            ? 400
            : code === 'SKILL_NAME_INVALID' || code === 'SKILL_INVALID'
              ? 400
              : code === 'SKILL_EXISTS'
                ? 409
                : code === 'SKILL_NOT_FOUND'
                  ? 404
                  : code === 'SKILL_NOT_FORGE'
                    ? 403
                    : code === 'LLM_FAILED'
                      ? 502
                      : 500
        ctx.logger?.warn?.(`skill-forge route ${req.url} failed: ${error?.stack ?? error}`)
        writeJson(res, status, { error: code, message: String(error?.message ?? error) })
      }
    }
  })

  const queryOf = (req) => new URL(req.url ?? '/', 'http://localhost')
  const describeLlm = () => llmFace(ctx) !== undefined

  return [
    route('health', 'GET', async (req, res) => {
      const sessions = ctx.get('sessions', false)
      const query = ctx.get('sessionQuery', false)
      writeJson(res, 200, {
        ok: true,
        version,
        root: skillRoot(),
        hasLlm: describeLlm(),
        hasSessionQuery: (query !== undefined && typeof query.readSession === 'function') || (sessions !== undefined && typeof sessions.list === 'function')
      })
    }),

    route('list', 'GET', async (_req, res) => {
      const root = skillRoot()
      const skills = await scanSkills(root, { includeBundled: false })
      writeJson(res, 200, {
        root,
        skills: skills.map(({ forged, ...rest }) => rest)
      })
    }),

    route('read', 'GET', async (req, res) => {
      const nameParam = queryOf(req).searchParams.get('name') ?? ''
      const target = skillDir(nameParam, skillRoot())
      const skill = await readSkillAt(target.file)
      if (skill === undefined) {
        writeJson(res, 404, { error: 'SKILL_NOT_FOUND', message: `no SKILL.md at ${target.file}` })
        return
      }
      writeJson(res, 200, {
        name: skill.parsed.name ?? target.name,
        path: target.file,
        description: skill.parsed.description ?? '',
        ...(skill.parsed.whenToUse === undefined ? {} : { whenToUse: skill.parsed.whenToUse }),
        content: skill.parsed.body
      })
    }),

    route('save', 'POST', async (req, res) => {
      const body = await readJsonBody(req)
      if (body === null || typeof body !== 'object') {
        writeJson(res, 400, { error: 'BAD_JSON', message: 'expected a JSON object' })
        return
      }
      const result = await saveSkill(body, config)
      writeJson(res, 200, result)
    }),

    route('delete', 'POST', async (req, res) => {
      const body = await readJsonBody(req)
      if (body === null || typeof body !== 'object') {
        writeJson(res, 400, { error: 'BAD_JSON', message: 'expected a JSON object' })
        return
      }
      writeJson(res, 200, await deleteSkill(body))
    }),

    route('sessions', 'GET', async (req, res) => {
      // Grouping by workspace and showing subagent lineage needs the whole recent
      // corpus, not a 20-item page, so the default window is much wider than before.
      const limit = normalizeInt(queryOf(req).searchParams.get('limit'), 300, 1, 1000)

      /** Project one header into the shape the panel groups by. */
      const project = (header, titles) => {
        const id = String(header?.id ?? '')
        // `origin: 'subagent'` marks a session spawned by another agent;
        // `parentSession` is its owner. Both are part of the immutable header.
        const isSubagent = header?.origin === 'subagent'
        return {
          id,
          title: titles.get(id) ?? '',
          updatedAt: header?.createdAt ?? undefined,
          ...(header?.cwd === undefined ? {} : { cwd: header.cwd }),
          ...(header?.parentSession === undefined ? {} : { parentSession: String(header.parentSession) }),
          isSubagent,
          depth: typeof header?.delegationDepth === 'number' ? header.delegationDepth : (isSubagent ? 1 : 0)
        }
      }

      /** Count direct children per parent so a row can say "N 个子代理对话". */
      const withChildCounts = (rows) => {
        const counts = new Map()
        for (const row of rows) {
          if (row.parentSession !== undefined) {
            counts.set(row.parentSession, (counts.get(row.parentSession) ?? 0) + 1)
          }
        }
        return rows.map((row) => ({ ...row, childCount: counts.get(row.id) ?? 0 }))
      }

      const query = ctx.get('sessionQuery', false)
      if (query !== undefined && typeof query.listSessions === 'function') {
        const records = (await query.listSessions()).slice(0, limit)
        const ids = records.map((record) => record.header.id)
        const titles = new Map()
        if (typeof query.readTitleSnapshots === 'function' && ids.length > 0) {
          try {
            const observed = await query.readTitleSnapshots(ids)
            for (const entry of observed) {
              if (entry?.status === 'fulfilled' && typeof entry.value?.title?.title === 'string') {
                titles.set(String(entry.sessionId), entry.value.title.title)
              }
            }
          } catch {
            /* titles are cosmetic; the id is a usable fallback */
          }
        }
        writeJson(res, 200, {
          total: records.length,
          sessions: withChildCounts(records.map((record) => project(record.header, titles)))
        })
        return
      }
      const sessions = ctx.get('sessions', false)
      const live = sessions !== undefined && typeof sessions.list === 'function' ? sessions.list() : []
      const rows = live.slice(-limit).reverse().map((session) => project(session.header, new Map()))
      writeJson(res, 200, { total: rows.length, sessions: withChildCounts(rows) })
    }),

    route('models', 'GET', async (_req, res) => {
      const directory = await listForgeModels(ctx)
      writeJson(res, 200, {
        // `default` is what the panel shows as "follow the agent default"; it can be
        // absent when no default model is configured, in which case only the listed
        // providers are selectable.
        default: directory.default ?? null,
        providers: directory.providers
      })
    }),

    route('distill', 'POST', async (req, res) => {
      const body = await readJsonBody(req)
      if (body === null || typeof body !== 'object') {
        writeJson(res, 400, { error: 'BAD_JSON', message: 'expected a JSON object' })
        return
      }
      let digest
      if (typeof body.text === 'string' && body.text.trim().length > 0) {
        const cap = normalizeInt(body.maxChars, config.maxCaptureChars, 500, MAX_BODY_BYTES)
        const whole = body.text.trim()
        const truncated = whole.length > cap
        const text = truncated ? `……（已截断）\n${whole.slice(whole.length - cap)}` : whole
        digest = { digest: text, chars: text.length, truncated, source: 'text', sessionId: undefined }
      } else {
        if (typeof body.sessionId !== 'string' || body.sessionId.trim().length === 0) {
          writeJson(res, 400, { error: 'BAD_REQUEST', message: 'provide either text or a sessionId to distill' })
          return
        }
        const captured = await captureSession(ctx, body.sessionId.trim(), {
          lastTurns: body.lastTurns,
          maxChars: body.maxChars ?? config.maxCaptureChars,
          includeToolResults: false
        })
        if (captured.digest.length === 0) {
          writeJson(res, 400, {
            error: 'NO_CONTEXT',
            message: `session ${body.sessionId} has no readable messages to distil`
          })
          return
        }
        digest = captured
      }
      const digestMeta = { chars: digest.chars, truncated: digest.truncated, source: digest.source }
      // The panel may name the model that forges the skill; omitted = agent default.
      const face = llmFace(ctx, {
        provider: body.provider,
        model: body.model
      })
      if (face === undefined) {
        writeJson(res, 503, {
          error: 'llm-unavailable',
          message: 'the host has no usable default model, so automatic distillation is unavailable',
          digest: digestMeta
        })
        return
      }
      const prompt = [
        '以下是需要蒸馏的上下文：',
        '',
        digest.digest,
        '',
        `建议技能名（可改）：${normalizeName(body.name, '') || '（无）'}`,
        `建议描述（可改）：${typeof body.description === 'string' && body.description.trim() ? body.description.trim() : '（无）'}`
      ].join('\n')
      let modelText
      const signal = AbortSignal.timeout(DISTILL_TIMEOUT_MS)
      try {
        modelText = await callModel(face, prompt, signal)
      } catch (error) {
        if (error?.name === 'TimeoutError' || error?.code === 'ABORT_ERR') {
          writeJson(res, 504, { error: 'LLM_TIMEOUT', message: `distillation exceeded ${DISTILL_TIMEOUT_MS} ms`, digest: digestMeta })
          return
        }
        writeJson(res, 502, {
          error: typeof error?.code === 'string' ? error.code : 'LLM_FAILED',
          message: String(error?.message ?? error),
          digest: digestMeta
        })
        return
      }
      const draft = buildDraft(modelText, {
        name: body.name,
        description: body.description,
        whenToUse: ''
      })
      writeJson(res, 200, { draft, digest: digestMeta })
    })
  ]
}

/* ------------------------------------------------------------------ *
 * Plugin entry
 * ------------------------------------------------------------------ */

/**
 * Mount the Skill Forge tools and routes.
 * @param {object} ctx host context carrying `tools` and `webServer`
 * @param {{ maxCaptureChars?: number, toolCaptureChars?: number }} rawConfig row config
 */
export function apply(ctx, rawConfig = {}) {
  const config = {
    maxCaptureChars: normalizeInt(rawConfig.maxCaptureChars, DEFAULT_CAPTURE_CHARS, 1000, MAX_BODY_BYTES),
    toolCaptureChars: normalizeInt(rawConfig.toolCaptureChars, DEFAULT_TOOL_CHARS, 500, MAX_BODY_BYTES)
  }
  ctx.effect(() => {
    const disposers = []
    for (const definition of createTools(ctx, config)) {
      disposers.push(ctx.tools.register(definition))
    }
    return () => {
      for (const dispose of disposers.splice(0)) dispose()
    }
  }, 'skill-forge: tools')
  ctx.effect(() => {
    const routes = createRoutes(ctx, config)
    const disposers = routes.map((definition) => ctx.webServer.register(definition))
    ctx.logger?.info?.(`skill-forge: ${routes.length} routes mounted under ${ROUTE_PREFIX}`)
    return () => {
      for (const dispose of disposers.splice(0)) dispose()
    }
  }, 'skill-forge: routes')
}
