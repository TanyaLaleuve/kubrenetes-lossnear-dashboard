"use client";

import { useState } from "react";
import {
  MessageBuilder,
  MessageBuilderModal,
} from "@/components/message-builder/MessageBuilder";
import { emptyPayload, type MessagePayload } from "@/lib/messages/payload";

const SAMPLE: MessagePayload = {
  content: "Bienvenue sur **{server}** ! 🎉",
  embeds: [
    {
      author: { name: "LossNear", url: "", iconUrl: "" },
      title: "Règlement",
      url: "",
      description:
        "Merci de lire les règles.\n\n> Sois respectueux\n> Pas de spam\n\nOn est **{server.members}** membres !",
      color: "#5865F2",
      fields: [
        { name: "Salon", value: "{channel}", inline: true },
        { name: "Date", value: "{date}", inline: true },
      ],
      image: "",
      thumbnail: "",
      footer: { text: "LossNear", iconUrl: "" },
      timestamp: true,
    },
  ],
};

export function MessageBuilderDemo() {
  const [inline, setInline] = useState<MessagePayload>(SAMPLE);
  const [modal, setModal] = useState<MessagePayload>(emptyPayload());

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Version inline (module Messages)</h2>
          <p className="text-xs text-muted-foreground">
            Le builder est l&apos;objectif de la page : contenu + embeds, aperçu
            en direct.
          </p>
        </div>
        <MessageBuilder value={inline} onChange={setInline} />
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <div>
          <h2 className="text-sm font-semibold">
            Version modale (bouton « Personnaliser »)
          </h2>
          <p className="text-xs text-muted-foreground">
            À utiliser partout où l&apos;on personnalise un message existant
            (bienvenue, logs…).
          </p>
        </div>
        <MessageBuilderModal value={modal} onChange={setModal} />
      </section>

      <section className="space-y-2 border-t border-border pt-6">
        <h2 className="text-sm font-semibold">Payload généré (debug)</h2>
        <pre className="max-h-64 overflow-auto rounded-xl border border-border bg-[#04070f] p-3 font-mono text-xs">
          {JSON.stringify(inline, null, 2)}
        </pre>
      </section>
    </div>
  );
}
