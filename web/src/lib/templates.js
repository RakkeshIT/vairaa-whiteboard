// Teaching templates: each builds ordinary, fully editable elements around (0, 0).
import { uid } from "./elements";
import { fitText, INK } from "./render";

const base = { strokeWidth: 3, strokeStyle: "solid", opacity: 1, stroke: INK };

const text = (value, cx, cy, { size = 28, bold = false, font = "sans", color = INK, left = false } = {}) => {
  const el = fitText({
    ...base,
    id: uid(),
    type: "text",
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    text: value,
    stroke: color,
    strokeWidth: 1,
    font,
    fontSize: size,
    bold,
  });
  return { ...el, x: left ? cx : cx - el.w / 2, y: cy - el.h / 2 };
};
const box = (type, x, y, w, h, { fill = "transparent", stroke = INK, dashed = false } = {}) => ({
  ...base,
  id: uid(),
  type,
  x,
  y,
  w,
  h,
  fill,
  stroke,
  strokeStyle: dashed ? "dashed" : "solid",
});
/** A shape with a centred label. */
const node = (type, label, cx, cy, w, h, opts = {}) => [
  box(type, cx - w / 2, cy - h / 2, w, h, opts),
  text(label, cx, cy, { size: opts.size || 24 }),
];
const arrow = (x1, y1, x2, y2, { stroke = INK, dashed = false } = {}) => ({
  ...base,
  id: uid(),
  type: "arrow",
  stroke,
  strokeStyle: dashed ? "dashed" : "solid",
  points: [
    [x1, y1],
    [x2, y2],
  ],
});
const line = (x1, y1, x2, y2, { width = 3, stroke = INK } = {}) => ({
  ...arrow(x1, y1, x2, y2, { stroke }),
  type: "line",
  strokeWidth: width,
});
const sticky = (value, x, y, fill, { w = 260, h = 220, size = 22 } = {}) => ({
  ...base,
  id: uid(),
  type: "sticky",
  x,
  y,
  w,
  h,
  fill,
  text: value,
  strokeWidth: 1,
  font: "sans",
  fontSize: size,
});

