import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Modal from '../components/Modal'

describe('Modal Component — Smoke Test', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={vi.fn()} title="Test Modal">
        <p>Modal content</p>
      </Modal>
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders title and content when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
        <p>Modal content</p>
      </Modal>
    )

    expect(screen.getByText('Test Modal')).toBeInTheDocument()
    expect(screen.getByText('Modal content')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={onClose} title="Test Modal">
        <p>Content</p>
      </Modal>
    )

    const closeButton = screen.getByRole('button')
    fireEvent.click(closeButton)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('applies different sizes', () => {
    const sizes = ['sm', 'md', 'lg', 'xl']
    for (const size of sizes) {
      const { unmount } = render(
        <Modal isOpen={true} onClose={vi.fn()} title="Size Test" size={size}>
          <p>{size} content</p>
        </Modal>
      )
      expect(screen.getByText('Size Test')).toBeInTheDocument()
      unmount()
    }
  })
})
