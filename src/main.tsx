import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCenter,
  pointerWithin,
  type DragEndEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { get, set } from "idb-keyval";
import {
  Plus,
  Search,
  Download,
  Undo2,
  Redo2,
  Settings2,
  X,
  ImagePlus,
  Upload,
  Link,
  ChevronDown,
  LayoutGrid,
  Layers,
  ArrowUpRight,
  Check,
  FolderOpen,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  allItems,
  moveItem,
  newBoard,
  normalizeImage,
  parseBoards,
  uid,
  type Board,
  type Item,
  type Rank,
} from "./model";
import { download, exportPng } from "./export";
import "./style.css";
type Result = {
  key: string;
  name: string;
  url: string;
  source: string;
  credit: string;
};
function Tile({
  item,
  onSelect,
  fit,
  dim = false,
}: {
  item: Item;
  onSelect: () => void;
  fit: boolean;
  dim?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      className={`tile ${fit ? "contain" : ""} ${dim ? "dim" : ""}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.25 : undefined,
      }}
      aria-label={`${item.name}を移動・編集`}
    >
      <img src={item.src} alt={item.name} draggable={false} />
      <span>{item.name}</span>
    </button>
  );
}
function Zone({
  id,
  items,
  onSelect,
  fit,
  filter,
}: {
  id: string;
  items: Item[];
  onSelect: (i: Item) => void;
  fit: boolean;
  filter: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`dropzone ${isOver ? "over" : ""}`}>
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={rectSortingStrategy}
      >
        {items.map((i) => (
          <Tile
            key={i.id}
            item={i}
            onSelect={() => onSelect(i)}
            fit={fit}
            dim={
              !!filter && !i.name.toLowerCase().includes(filter.toLowerCase())
            }
          />
        ))}
      </SortableContext>
      {!items.length && <span className="drop-hint">ここに画像をドロップ</span>}
    </div>
  );
}
function App() {
  const [boards, setBoards] = useState<Board[]>([]),
    [active, setActive] = useState(""),
    [loaded, setLoaded] = useState(false),
    [saveState, setSaveState] = useState("読み込み中"),
    [panel, setPanel] = useState<"search" | "upload" | "url">("search"),
    [q, setQ] = useState(""),
    [kind, setKind] = useState("anime"),
    [provider, setProvider] = useState("AniList / Kitsu"),
    [results, setResults] = useState<Result[]>([]),
    [searching, setSearching] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [selected, setSelected] = useState<Item | null>(null),
    [editing, setEditing] = useState<Rank | null>(null),
    [library, setLibrary] = useState(false),
    [exportOpen, setExportOpen] = useState(false),
    [bg, setBg] = useState("#111214"),
    [fit, setFit] = useState(false),
    [filter, setFilter] = useState(""),
    [direct, setDirect] = useState(""),
    [dragging, setDragging] = useState<string | null>(null),
    [png, setPng] = useState<Blob | null>(null);
  const [history, setHistory] = useState<Board[]>([]),
    [future, setFuture] = useState<Board[]>([]);
  const importRef = useRef<HTMLInputElement>(null),
    replaceRef = useRef<HTMLInputElement>(null);
  const saveChain = useRef(Promise.resolve());
  const board = boards.find((b) => b.id === active);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 230, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  useEffect(() => {
    get("tier-studio-v1")
      .then((v) => {
        if (v) {
          const data = parseBoards(v.boards);
          setBoards(data);
          setActive(
            data.some((b) => b.id === v.active) ? v.active : data[0].id,
          );
        } else {
          const b = newBoard();
          setBoards([b]);
          setActive(b.id);
        }
        setLoaded(true);
        setSaveState("保存済み");
      })
      .catch(() =>
        setNotice("保存データを読み込めませんでした。再読み込みしてください。"),
      );
  }, []);
  useEffect(() => {
    if (!loaded) return;
    setSaveState("保存中…");
    const persist = () => {
      saveChain.current = saveChain.current
        .catch(() => {})
        .then(() => set("tier-studio-v1", { boards, active }))
        .then(() => setSaveState("自動保存済み"))
        .catch(() => setSaveState("保存失敗：JSONでバックアップしてください"));
    };
    const timer = setTimeout(persist, 400);
    const flush = () => {
      if (document.visibilityState === "hidden") persist();
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", persist);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", persist);
    };
  }, [boards, active, loaded]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(t);
  }, [notice]);
  function commit(next: Board) {
    if (!board) return;
    setHistory((h) => [...h.slice(-39), structuredClone(board)]);
    setFuture([]);
    setBoards((bs) =>
      bs.map((b) => (b.id === next.id ? { ...next, updated: Date.now() } : b)),
    );
    setPng(null);
  }
  function undo() {
    if (!board || !history.length) return;
    const prev = history.at(-1)!;
    setFuture((f) => [...f, board]);
    setHistory((h) => h.slice(0, -1));
    setBoards((bs) => bs.map((b) => (b.id === active ? prev : b)));
    setPng(null);
  }
  function redo() {
    if (!board || !future.length) return;
    const next = future.at(-1)!;
    setHistory((h) => [...h, board]);
    setFuture((f) => f.slice(0, -1));
    setBoards((bs) => bs.map((b) => (b.id === active ? next : b)));
    setPng(null);
  }
  function switchBoard(id: string) {
    setActive(id);
    setHistory([]);
    setFuture([]);
    setSelected(null);
    setEditing(null);
    setPng(null);
    setLibrary(false);
  }
  function addBoard() {
    if (boards.length >= 100) {
      setNotice(
        "ランキングは100件までです。JSONで保存して不要なものを削除してください",
      );
      return;
    }
    const b = newBoard();
    setBoards((bs) => [...bs, b]);
    switchBoard(b.id);
  }
  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!q.trim() || searching) return;
    setSearching(true);
    setResults([]);
    try {
      const r = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&type=${kind}`,
      );
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "検索できませんでした");
      setResults(data.items);
      setProvider(data.provider || "AniList / Kitsu");
      if (!data.items.length)
        setNotice(
          "画像が見つかりません。別のキーワードや画像アップロードをお試しください。",
        );
    } catch {
      setNotice(
        "画像検索に接続できませんでした。少し待って再試行するか、アップロードをお試しください。",
      );
    } finally {
      setSearching(false);
    }
  }
  async function remoteBlob(url: string) {
    const u = new URL(url);
    if (u.protocol !== "https:")
      throw Error("HTTPSの画像URLを入力してください");
    const known = [
      "upload.wikimedia.org",
      "thumb.wikimedia.org",
      "s4.anilist.co",
      "media.kitsu.app",
    ].includes(u.hostname);
    const r = await fetch(
      known ? `/api/image?url=${encodeURIComponent(url)}` : url,
      { signal: AbortSignal.timeout(20000), credentials: "omit" },
    );
    if (!r.ok)
      throw Error(
        "画像を取得できません。端末からのアップロードをお試しください",
      );
    return r.blob();
  }
  async function addImage(
    blob: Blob,
    meta: { name: string; key: string; source?: string; credit?: string },
  ) {
    if (!board) return;
    if (allItems(board).some((i) => i.key === meta.key)) {
      setNotice("この画像は追加済みです");
      return;
    }
    const src = await normalizeImage(blob);
    if (allItems(board).some((i) => i.src === src)) {
      setNotice("同じ画像は追加済みです");
      return;
    }
    commit({
      ...board,
      pool: [
        ...board.pool,
        {
          id: uid(),
          src,
          name: meta.name,
          key: meta.key,
          source: meta.source || "",
          credit:
            meta.credit || "アップロード画像（権利を確認してご利用ください）",
        },
      ],
    });
    setNotice("未分類エリアに追加しました");
  }
  async function addResult(r: Result) {
    if (busy) return;
    setBusy(true);
    try {
      await addImage(await remoteBlob(r.url), r);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(files: FileList | null, replace = false) {
    if (!files?.length || !board) return;
    setBusy(true);
    try {
      const f = files[0];
      if (replace && selected) {
        const src = await normalizeImage(f);
        if (allItems(board).some((i) => i.id !== selected.id && i.src === src))
          throw Error("同じ画像は追加済みです");
        const change = (i: Item) =>
          i.id === selected.id
            ? {
                ...i,
                src,
                name: f.name,
                key: `file:${f.name}:${f.size}:${f.lastModified}`,
                source: "",
                credit: "アップロード画像",
              }
            : i;
        commit({
          ...board,
          pool: board.pool.map(change),
          ranks: board.ranks.map((r) => ({ ...r, items: r.items.map(change) })),
        });
        setSelected(null);
      } else
        await addImage(f, {
          name: f.name.replace(/\.[^.]+$/, ""),
          key: `file:${f.name}:${f.size}:${f.lastModified}`,
        });
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    if (!board || !e.over) return;
    const over = String(e.over.id),
      id = String(e.active.id);
    const target =
      over === "pool" || board.ranks.some((r) => r.id === over)
        ? over
        : board.pool.some((i) => i.id === over)
          ? "pool"
          : board.ranks.find((r) => r.items.some((i) => i.id === over))?.id;
    if (target) commit(moveItem(board, id, target, over));
  }
  async function generate() {
    if (!board) return;
    setBusy(true);
    try {
      const blob = await exportPng(board, bg, fit);
      setPng(blob);
      download(blob, `${board.title}.png`);
      setNotice("PNGを作成しました。iPhoneでは「共有」も利用できます。");
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    if (!png || !board) return;
    const f = new File([png], `${board.title}.png`, { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [f] }))
        await navigator.share({ files: [f], title: board.title });
      else download(png, `${board.title}.png`);
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setNotice("共有できませんでした。ダウンロードをお試しください。");
    }
  }
  async function importJson(file?: File) {
    if (!file) return;
    try {
      if (file.size > 50 * 1024 * 1024)
        throw Error("JSONは50MB以下にしてください");
      const incoming = parseBoards(JSON.parse(await file.text()));
      if (boards.length + incoming.length > 100)
        throw Error("ランキングは合計100件まで復元できます");
      const copies = incoming.map((b) => ({
        ...b,
        id: uid(),
        updated: Date.now(),
      }));
      setBoards((bs) => [...bs, ...copies]);
      switchBoard(copies[0].id);
      setNotice("ランキングを復元しました");
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  if (!loaded || !board)
    return (
      <main className="loading">
        <Layers size={36} />
        <p>{notice || "スタジオを準備しています…"}</p>
      </main>
    );
  const count = allItems(board).length;
  return (
    <>
      <header className="header">
        <a className="brand" href="/" aria-label="Tier Studio ホーム">
          <span className="brand-mark">
            <Layers size={22} />
          </span>
          TIER<span className="brand-light">STUDIO</span>
          <span className="beta">BETA</span>
        </a>
        <div className="header-right">
          <span className="local-label">
            <span className="status-dot" />
            ログイン不要・端末内に保存
          </span>
          <button className="button subtle" onClick={() => setLibrary(true)}>
            <FolderOpen size={17} />
            <span>マイランキング</span>
          </button>
        </div>
      </header>
      <div className="workspace">
        <div className="breadcrumb">
          WORKSPACE <span>/</span> ランキングエディター
        </div>
        <section className="intro">
          <div>
            <div className="eyebrow">YOUR PICKS. YOUR RULES.</div>
            <h1>
              好きに、順位をつけよう<span>。</span>
            </h1>
            <p>画像を探して、並べるだけ。あなただけのティアリストを。</p>
          </div>
          <button
            className="button primary"
            onClick={() => {
              setPng(null);
              setExportOpen(true);
            }}
          >
            <Download size={17} />
            画像として保存
          </button>
        </section>
        <div className="editor-layout">
          <main className="editor" id="ranking-editor">
            <div className="board-top">
              <div className="title-wrap">
                <span className="tiny-label">TIER LIST</span>
                <input
                  aria-label="ランキングタイトル"
                  className="title-input"
                  value={board.title}
                  maxLength={100}
                  onChange={(e) => commit({ ...board, title: e.target.value })}
                />
              </div>
              <span className="save-label">
                <Check size={13} />
                {saveState}
              </span>
            </div>
            <div className="toolbar">
              <div className="tool-group">
                <button
                  className="icon-btn"
                  title="取り消し"
                  aria-label="取り消し"
                  disabled={!history.length}
                  onClick={undo}
                >
                  <Undo2 size={17} />
                </button>
                <button
                  className="icon-btn"
                  title="やり直し"
                  aria-label="やり直し"
                  disabled={!future.length}
                  onClick={redo}
                >
                  <Redo2 size={17} />
                </button>
                <span className="divider" />
                <button
                  className={`view-button ${fit ? "active" : ""}`}
                  onClick={() => setFit(!fit)}
                >
                  <LayoutGrid size={15} />
                  {fit ? "縦横比を維持" : "統一サイズ"}
                </button>
              </div>
              <label className="filter">
                <Search size={14} />
                <input
                  placeholder="リスト内を検索"
                  aria-label="ランキング内検索"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </label>
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={(args) => {
                const hits = pointerWithin(args);
                const items = hits.filter((h) =>
                  allItems(board).some((i) => i.id === h.id),
                );
                return items.length
                  ? items
                  : hits.length
                    ? hits
                    : closestCenter(args);
              }}
              onDragStart={(e) => setDragging(String(e.active.id))}
              onDragEnd={onDragEnd}
              onDragCancel={() => setDragging(null)}
            >
              <div className="tier-board">
                {board.ranks.map((r) => (
                  <div className="tier-row" key={r.id}>
                    <button
                      className="rank-label"
                      style={{ background: r.color }}
                      onClick={() => setEditing(structuredClone(r))}
                      title="ランクを編集"
                    >
                      {r.name}
                    </button>
                    <Zone
                      id={r.id}
                      items={r.items}
                      onSelect={setSelected}
                      fit={fit}
                      filter={filter}
                    />
                    <button
                      className="rank-settings"
                      aria-label={`${r.name}の設定`}
                      onClick={() => setEditing(structuredClone(r))}
                    >
                      <Settings2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="add-rank"
                disabled={board.ranks.length >= 50}
                onClick={() =>
                  commit({
                    ...board,
                    ranks: [
                      ...board.ranks,
                      { id: uid(), name: "NEW", color: "#a1a1aa", items: [] },
                    ],
                  })
                }
              >
                <Plus size={15} />
                ランクを追加
              </button>
              <section className="pool-section">
                <div className="pool-heading">
                  <h2>
                    <span className="pool-dot" />
                    未分類の画像{" "}
                    <span className="count">{board.pool.length}</span>
                  </h2>
                  <span>長押しでドラッグ / タップで移動</span>
                </div>
                <div className="pool">
                  <Zone
                    id="pool"
                    items={board.pool}
                    onSelect={setSelected}
                    fit={fit}
                    filter={filter}
                  />
                  {!board.pool.length && (
                    <div className="empty-pool">
                      <ImagePlus size={26} />
                      <p>まずは、お気に入りの画像から。</p>
                      <span>
                        画像を検索、またはアップロードして追加しましょう
                      </span>
                    </div>
                  )}
                </div>
              </section>
              <DragOverlay>
                {dragging && (
                  <div className="drag-preview">
                    <img
                      src={allItems(board).find((i) => i.id === dragging)?.src}
                    />
                  </div>
                )}
              </DragOverlay>
            </DndContext>
            <div className="board-bottom">
              <span>
                {board.ranks.length} ランク<span>·</span>
                {count} 画像
              </span>
              <button
                onClick={() => {
                  if (
                    confirm(
                      "画像とランクを初期化しますか？取り消しで戻せます。",
                    )
                  )
                    commit({ ...newBoard(), id: board.id, title: board.title });
                }}
              >
                ランキングを初期化
              </button>
            </div>
          </main>
          <aside className="image-panel" id="image-library">
            <div className="panel-title">
              <div className="panel-icon">
                <ImagePlus size={19} />
              </div>
              <div>
                <h2>画像を追加</h2>
                <p>あなたの「好き」を集めよう</p>
              </div>
            </div>
            <div className="tabs">
              {(
                [
                  ["search", "検索", Search],
                  ["upload", "アップロード", Upload],
                  ["url", "URL", Link],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  className={panel === id ? "active" : ""}
                  onClick={() => setPanel(id)}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
            {panel === "search" ? (
              <>
                <form onSubmit={search}>
                  <div className="search-field">
                    <Search size={18} />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="作品名やキーワードで検索"
                      aria-label="画像検索キーワード"
                    />
                    <button
                      disabled={searching || !q.trim()}
                      aria-label="画像を検索"
                    >
                      <ArrowUpRight size={18} />
                    </button>
                  </div>
                  <label className="source-select">
                    <select
                      aria-label="検索ジャンル"
                      value={kind}
                      onChange={(e) => {
                        setKind(e.target.value);
                        setResults([]);
                      }}
                    >
                      <option value="anime">
                        アニメ作品 · AniList / Kitsu
                      </option>
                      <option value="general">
                        すべてのジャンル · Wikimedia
                      </option>
                    </select>
                    <ChevronDown size={14} />
                  </label>
                </form>
                <div className="suggestions">
                  <span>試してみる</span>
                  {(kind === "anime"
                    ? ["進撃の巨人", "葬送のフリーレン", "ONE PIECE"]
                    : ["猫", "寿司", "富士山"]
                  ).map((s) => (
                    <button key={s} onClick={() => setQ(s)}>
                      {s}
                    </button>
                  ))}
                </div>
                <div className="results-heading">
                  <span>
                    {searching
                      ? "検索しています…"
                      : results.length
                        ? `検索結果 · ${results.length}件`
                        : "FIND YOUR FAVORITES"}
                  </span>
                  {!!results.length && <span>タップして追加</span>}
                </div>
                {results.length ? (
                  <div className="results">
                    {results.map((r) => {
                      const added = allItems(board).some(
                        (i) => i.key === r.key,
                      );
                      return (
                        <div className="result" key={r.key}>
                          <button
                            disabled={busy || added}
                            onClick={() => addResult(r)}
                            aria-label={`${r.name}を追加`}
                            title={`${r.name}を追加`}
                          >
                            <img src={r.url} alt={r.name} loading="lazy" />
                            <span className="result-plus">
                              {added ? <Check size={18} /> : <Plus size={18} />}
                            </span>
                          </button>
                          <strong title={r.name}>{r.name}</strong>
                          <a href={r.source} target="_blank" rel="noreferrer">
                            出典・利用条件 ↗
                          </a>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="search-empty">
                    <div className="empty-art">
                      <Search size={32} />
                      <span>✦</span>
                    </div>
                    <h3>次の「最高」を見つけよう。</h3>
                    <p>
                      アニメ、食べ物、動物、スポーツ。
                      <br />
                      気になるキーワードを検索してみてください。
                    </p>
                  </div>
                )}
                <div className="source-note">
                  <span className="status-dot" />
                  {kind === "anime"
                    ? `Powered by ${provider}`
                    : "Powered by Wikimedia Commons"}
                  <p>
                    {kind === "anime"
                      ? "日本語・英語の作品名に対応。画像の権利は各権利者に帰属します。"
                      : "日本語対応。英語のキーワードで候補が増える場合があります。画像ごとのライセンスをご確認ください。"}
                  </p>
                </div>
              </>
            ) : panel === "upload" ? (
              <label className="upload-area">
                <Upload size={30} />
                <strong>画像をアップロード</strong>
                <span>タップして端末内の写真を選択</span>
                <small>JPG / PNG / WebP / GIF / AVIF · 15MBまで</small>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  disabled={busy}
                  onChange={(e) => {
                    upload(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            ) : (
              <form
                className="url-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  try {
                    await addImage(await remoteBlob(direct), {
                      name: "URLから追加した画像",
                      key: direct,
                      source: direct,
                      credit: "外部画像（利用権を確認してください）",
                    });
                  } catch (err) {
                    setNotice((err as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  画像のURL
                  <input
                    type="url"
                    required
                    value={direct}
                    onChange={(e) => setDirect(e.target.value)}
                    placeholder="https://…"
                  />
                </label>
                <button className="button primary" disabled={busy}>
                  画像を追加
                </button>
                <p>
                  外部サイトがCORSを許可している画像に対応します。取得できない場合は端末からアップロードしてください。
                </p>
              </form>
            )}
            <div className="privacy-note">
              <Layers size={15} />
              <span>
                データはこのブラウザに自動保存されます。
                <br />
                大切なランキングはJSONでもバックアップ。
              </span>
            </div>
          </aside>
        </div>
        <footer>
          <span className="footer-brand">TIER STUDIO</span>
          <span>すべての「好き」に、居場所を。</span>
          <button
            onClick={() =>
              download(
                new Blob([JSON.stringify([board])], {
                  type: "application/json",
                }),
                `${board.title}.json`,
              )
            }
          >
            JSONエクスポート <ArrowUpRight size={12} />
          </button>
          <button onClick={() => importRef.current?.click()}>
            JSONから復元 <Upload size={12} />
          </button>
        </footer>
      </div>
      <nav className="mobile-dock" aria-label="エディター操作">
        <button
          onClick={() =>
            document
              .getElementById("ranking-editor")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        >
          <Layers size={17} />
          ランキング
        </button>
        <button
          className="dock-add"
          onClick={() =>
            document
              .getElementById("image-library")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        >
          <Plus size={18} />
          画像を追加
        </button>
        <button
          onClick={() => {
            setPng(null);
            setExportOpen(true);
          }}
        >
          <Download size={17} />
          画像保存
        </button>
      </nav>
      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          importJson(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={replaceRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          upload(e.target.files, true);
          e.target.value = "";
        }}
      />
      {selected && (
        <Modal title="画像を移動・編集" close={() => setSelected(null)}>
          <div className="selected-item">
            <img src={selected.src} />
            <div>
              <strong>{selected.name}</strong>
              <p>{selected.credit}</p>
              {selected.source && (
                <a href={selected.source} target="_blank" rel="noreferrer">
                  出典・利用条件 ↗
                </a>
              )}
            </div>
          </div>
          <label className="field">
            画像の名前
            <input
              value={selected.name}
              maxLength={120}
              onChange={(e) =>
                setSelected({ ...selected, name: e.target.value })
              }
            />
          </label>
          <button
            className="button"
            onClick={() => {
              const rename = (i: Item) => (i.id === selected.id ? selected : i);
              commit({
                ...board,
                pool: board.pool.map(rename),
                ranks: board.ranks.map((r) => ({
                  ...r,
                  items: r.items.map(rename),
                })),
              });
              setSelected(null);
            }}
          >
            名前を保存
          </button>
          <p className="modal-label">移動先を選択（末尾に追加）</p>
          <div className="move-options">
            {[
              ...board.ranks,
              { id: "pool", name: "未分類", color: "#777" },
            ].map((r) => (
              <button
                key={r.id}
                style={{ borderColor: r.color }}
                onClick={() => {
                  commit(moveItem(board, selected.id, r.id));
                  setSelected(null);
                }}
              >
                <span style={{ background: r.color }} />
                {r.name}
              </button>
            ))}
          </div>
          <div className="modal-actions">
            <button
              className="button"
              onClick={() => replaceRef.current?.click()}
              disabled={busy}
            >
              <Upload size={15} />
              画像を入れ替え
            </button>
            <button
              className="button danger"
              onClick={() => {
                commit({
                  ...board,
                  pool: board.pool.filter((i) => i.id !== selected.id),
                  ranks: board.ranks.map((r) => ({
                    ...r,
                    items: r.items.filter((i) => i.id !== selected.id),
                  })),
                });
                setSelected(null);
              }}
            >
              <Trash2 size={15} />
              削除
            </button>
          </div>
        </Modal>
      )}
      {editing && (
        <Modal title="ランクを編集" close={() => setEditing(null)}>
          <label className="field">
            ランク名
            <input
              maxLength={20}
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
          </label>
          <label className="field">
            背景色
            <input
              type="color"
              value={editing.color}
              onChange={(e) =>
                setEditing({ ...editing, color: e.target.value })
              }
            />
          </label>
          <div className="modal-actions">
            <button
              className="button"
              disabled={board.ranks[0].id === editing.id}
              onClick={() => {
                const ranks = [...board.ranks],
                  i = ranks.findIndex((r) => r.id === editing.id);
                [ranks[i - 1], ranks[i]] = [ranks[i], ranks[i - 1]];
                commit({ ...board, ranks });
              }}
            >
              <ArrowUp size={16} />
              上へ
            </button>
            <button
              className="button"
              disabled={board.ranks.at(-1)?.id === editing.id}
              onClick={() => {
                const ranks = [...board.ranks],
                  i = ranks.findIndex((r) => r.id === editing.id);
                [ranks[i + 1], ranks[i]] = [ranks[i], ranks[i + 1]];
                commit({ ...board, ranks });
              }}
            >
              <ArrowDown size={16} />
              下へ
            </button>
          </div>
          <div className="modal-actions">
            <button
              className="button danger"
              onClick={() => {
                const r = board.ranks.find((r) => r.id === editing.id)!;
                commit({
                  ...board,
                  ranks: board.ranks.filter((r) => r.id !== editing.id),
                  pool: [...board.pool, ...r.items],
                });
                setEditing(null);
              }}
            >
              ランクを削除
            </button>
            <button
              className="button primary"
              onClick={() => {
                commit({
                  ...board,
                  ranks: board.ranks.map((r) =>
                    r.id === editing.id
                      ? {
                          ...r,
                          name: editing.name || "?",
                          color: editing.color,
                        }
                      : r,
                  ),
                });
                setEditing(null);
              }}
            >
              変更を保存
            </button>
          </div>
          <p className="helper">削除したランクの画像は未分類へ移動します。</p>
        </Modal>
      )}
      {library && (
        <Modal title="マイランキング" close={() => setLibrary(false)}>
          <button className="button primary full" onClick={addBoard}>
            <Plus size={17} />
            新しいランキング
          </button>
          <div className="library-list">
            {boards.map((b) => (
              <div className="library-item" key={b.id}>
                <button
                  className="library-open"
                  onClick={() => switchBoard(b.id)}
                >
                  <span>
                    {b.id === active && <span className="status-dot" />}
                    {b.title || "無題のランキング"}
                  </span>
                  <small>
                    {allItems(b).length} 画像 ·{" "}
                    {new Date(b.updated).toLocaleDateString("ja-JP")}
                  </small>
                </button>
                <button
                  className="icon-btn"
                  title="複製"
                  aria-label={`${b.title}を複製`}
                  disabled={boards.length >= 100}
                  onClick={() => {
                    const copy = {
                      ...structuredClone(b),
                      id: uid(),
                      title: `${b.title} のコピー`,
                      updated: Date.now(),
                    };
                    setBoards((bs) => [...bs, copy]);
                    setNotice("ランキングを複製しました");
                  }}
                >
                  <Copy size={16} />
                </button>
                <button
                  className="icon-btn danger"
                  title="削除"
                  aria-label={`${b.title}を削除`}
                  onClick={() => {
                    if (
                      !confirm(
                        `「${b.title}」を削除しますか？この操作は元に戻せません。`,
                      )
                    )
                      return;
                    const next = boards.filter((x) => x.id !== b.id);
                    if (!next.length) next.push(newBoard());
                    setBoards(next);
                    if (active === b.id) {
                      setActive(next[0].id);
                      setHistory([]);
                      setFuture([]);
                    }
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <p className="helper">
            ランキング名はエディターのタイトル欄から変更できます。ブラウザのデータを削除すると保存内容も消えるため、JSONでバックアップしてください。
          </p>
        </Modal>
      )}
      {exportOpen && (
        <Modal
          title="ランキングを画像に保存"
          close={() => setExportOpen(false)}
        >
          <div className="export-illustration">
            <Layers size={34} />
            <div>
              <strong>あなたのランキングを、一枚に。</strong>
              <p>タイトル・すべてのランク・出典を含む高解像度PNG</p>
            </div>
          </div>
          <label className="field">
            保存画像の背景
            <select
              value={bg}
              onChange={(e) => {
                setBg(e.target.value);
                setPng(null);
              }}
            >
              <option value="#111214">ダーク</option>
              <option value="#ffffff">ホワイト</option>
            </select>
          </label>
          <p className="helper">
            画像は折り返して配置し、横長のリストも切れずに保存します。未分類の画像と編集UIは含まれません。
          </p>
          <button
            className="button primary full"
            onClick={generate}
            disabled={busy}
          >
            <Download size={17} />
            {busy ? "PNGを作成中…" : "PNGを作成・ダウンロード"}
          </button>
          {png && (
            <button className="button full" onClick={share}>
              共有 / iPhoneに保存
            </button>
          )}
          <p className="helper">
            利用条件をご確認のうえ保存・共有してください。出典情報はPNG下部に記載されます。
          </p>
        </Modal>
      )}
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button aria-label="通知を閉じる" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {busy && (
        <div className="busy-indicator" role="status">
          画像を処理しています…
        </div>
      )}
    </>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-btn" aria-label="閉じる" onClick={close}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
