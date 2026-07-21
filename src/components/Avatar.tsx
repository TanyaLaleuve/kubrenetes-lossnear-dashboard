export function Avatar({
  userId,
  username,
  hasAvatar,
  size = 40,
  version,
}: {
  userId: string;
  username: string;
  hasAvatar: boolean;
  size?: number;
  version?: number;
}) {
  if (hasAvatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- source dynamique en DB, pas d'optimisation Next
      <img
        src={`/api/avatar/${userId}${version ? `?v=${version}` : ""}`}
        alt={`Avatar de ${username}`}
        width={size}
        height={size}
        className="rounded-full border border-border object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="grid place-items-center rounded-full border border-border bg-muted font-mono font-semibold text-accent"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {username.slice(0, 1).toUpperCase()}
    </span>
  );
}
