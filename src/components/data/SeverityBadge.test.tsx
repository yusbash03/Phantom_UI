import { render, screen } from '@testing-library/react'
import { SeverityBadge, type Severity } from './SeverityBadge'

describe('SeverityBadge', () => {
  it.each<Severity>(['Low', 'Medium', 'High', 'Critical'])('shows %s as text and an accessible label, not colour alone', (severity) => {
    render(<SeverityBadge severity={severity} />)
    const badge = screen.getByLabelText(`${severity} severity`)
    expect(badge).toHaveTextContent(severity)
    expect(badge.querySelector('svg')).not.toBeNull()
  })

  it('labels AI recommendations distinctly from approved severity', () => {
    render(<SeverityBadge severity="Critical" source="ai" />)
    const badge = screen.getByLabelText('AI recommends Critical')
    expect(badge).toHaveTextContent('AI')
    expect(screen.queryByLabelText('Critical severity')).toBeNull()
  })

  it('never invents a severity when none exists', () => {
    render(<SeverityBadge severity={null} />)
    expect(screen.getByText('Not yet assessed')).toBeInTheDocument()
  })
})
