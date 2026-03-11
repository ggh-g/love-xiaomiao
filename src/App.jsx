import { useEffect, useMemo, useState } from "react";
import loveCallImage from "./assets/rewards/love-call.svg";
import loveGiftImage from "./assets/rewards/love-gift.svg";
import {
  LOVE_BANK_ID,
  fetchLoveBankEvents,
  insertLoveBankEvents,
  resetLoveBankEvents,
  supabaseEnabled,
} from "./lib/supabase";

const CACHE_KEY = "cute-love-bank-cache-v4";
const MAX_LOG_ITEMS = 36;

const REWARDS = [
  {
    id: "love-call",
    name: "爱心电话",
    icon: "📞",
    image: loveCallImage,
    cost: 5,
    description: "选择某个时间陪伴小喵。",
  },
  {
    id: "love-gift",
    name: "盲盒小礼物",
    icon: "🎁",
    image: loveGiftImage,
    cost: 10,
    description: "未知的精心挑选的小礼物。",
  },
];

function formatDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function normalizeEvent(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const kind = item.kind === "redeem" ? "redeem" : "heart";
  const amount = Number(item.amount);
  const label =
    typeof item.label === "string"
      ? item.label.trim()
      : typeof item.reason === "string"
        ? item.reason.trim()
        : typeof item.name === "string"
          ? item.name.trim()
          : "";
  const createdAt =
    typeof item.created_at === "string"
      ? item.created_at
      : typeof item.time === "string"
        ? new Date(item.time).toISOString()
        : new Date().toISOString();

  if (!Number.isFinite(amount) || amount <= 0 || !label) {
    return null;
  }

  return {
    id:
      typeof item.id === "string" && item.id
        ? item.id
        : `${kind}-${createdAt}-${label.slice(0, 8)}`,
    bank_id:
      typeof item.bank_id === "string" && item.bank_id
        ? item.bank_id
        : LOVE_BANK_ID,
    kind,
    amount,
    label,
    created_at: createdAt,
  };
}

function sortEvents(events) {
  return [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

function getCachedEvents() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sortEvents(parsed.map(normalizeEvent).filter(Boolean));
  } catch (_error) {
    return [];
  }
}

