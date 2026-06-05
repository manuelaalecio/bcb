export function PresenceBadge({ online }: { online: boolean }) {
  return (
    <span className={`presence ${online ? 'online' : 'offline'}`}>
      <span className="presence-dot" aria-hidden />
      {online ? 'Online' : 'Offline'}
    </span>
  )
}
