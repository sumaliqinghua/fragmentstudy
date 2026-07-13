import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Clock3, Feather, Gamepad2, Layers3, MessageCircleMore, Plus, Sparkles, Users, X } from 'lucide-react';
import {
  advanceWorkspaceSession,
  importTextProject,
  pauseWorkspaceSession,
  startWorkspaceSession,
  type LearningWorkspace,
} from '../domain/workspace.ts';
import { createDialogueBeat, createGalgameBeat } from '../domain/narrative.ts';
import type { LearningMode } from '../domain/session.ts';
import { decodeWorkspace, encodeWorkspace, WORKSPACE_STORAGE_KEY } from '../domain/workspaceStorage.ts';

type Screen = 'home' | 'import' | 'session' | 'paused';

const sampleText = '大脑更喜欢在低压力下建立熟悉感，而不是一次塞进所有内容。把材料切成小片段，会让开始这件事变得容易。今天只看几张也算一次真实的接触。隔天再次遇见时，理解会自然地长出来。';

export default function App() {
  const [workspace, setWorkspace] = useState<LearningWorkspace>(() => decodeWorkspace(localStorage.getItem(WORKSPACE_STORAGE_KEY)));
  const [screen, setScreen] = useState<Screen>(() => workspace.projects.length ? 'home' : 'import');
  const [title, setTitle] = useState('我的新主题');
  const [content, setContent] = useState('');

  useEffect(() => localStorage.setItem(WORKSPACE_STORAGE_KEY, encodeWorkspace(workspace)), [workspace]);

  const activeProject = useMemo(
    () => workspace.projects.find((item) => item.project.id === workspace.activeProjectId) ?? workspace.projects[workspace.projects.length - 1],
    [workspace],
  );
  const activeSession = workspace.sessions.find((session) => session.projectId === activeProject?.project.id && session.mode === (workspace.activeMode ?? 'card'))
    ?? workspace.sessions.find((session) => session.projectId === activeProject?.project.id && session.mode === 'card');
  const activeFragment = activeProject?.fragments.find((fragment) => fragment.id === activeSession?.itemIds[activeSession.cursor]);

  const importProject = () => {
    const next = importTextProject(workspace, {
      title: title.trim() || '未命名主题',
      content,
      now: new Date().toISOString(),
      createId: () => crypto.randomUUID(),
    });
    setWorkspace(next);
    setScreen('home');
    setContent('');
  };

  const begin = (projectId: string, mode: LearningMode = 'card') => {
    setWorkspace((current) => startWorkspaceSession(current, { projectId, mode, now: new Date().toISOString(), createId: () => crypto.randomUUID() }));
    setScreen('session');
  };

  const advance = (kind: 'seen' | 'later' = 'seen') => {
    if (!activeProject || !activeSession) return;
    if (activeSession.cursor === activeSession.itemIds.length - 1) {
      setWorkspace((current) => pauseWorkspaceSession(current, { projectId: activeProject.project.id, mode: activeSession.mode, now: new Date().toISOString() }));
      setScreen('paused');
      return;
    }
    setWorkspace((current) => advanceWorkspaceSession(current, { projectId: activeProject.project.id, mode: activeSession.mode, kind, now: new Date().toISOString() }));
  };

  const pause = () => {
    if (!activeProject) return;
    setWorkspace((current) => pauseWorkspaceSession(current, { projectId: activeProject.project.id, mode: activeSession?.mode, now: new Date().toISOString() }));
    setScreen('paused');
  };

  return (
    <main className="v2-shell">
      <div className="v2-grain" />
      <div className="v2-orb v2-orb-one" />
      <div className="v2-orb v2-orb-two" />
      {screen === 'import' && (
        <ImportScreen
          title={title}
          content={content}
          hasProjects={workspace.projects.length > 0}
          onTitleChange={setTitle}
          onContentChange={setContent}
          onSample={() => { setTitle('低压力学习'); setContent(sampleText); }}
          onBack={() => setScreen('home')}
          onImport={importProject}
        />
      )}
      {screen === 'home' && (
        <HomeScreen workspace={workspace} onAdd={() => setScreen('import')} onBegin={begin} />
      )}
      {screen === 'session' && activeProject && activeSession && activeFragment && (
        <SessionScreen
          mode={activeSession.mode}
          title={activeProject.project.title}
          content={activeFragment.content}
          source={activeFragment.sourceText}
          cursor={activeSession.cursor}
          total={activeSession.itemIds.length}
          onAdvance={() => advance('seen')}
          onLater={() => advance('later')}
          onPause={pause}
        />
      )}
      {screen === 'paused' && activeProject && activeSession && (
        <PausedScreen title={activeProject.project.title} mode={activeSession.mode} touched={activeSession.cursor + 1} onHome={() => setScreen('home')} onContinue={() => begin(activeProject.project.id, activeSession.mode)} onChooseMode={(mode) => begin(activeProject.project.id, mode)} />
      )}
    </main>
  );
}

