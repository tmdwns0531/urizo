import type {
  CuratorChoiceDraft,
  CuratorConversationInterpreter,
  CuratorModelOutput,
  CuratorTopic,
  ResolvedCuratorTurnRequest,
} from "../../contracts/curator";
import type {
  Mood,
} from "../../contracts/mvp-search";
import {
  addResolvedTopic,
  hasCuratorMediaRevisionSignal,
  parseCuratorChildAgeRating,
  sanitizeCuratorText,
} from "./conversation";
import { parseNaturalInput } from "../recommendation/natural-language/parse-natural-input";

const PROVIDER_LABELS = {
  NETFLIX: "넷플릭스",
  TVING: "티빙",
  DISNEY_PLUS: "디즈니+",
  WAVVE: "웨이브",
  WATCHA: "왓챠",
  COUPANG_PLAY: "쿠팡플레이",
} as const;

const UNCERTAIN_PATTERN =
  /(모르겠|모르겟|아무 생각|뭘 봐야|뭐 봐야|추천해\s*줘|골라\s*줘)/;
const HARD_DAY_PATTERN =
  /(힘든|지친|피곤|안\s*좋은\s*일|속상|우울|짜증|화가|스트레스|회사.*일)/;

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function limitedMoods(values: readonly Mood[]): Mood[] {
  return unique(values).slice(0, 4);
}

function addTopic(
  topics: readonly CuratorTopic[],
  topic: CuratorTopic,
): CuratorTopic[] {
  return addResolvedTopic(topics, topic);
}

function mergeMessage(
  request: ResolvedCuratorTurnRequest,
): { choice: CuratorChoiceDraft; topics: CuratorTopic[]; intent: string } {
  const choice: CuratorChoiceDraft = {
    ...request.state.choice,
    selectedProviders: [...request.state.choice.selectedProviders],
    companions: [...request.state.choice.companions],
    moods: [...request.state.choice.moods],
    desiredGenres: [...request.state.choice.desiredGenres],
    companionAvoidGenres: [...request.state.choice.companionAvoidGenres],
    requiredGenres: [...request.state.choice.requiredGenres],
    excludedGenres: [...request.state.choice.excludedGenres],
  };
  let topics = [...request.state.resolvedTopics];
  let intent = request.state.searchQuery;
  const message = request.message?.trim() ?? "";

  if (message) {
    const parsed = parseNaturalInput(message);
    if (parsed.companion.source === "EXPLICIT") {
      choice.companions = [parsed.companion.value];
      if (parsed.companion.value !== "WITH_CHILDREN") {
        choice.childAgeRatingLimit = null;
      }
      if (
        parsed.companion.value !== "PARTNER" &&
        parsed.companion.value !== "FRIENDS"
      ) {
        choice.companionAvoidGenres = [];
      }
      topics = addTopic(topics, "COMPANION");
    }
    if (parsed.providers.source === "EXPLICIT") {
      choice.selectedProviders = [...parsed.providers.value];
      topics = addTopic(topics, "PROVIDER");
    }
    if (parsed.runtimeMinutes.source === "EXPLICIT") {
      choice.naturalRuntimeMinutes = parsed.runtimeMinutes.value;
      topics = addTopic(topics, "RUNTIME");
    }
    if (parsed.moods.source === "EXPLICIT") {
      choice.moods = limitedMoods([...choice.moods, ...parsed.moods.value]);
      topics = addTopic(topics, "MOOD");
    }
    if (
      parsed.desiredGenres.source === "EXPLICIT" ||
      parsed.requiredGenres.source === "EXPLICIT" ||
      parsed.excludedGenres.source === "EXPLICIT"
    ) {
      choice.desiredGenres = unique([
        ...choice.desiredGenres,
        ...parsed.desiredGenres.value,
      ]);
      choice.requiredGenres = unique([
        ...choice.requiredGenres,
        ...parsed.requiredGenres.value,
      ]);
      choice.excludedGenres = unique([
        ...choice.excludedGenres,
        ...parsed.excludedGenres.value,
      ]).filter((genre) => !choice.requiredGenres.includes(genre));
      topics = addTopic(topics, "GENRE");
    }
    if (parsed.origin.source === "EXPLICIT") {
      choice.originPreference = parsed.origin.value;
      topics = addTopic(topics, "ORIGIN");
    }
    if (
      parsed.mediaType.source === "EXPLICIT" &&
      hasCuratorMediaRevisionSignal(message)
    ) {
      choice.mediaType = parsed.mediaType.value;
      topics = addTopic(topics, "MEDIA_TYPE");
    }

    const rating = parseCuratorChildAgeRating(message);
    if (choice.companions[0] === "WITH_CHILDREN" && rating !== null) {
      choice.childAgeRatingLimit = rating;
      topics = addTopic(topics, "CHILD_AGE");
    }

    if (HARD_DAY_PATTERN.test(message)) {
      choice.moods = limitedMoods([...choice.moods, "따뜻한", "잔잔한"]);
      topics = addTopic(topics, "MOOD");
      intent = "힘든 하루 뒤 마음을 달래고 부담 없이 위로받을 수 있는 작품";
    } else if (/(마음.*편|편해|편안)/.test(message)) {
      choice.moods = limitedMoods([...choice.moods, "따뜻한", "잔잔한"]);
      topics = addTopic(topics, "MOOD");
      intent = "마음이 편안해지는 따뜻하고 잔잔한 작품";
    } else if (/(신나|화려|통쾌)/.test(message)) {
      choice.moods = limitedMoods([...choice.moods, "밝은", "자극적인"]);
      topics = addTopic(topics, "MOOD");
      intent = "신나고 화려해서 기분을 전환할 수 있는 작품";
    } else if (!UNCERTAIN_PATTERN.test(message)) {
      intent = request.state.searchQuery;
    }
  }

  return { choice, topics, intent };
}

