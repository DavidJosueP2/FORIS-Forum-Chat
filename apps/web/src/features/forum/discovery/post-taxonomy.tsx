import type { ForumPostSummary } from '@messages/contracts'
import { Link } from 'react-router-dom'
import { categoryLink, tagLink } from './discovery-query'

export function PostTaxonomy({ category, tags }: Pick<ForumPostSummary, 'category' | 'tags'>) {
  if (!category && !tags.length) return null

  return (
    <div className="discovery-post-taxonomy">
      {category && <Link to={categoryLink(category.id)} className="discovery-post-category">{category.name}</Link>}
      {tags.map(tag => (
        <Link key={tag.id} to={tagLink(tag.id)} className="discovery-post-tag">
          <span><span aria-hidden="true">#</span>{tag.name}</span>
        </Link>
      ))}
    </div>
  )
}
