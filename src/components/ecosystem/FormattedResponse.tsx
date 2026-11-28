import React from "react";
import { parseInline, parseReport } from "../../utils/responsePresentation";

function Inline({ text }: { text: string }) {
  return <>{parseInline(text).map((part, i) =>
    part.kind === "strong" ? <strong key={i}>{part.text}</strong> :
    part.kind === "em" ? <em key={i}>{part.text}</em> :
    part.kind === "code" ? <code key={i} className="rounded bg-slate-100 dark:bg-zinc-800 px-1 break-all">{part.text}</code> :
    <React.Fragment key={i}>{part.text}</React.Fragment>
  )}</>;
}

export function FormattedResponse({ value }: { value: string }) {
  const blocks = parseReport(value);
  if (!blocks.length) return <p className="text-sm text-slate-500 dark:text-zinc-400">No content in this section.</p>;
  return <div className="space-y-3 text-sm leading-relaxed text-slate-800 dark:text-zinc-200 break-words">
    {blocks.map((block, i) => {
      switch (block.kind) {
        case "heading": return <h4 key={i} className="text-base font-bold text-slate-950 dark:text-white pt-2"><Inline text={block.text}/></h4>;
        case "paragraph": return <p key={i} className="whitespace-pre-wrap"><Inline text={block.text}/></p>;
        case "code": return <pre key={i} className="overflow-x-auto rounded-lg bg-slate-100 dark:bg-zinc-900 p-3 text-xs whitespace-pre-wrap break-all">{block.text}</pre>;
        case "list": {
          const List = block.ordered ? "ol" : "ul";
          return <List key={i} className={`pl-5 space-y-2 ${block.ordered ? "list-decimal" : "list-disc"}`}>{block.items.map((item, j) => <li key={j}><Inline text={item}/></li>)}</List>;
        }
        case "table": return <div key={i} className="overflow-x-auto"><table className="w-full text-sm border-collapse"><thead><tr>{block.headers.map((h, j) => <th key={j} scope="col" className="border border-slate-200 dark:border-zinc-700 p-2 text-left bg-slate-100 dark:bg-zinc-800"><Inline text={h}/></th>)}</tr></thead><tbody>{block.rows.map((row, j) => <tr key={j}>{row.map((cell,k) => <td key={k} className="border border-slate-200 dark:border-zinc-700 p-2 align-top"><Inline text={cell}/></td>)}</tr>)}</tbody></table></div>;
      }
    })}
  </div>;
}
