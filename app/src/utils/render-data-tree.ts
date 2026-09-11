interface SpecRef {
  /** Tooltip text for spec-defined objects. */
  hover?: string;
  /** Display override for the node's type label. */
  type?: string;
  /** Display type for elements of an array of spec objects. */
  itemType?: string;
  /** Child keys that must not inherit a spec lookup (e.g. error.message). */
  ignore?: string[];
}

/**
 * Spec-highlighted objects keyed by payload label, derived from a2a-specs.md.
 * Core objects: §4.1/4.2. Operation parameter objects: §3.1/3.2/9.4.
 */
const specObjects: Record<string, SpecRef> = {
  // 4.1 Core Objects
  task: { hover: "Core object (4.1.1)", type: "Task" },
  status: { hover: "Core object (4.1.2)", type: "TaskStatus" },
  state: { hover: "Core object (4.1.3)", type: "TaskState" },
  message: { hover: "Core object (4.1.4)", type: "Message" },
  role: { hover: "Core object (4.1.5)", type: "Role" },
  parts: { hover: "Core object (4.1.6)", type: "Part[]", itemType: "Part" },
  artifact: { hover: "Core object (4.1.7)", type: "Artifact" },
  artifacts: { hover: "Core object (4.1.7)", type: "Artifact[]", itemType: "Artifact" },
  history: { hover: "Core object (4.1.4)", type: "Message[]", itemType: "Message" },
  statusupdate: { hover: "Core object (4.2.1)", type: "TaskStatusUpdateEvent" },
  artifactupdate: { hover: "Core object (4.2.2)", type: "TaskArtifactUpdateEvent" },
  // 3.1/3.2 Operation request and response objects
  sendmessagerequest: {
    hover: "Operation parameter object (3.2.1)",
    type: "SendMessageRequest",
  },
  gettaskrequest: { hover: "Operation parameter object (3.1.3)", type: "GetTaskRequest" },
  canceltaskrequest: { hover: "Operation parameter object (3.1.5)", type: "CancelTaskRequest" },
  sendmessageresponse: {
    hover: "Operation parameter object (9.4.1)",
    type: "SendMessageResponse",
  },
  streamresponse: { hover: "Operation parameter object (3.2.3)", type: "StreamResponse" },
  configuration: {
    hover: "Operation parameter object (3.2.2)",
    type: "SendMessageConfiguration",
  },
  metadata: { hover: "Operation parameter object (3.2.5)", type: "Metadata" },
  // Well-known or scalar spec types without object semantics
  timestamp: { type: "timestamp" },
  acceptedoutputmodes: { type: "string[]" },
  historylength: { type: "integer" },
  // JSON-RPC error payloads: `message` is a plain string, not a Message object
  error: { ignore: ["message"] },
};

function valueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `array · ${value.length}`;
  return typeof value;
}

function makeNode(label: string, value: unknown, depth = 0, ctx?: SpecRef): HTMLElement {
  const spec = ctx ?? specObjects[label.toLowerCase()];
  const typeDisplay = spec?.type ?? valueType(value);
  const node = document.createElement("div");
  node.className =
    depth === 0
      ? "rounded-xl border-2 border-stone-300 bg-stone-50 p-3 transition-[filter] dark:border-slate-600 dark:bg-slate-900"
      : "rounded-lg border border-stone-200 bg-white/70 p-2.5 transition-[filter] dark:border-slate-700 dark:bg-slate-950/70";
  node.dataset.treeKind = typeDisplay.split(" · ")[0];
  node.dataset.treeNode = "";
  node.setAttribute("role", "group");
  node.setAttribute("aria-label", `${label}: ${typeDisplay}`);

  const header = document.createElement("div");
  header.className = "flex items-baseline gap-2";

  const name = document.createElement("span");
  name.className = "break-all font-mono text-xs font-bold text-sky-700 dark:text-sky-300";
  name.textContent = label;

  const type = document.createElement("span");
  if (spec?.hover) {
    type.className =
      "text-xs text-violet-700 underline decoration-dotted underline-offset-2 dark:text-violet-300";
    type.title = spec.hover;
  } else {
    type.className = "text-xs text-stone-500 dark:text-slate-400";
  }
  type.textContent = typeDisplay;
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
      children.append(
        ...entries.map(([key, item]) => {
          let childCtx: SpecRef | undefined;
          if (Array.isArray(value) && spec?.itemType) {
            childCtx = { hover: spec.hover, type: spec.itemType };
          } else if (spec?.ignore?.includes(key)) {
            childCtx = {};
          }
          return makeNode(key, item, depth + 1, childCtx);
        }),
      );
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
