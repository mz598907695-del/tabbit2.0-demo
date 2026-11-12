import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, Copy, Paperclip } from '../icons';
import { Composer } from '../Composer';
import { initialConversationMessages, makeConversationExchange, readConversationMessages, writeConversationMessages } from './workspace-conversation-data';
import './workspace-conversation.css';

function browserStorage() {
  try { return window.localStorage; } catch { return undefined; }
}

function DemoCodeBlock({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  async function copyCode() {
    try { await navigator.clipboard.writeText(children); } catch { /* Demo only. */ }
  }

  return <div className={`aiw-markdown-code-block${collapsed ? ' is-collapsed' : ''}`}>
    <div className="aiw-markdown-code-header">
      <span className="aiw-markdown-code-language">代码</span>
      <div className="aiw-markdown-code-actions">
        <button className="aiw-markdown-code-copy" type="button" onClick={copyCode} aria-label="复制代码" title="复制代码"><Copy size={14}/></button>
        <button className="aiw-markdown-code-toggle" type="button" onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? '展开代码' : '收起代码'} aria-expanded={!collapsed}><ChevronDown size={14}/></button>
      </div>
    </div>
    {!collapsed && <pre><code>{children}</code></pre>}
  </div>;
}

function AssistantDemo({ type }) {
  if (type === 'tool-comparison') return <>
    <p>这三种方式不是三个平行入口，而是同一件事在不同阶段的承载方式。</p>
    <h3>怎么区分</h3>
    <table><thead><tr><th>方式</th><th>适合场景</th><th>核心价值</th></tr></thead><tbody><tr><td>对话</td><td>快速提问、探索想法</td><td>马上获得反馈</td></tr><tr><td>项目</td><td>长期主题、持续协作</td><td>保留共同上下文</td></tr><tr><td>任务</td><td>目标明确、需要交付</td><td>持续推进并检查结果</td></tr></tbody></table>
    <blockquote>用户首先想到的是“我要完成什么”，而不是“我要使用哪种 AI 工具”。</blockquote>
    <p>因此入口应从用户目标出发，再让系统自然决定使用 <code>对话</code>、<code>项目</code> 还是 <code>任务</code>。</p>
  </>;
  if (type === 'tool-entry') return <>
    <p>建议只保留一个“开始”入口，提交内容后再渐进展示工作方式：</p>
    <ol><li>默认进入对话，降低第一次使用成本。</li><li>识别到长期资料时，提示加入项目。</li><li>识别到明确交付或时间要求时，建议转为任务。</li></ol>
    <DemoCodeBlock>{`用户输入\n  ↓\n先开始对话\n  ├─ 需要长期上下文 → 项目\n  └─ 需要持续执行   → 任务`}</DemoCodeBlock>
    <p>这样既保留了能力差异，也不会让用户在开始之前先理解产品结构。</p>
  </>;
  if (type === 'home-structure') return <>
    <p>可以，把首页收敛成三个层级，让用户先行动，再回到上下文，最后查看结果。</p>
    <h3>1. 开始工作</h3>
    <ul><li>新建对话作为主入口。</li><li>妙招和定时任务放在次级入口。</li></ul>
    <h3>2. 继续工作</h3>
    <p>优先展示置顶项目、最近对话和还没处理完的任务。</p>
    <blockquote>首页只回答一个问题：我现在最值得继续做什么？</blockquote>
    <h3>3. 查看结果</h3>
    <table><thead><tr><th>区域</th><th>保留内容</th><th>处理方式</th></tr></thead><tbody><tr><td>主入口</td><td>新建对话</td><td>持续可见</td></tr><tr><td>进行中</td><td>项目、对话、任务</td><td>按最近使用排序</td></tr><tr><td>结果</td><td>文件、卡片、看板</td><td>集中到输出物</td></tr></tbody></table>
    <p>视觉优先级可以理解为 <code>继续工作 &gt; 开始工作 &gt; 查看结果</code>。</p>
  </>;
  if (type === 'mobile-layout') return <>
    <p>移动端建议采用渐进披露，只保留当前任务需要的信息：</p>
    <ol><li>首屏只放输入框和最近一项工作。</li><li>横向滑动查看其他进行中的内容。</li><li>输出物和历史记录收进二级页面。</li></ol>
    <DemoCodeBlock>{`首页\n├─ 继续上次工作\n├─ 开始新对话\n└─ 更多内容`}</DemoCodeBlock>
    <p>这样首屏不会拥挤，同时仍然保留完整的信息路径。</p>
  </>;
  return null;
}