function makeLocalEvent(kind, amount, label) {
  return {
    id: `${kind}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    bank_id: LOVE_BANK_ID,
    kind,
    amount,
    label,
    created_at: new Date().toISOString(),
  };
}

export default function App() {
  const cachedEvents = useMemo(() => getCachedEvents(), []);
  const [events, setEvents] = useState(cachedEvents);
  const [amountInput, setAmountInput] = useState("1");
  const [reasonInput, setReasonInput] = useState("");
  const [notice, setNotice] = useState(
    supabaseEnabled
      ? "正在连接小喵宝宝的云端爱心银行..."
      : "未配置 Supabase，当前仍是本地模式。"
  );
  const [activeLogTab, setActiveLogTab] = useState("heart");
  const [isLoading, setIsLoading] = useState(supabaseEnabled);
  const [isMutating, setIsMutating] = useState(false);
  const [syncState, setSyncState] = useState(
    supabaseEnabled ? "connecting" : "local"
  );

  const heartLogs = useMemo(
    () =>
      events
        .filter((item) => item.kind === "heart")
        .slice(0, MAX_LOG_ITEMS)
        .map((item) => ({
          id: item.id,
          amount: item.amount,
          reason: item.label,
          time: formatDateTime(item.created_at),
        })),
    [events]
  );

  const redeemLogs = useMemo(
    () =>
      events
        .filter((item) => item.kind === "redeem")
        .slice(0, MAX_LOG_ITEMS)
        .map((item) => ({
          id: item.id,
          cost: item.amount,
          name: item.label,
          time: formatDateTime(item.created_at),
        })),
    [events]
  );

  const hearts = useMemo(
    () =>
      events.reduce(
        (sum, item) => sum + (item.kind === "heart" ? item.amount : -item.amount),
        0
      ),
    [events]
  );

  const redeemableCount = useMemo(
    () => REWARDS.filter((item) => hearts >= item.cost).length,
    [hearts]
  );

  const isBusy = isLoading || isMutating;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    if (!supabaseEnabled) {
      return;
    }

    let cancelled = false;

    async function loadEvents() {
      setIsLoading(true);
      try {
        const remoteData = await fetchLoveBankEvents();

        if (cancelled) {
          return;
        }

        const remoteEvents = sortEvents(
          (remoteData ?? []).map(normalizeEvent).filter(Boolean)
        );

        if (remoteEvents.length === 0 && cachedEvents.length > 0) {
          const payload = cachedEvents.map((item) => ({
            bank_id: LOVE_BANK_ID,
            kind: item.kind,
            amount: item.amount,
            label: item.label,
            created_at: item.created_at,
          }));

          const migratedData = await insertLoveBankEvents(payload);

          if (cancelled) {
            return;
          }

          const migratedEvents = sortEvents(
            (migratedData ?? []).map(normalizeEvent).filter(Boolean)
          );
          setEvents(migratedEvents);
          setSyncState("cloud");
          setNotice("已把本地爱心记录迁移到云端。");
          setIsLoading(false);
          return;
        }

        setEvents(remoteEvents);
        setSyncState("cloud");
        setNotice(
          remoteEvents.length > 0 ? "云端同步成功。" : "云端爱心银行已经准备好。"
        );
      } catch (_error) {
        if (!cancelled) {
          setSyncState("error");
          setNotice("云端读取失败，先使用本地缓存。");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadEvents();

    return () => {
      cancelled = true;
    };
  }, [cachedEvents]);

  async function insertRemoteEvent(kind, amount, label) {
    const data = await insertLoveBankEvents({
      bank_id: LOVE_BANK_ID,
      kind,
      amount,
      label,
    });

    const event = normalizeEvent(Array.isArray(data) ? data[0] : data);
    if (!event) {
      throw new Error("invalid_event_payload");
    }

    setEvents((prev) => sortEvents([event, ...prev]));
    setSyncState("cloud");
  }

  function insertLocalFallbackEvent(kind, amount, label) {
    const event = makeLocalEvent(kind, amount, label);
    setEvents((prev) => sortEvents([event, ...prev]));
    setSyncState("local");
    return event;
  }

  const onAddHearts = async (event) => {
    event.preventDefault();
    const amount = Number(amountInput);
    const reason = reasonInput.trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      setNotice("爱心数量要大于 0 哦。");
      return;
    }
    if (!reason) {
      setNotice("写一句可爱理由再存入吧。");
      return;
    }

    setIsMutating(true);

    try {
      if (supabaseEnabled) {
        await insertRemoteEvent("heart", amount, reason);
        setNotice(`已同步到云端：存入 ${amount} 颗爱心。`);
      } else {
        insertLocalFallbackEvent("heart", amount, reason);
        setNotice(`已本地存入 ${amount} 颗爱心，请先配置 Supabase。`);
      }

      setActiveLogTab("heart");
      setAmountInput("1");
      setReasonInput("");
    } catch (_error) {
      setSyncState("error");
      setNotice("保存失败了，稍后再试一次。");
    } finally {
      setIsMutating(false);
    }
  };

  const onRedeem = async (item) => {
    if (hearts < item.cost) {
      setNotice(`爱心不够啦，还差 ${item.cost - hearts} 颗。`);
      return;
    }

    setIsMutating(true);

    try {
      if (supabaseEnabled) {
        await insertRemoteEvent("redeem", item.cost, item.name);
        setNotice(`已同步兑换：${item.name} ${item.icon}`);
      } else {
        insertLocalFallbackEvent("redeem", item.cost, item.name);
        setNotice(`已本地兑换：${item.name}，请先配置 Supabase。`);
      }

      setActiveLogTab("redeem");
    } catch (_error) {
      setSyncState("error");
      setNotice("兑换失败了，稍后再试一次。");
    } finally {
      setIsMutating(false);
    }
  };

  const onReset = async () => {
    setIsMutating(true);

    try {
      if (supabaseEnabled) {
        await resetLoveBankEvents();
        setSyncState("cloud");
        setNotice("云端数据已清空。");
      } else {
        setSyncState("local");
        setNotice("本地缓存已清空，请先配置 Supabase。");
      }

      setEvents([]);
      setActiveLogTab("heart");
      setAmountInput("1");
      setReasonInput("");
    } catch (_error) {
      setSyncState("error");
      setNotice("重置失败了，稍后再试一次。");
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <main className="cute-page">
      <div className="floating floating-1">💗</div>
      <div className="floating floating-2">🌸</div>
      <div className="floating floating-3">✨</div>

      <div className="cute-shell">
        <section className="bubble-card hero-card">
          <div className="hero-head">
            <p className="cute-chip">🐱 甜甜模式</p>
            <button
              type="button"
              className="ghost-btn"
              onClick={onReset}
              disabled={isBusy}
            >
              重置
            </button>
          </div>

          <h1 className="cute-title">小喵宝宝爱心银行</h1>
          <p className="hero-sub">
            把每个贴心瞬间都存进爱心罐，攒够就可以兑换小惊喜。
          </p>

          <div className="hero-stats">
            <div className="heart-box">
              <span className="heart-emoji">💖</span>
              <div>
                <p className="heart-label">当前爱心</p>
                <p className="heart-count">{hearts}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="dashboard-layout">
          <aside className="dashboard-side">
            <article className="bubble-card panel-card">
              <h2 className="panel-title">存入爱心</h2>
              <p className="panel-sub">输入数量和理由，把今天的甜蜜记下来。</p>

              <form className="form-stack" onSubmit={onAddHearts}>
                <label className="field-wrap">
                  <span className="field-label">爱心数量</span>
                  <input
                    type="number"
                    min="1"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="cute-input"
                    disabled={isBusy}
                  />
                </label>

                <label className="field-wrap">
                  <span className="field-label">添加理由</span>
                  <textarea
                    rows={4}
                    value={reasonInput}
                    onChange={(e) => setReasonInput(e.target.value)}
                    placeholder="比如：今天下雨来接我，还带了热奶茶。"
                    className="cute-input"
                    disabled={isBusy}
                  />
                </label>

                <button type="submit" className="main-btn" disabled={isBusy}>
                  {isBusy ? "同步中..." : "存入到爱心罐"}
                </button>
              </form>
            </article>

            <article className="bubble-card panel-card side-note-card">
              <h3 className="mini-title">小喵宝宝今日播报</h3>
              <p className="notice-bubble side-notice">{notice}</p>
              <div className="mini-stat-grid">
                <div className="mini-stat">
                  <p className="mini-stat-label">同步状态</p>
                  <p className="mini-stat-value">
                    {syncState === "cloud"
                      ? "云端已连接"
                      : syncState === "connecting"
                        ? "连接中"
                        : syncState === "error"
                          ? "同步失败"
                          : "本地模式"}
                  </p>
                </div>
                <div className="mini-stat">
                  <p className="mini-stat-label">可兑换项目</p>
                  <p className="mini-stat-value">{redeemableCount}</p>
                </div>
              </div>
            </article>
          </aside>

          <div className="dashboard-main">
            <article className="bubble-card panel-card">
              <h2 className="panel-title">兑换区域</h2>
              <p className="panel-sub">先放两个基础礼物，后续可以继续添加。</p>

              <div className="reward-list">
                {REWARDS.map((item) => {
                  const canRedeem = hearts >= item.cost && !isBusy;
                  const itemProgress = Math.min(
                    100,
                    Math.round((hearts / item.cost) * 100)
                  );
                  return (
                    <div key={item.id} className="reward-card">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="reward-cover"
                        loading="lazy"
                      />
                      <div className="reward-head">
                        <div className="reward-name">
                          <span className="reward-icon">{item.icon}</span>
                          <div>
                            <p className="reward-title">{item.name}</p>
                            <p className="reward-desc">{item.description}</p>
                          </div>
                        </div>
                        <span className="cost-tag">{item.cost} 颗</span>
                      </div>

                      <div className="tiny-meter">
                        <span style={{ width: `${itemProgress}%` }} />
                      </div>

                      <button
                        type="button"
                        disabled={!canRedeem}
                        onClick={() => onRedeem(item)}
                        className="exchange-btn"
                      >
                        {isBusy
                          ? "同步中..."
                          : hearts >= item.cost
                            ? `兑换 ${item.name}`
                            : `还差 ${item.cost - hearts} 颗爱心`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </article>

            <section className="logs-grid">
              <div className="log-tabs" role="tablist" aria-label="记录切换">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeLogTab === "heart"}
                  className={`log-tab-btn ${
                    activeLogTab === "heart" ? "is-active" : ""
                  }`}
                  onClick={() => setActiveLogTab("heart")}
                >
                  爱心记录
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeLogTab === "redeem"}
                  className={`log-tab-btn ${
                    activeLogTab === "redeem" ? "is-active" : ""
                  }`}
                  onClick={() => setActiveLogTab("redeem")}
                >
                  兑换记录
                </button>
              </div>

              <article
                className={`bubble-card panel-card log-panel ${
                  activeLogTab === "heart" ? "is-active" : "is-hidden-mobile"
                }`}
              >
                <div className="log-head">
                  <h2 className="panel-title">爱心记录</h2>
                  <span className="log-count">{heartLogs.length} 条</span>
                </div>
                <ul className="log-list">
                  {heartLogs.length > 0 ? (
                    heartLogs.map((item) => (
                      <li key={item.id} className="log-item heart-log-item">
                        <div className="log-top">
                          <p className="log-text">{item.reason}</p>
                          <span className="log-value">+{item.amount}</span>
                        </div>
                        <p className="log-time">{item.time}</p>
                      </li>
                    ))
                  ) : (
                    <li className="log-empty">还没有爱心记录。</li>
                  )}
                </ul>
              </article>

              <article
                className={`bubble-card panel-card log-panel ${
                  activeLogTab === "redeem" ? "is-active" : "is-hidden-mobile"
                }`}
              >
                <div className="log-head">
                  <h2 className="panel-title">兑换记录</h2>
                  <span className="log-count">{redeemLogs.length} 条</span>
                </div>
                <ul className="log-list">
                  {redeemLogs.length > 0 ? (
                    redeemLogs.map((item) => (
                      <li key={item.id} className="log-item reward-log-item">
                        <div className="log-top">
                          <p className="log-text">{item.name}</p>
                          <span className="log-value">-{item.cost}</span>
                        </div>
                        <p className="log-time">{item.time}</p>
                      </li>
                    ))
                  ) : (
                    <li className="log-empty">还没有兑换记录。</li>
                  )}
                </ul>
              </article>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
