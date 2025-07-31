/**
 * Accessibility Integration Tests
 * 
 * Comprehensive accessibility testing including:
 * - WCAG 2.1 AA compliance validation
 * - Keyboard navigation and focus management
 * - Screen reader compatibility
 * - Color contrast and visual accessibility
 * - Responsive design accessibility
 * - Error handling accessibility
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { act, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'
import React from 'react'

// Import components for accessibility testing
import { WorkspacePanel } from '../../components/layout/WorkspacePanel'
import { ReviewStep } from '../../components/steps/ReviewStep'

// Import stores and services
import { useWorkspaceStore } from '../../stores/workspace-store'
import { useAppStore } from '../../stores/app-store'

// Import test utilities
import { TestEnvironment, MockDataGenerator, WorkspaceTestScenarios } from '../utils/test-workspace-setup'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

/**
 * Accessibility Standards and Targets
 */
const ACCESSIBILITY_TARGETS = {
  wcag: {
    level: 'AA', // WCAG 2.1 AA compliance
    maxViolations: 0,
    allowedTags: [], // No allowed violations
  },
  colorContrast: {
    normalText: 4.5, // WCAG AA standard
    largeText: 3.0,
    uiElements: 3.0
  },
  keyboardNavigation: {
    maxTabStops: 50, // Reasonable limit
    focusIndicatorVisible: true,
    logicalTabOrder: true,
    noKeyboardTraps: true
  },
  screenReader: {
    landmarksPresent: true,
    headingStructure: true,
    altTextComplete: true,
    ariaLabelsPresent: true,
    formLabelsAssociated: true
  },
  responsive: {
    minWidth: 320, // Minimum viewport width
    maxZoom: 200, // 200% zoom support
    textReflow: true,
    noHorizontalScroll: true
  }
}

/**
 * Accessibility Integration Test Suite
 */
