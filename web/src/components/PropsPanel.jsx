import {
  ArrowUpToLine,
  ArrowDownToLine,
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Plus,
  Circle,
  Pencil,
  MousePointer2,
  Bold,
  Italic,
  Underline,
  ListOrdered,
  Lock,
  PencilLine,
} from "lucide-react";
import { useState } from "react";
import { INK } from "../lib/render";
import { POINTER_TOOLS } from "../lib/cursors";
import { BULLETS } from "../lib/text";

// ---- stamps: emoji avatars, point markers and reactions
const em = (s) => [...s.matchAll(/\S+/gu)].map((m) => ({ kind: "emoji", v: m[0] }));
const NUMBER = { kind: "number" };
export const STAMP_SETS = {
  Avatars: em("😀 😃 😎 🤓 🥳 🤔 😍 😂 😴 😮 😢 😡 🧑‍💻 👩‍💻 👨‍🏫 👩‍🏫 👨‍🎓 👩‍🎓 🦸 🧑‍🚀 🤖 👻 🐱 🦁"),
  Points: [NUMBER, ...em("✅ ❌ ⭐ 📌 📍 ➡️ ⬅️ ⬆️ ⬇️ ✔️ ❗ ❓ ⚠️ 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ 💡 🎯 🔥")],
  Emoji: em("👍 👎 👏 🙌 🙏 🤝 👀 💪 ❤️ 🎉 🚀 ✨ 💯 🏆 📈 📉 📝 📅 ⏰ 💬 💰 🔒 🌟 ☕"),
};
const QUICK = [NUMBER, ...em("✅ ❌ ⭐ 📌 💡 😀 👍 ❤️")];

function StampButton({ item, active, onClick }) {
  return (
    <button
      title={item.kind === "number" ? "Numbered marker 1, 2, 3… (auto)" : item.v}
      onClick={onClick}
      className={`h-8 rounded-lg grid place-items-center text-lg leading-none transition hover:scale-110 ${
        active ? "bg-indigo-100 ring-2 ring-indigo-400 dark:bg-indigo-500/25" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
      }`}
    >
      {item.kind === "number" ? (
        <span className="w-6 h-6 rounded-full bg-indigo-500 text-white text-[11px] font-bold grid place-items-center">1</span>
      ) : (
        <span style={{ fontFamily: '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif' }}>{item.v}</span>
      )}
    </button>
  );
}

