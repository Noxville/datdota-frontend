/** Uppercase control label with a hoverable "?" explainer. */
export default function HelpLabel({ text, tip }: { text: string; tip: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: '0.6rem',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: 'var(--color-text-muted)',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
      <span
        title={tip}
        aria-label={tip}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 13,
          height: 13,
          borderRadius: '50%',
          border: '1px solid var(--color-border)',
          fontSize: '0.5rem',
          lineHeight: 1,
          cursor: 'help',
        }}
      >
        ?
      </span>
    </span>
  )
}
