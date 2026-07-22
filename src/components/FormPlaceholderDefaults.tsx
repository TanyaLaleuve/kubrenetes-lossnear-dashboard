"use client";

import { useEffect } from "react";

/**
 * Confort global : sur tout le site, un champ texte laissé vide est soumis avec
 * la valeur de son placeholder (le placeholder = valeur par défaut).
 *
 * S'applique aux <input> texte et aux <textarea>. Exclusions :
 * - les mots de passe et champs non-texte (nombre, email, case à cocher…) ;
 * - tout champ (ou formulaire/conteneur) portant l'attribut `data-keep-empty`
 *   — utilisé pour les placeholders qui sont des exemples et non des défauts
 *   (adresse, pseudo à inviter, variables d'env, exemples des eggs…).
 *
 * Monté dans le layout protégé : la page de connexion (hors layout) n'est donc
 * jamais affectée (identifiant + mot de passe de connexion préservés).
 *
 * Écoute en phase de capture pour remplir le DOM avant que React ne construise
 * le FormData de l'action serveur.
 */
const FILLABLE_INPUT_TYPES = new Set(["text", "search", "url", "tel"]);

export function FormPlaceholderDefaults() {
  useEffect(() => {
    function handler(event: SubmitEvent) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;

      const fields = form.querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement
      >("input, textarea");

      fields.forEach((el) => {
        // Opt-out explicite (le champ, un fieldset parent ou le formulaire).
        if (el.closest("[data-keep-empty]")) return;

        const isTextarea = el.tagName === "TEXTAREA";
        if (
          !isTextarea &&
          !FILLABLE_INPUT_TYPES.has((el as HTMLInputElement).type)
        ) {
          return;
        }

        const placeholder = el.placeholder;
        if (placeholder && el.value.trim() === "") {
          el.value = placeholder;
        }
      });
    }

    document.addEventListener("submit", handler, true);
    return () => document.removeEventListener("submit", handler, true);
  }, []);

  return null;
}
