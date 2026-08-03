"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent as ReactDragEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CURATOR_MAX_TURNS,
  CURATOR_MESSAGE_MAX_CODE_POINTS,
  type CuratorPageContext,
  type CuratorState,
  type CuratorTurnResponse,
} from "../../contracts/curator";
import type { MvpRecommendationRequest } from "../../contracts/mvp-search";
import { prepareCuratorImage, type PreparedCuratorImage } from "./curator-image";
import { MoaAvatar } from "./moa-avatar";
import styles from "./curator-widget.module.css";

type ChatMessage = {
  id: number;
  role: "assistant" | "user";
  text: string;
  image?: {
    previewUrl: string;
    name: string;
  };
};

const STARTERS = [
  "오늘 기분부터 찾아볼래",
  "뭘 보고 싶은지 모르겠어",
  "사진 느낌과 비슷한 작품",
  "여러 조건을 같이 상담할래",
] as const;

const PROVIDER_LABELS: Record<string, string> = {
  NETFLIX: "넷플릭스",
  TVING: "티빙",
  DISNEY_PLUS: "디즈니+",
  WAVVE: "웨이브",
  WATCHA: "왓챠",
  COUPANG_PLAY: "쿠팡플레이",
};

const COMPANION_LABELS: Record<string, string> = {
  ALONE: "혼자 시청",
  PARTNER: "연인과 시청",
  FRIENDS: "친구들과 시청",
  FAMILY: "성인 가족과 시청",
  WITH_CHILDREN: "아이와 시청",
  ANY: "동반자 제한 없음",
};

const CHILD_RATING_LABELS: Record<string, string> = {
  ALL: "전체 관람가까지",
  "7": "7세 관람가까지",
  "12": "12세 관람가까지",
  "15": "15세 관람가까지",
};

function pageContext(pathname: string): CuratorPageContext {
  if (pathname === "/") return "HOME";
  if (pathname.startsWith("/choice")) return "CHOICE";
  if (pathname.startsWith("/prompt")) return "PROMPT";
  if (pathname.startsWith("/recommendations/")) return "RESULT";
  return "OTHER";
}

function greeting(context: CuratorPageContext): string {
  switch (context) {
    case "CHOICE":
      return "조건을 고르기 어렵다면 제가 한 가지씩 물어볼게요. 지금 떠오르는 상황이나 기분부터 편하게 말해 주세요.";
    case "PROMPT":
      return "한 문장으로 정리하기 어려운 마음도 괜찮아요. 대화하면서 보고 싶은 느낌을 같이 찾아볼게요.";
    case "RESULT":
      return "방금 추천과 다른 방향이 필요하신가요? 지금 달라진 기분이나 조건부터 알려주세요.";
    default:
      return "안녕하세요, AI 큐레이터 모아예요. 뭘 원하는지 몰라도 괜찮아요. 대화나 사진에서 단서를 찾아 추천 조건으로 정리해 드릴게요.";
  }
}

function isCuratorResponse(value: unknown): value is CuratorTurnResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as { action?: unknown; state?: unknown; reply?: unknown };
  return (
    (response.action === "ASK" || response.action === "READY") &&
    typeof response.reply === "string" &&
    typeof response.state === "object" &&
    response.state !== null
  );
}

function cloneInitialState(): CuratorState {
  return {
    turn: 0,
    resolvedTopics: [],
    preferenceSummary: "",
    searchQuery: "",
    choice: {
      selectedProviders: [],
      companions: ["ANY"],
      moods: [],
      desiredGenres: [],
      companionAvoidGenres: [],
      requiredGenres: [],
      excludedGenres: [],
      mediaType: "ANY",
      naturalRuntimeMinutes: null,
      childAgeRatingLimit: null,
      originPreference: "ANY",
    },
  };
}