function Brand() {
  return <div className="v2-brand"><span><Feather size={17} /></span><strong>拾光</strong><small>FRAGMENT</small></div>;
}

function ImportScreen(props: { title: string; content: string; hasProjects: boolean; onTitleChange: (value: string) => void; onContentChange: (value: string) => void; onSample: () => void; onBack: () => void; onImport: () => void }) {
  return <section className="v2-page v2-import-page">
    <header className="v2-topbar">{props.hasProjects ? <button className="v2-icon-button" onClick={props.onBack} aria-label="返回"><ArrowLeft /></button> : <Brand />}<span className="v2-step">新建独立项目</span></header>
    <div className="v2-import-copy"><p className="v2-kicker">从任何材料开始</p><h1>先放进来，<br /><em>我们帮你拆小。</em></h1><p>每份素材默认成为独立项目，不会和其他内容混在一起。</p></div>
    <div className="v2-paper-panel">
      <label>这份材料关于什么？<input value={props.title} onChange={(event) => props.onTitleChange(event.target.value)} placeholder="例如：行为经济学" /></label>
      <label>粘贴学习材料<textarea value={props.content} onChange={(event) => props.onContentChange(event.target.value)} placeholder="文章、课堂笔记、视频字幕……" /></label>
      <div className="v2-import-actions"><button className="v2-text-button" onClick={props.onSample}><Sparkles size={15} />试试示例</button><span>{props.content.trim().length} 字</span></div>
    </div>
    <button className="v2-primary" disabled={!props.content.trim()} onClick={props.onImport}>拆成几小口 <ArrowRight size={18} /></button>
    <p className="v2-reassure"><Check size={14} /> 不设截止日期，也不要求一次学完</p>
  </section>;
}

function HomeScreen({ workspace, onAdd, onBegin }: { workspace: LearningWorkspace; onAdd: () => void; onBegin: (projectId: string, mode?: LearningMode) => void }) {
  return <section className="v2-page">
    <header className="v2-topbar"><Brand /><button className="v2-icon-button" onClick={onAdd} aria-label="添加项目"><Plus /></button></header>
    <div className="v2-home-title"><p className="v2-kicker">今天想靠近什么？</p><h1>随便学一点，<br /><em>就很好。</em></h1></div>
    <div className="v2-project-list">
      {workspace.projects.map((item, index) => {
        const session = workspace.sessions.find((candidate) => candidate.projectId === item.project.id && candidate.mode === (workspace.activeProjectId === item.project.id ? workspace.activeMode : 'card'))
          ?? workspace.sessions.find((candidate) => candidate.projectId === item.project.id && candidate.mode === 'card')!;
        return <article className="v2-project-card" key={item.project.id} style={{ '--delay': `${index * 70}ms` } as React.CSSProperties}>
          <div className="v2-card-label"><span>{session.status === 'ready' ? '还没开始' : '可以续上'}</span><span><Clock3 size={13} />约 2 分钟</span></div>
          <h2>{item.project.title}</h2>
          <p>{item.materials[0].content}</p>
          <div className="v2-card-foot"><div><Layers3 size={16} /><span>{modeLabel(session.mode)} · 接触过 {session.cursor + (session.status === 'ready' ? 0 : 1)} 个片段</span></div><button onClick={() => onBegin(item.project.id, session.mode)}>{session.status === 'ready' ? '开始学一点' : '继续学一点'}<ChevronRight size={18} /></button></div>
        </article>;
      })}
    </div>
    <button className="v2-add-card" onClick={onAdd}><Plus size={18} />放入另一份材料</button>
    <div className="v2-coming"><MessageCircleMore size={18} /><span>群聊与 Galgame 会在一次 Session 结束后出现，不会打断当前内容。</span></div>
  </section>;
}

function SessionScreen(props: { mode: LearningMode; title: string; content: string; source: string; cursor: number; total: number; onAdvance: () => void; onLater: () => void; onPause: () => void }) {
  const isLast = props.cursor === props.total - 1;
  if (props.mode === 'dialogue') return <DialogueSession {...props} isLast={isLast} />;
  if (props.mode === 'galgame') return <GalgameSession {...props} isLast={isLast} />;
  return <section className="v2-page v2-session-page">
    <header className="v2-session-header"><button className="v2-icon-button" onClick={props.onPause} aria-label="今天先到这里"><X /></button><div><span>{props.title}</span><small>卡片 · 可以随时停</small></div><span className="v2-count">{props.cursor + 1}<i>/</i>{props.total}</span></header>
    <div className="v2-dots" aria-label={`第 ${props.cursor + 1} 个，共 ${props.total} 个`}>{Array.from({ length: props.total }, (_, index) => <span key={index} className={index <= props.cursor ? 'active' : ''} />)}</div>
    <article className="v2-learning-card">
      <span className="v2-card-number">FRAGMENT {String(props.cursor + 1).padStart(2, '0')}</span>
      <BookOpen className="v2-watermark" />
      <p>{props.content}</p>
      <details><summary>看看原文位置</summary><blockquote>{props.source}</blockquote></details>
    </article>
    <div className="v2-session-actions"><button className="v2-secondary" onClick={props.onLater}>以后再看</button><button className="v2-primary" onClick={props.onAdvance}>{isLast ? '今天先到这' : '下一张'}<ArrowRight size={18} /></button></div>
    <button className="v2-quiet-exit" onClick={props.onPause}>现在停下也完全没关系</button>
  </section>;
}