function StampPicker({ values, onStamp, onChange }) {
  const [tab, setTab] = useState(values.stampKind === "number" ? "Points" : "Avatars");
  const isActive = (it) => (it.kind === "number" ? values.stampKind === "number" : values.stampKind === "emoji" && values.stamp === it.v);
  return (
    <>
      <Section title="Stamps · tap board to place">
        <div className="flex gap-1 mb-1">
          {Object.keys(STAMP_SETS).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 h-7 rounded-lg text-[11px] font-semibold transition ${
                tab === t
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-200"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-6 gap-0.5">
          {STAMP_SETS[tab].map((it) => (
            <StampButton key={it.kind + (it.v || "")} item={it} active={isActive(it)} onClick={() => onStamp(it)} />
          ))}
        </div>
      </Section>
      <Section title="Stamp size">
        <Seg
          options={[
            { v: 32, label: "S" },
            { v: 56, label: "M" },
            { v: 96, label: "L" },
            { v: 160, label: "XL" },
          ]}
          value={values.stampSize}
          onPick={(v) => onChange({ stampSize: v })}
        />
      </Section>
    </>
  );
}

export const STROKES = [INK, "#e03131", "#f08c00", "#2f9e44", "#1971c2", "#9c36b5", "#868e96"];
export const FILLS = ["transparent", "#ffc9c9", "#ffec99", "#b2f2bb", "#a5d8ff", "#eebefa", "#e9ecef"];
export const COVERS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#334155"];
export const STICKIES = ["#fef08a", "#fbcfe8", "#bfdbfe", "#bbf7d0", "#fed7aa", "#e9d5ff"];
const WIDTHS = [
  { v: 2, label: "S" },
  { v: 4, label: "M" },
  { v: 8, label: "L" },
  { v: 14, label: "XL" },
];

const Section = ({ title, children }) => (
  <div className="flex flex-col gap-1.5">
    <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">{title}</div>
    {children}
  </div>
);

function Swatches({ colors, value, onPick, dark }) {
  const custom = !colors.includes(value) && value !== "transparent";
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {colors.map((c) => (
        <button
          key={c}
          title={c === "transparent" ? "None" : c}
          onClick={() => onPick(c)}
          className={`w-6 h-6 rounded-md ring-1 ring-black/10 dark:ring-white/15 transition hover:scale-110 ${
            value === c ? "outline-2 outline-offset-2 outline-indigo-500" : ""
          }`}
          style={
            c === "transparent"
              ? { background: "repeating-conic-gradient(#d4d4d8 0 25%, transparent 0 50%) 50% / 8px 8px" }
              : { background: c === INK && dark ? "#e9e9ee" : c }
          }
        />
      ))}
      <label
        title="Custom colour"
        className={`relative w-6 h-6 rounded-md overflow-hidden ring-1 ring-black/10 dark:ring-white/15 cursor-pointer ${
          custom ? "outline-2 outline-offset-2 outline-indigo-500" : ""
        }`}
        style={{ background: custom ? value : "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
      >
        <input
          type="color"
          className="absolute inset-0 opacity-0 cursor-pointer"
          value={custom ? value : "#000000"}
          onChange={(e) => onPick(e.target.value)}
        />
      </label>
    </div>
  );
}

function Seg({ options, value, onPick }) {
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <button
          key={o.v}
          title={o.title || o.label}
          onClick={() => onPick(o.v)}
          className={`flex-1 h-8 px-2 rounded-lg text-xs font-medium transition ${
            value === o.v
              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-200"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const DashIcon = ({ dash }) => (
  <svg width="26" height="8" className="mx-auto">
    <line x1="2" y1="4" x2="24" y2="4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={dash} />
  </svg>
);

/**
 * types: element types currently in context (the active tool, or the selected elements).
 */
export default function PropsPanel({
  types,
  values,
  onChange,
  selCount,
  onLayer,
  onAlign,
  onDuplicate,
  onDelete,
  dark,
  editing,
  onToggleFmt,
  onList,
  onStamp,
  onEditRich,
  onLock,
}) {
  const has = (...t) => t.some((x) => types.includes(x));
  const strokeable = has("pen", "hl", "line", "arrow", "rect", "ellipse", "diamond", "text", "stamp", "math", "compass");
  const stampTool = types.length === 1 && types[0] === "stamp" && selCount === 0;
  const quickStamps = selCount === 0 && !editing && has("pen", "hl", "line", "arrow", "rect", "ellipse", "diamond");
  const shapes = has("rect", "ellipse", "diamond");
  const widths = has("pen", "hl", "line", "arrow", "rect", "ellipse", "diamond", "eraser", "compass");
  const penTool = selCount === 0 && !editing && types.length === 1 && types[0] === "pen";
  const eraserTool = selCount === 0 && types.length === 1 && types[0] === "eraser";
  const dashes = has("line", "arrow", "rect", "ellipse", "diamond");
  const fonts = has("text", "sticky");
  const opacity = !has("eraser", "laser") || selCount > 0;

  return (
    <div className="panel w-[212px] ui-panel-max-h overflow-y-auto no-scrollbar p-3 flex flex-col gap-3.5 text-zinc-700 dark:text-zinc-200">
      {stampTool && <StampPicker values={values} onStamp={onStamp} onChange={onChange} />}
      {quickStamps && (
        <Section title="Quick stamps · click, then tap board">
          <div className="grid grid-cols-5 gap-1">
            {QUICK.map((it) => (
              <StampButton key={it.kind + (it.v || "")} item={it} onClick={() => onStamp(it, { quick: true })} />
            ))}
            <button
              title="All emoji, avatars and points (S)"
              onClick={() => onStamp({ kind: values.stampKind, v: values.stamp })}
              className="h-8 rounded-lg text-[11px] font-semibold bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              More
            </button>
          </div>
        </Section>
      )}
      {has("text", "sticky") && (
        <Section title="Text style">
          <div className="flex gap-1">
            {[
              ["bold", Bold, "Bold (Ctrl+B)"],
              ["italic", Italic, "Italic (Ctrl+I)"],
              ["underline", Underline, "Underline (Ctrl+U)"],
            ].map(([k, Icon, label]) => (
              <button
                key={k}
                title={label}
                aria-pressed={!!values[k]}
                onClick={() => onToggleFmt(k)}
                className={`flex-1 h-8 rounded-lg grid place-items-center transition ${
                  values[k]
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-200"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                <Icon size={15} strokeWidth={k === "bold" ? 3 : 2} />
              </button>
            ))}
          </div>
        </Section>
      )}
      {has("text", "sticky") && (editing || selCount > 0) && (
        <Section title="Points · Enter continues">
          <div className="grid grid-cols-4 gap-1">
            {[...BULLETS, "num"].map((b) => (
              <button
                key={b}
                title={b === "num" ? "Numbered 1. 2. 3. (Ctrl+Shift+7)" : b === "•" ? "Bullets (Ctrl+Shift+8)" : `${b} points`}
                onClick={() => onList(b)}
                className="h-8 rounded-lg text-sm font-semibold bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                {b === "num" ? <ListOrdered size={15} className="mx-auto" /> : b}
              </button>
            ))}
          </div>
        </Section>
      )}
      {selCount === 0 && has(...POINTER_TOOLS) && (
        <Section title="Pointer · press .">
          <Seg
            options={[
              { v: "plus", label: <Plus size={15} className="mx-auto" />, title: "Plus" },
              { v: "dot", label: <span className="block mx-auto w-2.5 h-2.5 rounded-full bg-current" />, title: "Dot (brush size)" },
              { v: "ring", label: <Circle size={14} className="mx-auto" />, title: "Ring (brush size)" },
              { v: "pencil", label: <Pencil size={14} className="mx-auto" />, title: "Pencil" },
              { v: "arrow", label: <MousePointer2 size={14} className="mx-auto" />, title: "Arrow" },
            ]}
            value={values.pointer}
            onPick={(v) => onChange({ pointer: v })}
          />
        </Section>
      )}
      {penTool && (
        <>
          <Section title="Quick shapes · draw, then hold">
            <Seg
              options={[
                { v: true, label: "On", title: "Hold the pen still at the end of a stroke to snap it to a line, box, circle or diamond" },
                { v: false, label: "Off" },
              ]}
              value={values.shapeSnap !== false}
              onPick={(v) => onChange({ shapeSnap: v })}
            />
          </Section>
          <Section title="Stylus pressure">
            <Seg
              options={[
                { v: "off", label: "Off", title: "Even width, whatever the pressure" },
                { v: "soft", label: "Soft", title: "Thick lines with a light touch" },
                { v: "normal", label: "Mid", title: "Default response" },
                { v: "firm", label: "Firm", title: "Press harder for thick lines" },
              ]}
              value={values.pressureCurve || "normal"}
              onPick={(v) => onChange({ pressureCurve: v })}
            />
          </Section>
        </>
      )}
      {eraserTool && (
        <Section title="Eraser">
          <Seg
            options={[
              { v: "stroke", label: "Whole", title: "Erase whole strokes" },
              { v: "partial", label: "Partial", title: "Rub out only the part of the ink you touch" },
            ]}
            value={values.eraserMode || "stroke"}
            onPick={(v) => onChange({ eraserMode: v })}
          />
        </Section>
      )}
      {has("cover") && (
        <Section title="Cover colour">
          <Swatches colors={COVERS} value={values.coverFill} onPick={(c) => onChange({ coverFill: c })} dark={dark} />
        </Section>
      )}
      {strokeable && (
        <Section title="Stroke">
          <Swatches colors={STROKES} value={values.stroke} onPick={(c) => onChange({ stroke: c })} dark={dark} />
        </Section>
      )}
      {shapes && (
        <Section title="Fill">
          <Swatches colors={FILLS} value={values.fill} onPick={(c) => onChange({ fill: c })} dark={dark} />
        </Section>
      )}
      {has("sticky") && (
        <Section title="Note colour">
          <Swatches colors={STICKIES} value={values.stickyFill} onPick={(c) => onChange({ stickyFill: c })} dark={dark} />
        </Section>
      )}
      {widths && (
        <Section title={types.includes("eraser") && types.length === 1 ? "Eraser size" : "Stroke width"}>
          <Seg options={WIDTHS} value={values.strokeWidth} onPick={(v) => onChange({ strokeWidth: v })} />
          <input
            type="range"
            min="1"
            max="40"
            value={values.strokeWidth}
            onChange={(e) => onChange({ strokeWidth: +e.target.value }, { live: true })}
            onPointerUp={(e) => onChange({ strokeWidth: +e.target.value })}
            className="accent-indigo-500"
            aria-label="Stroke width"
          />
        </Section>
      )}
      {dashes && (
        <Section title="Stroke style">
          <Seg
            options={[
              { v: "solid", label: <DashIcon />, title: "Solid" },
              { v: "dashed", label: <DashIcon dash="6 5" />, title: "Dashed" },
              { v: "dotted", label: <DashIcon dash="0.1 5" />, title: "Dotted" },
            ]}
            value={values.strokeStyle}
            onPick={(v) => onChange({ strokeStyle: v })}
          />
        </Section>
      )}
      {fonts && (
        <>
          <Section title="Font">
            <Seg
              options={[
                { v: "hand", label: <span style={{ fontFamily: "Caveat", fontSize: 16 }}>Hand</span>, title: "Handwritten" },
                { v: "sans", label: "Sans" },
                { v: "mono", label: <span className="font-mono">Mono</span> },
              ]}
              value={values.font}
              onPick={(v) => onChange({ font: v })}
            />
          </Section>
          <Section title="Font size">
            <Seg
              options={[
                { v: 16, label: "S" },
                { v: 24, label: "M" },
                { v: 36, label: "L" },
                { v: 56, label: "XL" },
              ]}
              value={values.fontSize}
              onPick={(v) => onChange({ fontSize: v })}
            />
          </Section>
        </>
      )}
      {onEditRich && (
        <button
          onClick={onEditRich}
          className="h-9 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center gap-1.5"
        >
          <PencilLine size={15} /> {types.includes("code") ? "Edit code" : types.includes("graph") ? "Edit graph" : "Edit equation"}
        </button>
      )}
      {has("code") && (
        <>
          <Section title="Code theme">
            <Seg
              options={[
                { v: "dark", label: "Dark" },
                { v: "light", label: "Light" },
              ]}
              value={values.codeTheme}
              onPick={(v) => onChange({ codeTheme: v })}
            />
          </Section>
          <Section title="Code size">
            <Seg
              options={[
                { v: 14, label: "S" },
                { v: 20, label: "M" },
                { v: 28, label: "L" },
                { v: 40, label: "XL" },
              ]}
              value={values.codeFontSize}
              onPick={(v) => onChange({ codeFontSize: v })}
            />
          </Section>
          <Section title="Line numbers">
            <Seg
              options={[
                { v: true, label: "Show" },
                { v: false, label: "Hide" },
              ]}
              value={values.lineNumbers}
              onPick={(v) => onChange({ lineNumbers: v })}
            />
          </Section>
        </>
      )}
      {has("math") && (
        <Section title="Equation size">
          <Seg
            options={[
              { v: 28, label: "S" },
              { v: 40, label: "M" },
              { v: 64, label: "L" },
              { v: 96, label: "XL" },
            ]}
            value={values.mathSize}
            onPick={(v) => onChange({ mathSize: v })}
          />
        </Section>
      )}
      {opacity && (
        <Section title={`Opacity · ${Math.round(values.opacity * 100)}%`}>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={values.opacity}
            onChange={(e) => onChange({ opacity: +e.target.value }, { live: true })}
            onPointerUp={(e) => onChange({ opacity: +e.target.value })}
            className="accent-indigo-500"
            aria-label="Opacity"
          />
        </Section>
      )}
      {selCount > 0 && (
        <Section title="Layers">
          <div className="flex gap-1">
            <button className="icon-btn" title="Send to back ( Ctrl+Shift+[ )" onClick={() => onLayer("back")}>
              <ArrowDownToLine size={16} />
            </button>
            <button className="icon-btn" title="Send backward ( Ctrl+[ )" onClick={() => onLayer("backward")}>
              <ChevronDown size={16} />
            </button>
            <button className="icon-btn" title="Bring forward ( Ctrl+] )" onClick={() => onLayer("forward")}>
              <ChevronUp size={16} />
            </button>
            <button className="icon-btn" title="Bring to front ( Ctrl+Shift+] )" onClick={() => onLayer("front")}>
              <ArrowUpToLine size={16} />
            </button>
          </div>
        </Section>
      )}
      {selCount > 1 && (
        <Section title="Align">
          <div className="grid grid-cols-6 gap-0.5">
            {[
              ["left", AlignHorizontalJustifyStart, "Align left"],
              ["hcenter", AlignHorizontalJustifyCenter, "Align centre"],
              ["right", AlignHorizontalJustifyEnd, "Align right"],
              ["top", AlignVerticalJustifyStart, "Align top"],
              ["vcenter", AlignVerticalJustifyCenter, "Align middle"],
              ["bottom", AlignVerticalJustifyEnd, "Align bottom"],
            ].map(([k, Icon, label]) => (
              <button key={k} className="icon-btn !w-8 !h-8" title={label} onClick={() => onAlign(k)}>
                <Icon size={15} />
              </button>
            ))}
          </div>
        </Section>
      )}
      {selCount > 0 && (
        <Section title="Actions">
          <div className="flex gap-1">
            <button className="icon-btn" title="Duplicate (Ctrl+D)" onClick={onDuplicate}>
              <Copy size={16} />
            </button>
            <button className="icon-btn" title="Lock in place (e.g. a slide you draw over)" onClick={onLock}>
              <Lock size={16} />
            </button>
            <button className="icon-btn !text-red-500" title="Delete (Del)" onClick={onDelete}>
              <Trash2 size={16} />
            </button>
          </div>
        </Section>
      )}
    </div>
  );
}