function conditionLabels(state: CuratorState): string[] {
  const labels: string[] = [];
  const choice = state.choice;
  labels.push(...choice.moods);
  labels.push(...choice.desiredGenres.map((genre) => `${genre} 선호`));
  labels.push(...choice.requiredGenres.map((genre) => `${genre} 필수`));
  labels.push(...choice.excludedGenres.map((genre) => `${genre} 제외`));
  labels.push(
    ...choice.companionAvoidGenres.map((genre) => `동반자 기준 ${genre} 제외`),
  );
  labels.push(COMPANION_LABELS[choice.companions[0]] ?? "동반자 제한 없음");
  if (choice.childAgeRatingLimit !== null) {
    labels.push(CHILD_RATING_LABELS[choice.childAgeRatingLimit]);
  }
  labels.push(
    choice.naturalRuntimeMinutes === null
      ? "시간 제한 없음"
      : `${choice.naturalRuntimeMinutes}분 이내`,
  );
  labels.push(
    choice.mediaType === "MOVIE"
      ? "영화"
      : choice.mediaType === "SERIES"
        ? "시리즈"
        : "영화·시리즈 모두",
  );
  labels.push(
    choice.originPreference === "KR"
      ? "한국 작품"
      : choice.originPreference === "NON_KR"
        ? "해외 작품"
        : "제작 국가 제한 없음",
  );
  if (choice.selectedProviders.length === 0) {
    labels.push("OTT 제한 없음");
  } else {
    labels.push(
      ...choice.selectedProviders.map(
        (provider) => PROVIDER_LABELS[provider] ?? provider,
      ),
    );
  }
  return [...new Set(labels)];
}

