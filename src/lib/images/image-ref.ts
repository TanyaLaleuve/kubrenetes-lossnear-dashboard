/**
 * Décompose une référence d'image Docker en registre / dépôt / tag.
 * Ex. "ghcr.io/pterodactyl/yolks:java_17" ->
 *   { registry: "ghcr.io", repository: "pterodactyl/yolks", tag: "java_17" }
 * Ex. "itzg/minecraft-server:latest" ->
 *   { registry: "docker.io", repository: "itzg/minecraft-server", tag: "latest" }
 */
export function parseImageRef(ref: string): {
  registry: string;
  repository: string;
  tag: string;
} {
  let rest = ref.trim();
  let tag = "latest";

  const at = rest.indexOf("@");
  if (at !== -1) {
    // Digest (sha256:...) : on l'affiche comme "tag" abrégé.
    tag = rest.slice(at + 1).slice(0, 19);
    rest = rest.slice(0, at);
  } else {
    const lastSlash = rest.lastIndexOf("/");
    const lastColon = rest.lastIndexOf(":");
    if (lastColon > lastSlash) {
      tag = rest.slice(lastColon + 1);
      rest = rest.slice(0, lastColon);
    }
  }

  let registry = "docker.io";
  const firstSlash = rest.indexOf("/");
  if (firstSlash !== -1) {
    const first = rest.slice(0, firstSlash);
    // Le premier segment est un registre s'il ressemble à un hôte.
    if (first.includes(".") || first.includes(":") || first === "localhost") {
      registry = first;
      rest = rest.slice(firstSlash + 1);
    }
  }

  return { registry, repository: rest, tag };
}
