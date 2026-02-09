/**
 * Profile Reader - Content script for LinkedIn profile pages
 * 
 * ANTI-BAN COMPLIANCE:
 * - Only runs on linkedin.com/in/* pages
 * - Only reads visible DOM
 * - Requires manual user click to trigger any action
 * - Uses MutationObserver with debounce for safe DOM handling
 */

(function () {
    'use strict';

    // Configuration
    const CONFIG = {
        BUTTON_ID: 'linkedin-dm-copilot-btn',
        DEBOUNCE_MS: 300,
        MAX_RETRY_ATTEMPTS: 10,
        RETRY_INTERVAL_MS: 1000
    };

    // State
    let buttonInjected = false;
    let observerActive = false;
    let retryCount = 0;

    /**
     * Debounce function to prevent excessive DOM operations
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Check if we're on a LinkedIn profile page
     * @returns {boolean}
     */
    function isProfilePage() {
        return window.location.href.includes('linkedin.com/in/');
    }

    /**
     * Find the Message button on the profile page
     * @returns {Element|null}
     */
    function findMessageButton() {
        // Look for the primary Message button - updated selectors for current LinkedIn
        const selectors = [
            // Primary selectors for Message button
            'button[aria-label*="Message"]',
            'button.artdeco-button--primary:has(span:contains("Message"))',
            '.pv-top-card-v2-ctas button[aria-label*="Message"]',
            '.pvs-profile-actions button[aria-label*="Message"]',
            '.pv-s-profile-actions button[aria-label*="Message"]',
            // Action bar buttons
            '.ph5 button[aria-label*="Message"]',
            '.pv-top-card-v2-ctas__container button:first-child',
            // Generic message button patterns
            'button.message-anywhere-button',
            'button.artdeco-button--primary'
        ];

        for (const selector of selectors) {
            try {
                const buttons = document.querySelectorAll(selector);
                for (const button of buttons) {
                    const text = button.textContent || button.innerText || '';
                    const ariaLabel = button.getAttribute('aria-label') || '';
                    // Check if this is the Message button and visible
                    if ((text.includes('Message') || ariaLabel.includes('Message')) &&
                        button.offsetParent !== null) {
                        console.log('[ProfileReader] Found Message button via selector:', selector);
                        return button;
                    }
                }
            } catch (e) {
                // Some selectors might not be supported, continue to next
            }
        }

        // Fallback: find button by text content - search all buttons
        const allButtons = document.querySelectorAll('button');
        for (const btn of allButtons) {
            const text = (btn.textContent || btn.innerText || '').trim();
            const ariaLabel = btn.getAttribute('aria-label') || '';
            // Match "Message" text or aria-label containing Message
            if ((text === 'Message' || text.startsWith('Message ') || ariaLabel.includes('Message')) &&
                btn.offsetParent !== null) {
                console.log('[ProfileReader] Found Message button via text search');
                return btn;
            }
        }

        // Last fallback: find by icon (LinkedIn uses an icon with the text)
        const messagesIcons = document.querySelectorAll('li-icon[type="send-privately-medium"], [data-test-icon="send-privately-medium"]');
        for (const icon of messagesIcons) {
            const btn = icon.closest('button');
            if (btn && btn.offsetParent !== null) {
                console.log('[ProfileReader] Found Message button via icon');
                return btn;
            }
        }

        console.log('[ProfileReader] Message button not found with any method');
        return null;
    }

    /**
     * Find the action buttons container (where Message/More buttons are)
     * @returns {Element|null}
     */
    function findActionsContainer() {
        // Look for the container that holds the action buttons
        const selectors = [
            '.pv-top-card-v2-ctas',
            '.pvs-profile-actions',
            '.pv-s-profile-actions',
            '.ph5 .mt2' // Common container in profile header
        ];

        for (const selector of selectors) {
            const container = document.querySelector(selector);
            if (container) {
                return container;
            }
        }

        return null;
    }

    /**
     * Create the "Generate Smart DM" button
     * @returns {Element}
     */
    function createSmartDMButton() {
        const button = document.createElement('button');
        button.id = CONFIG.BUTTON_ID;
        button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
      <span>Generate Smart DM</span>
    `;

        // Apply styles
        Object.assign(button.style, {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 16px',
            marginLeft: '8px',
            backgroundColor: '#0a66c2',
            color: '#ffffff',
            border: 'none',
            borderRadius: '24px',
            fontSize: '14px',
            fontWeight: '600',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)'
        });

        // Hover effects
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = '#004182';
            button.style.transform = 'translateY(-1px)';
            button.style.boxShadow = '0 4px 6px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.12)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = '#0a66c2';
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)';
        });

        // Click handler
        button.addEventListener('click', handleSmartDMClick);

        return button;
    }

    /**
     * Handle click on the Smart DM button
     * @param {Event} event
     */
    async function handleSmartDMClick(event) {
        event.preventDefault();
        event.stopPropagation();

        const button = event.currentTarget;
        const originalContent = button.innerHTML;

        try {
            // Update button state to loading
            button.disabled = true;
            button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin" style="margin-right: 6px; animation: spin 1s linear infinite;">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"/>
        </svg>
        <span>Analyzing...</span>
      `;

            // Add spin animation if not already present
            if (!document.getElementById('dm-copilot-styles')) {
                const styleSheet = document.createElement('style');
                styleSheet.id = 'dm-copilot-styles';
                styleSheet.textContent = `
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `;
                document.head.appendChild(styleSheet);
            }

            // Extract profile data
            const profileData = window.ProfileAnalyzer.analyze(document.body);

            if (!window.ProfileAnalyzer.hasMinimumContext(profileData)) {
                throw new Error('Unable to extract profile information. Please ensure the profile has loaded completely.');
            }

            console.log('[ProfileReader] Extracted profile data:', profileData);

            // Open side panel and send data
            await window.AIBridge.openSidePanel();
            await window.AIBridge.sendToSidePanel(profileData);

            // Update button to success state
            button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>Sent to Panel</span>
      `;
            button.style.backgroundColor = '#057642';

            // Reset button after delay
            setTimeout(() => {
                button.innerHTML = originalContent;
                button.style.backgroundColor = '#0a66c2';
                button.disabled = false;
            }, 2000);

        } catch (error) {
            console.error('[ProfileReader] Error:', error);

            button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>Error</span>
      `;
            button.style.backgroundColor = '#cc1016';

            // Reset button after delay
            setTimeout(() => {
                button.innerHTML = originalContent;
                button.style.backgroundColor = '#0a66c2';
                button.disabled = false;
            }, 3000);
        }
    }

    /**
     * Inject the Smart DM button near the Message button
     */
    function injectButton() {
        // Don't inject if already present
        if (document.getElementById(CONFIG.BUTTON_ID)) {
            buttonInjected = true;
            return;
        }

        const messageButton = findMessageButton();
        if (!messageButton) {
            console.log('[ProfileReader] Message button not found, will retry...');
            return;
        }

        console.log('[ProfileReader] Found Message button, attempting injection...');

        // Create and inject our button
        const smartDMButton = createSmartDMButton();

        // Strategy 1: Insert as sibling of Message button
        const parent = messageButton.parentElement;
        if (parent) {
            try {
                // Insert after the Message button
                if (messageButton.nextSibling) {
                    parent.insertBefore(smartDMButton, messageButton.nextSibling);
                } else {
                    parent.appendChild(smartDMButton);
                }

                buttonInjected = true;
                console.log('[ProfileReader] Smart DM button injected as sibling');
                return;
            } catch (e) {
                console.log('[ProfileReader] Sibling injection failed:', e);
            }
        }

        // Strategy 2: Insert into actions container
        const actionsContainer = findActionsContainer();
        if (actionsContainer) {
            try {
                actionsContainer.appendChild(smartDMButton);
                buttonInjected = true;
                console.log('[ProfileReader] Smart DM button injected into actions container');
                return;
            } catch (e) {
                console.log('[ProfileReader] Actions container injection failed:', e);
            }
        }

        // Strategy 3: Insert after the button group (grandparent)
        const grandparent = parent?.parentElement;
        if (grandparent) {
            try {
                grandparent.appendChild(smartDMButton);
                buttonInjected = true;
                console.log('[ProfileReader] Smart DM button injected into grandparent');
                return;
            } catch (e) {
                console.log('[ProfileReader] Grandparent injection failed:', e);
            }
        }

        // Strategy 4: Create floating button near profile header
        console.log('[ProfileReader] Using floating button strategy');
        smartDMButton.style.position = 'fixed';
        smartDMButton.style.bottom = '80px';
        smartDMButton.style.right = '20px';
        smartDMButton.style.zIndex = '9999';
        smartDMButton.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
        document.body.appendChild(smartDMButton);
        buttonInjected = true;
        console.log('[ProfileReader] Smart DM button injected as floating button');
    }

    /**
     * Handle DOM mutations
     */
    const handleMutations = debounce(() => {
        if (!isProfilePage()) {
            // Clean up if we navigated away
            const existingButton = document.getElementById(CONFIG.BUTTON_ID);
            if (existingButton) {
                existingButton.remove();
                buttonInjected = false;
            }
            return;
        }

        if (!buttonInjected) {
            injectButton();
        } else {
            // Check if button is still in DOM (LinkedIn may re-render)
            if (!document.getElementById(CONFIG.BUTTON_ID)) {
                buttonInjected = false;
                injectButton();
            }
        }
    }, CONFIG.DEBOUNCE_MS);

    /**
     * Start observing DOM changes
     */
    function startObserver() {
        if (observerActive) return;

        const observer = new MutationObserver(handleMutations);
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        observerActive = true;
        console.log('[ProfileReader] MutationObserver started');
    }

    /**
     * Initialize the content script
     */
    function initialize() {
        if (!isProfilePage()) {
            console.log('[ProfileReader] Not a profile page, exiting');
            return;
        }

        console.log('[ProfileReader] Initializing on LinkedIn profile page');

        // Initial injection attempt with retry
        function tryInject() {
            injectButton();

            if (!buttonInjected && retryCount < CONFIG.MAX_RETRY_ATTEMPTS) {
                retryCount++;
                setTimeout(tryInject, CONFIG.RETRY_INTERVAL_MS);
            }
        }

        // Start observer first for dynamic content
        startObserver();

        // Wait for initial page load, then try injection
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', tryInject);
        } else {
            // Small delay to ensure LinkedIn has rendered the main content
            setTimeout(tryInject, 500);
        }
    }

    // Handle SPA navigation (LinkedIn is a SPA)
    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            buttonInjected = false;
            retryCount = 0;

            if (isProfilePage()) {
                setTimeout(() => {
                    initialize();
                }, 500);
            }
        }
    }).observe(document, { subtree: true, childList: true });

    // Start initialization
    initialize();

})();