function choiceSummary(choice: CuratorChoiceDraft, intent: string): string {
  const parts: string[] = [];
  if (choice.moods.length > 0) parts.push(choice.moods.join("·"));
  if (choice.desiredGenres.length > 0) {
    parts.push(`${choice.desiredGenres.join("·")} 장르`);
  }
  if (choice.requiredGenres.length > 0) {
    parts.push(`${choice.requiredGenres.join("·")} 필수`);
  }
  if (choice.excludedGenres.length > 0) {
    parts.push(`${choice.excludedGenres.join("·")} 제외`);
  }
  if (choice.naturalRuntimeMinutes !== null) {
    parts.push(`${choice.naturalRuntimeMinutes}분 이내`);
  }
  if (choice.selectedProviders.length > 0) {
    parts.push(
      choice.selectedProviders.map((provider) => PROVIDER_LABELS[provider]).join("·"),
    );
  }
  const structured = parts.join(", ");
  return sanitizeCuratorText(structured || intent, 240);
}

function ask(
  topic: CuratorTopic,
  reply: string,
  quickReplies: string[],
  choice: CuratorChoiceDraft,
  topics: CuratorTopic[],
  intent: string,
): CuratorModelOutput {
  return {
    action: "ASK",
    reply,
    questionTopic: topic,
    quickReplies,
    resolvedTopics: topics,
    preferenceSummary: choiceSummary(choice, intent),
    searchQuery: intent,
    choice,
  };
}

function ready(
  choice: CuratorChoiceDraft,
  topics: CuratorTopic[],
  intent: string,
  safetyNote = "",
): CuratorModelOutput {
  const searchQuery =
    sanitizeCuratorText(intent, 140) ||
    "지금 부담 없이 편안하게 볼 수 있는 작품";
  return {
    action: "READY",
    reply: `${safetyNote}좋아요. 지금까지 나눈 이야기를 추천 조건으로 정리했어요. 확인한 뒤 추천을 시작해 주세요.`,
    questionTopic: null,
    quickReplies: [],
    resolvedTopics: topics,
    preferenceSummary: choiceSummary(choice, searchQuery),
    searchQuery,
    choice,
  };
}

export class DeterministicCuratorInterpreter
  implements CuratorConversationInterpreter
{
  async interpret(
    request: ResolvedCuratorTurnRequest,
  ): Promise<CuratorModelOutput> {
    const merged = mergeMessage(request);
    let { choice, topics } = merged;
    const { intent } = merged;
    const isLastTurn = request.state.turn + 1 >= 6;
    const discloseImageFallback = (output: CuratorModelOutput) =>
      request.image
        ? {
            ...output,
            reply:
              "이미지 분석을 사용할 수 없어, 이번에는 확인된 문장과 답변만 반영했어요. " +
              output.reply,
          }
        : output;

    if (request.image && !request.message) {
      if (isLastTurn) {
        return discloseImageFallback(ready(choice, topics, intent));
      }
      return discloseImageFallback(ask(
        "MOOD",
        "사진에서 특히 끌린 느낌을 한마디로 알려주면 그 방향으로 함께 찾아볼게요.",
        ["포근하고 편안해", "신나고 화려해", "어둡고 긴장돼", "잔잔하고 감성적이야"],
        choice,
        topics,
        intent,
      ));
    }

    if (
      choice.companions[0] === "WITH_CHILDREN" &&
      choice.childAgeRatingLimit === null
    ) {
      if (isLastTurn) {
        choice = { ...choice, childAgeRatingLimit: "ALL" };
        topics = addTopic(topics, "CHILD_AGE");
        return discloseImageFallback(ready(
          choice,
          topics,
          intent,
          "아이와 함께 보는 조건은 안전하게 전체 관람가로 잡았어요. ",
        ));
      }
      return discloseImageFallback(ask(
        "CHILD_AGE",
        "아이와 함께 본다면 관람등급을 안전하게 맞춰야 해요. 어느 등급까지 괜찮을까요?",
        ["전체 관람가", "7세 이하", "12세 이하", "15세 이하"],
        choice,
        topics,
        intent,
      ));
    }

    if (!topics.includes("MOOD") && !isLastTurn) {
      return discloseImageFallback(ask(
        "MOOD",
        "지금 작품을 보고 난 뒤 어떤 기분이 되었으면 좋겠어요? 정확히 몰라도 가까운 느낌만 골라주세요.",
        ["마음이 편해졌으면", "통쾌하게 웃고 싶어", "푹 빠져 긴장하고 싶어", "잔잔한 여운이 좋아"],
        choice,
        topics,
        intent,
      ));
    }

    if (!topics.includes("COMPANION") && !isLastTurn) {
      return discloseImageFallback(ask(
        "COMPANION",
        "누구와 함께 볼 예정인가요? 같이 보는 사람에 따라 피하면 좋은 분위기도 달라져요.",
        ["혼자 볼 거야", "연인과 함께", "친구들과", "아이와 가족"],
        choice,
        topics,
        intent,
      ));
    }

    if (!topics.includes("RUNTIME") && !isLastTurn) {
      return discloseImageFallback(ask(
        "RUNTIME",
        "오늘 확보한 시간은 어느 정도인가요?",
        ["30분 안쪽", "1시간 정도", "2시간까지", "시간은 상관없어"],
        choice,
        topics,
        intent,
      ));
    }

    return discloseImageFallback(ready(choice, topics, intent));
  }
}
