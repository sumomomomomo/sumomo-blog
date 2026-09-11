function valueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `array · ${value.length}`;
  return typeof value;
}

function makeNode(label: string, value: unknown, depth = 0): HTMLElement {
  const node = document.createElement("div");
  node.className =
    depth === 0
      ? "rounded-xl border-2 border-stone-300 bg-stone-50 p-3 dark:border-slate-600 dark:bg-slate-900"
      : "rounded-lg border border-stone-200 bg-white/70 p-2.5 dark:border-slate-700 dark:bg-slate-950/70";
  node.dataset.treeKind = valueType(value).split(" · ")[0];
  node.setAttribute("role", "group");
  node.setAttribute("aria-label", `${label}: ${valueType(value)}`);

  const header = document.createElement("div");
  header.className = "flex items-baseline gap-2";

  const name = document.createElement("span");
  name.className = "break-all font-mono text-xs font-bold text-sky-700 dark:text-sky-300";
  name.textContent = label;

  const type = document.createElement("span");
  type.className = "text-xs text-stone-500 dark:text-slate-400";
  type.textContent = valueType(value);
  header.append(name, type);
  node.append(header);

  if (value !== null && typeof value === "object") {
    const children = document.createElement("div");
    children.className = "mt-2 grid gap-2";
    const entries: [string, unknown][] = Array.isArray(value)
      ? value.map((item, index) => [`[${index}]`, item])
      : Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      const empty = document.createElement("span");
      empty.className = "font-mono text-xs italic text-stone-400 dark:text-slate-500";
      empty.textContent = "empty";
      children.append(empty);
    } else {
      children.append(...entries.map(([key, item]) => makeNode(key, item, depth + 1)));
    }
    node.append(children);
    return node;
  }

  const primitive = document.createElement("div");
  primitive.className = `mt-1.5 whitespace-pre-wrap break-words font-mono text-sm ${
    value === null || value === undefined
      ? "italic text-stone-400 dark:text-slate-500"
      : typeof value === "string"
        ? "text-emerald-700 dark:text-emerald-300"
        : typeof value === "boolean"
          ? "text-violet-700 dark:text-violet-300"
          : "text-amber-700 dark:text-amber-300"
  }`;
  primitive.textContent = value === "" ? "(empty string)" : String(value);
  node.append(primitive);
  return node;
}

export function renderDataTree(container: Element, value: unknown, label: string): void {
  container.replaceChildren(makeNode(label, value));
}
