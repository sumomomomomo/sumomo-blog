/** Spec-highlighted objects keyed by payload label, with kind and a2a-specs.md section. */
const specObjects: Record<string, { kind: string; section: string }> = {
  // 4.1 Core Objects
  task: { kind: "Core object", section: "4.1.1" },
  status: { kind: "Core object", section: "4.1.2" },
  message: { kind: "Core object", section: "4.1.4" },
  role: { kind: "Core object", section: "4.1.5" },
  parts: { kind: "Core object", section: "4.1.6" },
  artifact: { kind: "Core object", section: "4.1.7" },
  artifacts: { kind: "Core object", section: "4.1.7" },
  statusupdate: { kind: "Core object", section: "4.2.1" },
  artifactupdate: { kind: "Core object", section: "4.2.2" },
  // 3.2 Operation Parameter Objects
  request: { kind: "Operation parameter object", section: "3.2.1" },
  configuration: { kind: "Operation parameter object", section: "3.2.2" },
  streamresponse: { kind: "Operation parameter object", section: "3.2.3" },
  metadata: { kind: "Operation parameter object", section: "3.2.5" },
};

function valueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `array · ${value.length}`;
  return typeof value;
}

function makeNode(label: string, value: unknown, depth = 0): HTMLElement {
  const node = document.createElement("div");
  node.className =
    depth === 0
      ? "rounded-xl border-2 border-stone-300 bg-stone-50 p-3 transition-[filter] dark:border-slate-600 dark:bg-slate-900"
      : "rounded-lg border border-stone-200 bg-white/70 p-2.5 transition-[filter] dark:border-slate-700 dark:bg-slate-950/70";
  node.dataset.treeNode = "";
  node.dataset.treeKind = valueType(value).split(" · ")[0];
  node.setAttribute("role", "group");
  node.setAttribute("aria-label", `${label}: ${valueType(value)}`);

  const header = document.createElement("div");
  header.className = "flex items-baseline gap-2";

  const name = document.createElement("span");
  name.className = "break-all font-mono text-xs font-bold text-sky-700 dark:text-sky-300";
  name.textContent = label;

  const type = document.createElement("span");
  const specObject = specObjects[label.toLowerCase()];
  if (specObject) {
    type.className =
      "text-xs text-violet-700 underline decoration-dotted underline-offset-2 dark:text-violet-300";
    type.title = `${specObject.kind} (${specObject.section})`;
    type.textContent = specObject.kind === "Core object" ? "core object" : "parameter object";
  } else {
    type.className = "text-xs text-stone-500 dark:text-slate-400";
    type.textContent = valueType(value);
  }
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

export function renderDataTree(container: HTMLElement, value: unknown, label: string): void {
  container.replaceChildren(makeNode(label, value));

  // Darken only the innermost box under the cursor; ancestors stay normal.
  if (!container.dataset.treeHoverBound) {
    container.dataset.treeHoverBound = "true";
    const clear = () => {
      for (const node of container.querySelectorAll("[data-tree-node]")) {
        node.classList.remove("brightness-[0.92]");
      }
    };
    container.addEventListener("mouseover", (event) => {
      clear();
      const innermost = (event.target as Element).closest("[data-tree-node]");
      innermost?.classList.add("brightness-[0.92]");
    });
    container.addEventListener("mouseleave", clear);
  }
}