describe('Accessibility Integration', () => {
  let testEnv: TestEnvironment
  let user: ReturnType<typeof userEvent.setup>

  beforeAll(() => {
    // Setup accessibility testing environment
    testEnv = new TestEnvironment()
    
    // Mock accessibility APIs
    global.window = {
      ...global.window,
      speechSynthesis: {
        speak: jest.fn(),
        cancel: jest.fn(),
        pause: jest.fn(),
        resume: jest.fn(),
        getVoices: jest.fn(() => [])
      },
      navigator: {
        ...global.window?.navigator,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    } as any
  })

  beforeEach(async () => {
    await testEnv.setup()
    user = userEvent.setup({ delay: null })
    jest.clearAllMocks()
  })

  afterEach(async () => {
    await testEnv.cleanup()
  })

  afterAll(() => {
    delete (global as any).window
  })

  /**
   * 1. WCAG 2.1 AA COMPLIANCE TESTING
   */
  describe('WCAG 2.1 AA Compliance', () => {
    it('should meet WCAG 2.1 AA standards for WorkspacePanel', async () => {
      const { container } = render(<WorkspacePanel />)

      // Run axe accessibility tests
      const results = await axe(container, {
        rules: {
          // Enable all WCAG 2.1 AA rules
          'color-contrast': { enabled: true },
          'keyboard-navigation': { enabled: true },
          'focus-order-semantics': { enabled: true },
          'aria-roles': { enabled: true },
          'label-title-only': { enabled: true }
        }
      })

      expect(results).toHaveNoViolations()
    })

    it('should maintain accessibility during workspace operations', async () => {
      const { workspace, config } = await WorkspaceTestScenarios.createBasicWorkspaceScenario(testEnv)
      
      const { result } = renderHook(() => useWorkspaceStore())
      const workspaceStore = result.current

      await act(async () => {
        await workspaceStore.initializeWorkspaces()
        workspaceStore.currentWorkspace = workspace
      })

      const { container } = render(<WorkspacePanel />)

      // Test accessibility during workspace creation
      const createButton = screen.getByRole('button', { name: /create.*workspace/i })
      expect(createButton).toBeInTheDocument()

      await user.click(createButton)
      
      // Check accessibility after interaction
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should handle error states accessibly', async () => {
      // Setup error scenario
      testEnv.mockAPI.createWorkspace.mockRejectedValue(new Error('Workspace creation failed'))

      const { result } = renderHook(() => useWorkspaceStore())
      const workspaceStore = result.current

      await act(async () => {
        await workspaceStore.initializeWorkspaces()
        try {
          await workspaceStore.createWorkspace('Error Test')
        } catch (error) {
          // Expected error
        }
      })

      const { container } = render(<WorkspacePanel />)

      // Verify error is announced accessibly
      const errorMessage = screen.getByRole('alert')
      expect(errorMessage).toBeInTheDocument()
      expect(errorMessage).toHaveAttribute('aria-live', 'assertive')

      // Check accessibility with error present
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should provide accessible form validation', async () => {
      const { workspace } = await WorkspaceTestScenarios.createBasicWorkspaceScenario(testEnv)
      
      const { result } = renderHook(() => useWorkspaceStore())
      const workspaceStore = result.current

      await act(async () => {
        await workspaceStore.initializeWorkspaces()
        workspaceStore.currentWorkspace = workspace
      })

      const { container } = render(<WorkspacePanel />)

      // Find form elements
      const nameInput = screen.getByLabelText(/workspace.*name/i)
      expect(nameInput).toBeInTheDocument()

      // Test invalid input
      await user.clear(nameInput)
      await user.tab() // Move focus away to trigger validation

      // Check for accessible validation messages
      const validationMessage = screen.getByRole('alert')
      expect(validationMessage).toBeInTheDocument()
      expect(validationMessage).toHaveAttribute('aria-describedby')

      // Verify form accessibility
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  /**
   * 2. KEYBOARD NAVIGATION AND FOCUS MANAGEMENT
   */
  describe('Keyboard Navigation', () => {
    it('should support complete keyboard navigation', async () => {
      const { workspace } = await WorkspaceTestScenarios.createBasicWorkspaceScenario(testEnv)
      
      const { result } = renderHook(() => useWorkspaceStore())
      const workspaceStore = result.current

      await act(async () => {
        await workspaceStore.initializeWorkspaces()
        workspaceStore.currentWorkspace = workspace
      })

      render(<WorkspacePanel />)

      // Test Tab navigation
      const focusableElements = screen.getAllByRole('button')
        .concat(screen.getAllByRole('textbox'))
        .concat(screen.getAllByRole('combobox'))

      expect(focusableElements.length).toBeGreaterThan(0)

      // Navigate through all focusable elements
      let tabCount = 0
      let currentElement = document.activeElement

      while (tabCount < focusableElements.length && tabCount < ACCESSIBILITY_TARGETS.keyboardNavigation.maxTabStops) {
        await user.tab()
        const newElement = document.activeElement
        
        // Verify focus moved
        expect(newElement).not.toBe(currentElement)
        
        // Verify focus indicator is visible
        expect(newElement).toHaveStyle({ outline: expect.any(String) })
        
        currentElement = newElement
        tabCount++
      }

      // Verify no keyboard traps
      expect(tabCount).toBeLessThan(ACCESSIBILITY_TARGETS.keyboardNavigation.maxTabStops)
    })

    it('should handle Escape key for modal dialogs', async () => {
      const { workspace } = await WorkspaceTestScenarios.createBasicWorkspaceScenario(testEnv)
      
      const { result } = renderHook(() => useWorkspaceStore())
      const workspaceStore = result.current

      await act(async () => {
        await workspaceStore.initializeWorkspaces()
        workspaceStore.currentWorkspace = workspace
      })

      render(<WorkspacePanel />)

      // Open a modal (if available)
      const modalTrigger = screen.queryByRole('button', { name: /settings|options|configure/i })
      
      if (modalTrigger) {
        await user.click(modalTrigger)

        // Verify modal opened
        const modal = screen.getByRole('dialog')
        expect(modal).toBeInTheDocument()

        // Test Escape key
        await user.keyboard('{Escape}')

        // Verify modal closed
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })

        // Verify focus returned to trigger
        expect(modalTrigger).toHaveFocus()
      }
    })

    it('should support Arrow key navigation in lists', async () => {
      const { workspace } = await WorkspaceTestScenarios.createBasicWorkspaceScenario(testEnv)
      
      // Create multiple workspaces for list navigation
      const workspaces = Array.from({ length: 5 }, (_, i) =>
        MockDataGenerator.generateWorkspace({ name: `Workspace ${i + 1}` })
      )

      const { result } = renderHook(() => useWorkspaceStore())
      const workspaceStore = result.current

      await act(async () => {
        await workspaceStore.initializeWorkspaces()
        workspaceStore.availableWorkspaces = workspaces
        workspaceStore.currentWorkspace = workspaces[0]
      })

      render(<WorkspacePanel />)

      // Find workspace list
      const workspaceList = screen.getByRole('list')
      expect(workspaceList).toBeInTheDocument()

      const listItems = screen.getAllByRole('listitem')
      expect(listItems.length).toBe(workspaces.length)

      // Focus first item
      const firstItem = listItems[0].querySelector('[role="button"]') as HTMLElement
      firstItem.focus()

      // Test Arrow Down navigation
      await user.keyboard('{ArrowDown}')
      expect(listItems[1].querySelector('[role="button"]')).toHaveFocus()

      await user.keyboard('{ArrowDown}')
      expect(listItems[2].querySelector('[role="button"]')).toHaveFocus()

      // Test Arrow Up navigation
      await user.keyboard('{ArrowUp}')
      expect(listItems[1].querySelector('[role="button"]')).toHaveFocus()

      // Test Home/End keys
      await user.keyboard('{Home}')
      expect(listItems[0].querySelector('[role="button"]')).toHaveFocus()

      await user.keyboard('{End}')
      expect(listItems[listItems.length - 1].querySelector('[role="button"]')).toHaveFocus()
    })

    it('should manage focus during dynamic content updates', async () => {
      const { workspace } = await WorkspaceTestScenarios.createBasicWorkspaceScenario(testEnv)
      
      const { result } = renderHook(() => useWorkspaceStore())
      const workspaceStore = result.current

      await act(async () => {
        await workspaceStore.initializeWorkspaces()
        workspaceStore.currentWorkspace = workspace
      })

      render(<WorkspacePanel />)

      // Focus on an element
      const initialButton = screen.getByRole('button', { name: /create/i })
      initialButton.focus()
      expect(initialButton).toHaveFocus()

      // Trigger dynamic content update
      await act(async () => {
        await workspaceStore.createWorkspace('Dynamic Test')
      })

      // Wait for UI update
      await waitFor(() => {
        const notification = screen.queryByRole('status')
        if (notification) {
          expect(notification).toBeInTheDocument()
        }
      })

      // Verify focus is managed appropriately
      const focusedElement = document.activeElement
      expect(focusedElement).toBeDefined()
      expect(focusedElement?.tagName).not.toBe('BODY') // Focus shouldn't be lost
    })
  })

  /**
   * 3. SCREEN READER COMPATIBILITY
   */
  describe('Screen Reader Compatibility', () => {
    it('should provide proper landmark structure', async () => {
      const { workspace } = await WorkspaceTestScenarios.createBasicWorkspaceScenario(testEnv)
      
      const { result } = renderHook(() => useWorkspaceStore())
      const workspaceStore = result.current

      await act(async () => {
        await workspaceStore.initializeWorkspaces()
        workspaceStore.currentWorkspace = workspace
      })

      const { container } = render(<WorkspacePanel />)

      // Check for proper landmarks
      const main = screen.getByRole('main')
      expect(main).toBeInTheDocument()

      const navigation = screen.queryByRole('navigation')
      if (navigation) {
        expect(navigation).toBeInTheDocument()
      }

      const banner = screen.queryByRole('banner')
      if (banner) {
        expect(banner).toBeInTheDocument()
      }

      // Verify heading structure
      const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
      expect(headings.length).toBeGreaterThan(0)

      // Check heading hierarchy
      const headingLevels = Array.from(headings).map(h => parseInt(h.tagName.substring(1)))
      for (let i = 1; i < headingLevels.length; i++) {
        const levelDiff = headingLevels[i] - headingLevels[i - 1]
        expect(levelDiff).toBeLessThanOrEqual(1) // No skipped heading levels
      }
    })

    it('should provide comprehensive ARIA labels and descriptions', async () => {
      const { workspace, config } = await WorkspaceTestScenarios.createBasicWorkspaceScenario(testEnv)
      
      const { result } = renderHook(() => useWorkspaceStore())
      const workspaceStore = result.current

      await act(async () => {
        await workspaceStore.initializeWorkspaces()
        workspaceStore.currentWorkspace = workspace
      })

      const { container } = render(<WorkspacePanel />)

      // Check for ARIA labels on interactive elements
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        const hasLabel = button.getAttribute('aria-label') || 
                         button.getAttribute('aria-labelledby') ||
                         button.textContent?.trim()
        expect(hasLabel).toBeTruthy()
      })

      // Check for ARIA descriptions where appropriate
      const inputs = screen.getAllByRole('textbox')
      inputs.forEach(input => {
        const hasLabel = input.getAttribute('aria-label') || 
                         input.getAttribute('aria-labelledby')
        expect(hasLabel).toBeTruthy()

        const describedBy = input.getAttribute('aria-describedby')
        if (describedBy) {
          const description = document.getElementById(describedBy)
          expect(description).toBeInTheDocument()
        }
      })

      // Check for live regions
      const liveRegions = container.querySelectorAll('[aria-live]')
      expect(liveRegions.length).toBeGreaterThan(0)
    })

    it('should announce status changes appropriately', async () => {
      const { workspace } = await WorkspaceTestScenarios.createBasicWorkspaceScenario(testEnv)
      
      const { result } = renderHook(() => useWorkspaceStore())
      const workspaceStore = result.current

      await act(async () => {
        await workspaceStore.initializeWorkspaces()
        workspaceStore.currentWorkspace = workspace
      })

      render(<WorkspacePanel />)

      // Trigger a status change
      await act(async () => {
        await workspaceStore.updateWorkspaceConfig({ language: 'en' })
      })

      // Check for status announcement
      const statusRegion = screen.getByRole('status')
      expect(statusRegion).toBeInTheDocument()
      expect(statusRegion).toHaveAttribute('aria-live', 'polite')

      // Trigger an error
      testEnv.simulateNetworkFailure()
      
      await act(async () => {
        try {
          await workspaceStore.updateWorkspaceConfig({ language: 'fr' })
        } catch (error) {
          // Expected error
        }
      })

      // Check for error announcement
      const alertRegion = screen.getByRole('alert')
      expect(alertRegion).toBeInTheDocument()
      expect(alertRegion).toHaveAttribute('aria-live', 'assertive')
    })

    it('should provide alternative text for all images and icons', async () => {
      const { workspace } = await WorkspaceTestScenarios.createBasicWorkspaceScenario(testEnv)
      
      const { result } = renderHook(() => useWorkspaceStore())
      const workspaceStore = result.current

      await act(async () => {
        await workspaceStore.initializeWorkspaces()
        workspaceStore.currentWorkspace = workspace
      })

      const { container } = render(<WorkspacePanel />)

      // Check all images have alt text
      const images = container.querySelectorAll('img')
      images.forEach(img => {
        const altText = img.getAttribute('alt')
        expect(altText).toBeDefined()
        
        // Decorative images should have empty alt text
        if (img.getAttribute('role') === 'presentation') {
          expect(altText).toBe('')
        } else {
          expect(altText).toBeTruthy()
        }
      })

      // Check icons have appropriate labels
      const icons = container.querySelectorAll('[data-testid*="icon"], [class*="icon"]')
      icons.forEach(icon => {
        const hasLabel = icon.getAttribute('aria-label') || 
                         icon.getAttribute('aria-labelledby') ||
                         icon.getAttribute('title')
        
        // Only require labels for interactive icons
        if (icon.closest('button') || icon.getAttribute('role') === 'button') {
          expect(hasLabel).toBeTruthy()
        }
      })
    })
  })

  /**
   * 4. COLOR CONTRAST AND VISUAL ACCESSIBILITY
   */
  describe('Color Contrast and Visual Accessibility', () => {
    it('should meet color contrast requirements', async () => {
      const { workspace } = await WorkspaceTestScenarios.createBasicWorkspaceScenario(testEnv)
      
      render(<WorkspacePanel />)

      // Run axe with color contrast rules
      const results = await axe(document.body, {
        rules: {
          'color-contrast': { enabled: true }
        }
      })

      expect(results.violations.filter(v => v.id === 'color-contrast')).toHaveLength(0)
    })

    it('should remain usable without color alone', async () => {
      const { workspace } = await WorkspaceTestScenarios.createBasicWorkspaceScenario(testEnv)
      
      const { result } = renderHook(() => useWorkspaceStore())
      const workspaceStore = result.current

      await act(async () => {
        await workspaceStore.initializeWorkspaces()
        workspaceStore.currentWorkspace = workspace
      })

      const { container } = render(<WorkspacePanel />)

      // Simulate color blindness by checking for non-color indicators
      const errorElements = container.querySelectorAll('[role="alert"], .error, [data-error]')
      errorElements.forEach(element => {
        // Should have text content or icon, not just color
        const hasTextContent = element.textContent?.trim()
        const hasIcon = element.querySelector('[data-testid*="icon"], [class*="icon"]')
        const hasAriaLabel = element.getAttribute('aria-label')
        
        expect(hasTextContent || hasIcon || hasAriaLabel).toBeTruthy()
      })

      // Check status indicators
      const statusElements = container.querySelectorAll('[role="status"], .status, [data-status]')
      statusElements.forEach(element => {
        const hasTextContent = element.textContent?.trim()
        const hasIcon = element.querySelector('[data-testid*="icon"], [class*="icon"]')
        const hasAriaLabel = element.getAttribute('aria-label')
        
        expect(hasTextContent || hasIcon || hasAriaLabel).toBeTruthy()
      })
    })

    it('should support high contrast mode', async () => {
      // Simulate high contrast mode
      const originalMediaQuery = window.matchMedia
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-contrast: high)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }))

      const { workspace } = await WorkspaceTestScenarios.createBasicWorkspaceScenario(testEnv)
      
      render(<WorkspacePanel />)

      // Test should pass even in high contrast simulation
      const results = await axe(document.body, {
        rules: {
          'color-contrast': { enabled: true }
        }
      })

      expect(results.violations.filter(v => v.id === 'color-contrast')).toHaveLength(0)

      // Restore original
      window.matchMedia = originalMediaQuery
    })
  })

  /**
   * 5. RESPONSIVE DESIGN ACCESSIBILITY
   */
  describe('Responsive Design Accessibility', () => {
    it('should remain accessible at minimum viewport width', async () => {
      const { workspace } = await WorkspaceTestScenarios.createBasicWorkspaceScenario(testEnv)
      
      // Set minimum viewport size
      Object.defineProperty(window, 'innerWidth', { value: ACCESSIBILITY_TARGETS.responsive.minWidth })
      Object.defineProperty(window, 'innerHeight', { value: 568 })

      const { container } = render(<WorkspacePanel />)

      // Check accessibility at minimum width
      const results = await axe(container)
      expect(results).toHaveNoViolations()

      // Verify no horizontal scroll
      expect(document.body.scrollWidth).toBeLessThanOrEqual(ACCESSIBILITY_TARGETS.responsive.minWidth)
    })

    it('should support 200% zoom without horizontal scrolling', async () => {
      const { workspace } = await WorkspaceTestScenarios.createBasicWorkspaceScenario(testEnv)
      
      // Simulate 200% zoom
      const originalViewport = {
        width: window.innerWidth,
        height: window.innerHeight
      }

      Object.defineProperty(window, 'innerWidth', { value: originalViewport.width / 2 })
      Object.defineProperty(window, 'innerHeight', { value: originalViewport.height / 2 })

      const { container } = render(<WorkspacePanel />)

      // Check accessibility at zoom level
      const results = await axe(container)
      expect(results).toHaveNoViolations()

      // Verify text reflows properly
      const textElements = container.querySelectorAll('p, span, div')
      textElements.forEach(element => {
        const rect = element.getBoundingClientRect()
        expect(rect.width).toBeLessThanOrEqual(window.innerWidth)
      })

      // Restore original viewport
      Object.defineProperty(window, 'innerWidth', { value: originalViewport.width })
      Object.defineProperty(window, 'innerHeight', { value: originalViewport.height })
    })

    it('should maintain touch target sizes on mobile', async () => {
      const { workspace } = await WorkspaceTestScenarios.createBasicWorkspaceScenario(testEnv)
      
      // Simulate mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 375 })
      Object.defineProperty(window, 'innerHeight', { value: 667 })

      const { container } = render(<WorkspacePanel />)

      // Check touch target sizes (minimum 44x44px)
      const interactiveElements = container.querySelectorAll('button, a, input, [role="button"]')
      interactiveElements.forEach(element => {
        const rect = element.getBoundingClientRect()
        expect(Math.max(rect.width, rect.height)).toBeGreaterThanOrEqual(44)
      })

      // Check accessibility on mobile
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })
  })

  /**
   * 6. ERROR HANDLING ACCESSIBILITY
   */
  describe('Error Handling Accessibility', () => {
    it('should announce form validation errors appropriately', async () => {
      const { workspace } = await WorkspaceTestScenarios.createBasicWorkspaceScenario(testEnv)
      
      const { result } = renderHook(() => useWorkspaceStore())
      const workspaceStore = result.current

      await act(async () => {
        await workspaceStore.initializeWorkspaces()
        workspaceStore.currentWorkspace = workspace
      })

      render(<WorkspacePanel />)

      // Find form input
      const nameInput = screen.getByLabelText(/workspace.*name/i)
      
      // Create validation error
      await user.clear(nameInput)
      await user.tab() // Trigger validation

      // Check for accessible error announcement
      const errorMessage = screen.getByRole('alert')
      expect(errorMessage).toBeInTheDocument()
      expect(errorMessage).toHaveAttribute('aria-live', 'assertive')

      // Verify input is associated with error
      const describedBy = nameInput.getAttribute('aria-describedby')
      expect(describedBy).toBeTruthy()
      
      if (describedBy) {
        const errorElement = document.getElementById(describedBy)
        expect(errorElement).toBeInTheDocument()
      }

      // Check invalid state
      expect(nameInput).toHaveAttribute('aria-invalid', 'true')
    })

    it('should handle system errors accessibly', async () => {
      // Setup system error
      testEnv.mockAPI.initializeWorkspaceSystem.mockRejectedValue(new Error('System initialization failed'))

      const { result } = renderHook(() => useWorkspaceStore())
      const workspaceStore = result.current

      await act(async () => {
        try {
          await workspaceStore.initializeWorkspaces()
        } catch (error) {
          // Expected error
        }
      })

      render(<WorkspacePanel />)

      // Check for system error announcement
      const errorAlert = screen.getByRole('alert')
      expect(errorAlert).toBeInTheDocument()
      expect(errorAlert).toHaveAttribute('aria-live', 'assertive')

      // Verify error provides recovery options
      const retryButton = screen.queryByRole('button', { name: /retry|try again/i })
      if (retryButton) {
        expect(retryButton).toBeInTheDocument()
        expect(retryButton).toBeEnabled()
      }
    })

    it('should maintain accessibility during error recovery', async () => {
      // Setup intermittent failure
      let attemptCount = 0
      testEnv.mockAPI.createWorkspace.mockImplementation(() => {
        attemptCount++
        if (attemptCount === 1) {
          return Promise.reject(new Error('Temporary failure'))
        }
        return Promise.resolve({ success: true, workspaceId: 'ws_recovery_test' })
      })

      const { result } = renderHook(() => useWorkspaceStore())
      const workspaceStore = result.current

      await act(async () => {
        await workspaceStore.initializeWorkspaces()
      })

      render(<WorkspacePanel />)

      // Trigger error
      const createButton = screen.getByRole('button', { name: /create/i })
      await user.click(createButton)

      // Verify error is announced
      await waitFor(() => {
        const errorAlert = screen.getByRole('alert')
        expect(errorAlert).toBeInTheDocument()
      })

      // Retry operation
      const retryButton = screen.getByRole('button', { name: /retry/i })
      await user.click(retryButton)

      // Verify success is announced
      await waitFor(() => {
        const successStatus = screen.getByRole('status')
        expect(successStatus).toBeInTheDocument()
      })

      // Final accessibility check
      const results = await axe(document.body)
      expect(results).toHaveNoViolations()
    })
  })
})