const TEMPLATES = [
  {
    id: "lesson",
    name: "Lesson plan",
    description: "Title, objectives, agenda, key terms and an exit ticket",
    build: () => [
      text("Lesson title", 0, -330, { size: 56, bold: true }),
      text("Topic · Date · Class", 0, -265, { size: 24, color: "#868e96" }),
      sticky("🎯 Learning objectives\n\n1. \n2. \n3. ", -570, -200, "#fef08a"),
      sticky("🗓️ Agenda\n\n• Warm-up\n• Concept\n• Practice\n• Recap", -280, -200, "#bfdbfe"),
      sticky("📖 Key terms\n\n• \n• \n• ", 10, -200, "#bbf7d0"),
      sticky("🎟️ Exit ticket\n\nOne thing I learned:\nOne question I have:", 300, -200, "#fbcfe8"),
      box("rect", -570, 60, 1130, 300, { dashed: true, stroke: "#868e96" }),
      text("Main board area", -540, 95, { size: 24, color: "#868e96", left: true }),
    ],
  },
  {
    id: "kwl",
    name: "KWL chart",
    description: "What students Know, Want to know and Learned",
    build: () => {
      const cols = [
        ["K · What I Know", "#a5d8ff"],
        ["W · What I Want to know", "#ffec99"],
        ["L · What I Learned", "#b2f2bb"],
      ];
      return [
        text("Topic: ______________", 0, -330, { size: 44, bold: true }),
        ...cols.flatMap(([title, fill], i) => {
          const x = -540 + i * 370;
          return [box("rect", x, -260, 340, 80, { fill }), text(title, x + 170, -220, { size: 24, bold: true }), box("rect", x, -170, 340, 480)];
        }),
      ];
    },
  },
  {
    id: "flowchart",
    name: "Flowchart",
    description: "Start → process → decision with yes/no branches",
    build: () => [
      ...node("ellipse", "Start", 0, -360, 200, 80, { fill: "#b2f2bb" }),
      arrow(0, -320, 0, -260),
      ...node("rect", "Read input", 0, -220, 240, 80, { fill: "#a5d8ff" }),
      arrow(0, -180, 0, -120),
      ...node("diamond", "Condition?", 0, -40, 260, 160, { fill: "#ffec99" }),
      arrow(-130, -40, -300, -40),
      text("Yes", -215, -70, { size: 22, color: "#2f9e44", bold: true }),
      ...node("rect", "Do A", -400, -40, 200, 80, { fill: "#a5d8ff" }),
      arrow(130, -40, 300, -40),
      text("No", 215, -70, { size: 22, color: "#e03131", bold: true }),
      ...node("rect", "Do B", 400, -40, 200, 80, { fill: "#a5d8ff" }),
      arrow(-400, 0, -60, 180),
      arrow(400, 0, 60, 180),
      ...node("ellipse", "End", 0, 220, 200, 80, { fill: "#ffc9c9" }),
    ],
  },
  {
    id: "system",
    name: "System design",
    description: "Client, load balancer, services, cache, database and queue",
    build: () => [
      text("System architecture", 0, -330, { size: 44, bold: true }),
      ...node("rect", "Client app", -560, 0, 200, 90, { fill: "#e9ecef" }),
      arrow(-460, 0, -350, 0),
      ...node("rect", "Load balancer", -230, 0, 230, 90, { fill: "#eebefa" }),
      arrow(-115, -20, 20, -110),
      arrow(-115, 20, 20, 110),
      ...node("rect", "API server 1", 130, -120, 220, 90, { fill: "#a5d8ff" }),
      ...node("rect", "API server 2", 130, 120, 220, 90, { fill: "#a5d8ff" }),
      arrow(240, -120, 430, -170),
      arrow(240, 120, 430, 0),
      arrow(240, 140, 430, 190),
      ...node("rect", "Cache (Redis)", 540, -170, 220, 80, { fill: "#ffec99" }),
      ...node("ellipse", "Database", 540, 0, 220, 100, { fill: "#b2f2bb" }),
      ...node("rect", "Queue → Worker", 540, 190, 220, 80, { fill: "#ffc9c9" }),
    ],
  },
  {
    id: "compare",
    name: "Compare (T-chart)",
    description: "Two options side by side, e.g. pros vs cons",
    build: () => [
      text("Compare", 0, -330, { size: 44, bold: true }),
      line(-500, -200, 500, -200, { width: 4 }),
      line(0, -270, 0, 330, { width: 4 }),
      text("Option A", -250, -235, { size: 32, bold: true, color: "#1971c2" }),
      text("Option B", 250, -235, { size: 32, bold: true, color: "#9c36b5" }),
      text("• \n• \n• ", -460, -110, { size: 28, left: true, font: "hand" }),
      text("• \n• \n• ", 40, -110, { size: 28, left: true, font: "hand" }),
    ],
  },
  {
    id: "axes",
    name: "Coordinate plane",
    description: "x/y axes from −5 to 5 for graphs and functions",
    build: () => {
      const u = 60;
      const els = [arrow(-6 * u, 0, 6.3 * u, 0, { stroke: INK }), arrow(0, 6 * u, 0, -6.3 * u), text("x", 6.6 * u, 0, { size: 26, font: "hand" }), text("y", 0, -6.7 * u, { size: 26, font: "hand" })];
      for (let i = -5; i <= 5; i++) {
        if (!i) continue;
        els.push(line(i * u, -8, i * u, 8, { width: 2 }), text(String(i), i * u, 26, { size: 18, color: "#868e96" }));
        els.push(line(-8, -i * u, 8, -i * u, { width: 2 }), text(String(i), -26, -i * u, { size: 18, color: "#868e96" }));
      }
      els.push(text("0", -20, 22, { size: 18, color: "#868e96" }));
      return els;
    },
  },
  {
    id: "timeline",
    name: "Timeline",
    description: "Five milestones along a line",
    build: () => {
      const els = [text("Timeline", 0, -220, { size: 44, bold: true }), arrow(-620, 0, 640, 0, { stroke: "#868e96" })];
      const colors = ["#a5d8ff", "#b2f2bb", "#ffec99", "#ffc9c9", "#eebefa"];
      colors.forEach((fill, i) => {
        const x = -500 + i * 250;
        els.push(box("ellipse", x - 18, -18, 36, 36, { fill }), text(`Step ${i + 1}`, x, -70, { size: 26, bold: true }), text("Details…", x, 70, { size: 22, color: "#868e96", font: "hand" }));
      });
      return els;
    },
  },
  {
    id: "code",
    name: "Code walkthrough",
    description: "A code block with discussion prompts",
    build: () => {
      const code = fitText({
        ...base,
        id: uid(),
        type: "code",
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        language: "python",
        theme: "dark",
        fontSize: 20,
        strokeWidth: 1,
        code: 'def greet(name):\n    message = f"Hello, {name}!"\n    return message\n\nfor student in ["Asha", "Ravi"]:\n    print(greet(student))',
      });
      const c = { ...code, x: -code.w - 40, y: -code.h / 2 };
      return [
        text("Code walkthrough", -c.w / 2 - 40, c.y - 80, { size: 40, bold: true }),
        c,
        sticky("❓ What does this print?", 40, c.y, "#fef08a", { h: 150 }),
        sticky("🔍 What happens if the list is empty?", 40, c.y + 170, "#bfdbfe", { h: 150 }),
        sticky("✏️ Change it to greet in your language", 330, c.y + 85, "#bbf7d0", { h: 150 }),
      ];
    },
  },
];

export default TEMPLATES;
