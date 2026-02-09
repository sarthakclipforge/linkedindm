/**
 * Background Service Worker - LinkedIn DM Copilot
 * 
 * Responsibilities:
 * - Relay messages between content scripts and side panel
 * - Manage rate limiting cache
 * - Handle side panel opening
 * 
 * ANTI-BAN COMPLIANCE:
 * - Implements rate limiting per profile
 * - No automatic actions
 * - No LinkedIn API calls
 */

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
    COOLDOWN_MS: 60 * 60 * 1000, // 1 hour cooldown per profile
    MAX_GENERATIONS_PER_HOUR: 5
};

// In-memory cache for rate limiting (resets on service worker restart)
// For persistence, use chrome.storage.local
const generationCache = new Map();

/**
 * Initialize the service worker
 */
function initialize() {
    console.log('[ServiceWorker] LinkedIn DM Copilot initialized');

    // Set side panel behavior
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
        .catch(error => console.error('[ServiceWorker] Failed to set panel behavior:', error));
}

/**
 * Check if generation is rate limited for a profile
 * @param {string} profileId - Profile identifier
 * @returns {Object} Rate limit status
 */
function checkRateLimit(profileId) {
    const now = Date.now();
    const cacheEntry = generationCache.get(profileId);

    if (!cacheEntry) {
        return {
            limited: false,
            remainingGenerations: RATE_LIMIT_CONFIG.MAX_GENERATIONS_PER_HOUR,
            nextAllowedTime: null
        };
    }

    // Check if cooldown has passed
    const timeSinceLastGen = now - cacheEntry.lastTimestamp;
    if (timeSinceLastGen >= RATE_LIMIT_CONFIG.COOLDOWN_MS) {
        // Reset the cache entry
        generationCache.delete(profileId);
        return {
            limited: false,
            remainingGenerations: RATE_LIMIT_CONFIG.MAX_GENERATIONS_PER_HOUR,
            nextAllowedTime: null
        };
    }

    // Check if too many generations
    if (cacheEntry.count >= RATE_LIMIT_CONFIG.MAX_GENERATIONS_PER_HOUR) {
        return {
            limited: true,
            remainingGenerations: 0,
            nextAllowedTime: cacheEntry.firstTimestamp + RATE_LIMIT_CONFIG.COOLDOWN_MS,
            message: 'Rate limit reached. Please wait before generating more messages for this profile.'
        };
    }

    return {
        limited: false,
        remainingGenerations: RATE_LIMIT_CONFIG.MAX_GENERATIONS_PER_HOUR - cacheEntry.count,
        nextAllowedTime: null
    };
}

/**
 * Record a generation for rate limiting
 * @param {string} profileId - Profile identifier
 */
function recordGeneration(profileId) {
    const now = Date.now();
    const existing = generationCache.get(profileId);

    if (existing) {
        existing.count++;
        existing.lastTimestamp = now;
    } else {
        generationCache.set(profileId, {
            count: 1,
            firstTimestamp: now,
            lastTimestamp: now
        });
    }

    console.log(`[ServiceWorker] Recorded generation for ${profileId}. Count: ${generationCache.get(profileId).count}`);
}

/**
 * Store profile data for the side panel to access
 * @param {Object} profileData - Profile data to store
 */
async function storeProfileData(profileData) {
    await chrome.storage.session.set({ currentProfileData: profileData });
    console.log('[ServiceWorker] Profile data stored for side panel');
}

/**
 * Handle messages from content scripts and side panel
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[ServiceWorker] Received message:', message.type);

    switch (message.type) {
        case 'OPEN_SIDE_PANEL':
            // Open the side panel for the current tab
            if (sender.tab?.id) {
                chrome.sidePanel.open({ tabId: sender.tab.id })
                    .then(() => {
                        sendResponse({ success: true });
                    })
                    .catch(error => {
                        console.error('[ServiceWorker] Failed to open side panel:', error);
                        sendResponse({ success: false, error: error.message });
                    });
                return true; // Keep channel open for async response
            }
            break;

        case 'PROFILE_DATA':
            // Store profile data and notify side panel
            storeProfileData(message.data)
                .then(() => {
                    // Broadcast to side panel
                    chrome.runtime.sendMessage({
                        type: 'PROFILE_DATA_UPDATED',
                        data: message.data
                    }).catch(() => {
                        // Side panel might not be listening yet, that's okay
                    });
                    sendResponse({ success: true });
                })
                .catch(error => {
                    sendResponse({ success: false, error: error.message });
                });
            return true;

        case 'CHECK_RATE_LIMIT':
            const rateLimitStatus = checkRateLimit(message.profileId);
            sendResponse(rateLimitStatus);
            break;

        case 'RECORD_GENERATION':
            recordGeneration(message.profileId);
            sendResponse({ success: true });
            break;

        case 'GET_PROFILE_DATA':
            // Side panel requesting stored profile data
            chrome.storage.session.get('currentProfileData')
                .then(result => {
                    sendResponse({ success: true, data: result.currentProfileData || null });
                })
                .catch(error => {
                    sendResponse({ success: false, error: error.message });
                });
            return true;

        default:
            console.log('[ServiceWorker] Unknown message type:', message.type);
    }

    return false;
});

/**
 * Handle extension icon click
 */
chrome.action.onClicked.addListener((tab) => {
    // Open side panel when icon is clicked
    if (tab.id) {
        chrome.sidePanel.open({ tabId: tab.id });
    }
});

/**
 * Handle tab updates to track navigation
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url?.includes('linkedin.com/in/')) {
        console.log('[ServiceWorker] LinkedIn profile page loaded');
        // Enable side panel for this tab
        chrome.sidePanel.setOptions({
            tabId,
            path: 'sidepanel/sidepanel.html',
            enabled: true
        });
    }
});

// Initialize on load
initialize();
