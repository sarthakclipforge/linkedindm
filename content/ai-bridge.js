/**
 * AI Bridge - Communication layer between content script and AI services
 * 
 * Handles:
 * - Communication with background service worker
 * - Message passing to/from side panel
 * - AI generation requests
 */

class AIBridge {
    constructor() {
        this.pendingRequests = new Map();
        this.setupMessageListener();
    }

    /**
     * Setup listener for messages from background/sidepanel
     */
    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'GENERATION_COMPLETE') {
                this.handleGenerationComplete(message);
            } else if (message.type === 'GENERATION_ERROR') {
                this.handleGenerationError(message);
            } else if (message.type === 'REQUEST_PROFILE_DATA') {
                // Side panel requesting fresh profile data
                this.handleProfileDataRequest(sendResponse);
                return true; // Keep channel open for async response
            }
            return false;
        });
    }

    /**
     * Handle profile data request from side panel
     * @param {Function} sendResponse - Response callback
     */
    handleProfileDataRequest(sendResponse) {
        try {
            const profileData = window.ProfileAnalyzer.analyze(document.body);
            sendResponse({ success: true, data: profileData });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Send profile data to the side panel via background worker
     * @param {Object} profileData - Extracted profile data
     * @returns {Promise} Resolution when message is sent
     */
    async sendToSidePanel(profileData) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'PROFILE_DATA',
                data: profileData
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }

    /**
     * Request the side panel to open
     * @returns {Promise}
     */
    async openSidePanel() {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'OPEN_SIDE_PANEL'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    // Side panel might already be open, not a critical error
                    console.log('[AIBridge] Side panel message:', chrome.runtime.lastError.message);
                    resolve();
                } else {
                    resolve(response);
                }
            });
        });
    }

    /**
     * Request message generation
     * @param {Object} profileData - Profile data for generation
     * @returns {Promise<string>} Generated message
     */
    async requestGeneration(profileData) {
        return new Promise((resolve, reject) => {
            const requestId = Date.now().toString();
            this.pendingRequests.set(requestId, { resolve, reject });

            chrome.runtime.sendMessage({
                type: 'GENERATE_MESSAGE',
                requestId,
                data: profileData
            }, (response) => {
                if (chrome.runtime.lastError) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error(chrome.runtime.lastError.message));
                }
                // Response will come through message listener
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Generation timed out'));
                }
            }, 30000);
        });
    }

    /**
     * Handle successful generation response
     * @param {Object} message - Message with generated content
     */
    handleGenerationComplete(message) {
        const { requestId, generatedMessage } = message;
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
            pending.resolve(generatedMessage);
            this.pendingRequests.delete(requestId);
        }
    }

    /**
     * Handle generation error
     * @param {Object} message - Message with error details
     */
    handleGenerationError(message) {
        const { requestId, error } = message;
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
            pending.reject(new Error(error));
            this.pendingRequests.delete(requestId);
        }
    }

    /**
     * Check rate limit status for current profile
     * @param {string} profileId - Profile identifier
     * @returns {Promise<Object>} Rate limit status
     */
    async checkRateLimit(profileId) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'CHECK_RATE_LIMIT',
                profileId
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }
}

// Create global instance
if (typeof window !== 'undefined') {
    window.AIBridge = new AIBridge();
}
