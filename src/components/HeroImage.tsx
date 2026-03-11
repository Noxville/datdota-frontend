import { heroImageUrl, miniHeroImageUrl } from '../config'
import { heroesById } from '../data/heroes'

interface HeroImageProps {
  heroId: string | number
  variant?: 'mini' | 'full' | 'gray'
  size?: number
  className?: string
}

/**
 * Reusable hero image component.
 * - "mini" → small square icon from /images/miniheroes/
 * - "full" → landscape portrait from /images/heroes/{key}_full.png
 * - "gray" → greyscale portrait from /images/heroes/{key}_gray.png
 */
export default function HeroImage({ heroId, variant = 'mini', size, className }: HeroImageProps) {
  const hero = heroesById[String(heroId)]
  if (!hero) return null

  const src =
    variant === 'mini'
      ? miniHeroImageUrl(hero.picture)
      : heroImageUrl(hero.picture, variant)

  const defaultSize = variant === 'mini' ? 24 : undefined
  const finalSize = size ?? defaultSize

  return (
    <img
      src={src}
      alt={hero.name}
      title={hero.name}
      className={className}
      style={finalSize ? { width: finalSize, height: 'auto' } : undefined}
      loading="lazy"
    />
  )
}