function PausedScreen({ title, mode, touched, onHome, onContinue, onChooseMode }: { title: string; mode: LearningMode; touched: number; onHome: () => void; onContinue: () => void; onChooseMode: (mode: LearningMode) => void }) {
  return <section className="v2-page v2-paused-page"><Brand /><div className="v2-bloom"><span><Feather /></span></div><p className="v2-kicker">轻轻收个尾</p><h1>今天和「{title}」<br /><em>碰了个面。</em></h1><p>用{modeLabel(mode)}接触了 {touched} 个片段。没有待办，也没有落后；想回来时，位置还在。</p><div className="v2-mode-picker"><span>下次想换种方式？</span><div>{mode !== 'card' && <button onClick={() => onChooseMode('card')}><BookOpen />卡片</button>}{mode !== 'dialogue' && <button onClick={() => onChooseMode('dialogue')}><Users />群聊</button>}{mode !== 'galgame' && <button onClick={() => onChooseMode('galgame')}><Gamepad2 />Galgame</button>}</div></div><div className="v2-paused-actions"><button className="v2-primary" onClick={onHome}>回到项目 <ArrowRight size={18} /></button><button className="v2-text-button" onClick={onContinue}>继续当前方式</button></div></section>;
}

function DialogueSession(props: Parameters<typeof SessionScreen>[0] & { isLast: boolean }) {
  const beat = createDialogueBeat({ content: props.content, index: props.cursor });
  return <section className="v2-page v2-dialogue-page"><header className="v2-session-header"><button className="v2-icon-button" onClick={props.onPause} aria-label="今天先到这里"><X /></button><div><span>{props.title} · 小群</span><small>群聊 · 只聊当前项目</small></div><span className="v2-count">{props.cursor + 1}<i>/</i>{props.total}</span></header><div className="v2-chat-stage"><div className="v2-chat-note">3 位伙伴正在把同一个知识点说人话</div><div className="v2-chat-row"><span className="v2-avatar">{beat.avatar}</span><div><small>{beat.speaker} · {beat.role}</small><p>{beat.message}</p></div></div><div className="v2-chat-row self"><span className="v2-avatar">我</span><div><small>你可以只看，不必回复</small><p>嗯，我先记住这一小点。</p></div></div><details><summary>对应的原文</summary><blockquote>{beat.sourceText}</blockquote></details></div><div className="v2-session-actions"><button className="v2-secondary" onClick={props.onLater}>先潜水</button><button className="v2-primary" onClick={props.onAdvance}>{props.isLast ? '先聊到这' : '看看新消息'}<ArrowRight size={18} /></button></div></section>;
}

function GalgameSession(props: Parameters<typeof SessionScreen>[0] & { isLast: boolean }) {
  const beat = createGalgameBeat({ content: props.content, index: props.cursor });
  return <section className="v2-page v2-galgame-page"><header className="v2-session-header"><button className="v2-icon-button" onClick={props.onPause} aria-label="保存并离开"><X /></button><div><span>{props.title}</span><small>Galgame · 线索 {props.cursor + 1}</small></div><span className="v2-count">{props.cursor + 1}<i>/</i>{props.total}</span></header><div className="v2-scene"><div className="v2-moon" /><span className="v2-scene-name">{beat.scene}</span><div className="v2-character" aria-hidden="true"><span>{beat.character.slice(0, 1)}</span></div><div className="v2-dialogue-box"><strong>{beat.character}</strong><p>{beat.dialogue}</p><details><summary>查看素材线索</summary><blockquote>{beat.sourceText}</blockquote></details></div></div><div className="v2-session-actions"><button className="v2-secondary" onClick={props.onLater}>暂存线索</button><button className="v2-primary" onClick={props.onAdvance}>{props.isLast ? '保存进度' : '继续故事'}<ArrowRight size={18} /></button></div></section>;
}

function modeLabel(mode: LearningMode) {
  return mode === 'card' ? '卡片' : mode === 'dialogue' ? '群聊' : 'Galgame';
}
