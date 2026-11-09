import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronRight, Copy, ExternalLink, ListChecks, MessageSquare, Mic, Paperclip, X } from './icons';
import './overlays.css';

const invitationText =
  "邀请你一起体验 Tabbit，用 AI 开启更轻松的浏览。此文案仅用于个性化首页 2.0 交互演示，未生成真实邀请链接。";
const voiceExamples = [
  "帮我规划一个轻松的周末",
  "找一些简洁的首页设计灵感",
  "解释一下浏览器里的 AI 能做什么",
];

export function DemoDialog({
  kind,
  promotion,
  onClose,
  query = "",
  mode = "对话",
  model = "Auto",
  reference = "",
  attachments = [],
  taskContext = null,
  skill = null,
  returnLabel = '返回首页',
  onUsePrompt,
}) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const [copyStatus, setCopyStatus] = useState("idle");

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    setCopyStatus("idle");
  }, [kind]);

  async function copyInvitation() {
    try {
      await navigator.clipboard.writeText(invitationText);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }

  function selectVoiceExample(text) {
    onUsePrompt?.(text);
    onClose();
  }

  const resultContent = mode === "任务"
    ? {
        Icon: ListChecks,
        label: "任务规划",
        text: "在这里可以描述目标并继续安排任务。当前演示未连接真实 AI，也不会执行实际操作。",
      }
    : {
        Icon: MessageSquare,
        label: "AI 对话",
        text: "在这里可以围绕你的问题继续交流。当前演示未连接真实 AI，暂时不会生成回答；你也可以打开网页搜索继续探索。",
      };
  const ResultIcon = resultContent.Icon;

  return (
    <dialog
      ref={dialogRef}
      className={`demo-dialog overlay-dialog-${kind}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="overlay-dialog-inner">
        <button
          className={promotion ? "promotion-close overlay-promotion-close" : "overlay-icon-button overlay-dialog-close"}
          type="button"
          aria-label="关闭弹窗"
          onClick={onClose}
          autoFocus
        >
          <X size={promotion ? 16 : 19} />
        </button>

        {promotion && (
          <>
            <img
              className="overlay-promotion-image"
              src={promotion.image}
              alt={promotion.alt}
            />
            <div className={`overlay-dialog-content${kind === "invite" ? "" : " overlay-promotion-content"}`}>
              <span className="overlay-eyebrow">{promotion.dialogEyebrow}</span>
              <h2 id={titleId}>{promotion.title}</h2>
              <p className="overlay-dialog-description">
                {promotion.description.replace(/[。.]$/, "")}。
              </p>
              <div className="overlay-promotion-detail">{kind === "invite" ? invitationText : promotion.dialogNote}</div>
              {kind === "invite" ? <>
              <button
                className="overlay-primary-button"
                type="button"
                onClick={copyInvitation}
              >
                {copyStatus === "copied" ? (
                  <Check size={17} />
                ) : (
                  <Copy size={16} />
                )}
                {copyStatus === "copied" ? "邀请文案已复制" : "复制邀请文案"}
              </button>
              <span className="overlay-copy-status" aria-live="polite">
                {copyStatus === "copied"
                  ? "复制成功，可以粘贴使用。"
                  : copyStatus === "error"
                    ? "复制失败，请手动选择并复制上方文案。"
                    : ""}
              </span>
              </> : <button className="overlay-primary-button" type="button" onClick={onClose}>
                知道了
              </button>}
            </div>
          </>
        )}

        {kind === "voice" && (
          <div className="overlay-dialog-content overlay-voice-content">
            <div className="overlay-dialog-symbol">
              <Mic size={25} strokeWidth={1.8} />
            </div>
            <h2 id={titleId}>把想法，说出来</h2>
            <p className="overlay-dialog-description">
              选择一句示例，体验语音内容填入搜索框的效果。
            </p>
            <p className="overlay-demo-note">
              示例体验 · 不使用麦克风，不录制声音
            </p>
            <div className="overlay-voice-examples">
              {voiceExamples.map((text) => (
                <button
                  type="button"
                  className="overlay-example-button"
                  key={text}
                  onClick={() => selectVoiceExample(text)}
                >
                  <span>{text}</span>
                  <ChevronRight size={17} />
                </button>
              ))}
            </div>
          </div>
        )}

        {kind === "result" && (
          <div className="overlay-dialog-content overlay-result-content">
            <div className="overlay-dialog-symbol">
              <ResultIcon size={25} strokeWidth={1.8} />
            </div>
            <span className="overlay-eyebrow">
              {mode} · {resultContent.label}
            </span>
            <h2 id={titleId}>演示结果</h2>
            {skill && <p className="overlay-dialog-description">已使用妙招：{skill.name}</p>}
            <div className="overlay-query">
              <span>你的输入</span>
              <p>{query || "还没有输入内容"}</p>
            </div>
            <p className="overlay-selected-model">
              已选模型：<strong>{model}</strong>
            </p>
            {mode === "任务" && taskContext && (
              <div className="overlay-query">
                <span>任务挂载</span>
                <p>项目：{taskContext.project || "未选择"}<br />
                  {taskContext.runLocation === "local" && <>审批策略：{taskContext.approvalPolicy || "完全访问"}<br /></>}
                  运行位置：{taskContext.runLocation === "cloud" ? "在云端" : "在你的计算机上"}</p>
                <small>仅展示本次选择，尚未连接执行环境或授予文件访问权限。</small>
              </div>
            )}
            {reference.trim() && (
              <div className="overlay-query overlay-reference">
                <span>参考内容</span>
                <p>{reference}</p>
              </div>
            )}
            {attachments.length > 0 && (
              <div className="overlay-query overlay-attachments">
                <span>附件 · {attachments.length}</span>
                <ul>
                  {attachments.map((file) => (
                    <li key={file.id}>
                      <Paperclip size={14} aria-hidden="true" />
                      <span>{file.name}</span>
                    </li>
                  ))}
                </ul>
                <small>文件仅在本地预览，尚未上传或交给模型处理。</small>
              </div>
            )}
            <p className="overlay-dialog-description">{resultContent.text}</p>
            <p className="overlay-demo-note">未连接真实 AI / 文件服务</p>
            <a
              className="overlay-primary-button"
              href={`https://www.google.com/search?q=${encodeURIComponent(query)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              搜索网页
              <ExternalLink size={16} />
            </a>
            <button
              className="overlay-secondary-button"
              type="button"
              onClick={onClose}
            >
              {returnLabel}
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
