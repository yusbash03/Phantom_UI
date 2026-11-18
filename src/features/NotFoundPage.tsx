import { Compass } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="Page not found"
      description="This page does not exist or has moved."
      action={
        <Button asChild variant="outline">
          <Link to="/">Go to start</Link>
        </Button>
      }
    />
  )
}
