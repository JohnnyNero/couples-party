// One line-art icon per Shortlist theme, drawn here rather than shipped as files so a
// theme never depends on an asset somebody forgot to add. Matched on the theme's own
// words, not its id, because ids come from the order of the content file — reordering
// or inserting a theme there must not silently repoint every icon.

import type { ReactElement } from 'react'

type Glyph = (props: { className?: string }) => ReactElement

const svg =
  (children: ReactElement): Glyph =>
  ({ className }) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )

const Coffee = svg(
  <>
    <path d="M4.5 9.5h12v5a6 6 0 0 1-12 0z" />
    <path d="M16.5 10.5h2a2.5 2.5 0 0 1 0 5h-2" />
    <path d="M3 21h15.5" />
    <path d="M8 6.5c0-1 1-1.3 1-2.3M11.5 6.5c0-1 1-1.3 1-2.3" />
  </>,
)

const Argue = svg(
  <>
    <path d="M2.5 4.5h10v6h-5l-3 2.6V10.5h-2z" />
    <path d="M21.5 10.5h-8v6h4l3 2.6V16.5h1z" />
  </>,
)

const Target = svg(
  <>
    <circle cx="11" cy="13" r="8.2" />
    <circle cx="11" cy="13" r="4.2" />
    <circle cx="11" cy="13" r="0.6" />
    <path d="M14.2 9.8 21 3M18.4 3h2.8v2.8" />
  </>,
)

const Ghost = svg(
  <>
    <path d="M5 21.2V10.5a7 7 0 0 1 14 0v10.7l-3.5-2.4-3.5 2.4-3.5-2.4z" />
    <path d="M9.6 10.6h.01M14.4 10.6h.01" strokeWidth={2.2} />
    <path d="M10.7 14.6c.8.8 1.8.8 2.6 0" />
  </>,
)

const Says = svg(
  <>
    <path d="M3.5 4.5h17v11h-9.5L6 20v-4.5H3.5z" />
    <path d="M8.5 10h.01M12 10h.01M15.5 10h.01" strokeWidth={2.2} />
  </>,
)

const Cake = svg(
  <>
    <path d="M4 13.5c2.5-1.6 4.1 1.1 6.4 0 2.3-1.1 3.5 1.2 5.4.3 1.9-.9 2.4-.6 4.2.2" />
    <path d="M3.5 12.5c0-2 1.2-2.8 4-2.8h9c2.8 0 4 .8 4 2.8v6.5h-17z" />
    <path d="M2 21.5h20" />
    <path d="M12 9.7V6.4" />
    <path d="M12 6.4c-1.3-1 0-2.1.6-2.9.2 1.4 1.4 1.7-.6 2.9z" />
  </>,
)

const Lightning = svg(
  <>
    <path d="M13.4 2 5.5 13.2h5.2L9.3 22l8.2-11.6h-5.4z" />
  </>,
)

const Trophy = svg(
  <>
    <path d="M7 3h10v5.5a5 5 0 0 1-10 0z" />
    <path d="M7 4.5H4v2a3.5 3.5 0 0 0 3.2 3.5M17 4.5h3v2a3.5 3.5 0 0 1-3.2 3.5" />
    <path d="M12 13.5V17M8.5 21h7M9.5 21c0-2.5.8-4 2.5-4s2.5 1.5 2.5 4" />
  </>,
)

const Sun = svg(
  <>
    <circle cx="12" cy="12" r="5" />
    <path d="M12 1.6v2.6M12 19.8v2.6M22.4 12h-2.6M4.2 12H1.6M19.4 4.6l-1.9 1.9M6.5 17.5l-1.9 1.9M19.4 19.4l-1.9-1.9M6.5 6.5 4.6 4.6" />
  </>,
)

const HEART_D = 'M12 20.5S3 14.8 3 8.8A4.8 4.8 0 0 1 12 6.4a4.8 4.8 0 0 1 9 2.4c0 6-9 11.7-9 11.7z'

const Heart = svg(<path d={HEART_D} />)

const BrokenHeart = svg(
  <>
    <path d={HEART_D} />
    <path d="m12 6.3-2.4 3.9 3.8 2.3-1.9 4.3" />
  </>,
)

const Cat = svg(
  <>
    <path d="M5.2 10.4 4 4.5l4.6 2.8" />
    <path d="M18.8 10.4 20 4.5l-4.6 2.8" />
    <path d="M4 12.8C4 9.1 7.6 6.6 12 6.6s8 2.5 8 6.2-3.6 7.2-8 7.2-8-3.5-8-7.2z" />
    <path d="M9.3 12.4h.01M14.7 12.4h.01" strokeWidth={2.2} />
    <path d="M12 15.2c-.6.9-1.7.9-2.3.2M12 15.2c.6.9 1.7.9 2.3.2" />
    <path d="M7.7 14.6 3.6 13.6M7.7 16.2l-3.8.9M16.3 14.6l4.1-1M16.3 16.2l3.8.9" />
  </>,
)

const Star = svg(
  <>
    <path d="m12 2.8 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.6l6.5-.9z" />
  </>,
)

// First match wins, so the specific patterns have to sit above the loose ones.
const RULES: [RegExp, Glyph][] = [
  [/\bcats?\b/, Cat],
  [/happy|joy/, Sun],
  [/proud/, Trophy],
  [/attractive|fanc/, Heart],
  [/turn-?off|put.*off/, BrokenHeart],
  [/fear|scare|afraid/, Ghost],
  [/says|said|phrase/, Says],
  [/guilty|pleasure/, Cake],
  [/annoy|irritat|wind.*up/, Lightning],
  [/argue|argument|opinion|debate/, Argue],
  [/bad at|worst at|useless/, Target],
  [/give up|miss|need|couldn't live/, Coffee],
]

export function themeGlyph(themeText: string): Glyph {
  const t = themeText.toLowerCase()
  for (const [pattern, glyph] of RULES) if (pattern.test(t)) return glyph
  return Star
}

// A square card: the icon inside a ring, sized by its container rather than a fixed
// pixel value so the same component works on a phone and on a TV.
export function ThemeIcon({ themeText, className = '' }: { themeText: string; className?: string }) {
  const Glyph = themeGlyph(themeText)
  return (
    <div
      className={
        'aspect-square grid place-items-center rounded-3xl border-2 border-accent/30 bg-accent/5 text-accent ' +
        className
      }
    >
      <Glyph className="w-[62%] h-[62%]" />
    </div>
  )
}
