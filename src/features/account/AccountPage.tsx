import { ShieldCheck } from 'lucide-react'
import { ROLE_LABELS, isRoleName } from '@/api/types'
import { useAuth } from '@/app/auth/auth-context'
import { PageHeader } from '@/components/layout/AppShell'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MyAvailabilityCard } from '@/features/responders/MyAvailabilityCard'

export function AccountPage() {
  const { user, hasAnyRole } = useAuth()
  if (!user) return null

  return (
    <>
      <PageHeader title="Account" description="Your identity and permissions in PHANTOM." />
      <div className="space-y-6">
      {hasAnyRole('Responder') && <MyAvailabilityCard />}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{user.displayName}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted-foreground">Email</dt>
            <dd>{user.email}</dd>
            <dt className="text-muted-foreground">Roles</dt>
            <dd className="flex flex-wrap gap-2">
              {user.roles.map((role) => (
                <Badge key={role} variant="secondary" className="gap-1">
                  <ShieldCheck className="size-3" aria-hidden />
                  {isRoleName(role) ? ROLE_LABELS[role] : role}
                </Badge>
              ))}
            </dd>
            <dt className="text-muted-foreground">Session</dt>
            <dd className="text-muted-foreground">
              Signed-in sessions refresh automatically and end when you sign out. Role changes take effect at your next session refresh.
            </dd>
          </dl>
        </CardContent>
      </Card>
      </div>
    </>
  )
}