export function CuratorRoot() {
  const pathname = usePathname();
  const router = useRouter();
  const context = useMemo(() => pageContext(pathname), [pathname]);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<CuratorState>(() => cloneInitialState());
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [handoff, setHandoff] = useState<MvpRecommendationRequest | null>(null);
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<PreparedCuratorImage | null>(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isStartingRecommendation, setIsStartingRecommendation] = useState(false);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const panelRef = useRef<HTMLElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const recommendButtonRef = useRef<HTMLButtonElement | null>(null);
  const attachButtonRef = useRef<HTMLButtonElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const recommendationRequest = useRef<AbortController | null>(null);
  const attachmentRef = useRef<PreparedCuratorImage | null>(null);
  const messageImageUrls = useRef(new Set<string>());
  const imagePreparationSequence = useRef(0);

  const nextMessage = useCallback(
    (
      role: ChatMessage["role"],
      text: string,
      image?: ChatMessage["image"],
    ) => {
      sequence.current += 1;
      return { id: sequence.current, role, text, image } satisfies ChatMessage;
    },
    [],
  );

  const revokeMessageImages = useCallback(() => {
    for (const previewUrl of messageImageUrls.current) {
      URL.revokeObjectURL(previewUrl);
    }
    messageImageUrls.current.clear();
  }, []);

  const clearAttachment = useCallback(() => {
    imagePreparationSequence.current += 1;
    setIsPreparingImage(false);
    setAttachment((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const keepSubmittedAttachmentInMessage = useCallback(
    (submitted: PreparedCuratorImage | null) => {
      if (!submitted) return;
      messageImageUrls.current.add(submitted.previewUrl);
      attachmentRef.current = null;
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [],
  );

  const openFilePicker = useCallback(() => {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  }, []);

  const openPanel = useCallback(() => {
    setMessages((current) =>
      current.length > 0 ? current : [nextMessage("assistant", greeting(context))],
    );
    setIsOpen(true);
  }, [context, nextMessage]);

  const closePanel = useCallback(() => {
    activeRequest.current?.abort();
    activeRequest.current = null;
    recommendationRequest.current?.abort();
    recommendationRequest.current = null;
    imagePreparationSequence.current += 1;
    setIsDraggingImage(false);
    setIsSending(false);
    setIsPreparingImage(false);
    setIsStartingRecommendation(false);
    setIsOpen(false);
    window.setTimeout(() => launcherRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    attachmentRef.current = attachment;
  }, [attachment]);

  useEffect(() => {
    return () => {
      imagePreparationSequence.current += 1;
      activeRequest.current?.abort();
      recommendationRequest.current?.abort();
      if (attachmentRef.current) {
        URL.revokeObjectURL(attachmentRef.current.previewUrl);
      }
      revokeMessageImages();
    };
  }, [revokeMessageImages]);

  useEffect(() => {
    if (!isOpen) return;
    const shells = [...document.querySelectorAll<HTMLElement>("[data-app-shell='true']")];
    const previousOverflow = document.body.style.overflow;
    const previousInert = shells.map((shell) => shell.inert);
    shells.forEach((shell) => {
      shell.inert = true;
    });
    document.body.style.overflow = "hidden";
    return () => {
      shells.forEach((shell, index) => {
        shell.inert = previousInert[index];
      });
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, pathname]);

  useEffect(() => {
    if (!isOpen) return;
    window.setTimeout(() => {
      const panel = panelRef.current;
      const active = document.activeElement as HTMLElement | null;
      if (
        panel?.contains(active) &&
        active?.getAttribute("disabled") === null
      ) {
        return;
      }
      const target =
        handoff && recommendButtonRef.current && !recommendButtonRef.current.disabled
          ? recommendButtonRef.current
          : inputRef.current && !inputRef.current.disabled
            ? inputRef.current
            : panel;
      target?.focus();
    }, 0);
  }, [handoff, isOpen, isPreparingImage, isSending, isStartingRecommendation, state.turn]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, quickReplies, isSending]);

  function trapFocus(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closePanel();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = [
      ...panelRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([tabindex='-1']), [href], [tabindex]:not([tabindex='-1'])",
      ),
    ].filter((element) => !element.hidden);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function imageInteractionBlocked(): boolean {
    return (
      isSending ||
      isPreparingImage ||
      isStartingRecommendation ||
      state.turn >= CURATOR_MAX_TURNS
    );
  }

  async function prepareImageFile(file: File) {
    if (imageInteractionBlocked()) {
      setError("지금은 새 이미지를 첨부할 수 없어요.");
      return;
    }
    const preparationId = imagePreparationSequence.current + 1;
    imagePreparationSequence.current = preparationId;
    setError("");
    setIsPreparingImage(true);
    let focusAfterPreparation: "attach" | "input" = "attach";
    try {
      const prepared = await prepareCuratorImage(file);
      if (preparationId !== imagePreparationSequence.current) {
        URL.revokeObjectURL(prepared.previewUrl);
        return;
      }
      setAttachment((current) => {
        if (current) URL.revokeObjectURL(current.previewUrl);
        return prepared;
      });
      focusAfterPreparation = "input";
    } catch (selectionError) {
      if (preparationId !== imagePreparationSequence.current) return;
      setError(
        selectionError instanceof Error
          ? selectionError.message
          : "이미지를 준비하지 못했어요.",
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      if (preparationId === imagePreparationSequence.current) {
        setIsPreparingImage(false);
        window.setTimeout(() => {
          if (!panelRef.current) return;
          const target =
            focusAfterPreparation === "input"
              ? inputRef.current
              : attachButtonRef.current;
          target?.focus();
        }, 0);
      }
    }
  }

  function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void prepareImageFile(file);
  }

  function pasteImage(event: ReactClipboardEvent<HTMLElement>) {
    const imageItem = [...event.clipboardData.items].find(
      (item) => item.kind === "file" && item.type.startsWith("image/"),
    );
    const file =
      imageItem?.getAsFile() ??
      [...event.clipboardData.files].find((item) =>
        item.type.startsWith("image/"),
      );
    if (!file) return;
    event.preventDefault();
    void prepareImageFile(file);
  }

  function dragImage(event: ReactDragEvent<HTMLElement>) {
    if (![...event.dataTransfer.types].includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!imageInteractionBlocked()) setIsDraggingImage(true);
  }

  function leaveImageDropZone(event: ReactDragEvent<HTMLElement>) {
    const nextTarget = event.relatedTarget;
    if (
      nextTarget instanceof Node &&
      event.currentTarget.contains(nextTarget)
    ) {
      return;
    }
    setIsDraggingImage(false);
  }

  function dropImage(event: ReactDragEvent<HTMLElement>) {
    if (![...event.dataTransfer.types].includes("Files")) return;
    event.preventDefault();
    setIsDraggingImage(false);
    const files = [...event.dataTransfer.files];
    const file =
      files.find((item) => item.type.startsWith("image/")) ?? files[0];
    if (file) void prepareImageFile(file);
  }

  async function sendTurn(text: string) {
    const normalized = Array.from(text.trim())
      .slice(0, CURATOR_MESSAGE_MAX_CODE_POINTS)
      .join("");
    if (
      (!normalized && !attachment) ||
      activeRequest.current ||
      recommendationRequest.current ||
      isStartingRecommendation ||
      state.turn >= CURATOR_MAX_TURNS
    ) {
      return;
    }
    const controller = new AbortController();
    activeRequest.current = controller;
    const submittedAttachment = attachment;
    const submittedImage = submittedAttachment !== null;
    const submittedImagePayload = submittedAttachment?.payload ?? null;
    const optimisticMessage = nextMessage(
      "user",
      normalized || "이 사진의 색감과 분위기에서 추천 단서를 찾아줘.",
      submittedAttachment
        ? {
            previewUrl: submittedAttachment.previewUrl,
            name: submittedAttachment.name,
          }
        : undefined,
    );
    setError("");
    setIsSending(true);
    setHandoff(null);
    setQuickReplies([]);
    setMessages((current) => [
      ...current,
      optimisticMessage,
    ]);
    try {
      const response = await fetch("/api/curator/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pageContext: context,
          message: normalized || null,
          image: submittedImagePayload,
          state,
        }),
        signal: controller.signal,
      });
      const result = (await response.json().catch(() => null)) as
        | CuratorTurnResponse
        | { error?: string }
        | null;
      if (!response.ok || !isCuratorResponse(result)) {
        throw new Error(
          (result && "error" in result && result.error) ||
            "모아가 조건을 정리하지 못했어요. 잠시 후 다시 시도해 주세요.",
        );
      }
      if (controller.signal.aborted) {
        setMessages((current) =>
          current.filter((message) => message.id !== optimisticMessage.id),
        );
        return;
      }
      setState(result.state);
      setQuickReplies(result.quickReplies);
      setHandoff(result.handoff);
      const fallbackNotice = result.fallbackUsed
        ? submittedImage
          ? ""
          : "AI 해석이 잠시 어려워 안전한 질문 방식으로 이어갈게요. "
        : "";
      setMessages((current) => [
        ...current,
        nextMessage("assistant", `${fallbackNotice}${result.reply}`),
      ]);
      setInput("");
      keepSubmittedAttachmentInMessage(submittedAttachment);
    } catch (requestError) {
      if (
        controller.signal.aborted ||
        (requestError instanceof DOMException && requestError.name === "AbortError")
      ) {
        setMessages((current) =>
          current.filter((message) => message.id !== optimisticMessage.id),
        );
        return;
      }
      setMessages((current) =>
        current.filter((message) => message.id !== optimisticMessage.id),
      );
      setError(
        requestError instanceof Error
          ? requestError.message
          : "모아와 대화를 이어가지 못했어요.",
      );
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setIsSending(false);
      }
    }
  }

  function submitMessage(event: FormEvent) {
    event.preventDefault();
    void sendTurn(input);
  }

  async function startRecommendation() {
    if (!handoff || recommendationRequest.current) return;
    const controller = new AbortController();
    recommendationRequest.current = controller;
    setError("");
    setIsStartingRecommendation(true);
    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(handoff),
        signal: controller.signal,
      });
      const result = (await response.json().catch(() => null)) as
        | { runId?: string; error?: string }
        | null;
      if (!response.ok || !result?.runId) {
        throw new Error(
          result?.error || "추천을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.",
        );
      }
      if (controller.signal.aborted) return;
      clearAttachment();
      revokeMessageImages();
      setState(cloneInitialState());
      setQuickReplies([]);
      setHandoff(null);
      setInput("");
      setMessages([]);
      setIsOpen(false);
      router.push(`/recommendations/${encodeURIComponent(result.runId)}`);
    } catch (recommendationError) {
      if (
        recommendationError instanceof DOMException &&
        recommendationError.name === "AbortError"
      ) {
        return;
      }
      setError(
        recommendationError instanceof Error
          ? recommendationError.message
          : "추천을 시작하지 못했어요.",
      );
    } finally {
      if (recommendationRequest.current === controller) {
        recommendationRequest.current = null;
        setIsStartingRecommendation(false);
      }
    }
  }

  function resetConversation() {
    activeRequest.current?.abort();
    activeRequest.current = null;
    recommendationRequest.current?.abort();
    recommendationRequest.current = null;
    clearAttachment();
    revokeMessageImages();
    setIsDraggingImage(false);
    setState(cloneInitialState());
    setQuickReplies([]);
    setHandoff(null);
    setInput("");
    setError("");
    setIsSending(false);
    setIsStartingRecommendation(false);
    setMessages([nextMessage("assistant", greeting(context))]);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  const labels = conditionLabels(state);
  const isChoicePage = pathname.startsWith("/choice");
  const canSend =
    !isSending &&
    !isPreparingImage &&
    !isStartingRecommendation &&
    state.turn < CURATOR_MAX_TURNS &&
    (input.trim().length > 0 || attachment !== null);

  return (
    <div className={`${styles.root} ${isChoicePage ? styles.choiceOffset : ""}`}>
      {isOpen ? (
        <>
          <button
            type="button"
            className={styles.backdrop}
            tabIndex={-1}
            aria-label="모아 대화창 닫기"
            onClick={closePanel}
          />
          <section
            ref={panelRef}
            id="moa-curator-dialog"
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="moa-curator-title"
            tabIndex={-1}
            onKeyDown={trapFocus}
            onPaste={pasteImage}
            onDragEnter={dragImage}
            onDragOver={dragImage}
            onDragLeave={leaveImageDropZone}
            onDrop={dropImage}
          >
            {isDraggingImage ? (
              <div className={styles.dropOverlay} role="status">
                <strong>이미지를 여기에 놓아주세요</strong>
                <span>JPG, PNG, WebP 한 장을 첨부할 수 있어요</span>
              </div>
            ) : null}
            <header className={styles.header}>
              <MoaAvatar compact />
              <div className={styles.headerCopy}>
                <div className={styles.titleRow}>
                  <h2 id="moa-curator-title">AI 큐레이터 모아</h2>
                  <span>Beta</span>
                </div>
                <p>대화로 취향을 발견해요 · {state.turn}/{CURATOR_MAX_TURNS}턴</p>
              </div>
              <button
                type="button"
                className={styles.headerButton}
                onClick={resetConversation}
                aria-label="모아 대화 처음부터 시작"
              >
                ↻
              </button>
              <button
                type="button"
                className={styles.headerButton}
                onClick={closePanel}
                aria-label="모아 대화창 닫기"
              >
                ×
              </button>
            </header>

            <div className={styles.privacyNotice}>
              전체 대화 기록은 탭 메모리에만 두고, 보낸 발화·사진은 조건 분석에
              일시 전송해요. 추천 Run·Trace·DB에는 저장하지 않아요.
            </div>

            <div className={styles.messages} aria-live="polite" aria-busy={isSending}>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`${styles.messageRow} ${
                    message.role === "user" ? styles.messageRowUser : ""
                  }`}
                >
                  {message.role === "assistant" ? <MoaAvatar compact /> : null}
                  <div
                    className={`${styles.bubble} ${
                      message.role === "user" ? styles.userBubble : styles.assistantBubble
                    }`}
                  >
                    {message.image ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element -- transient local object URL */}
                        <img
                          className={styles.messageImage}
                          src={message.image.previewUrl}
                          alt={`전송한 이미지: ${message.image.name}`}
                        />
                      </>
                    ) : null}
                    <p className={styles.bubbleText}>
                      <span className={styles.srOnly}>
                        {message.role === "assistant" ? "모아: " : "나: "}
                      </span>
                      {message.text}
                    </p>
                  </div>
                </div>
              ))}

              {messages.length === 1 && state.turn === 0 ? (
                <div className={styles.starters} aria-label="대화 시작 예시">
                  {STARTERS.map((starter) => (
                    <button
                      type="button"
                      key={starter}
                      disabled={isPreparingImage || isStartingRecommendation}
                      onClick={() => {
                        if (starter.startsWith("사진")) openFilePicker();
                        else void sendTurn(starter);
                      }}
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              ) : null}

              {isSending ? (
                <div className={styles.typing} role="status">
                  <span /> <span /> <span />
                  <b>모아가 취향을 정리하고 있어요</b>
                </div>
              ) : null}

              {quickReplies.length > 0 &&
              !isSending &&
              state.turn < CURATOR_MAX_TURNS ? (
                <div className={styles.quickReplies} aria-label="빠른 답변">
                  {quickReplies.map((reply) => (
                    <button type="button" key={reply} onClick={() => void sendTurn(reply)}>
                      {reply}
                    </button>
                  ))}
                </div>
              ) : null}

              {state.turn > 0 && (state.preferenceSummary || labels.length > 0) ? (
                <section className={styles.conditionCard} aria-label="모아가 정리한 조건">
                  <div>
                    <strong>이렇게 이해했어요</strong>
                    <span>아래 조건과 추천 방향을 기존 추천에 사용해요</span>
                  </div>
                  {state.preferenceSummary ? <p>{state.preferenceSummary}</p> : null}
                  {state.searchQuery ? (
                    <p className={styles.searchDirection}>
                      <span>추천 방향</span> {state.searchQuery}
                    </p>
                  ) : null}
                  {labels.length > 0 ? (
                    <ul>
                      {labels.map((label) => (
                        <li key={label}>{label}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ) : null}

              {handoff ? (
                <button
                  ref={recommendButtonRef}
                  type="button"
                  className={styles.recommendButton}
                  onClick={() => void startRecommendation()}
                  disabled={isStartingRecommendation}
                >
                  {isStartingRecommendation ? "추천을 찾는 중…" : "이 조건으로 추천받기 →"}
                </button>
              ) : null}
              {state.turn >= CURATOR_MAX_TURNS && !handoff ? (
                <button
                  type="button"
                  className={styles.recommendButton}
                  onClick={resetConversation}
                >
                  대화 다시 시작하기
                </button>
              ) : null}
              <div ref={messagesEndRef} />
            </div>

            <footer className={styles.composerArea}>
              {attachment ? (
                <div
                  className={styles.imagePreview}
                  role="status"
                  aria-label="이미지 첨부 준비 완료"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- transient local object URL */}
                  <img src={attachment.previewUrl} alt="첨부 이미지 미리보기" />
                  <div className={styles.imagePreviewCopy}>
                    <strong>이미지 준비 완료</strong>
                    <span title={attachment.name}>{attachment.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={clearAttachment}
                    disabled={
                      isSending || isPreparingImage || isStartingRecommendation
                    }
                    aria-label="첨부 이미지 삭제"
                  >
                    ×
                  </button>
                </div>
              ) : null}
              {error ? <p className={styles.error} role="alert">{error}</p> : null}
              <form className={styles.composer} onSubmit={submitMessage}>
                <input
                  ref={fileInputRef}
                  className={styles.fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  tabIndex={-1}
                  onChange={selectImage}
                  aria-label="추천 분위기 이미지 첨부"
                />
                <button
                  ref={attachButtonRef}
                  type="button"
                  className={styles.attachButton}
                  onClick={openFilePicker}
                  disabled={
                    isSending ||
                    isPreparingImage ||
                    isStartingRecommendation ||
                    state.turn >= CURATOR_MAX_TURNS
                  }
                  aria-label="이미지 첨부"
                  title="이미지 첨부"
                >
                  {isPreparingImage ? "…" : "+"}
                </button>
                <textarea
                  ref={inputRef}
                  value={input}
                  rows={1}
                  placeholder="오늘 있었던 일이나 원하는 느낌을 말해 주세요"
                  aria-label="모아에게 보낼 메시지"
                  onChange={(event) =>
                    setInput(
                      Array.from(event.target.value)
                        .slice(0, CURATOR_MESSAGE_MAX_CODE_POINTS)
                        .join(""),
                    )
                  }
                  onKeyDown={(event) => {
                    if (
                      event.nativeEvent.isComposing ||
                      event.nativeEvent.keyCode === 229
                    ) {
                      return;
                    }
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      if (canSend) void sendTurn(input);
                    }
                  }}
                  readOnly={isSending || isStartingRecommendation}
                  disabled={state.turn >= CURATOR_MAX_TURNS}
                />
                <button
                  type="submit"
                  className={styles.sendButton}
                  disabled={!canSend}
                  aria-label="모아에게 메시지 보내기"
                >
                  ↑
                </button>
              </form>
              <p className={styles.imagePolicy}>
                + 버튼 외에도 이미지를 붙여넣거나 끌어다 놓을 수 있어요. 인물의 신원이나
                민감한 특성은 추론하지 않아요.
              </p>
            </footer>
          </section>
        </>
      ) : null}

      <button
        ref={launcherRef}
        type="button"
        className={styles.launcher}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="moa-curator-dialog"
        aria-hidden={isOpen}
        disabled={isOpen}
        onClick={openPanel}
      >
        <MoaAvatar />
        <span className={styles.launcherLabel}>
          <strong>뭘 볼지 고민되나요?</strong>
          모아에게 물어보기
        </span>
      </button>
    </div>
  );
}
