import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('keeps the dialog open and shows the error when the action fails', async () => {
    const onOpenChange = vi.fn<(open: boolean) => void>()
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Deactivate user?"
        description="They will be signed out."
        confirmLabel="Deactivate"
        destructive
        onConfirm={() => Promise.reject(new Error('At least one active Administrator must remain.'))}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('At least one active Administrator must remain.')
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('closes after the action succeeds', async () => {
    const onOpenChange = vi.fn<(open: boolean) => void>()
    render(
      <ConfirmDialog open onOpenChange={onOpenChange} title="Proceed?" description="x" confirmLabel="Confirm" onConfirm={() => Promise.resolve()} />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
