"use client";

import { Fragment, type ReactNode } from "react";
import {
  isEmbedEmpty,
  substituteVariables,
  type EmbedData,
  type MessagePayload,
  type MessageVariable,
} from "@/lib/messages/payload";

/** Formatage inline minimal façon Discord (gras/italique/souligné/barré/code). */
function formatInline(text: string, keyPrefix = "i"): ReactNode[] {
  const patterns: [RegExp, (inner: string, k: string) => ReactNode][] = [
    [/^\*\*([\s\S]+?)\*\*/, (s, k) => <strong key={k}>{formatInline(s, k)}</strong>],
    [/^__([\s\S]+?)__/, (s, k) => <u key={k}>{formatInline(s, k)}</u>],
    [/^~~([\s\S]+?)~~/, (s, k) => <s key={k}>{formatInline(s, k)}</s>],
    [/^\*([\s\S]+?)\*/, (s, k) => <em key={k}>{formatInline(s, k)}</em>],
    [/^_([\s\S]+?)_/, (s, k) => <em key={k}>{formatInline(s, k)}</em>],
    [
      /^`([^`]+?)`/,
      (s, k) => (
        <code
          key={k}
          className="rounded bg-black/40 px-1 py-0.5 font-mono text-[85%]"
        >
          {s}
        </code>
      ),
    ],
  ];

  const nodes: ReactNode[] = [];
  let buffer = "";
  let i = 0;
  let n = 0;
  while (i < text.length) {
    const sub = text.slice(i);
    let matched = false;
    for (const [re, render] of patterns) {
      const m = sub.match(re);
      if (m) {
        if (buffer) {
          nodes.push(buffer);
          buffer = "";
        }
        nodes.push(render(m[1], `${keyPrefix}-${n++}`));
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      buffer += text[i];
      i++;
    }
  }
  if (buffer) nodes.push(buffer);
  return nodes;
}

/** Rendu multi-ligne : titres (#), citations (>), listes, sinon inline. */
function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, idx) => {
        let content: ReactNode;
        if (/^###\s+/.test(line)) {
          content = (
            <span className="text-base font-bold">
              {formatInline(line.replace(/^###\s+/, ""), `h3-${idx}`)}
            </span>
          );
        } else if (/^##\s+/.test(line)) {
          content = (
            <span className="text-lg font-bold">
              {formatInline(line.replace(/^##\s+/, ""), `h2-${idx}`)}
            </span>
          );
        } else if (/^#\s+/.test(line)) {
          content = (
            <span className="text-xl font-bold">
              {formatInline(line.replace(/^#\s+/, ""), `h1-${idx}`)}
            </span>
          );
        } else if (/^>\s?/.test(line)) {
          content = (
            <span className="flex gap-2">
              <span className="w-0.5 shrink-0 rounded bg-[#4e5058]" aria-hidden />
              <span>{formatInline(line.replace(/^>\s?/, ""), `q-${idx}`)}</span>
            </span>
          );
        } else if (/^[-*]\s+/.test(line)) {
          content = (
            <span className="flex gap-2 pl-1">
              <span aria-hidden>•</span>
              <span>{formatInline(line.replace(/^[-*]\s+/, ""), `l-${idx}`)}</span>
            </span>
          );
        } else {
          content = formatInline(line, `p-${idx}`);
        }
        return (
          <Fragment key={idx}>
            {idx > 0 && <br />}
            {content}
          </Fragment>
        );
      })}
    </>
  );
}

function EmbedView({
  embed,
  variables,
}: {
  embed: EmbedData;
  variables: MessageVariable[];
}) {
  const sub = (t: string) => substituteVariables(t, variables);
  const color = /^#[0-9a-fA-F]{6}$/.test(embed.color) ? embed.color : "#4f545c";

  return (
    <div
      className="mt-1 max-w-[440px] overflow-hidden rounded border-l-4 bg-[#2b2d31] text-[#dbdee1]"
      style={{ borderLeftColor: color }}
    >
      <div className="flex gap-3 p-3">
        <div className="min-w-0 flex-1 text-sm leading-snug">
          {embed.author.name && (
            <div className="mb-1.5 flex items-center gap-2">
              {embed.author.iconUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={embed.author.iconUrl}
                  alt=""
                  className="size-6 rounded-full object-cover"
                />
              )}
              <span className="text-xs font-semibold text-white">
                {sub(embed.author.name)}
              </span>
            </div>
          )}

          {embed.title && (
            <div
              className={`mb-1 font-semibold ${
                embed.url ? "text-[#00a8fc]" : "text-white"
              }`}
            >
              {sub(embed.title)}
            </div>
          )}

          {embed.description && (
            <div className="whitespace-pre-wrap text-[13px] text-[#dbdee1]">
              <RichText text={sub(embed.description)} />
            </div>
          )}

          {embed.fields.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {embed.fields.map((f, i) => (
                <div
                  key={i}
                  className={f.inline ? "col-span-1" : "col-span-3"}
                >
                  {f.name && (
                    <div className="text-xs font-semibold text-white">
                      {sub(f.name)}
                    </div>
                  )}
                  {f.value && (
                    <div className="whitespace-pre-wrap text-[13px] text-[#dbdee1]">
                      <RichText text={sub(f.value)} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {embed.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={embed.image}
              alt=""
              className="mt-3 max-h-72 w-full rounded object-cover"
            />
          )}

          {(embed.footer.text || embed.timestamp) && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#949ba4]">
              {embed.footer.iconUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={embed.footer.iconUrl}
                  alt=""
                  className="size-4 rounded-full object-cover"
                />
              )}
              {embed.footer.text && <span>{sub(embed.footer.text)}</span>}
              {embed.footer.text && embed.timestamp && <span>•</span>}
              {embed.timestamp && (
                <span>
                  {new Date().toLocaleDateString("fr-FR")}{" "}
                  {new Date().toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          )}
        </div>

        {embed.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={embed.thumbnail}
            alt=""
            className="size-20 shrink-0 rounded object-cover"
          />
        )}
      </div>
    </div>
  );
}

export function DiscordMessagePreview({
  payload,
  variables,
  botName = "LossNear",
  botAvatar,
}: {
  payload: MessagePayload;
  variables: MessageVariable[];
  botName?: string;
  botAvatar?: string;
}) {
  const visibleEmbeds = payload.embeds.filter((e) => !isEmbedEmpty(e));
  const empty = !payload.content && visibleEmbeds.length === 0;
  const now = new Date().toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="rounded-xl bg-[#313338] p-4 font-sans text-[#dbdee1]">
      <div className="flex gap-3">
        <div className="size-10 shrink-0 overflow-hidden rounded-full bg-[#5865F2]">
          {botAvatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={botAvatar} alt="" className="size-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{botName}</span>
            <span className="rounded bg-[#5865F2] px-1 py-px text-[10px] font-semibold uppercase text-white">
              App
            </span>
            <span className="text-xs text-[#949ba4]">
              Aujourd&apos;hui à {now}
            </span>
          </div>

          {empty ? (
            <p className="mt-1 text-sm text-[#949ba4] italic">
              Aperçu vide — écris un contenu ou ajoute un embed.
            </p>
          ) : (
            <>
              {payload.content && (
                <div className="mt-0.5 whitespace-pre-wrap text-sm leading-snug text-[#dbdee1]">
                  <RichText text={substituteVariables(payload.content, variables)} />
                </div>
              )}
              {visibleEmbeds.map((embed, i) => (
                <EmbedView key={i} embed={embed} variables={variables} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
