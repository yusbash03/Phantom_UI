import { zodResolver } from '@hookform/resolvers/zod'
import { Lock } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { useAuth } from '@/app/auth/auth-context'
import { Spinner } from '@/components/feedback/LoadingState'
import { PhantomMark } from '@/components/layout/PhantomMark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})
type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const { status, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })

  if (status === 'authenticated') return <Navigate to={from} replace />

  const onSubmit = handleSubmit(async ({ email, password }) => {
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (error) {
      setError('root', { message: error instanceof Error ? error.message : 'Sign-in failed.' })
    }
  })

  return (
    <div className="relative grid min-h-svh place-items-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_50%_-10%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)]"
      />
      <div className="relative w-full max-w-sm">
        <PhantomMark className="mb-8 justify-center" />
        <div className="rounded-xl border border-border bg-card p-6 shadow-2xl shadow-black/30 sm:p-8">
          <h1 className="text-lg font-semibold">Sign in to the command centre</h1>
          <p className="mt-1 text-sm text-muted-foreground">Authorised personnel only. Activity is audited.</p>

          <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="username" aria-invalid={!!errors.email} {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register('password')} />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            {errors.root && (
              <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errors.root.message}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Spinner label="Signing in" className="text-current" /> : (<><Lock aria-hidden /> Sign in</>)}
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Reporting an emergency? Contact your local emergency number first.
        </p>
      </div>
    </div>
  )
}
