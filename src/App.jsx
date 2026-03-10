import { useEffect, useMemo, useState } from "react";
import loveCallImage from "./assets/rewards/love-call.svg";
import loveGiftImage from "./assets/rewards/love-gift.svg";

const STORAGE_KEY = "cute-love-bank-v3";

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

const DEFAULT_HEART_LOGS = [];

const DEFAULT_REDEEM_LOGS = [];

function formatDateTime(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function makeId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function getInitialState() {
  const fallback = {
    hearts: 0,
    heartLogs: DEFAULT_HEART_LOGS,
    redeemLogs: DEFAULT_REDEEM_LOGS,
  };
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      hearts:
        typeof parsed.hearts === "number" && parsed.hearts >= 0
          ? parsed.hearts
          : fallback.hearts,
      heartLogs: Array.isArray(parsed.heartLogs)
        ? parsed.heartLogs
        : fallback.heartLogs,
      redeemLogs: Array.isArray(parsed.redeemLogs)
        ? parsed.redeemLogs
        : fallback.redeemLogs,
    };
  } catch (_error) {
    return fallback;
  }
}

export default function App() {
  const initial = useMemo(() => getInitialState(), []);
  const [hearts, setHearts] = useState(initial.hearts);
  const [heartLogs, setHeartLogs] = useState(initial.heartLogs);
  const [redeemLogs, setRedeemLogs] = useState(initial.redeemLogs);
  const [amountInput, setAmountInput] = useState("1");
  const [reasonInput, setReasonInput] = useState("");
  const [notice, setNotice] = useState("欢迎来到小喵宝宝爱心银行~");
  const [activeLogTab, setActiveLogTab] = useState("heart");

  const redeemableCount = useMemo(
    () => REWARDS.filter((item) => hearts >= item.cost).length,
    [hearts]
  );

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ hearts, heartLogs, redeemLogs })
    );
  }, [hearts, heartLogs, redeemLogs]);

  const onAddHearts = (event) => {
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

    const newLog = {
      id: makeId("heart"),
      amount,
      reason,
      time: formatDateTime(new Date()),
    };

    setHearts((prev) => prev + amount);
    setHeartLogs((prev) => [newLog, ...prev].slice(0, 36));
    setActiveLogTab("heart");
    setAmountInput("1");
    setReasonInput("");
    setNotice(`已存入 ${amount} 颗爱心，甜度上升中~`);
  };

  const onRedeem = (item) => {
    if (hearts < item.cost) {
      setNotice(`爱心不够啦，还差 ${item.cost - hearts} 颗。`);
      return;
    }

    setHearts((prev) => prev - item.cost);
    setRedeemLogs((prev) => [
      {
        id: makeId("redeem"),
        name: item.name,
        cost: item.cost,
        time: formatDateTime(new Date()),
      },
      ...prev,
    ]);
    setActiveLogTab("redeem");
    setNotice(`兑换成功：${item.name} ${item.icon}`);
  };

  const onReset = () => {
    setHearts(0);
    setHeartLogs(DEFAULT_HEART_LOGS);
    setRedeemLogs(DEFAULT_REDEEM_LOGS);
    setActiveLogTab("heart");
    setAmountInput("1");
    setReasonInput("");
    setNotice("已恢复初始状态。");
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
            <button type="button" className="ghost-btn" onClick={onReset}>
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
                  />
                </label>

                <button type="submit" className="main-btn">
                  存入到爱心罐
                </button>
              </form>
            </article>

            <article className="bubble-card panel-card side-note-card">
              <h3 className="mini-title">小喵宝宝今日播报</h3>
              <p className="notice-bubble side-notice">{notice}</p>
              <div className="mini-stat-grid">
                <div className="mini-stat">
                  <p className="mini-stat-label">可兑换项目</p>
                  <p className="mini-stat-value">{redeemableCount}</p>
                </div>
                <div className="mini-stat">
                  <p className="mini-stat-label">最近一条记录</p>
                  <p className="mini-stat-value">{heartLogs[0]?.amount ?? 0} 颗</p>
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
                  const canRedeem = hearts >= item.cost;
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
                        {canRedeem
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
                  {heartLogs.map((item) => (
                    <li key={item.id} className="log-item heart-log-item">
                      <div className="log-top">
                        <p className="log-text">{item.reason}</p>
                        <span className="log-value">+{item.amount}</span>
                      </div>
                      <p className="log-time">{item.time}</p>
                    </li>
                  ))}
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
                  {redeemLogs.map((item) => (
                    <li key={item.id} className="log-item reward-log-item">
                      <div className="log-top">
                        <p className="log-text">{item.name}</p>
                        <span className="log-value">-{item.cost}</span>
                      </div>
                      <p className="log-time">{item.time}</p>
                    </li>
                  ))}
                </ul>
              </article>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
