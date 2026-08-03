"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  NICKNAME_MAX,
  NICKNAME_MIN,
  PASSWORD_MIN,
} from "@/domains/account/signup";
import { refreshWatchlist } from "./watchlist-store";

type Mode = "login" | "signup";

const FIELD =
  "mt-1.5 w-full min-h-12 rounded-xl border border-white/15 bg-black/30 px-4 text-base text-white placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400";
const LABEL = "text-sm font-bold text-slate-200";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get("next") ?? "/watchlist";
  const pendingSave = params.get("save");

  // 홈에서 "회원가입" 으로 들어온 사람에게 로그인 칸을 먼저 보이면 한 번 더
  // 눌러야 한다.
  const [mode, setMode] = useState<Mode>(
    params.get("mode") === "signup" ? "signup" : "login",
  );
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(
        mode === "login" ? "/api/account/session" : "/api/account/signup",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            mode === "login"
              ? { nickname, password }
              : { nickname, password, birthDate },
          ),
        },
      );
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setMessage(body.error ?? "잠시 뒤 다시 시도해 주세요.");
        return;
      }
      // 로그인하기 전에 누른 찜이 있으면 이어서 담는다.
      if (pendingSave) {
        await fetch("/api/watchlist", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contentId: pendingSave }),
        });
      }
      await refreshWatchlist();
      router.push(nextPath);
    } catch {
      setMessage("연결에 문제가 있어요. 잠시 뒤 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="app-container max-w-md py-14">
      <h1 className="text-3xl font-black tracking-[-0.04em] text-white">
        {mode === "login" ? "로그인" : "처음 오셨네요"}
      </h1>
      <p className="mt-3 text-base leading-7 text-slate-300">
        찜한 작품은 계정에 저장돼서, 다른 기기에서 열어도 그대로 있어요.
      </p>

      <form className="mt-8 grid gap-5" onSubmit={submit}>
        <div>
          <label className={LABEL} htmlFor="nickname">
            별명
          </label>
          <input
            id="nickname"
            className={FIELD}
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            autoComplete="username"
            required
            minLength={NICKNAME_MIN}
            maxLength={NICKNAME_MAX}
            placeholder="한글·영문·숫자"
          />
        </div>

        <div>
          <label className={LABEL} htmlFor="password">
            비밀번호
          </label>
          <input
            id="password"
            type="password"
            className={FIELD}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            required
            minLength={PASSWORD_MIN}
            placeholder={`${PASSWORD_MIN}자 이상`}
          />
        </div>

        {mode === "signup" ? (
          <div>
            <label className={LABEL} htmlFor="birthDate">
              생년월일
            </label>
            <input
              id="birthDate"
              type="date"
              className={FIELD}
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
              autoComplete="bday"
              required
            />
            <p className="mt-1.5 text-sm text-slate-400">
              관람등급 안내에만 쓰고 화면에 보여주지 않아요.
            </p>
          </div>
        ) : null}

        {message ? (
          <p
            className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200"
            role="alert"
          >
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#ff6b3d] px-6 text-sm font-extrabold text-white transition hover:bg-[#ff7d56] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50"
          disabled={busy}
        >
          {busy ? "잠시만요…" : mode === "login" ? "로그인" : "가입하고 시작"}
        </button>
      </form>

      <button
        type="button"
        className="mt-6 inline-flex min-h-11 items-center text-sm font-bold text-orange-200 transition hover:text-orange-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setMessage(null);
        }}
      >
        {mode === "login"
          ? "계정이 없어요, 새로 만들래요"
          : "이미 계정이 있어요"}
      </button>
    </section>
  );
}