function ConversationSession({ conversation, active, blocked, onOverlayChange }) {
  const composerRef = useRef(null);
  const scrollRef = useRef(null);
  const [messages, setMessages] = useState(() => readConversationMessages(conversation, browserStorage()));
  const sequence = useRef(0);
  const reportOverlay = useCallback(open => { if (active && !blocked) onOverlayChange?.(open); }, [active, blocked, onOverlayChange]);

  useEffect(() => {
    if (conversation.id === 'chat-4' && !messages.some(message => message.demo === 'tool-comparison')) {
      setMessages(initialConversationMessages(conversation));
    }
  }, [conversation, messages]);
  useEffect(() => { writeConversationMessages(conversation.id, messages, browserStorage()); }, [conversation.id, messages]);
  useLayoutEffect(() => {
    if (!active || blocked) composerRef.current?.closeOverlays();
  }, [active, blocked]);
  useLayoutEffect(() => {
    if (active && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [active, messages.length]);

  function sendMessage(payload) {
    const exchangeId = `${conversation.id}-${Date.now()}-${++sequence.current}`;
    setMessages(previous => [...previous, ...makeConversationExchange(payload, exchangeId)]);
    composerRef.current?.startNew();
    setVoiceNotice(false);
  }

  return <section className="aiw-conversation" hidden={!active} inert={!active || undefined} aria-label={conversation.title}>
    <div ref={scrollRef} className="aiw-conversation-scroll" tabIndex={0} aria-label="对话记录">
      <div className="aiw-conversation-messages" role="log" aria-live={active ? 'polite' : 'off'} aria-relevant="additions">
        {messages.map(message => <article key={message.id} className={`aiw-conversation-message is-${message.role}`}>
          {message.role === 'assistant' && <div className="aiw-conversation-author"><img src="/personalized-home-2-0/asset/icons/tabbit-solid.svg" alt=""/><span>Tabbit</span><small>示例</small></div>}
          <div className="aiw-conversation-message-body">
            {!!message.attachments.length && <div className="aiw-conversation-attachments">{message.attachments.map((file, index) => <span key={`${file.name}-${index}`}><Paperclip size={14}/>{file.name}</span>)}</div>}
            {message.reference && <blockquote>{message.reference}</blockquote>}
            {message.text && (message.role === 'assistant' && message.demo ? <AssistantDemo type={message.demo}/> : <p>{message.text}</p>)}
          </div>
        </article>)}
      </div>
    </div>
    <div className="aiw-conversation-footer">
      <Composer ref={composerRef} onSubmit={sendMessage} onOverlayChange={reportOverlay}/>
    </div>
  </section>;
}

// Do not key this host by the selected conversation. Each visited conversation
// keeps its own Composer mounted, including drafts, files, models and task state.
// Hidden sessions close their portals and are inert; the homepage Composer is
// independent and is never moved, reset or remounted by this component.
export default function WorkspaceConversation({ conversations, conversationId, active = true, blocked = false, onOverlayChange }) {
  const [visitedIds, setVisitedIds] = useState(() => conversationId ? [conversationId] : []);
  useEffect(() => {
    if (conversationId) setVisitedIds(previous => previous.includes(conversationId) ? previous : [...previous, conversationId]);
  }, [conversationId]);
  const renderedIds = conversationId && !visitedIds.includes(conversationId) ? [...visitedIds, conversationId] : visitedIds;
  return <div className="aiw-page-host aiw-conversation-host" hidden={!active} inert={!active || blocked || undefined}>
    {renderedIds.map(id => {
      const conversation = conversations.find(item => item.id === id);
      return conversation ? <ConversationSession key={id} conversation={conversation} active={active && id === conversationId} blocked={blocked} onOverlayChange={onOverlayChange}/> : null;
    })}
  </div>;
}
