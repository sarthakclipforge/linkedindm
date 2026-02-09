/**
 * Side Panel JavaScript - LinkedIn DM Copilot
 * 
 * Handles:
 * - Loading profile from current LinkedIn tab
 * - AI message generation with multiple LLM providers
 * - Copy to clipboard
 * - Insert into LinkedIn chat
 * - Settings management
 * - Tab navigation
 */

// LLM Provider Configuration
const LLM_PROVIDERS = {
    'gemini-nano': {
        name: 'Gemini Nano',
        requiresApiKey: false,
        helpUrl: 'https://developer.chrome.com/docs/ai/built-in',
        models: []
    },
    'openai': {
        name: 'OpenAI',
        requiresApiKey: true,
        helpUrl: 'https://platform.openai.com/api-keys',
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        models: [
            { id: 'gpt-4o', name: 'GPT-4o (Latest)' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Faster)' },
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
        ],
        placeholder: 'sk-...'
    },
    'claude': {
        name: 'Claude (Anthropic)',
        requiresApiKey: true,
        helpUrl: 'https://console.anthropic.com/settings/keys',
        apiEndpoint: 'https://api.anthropic.com/v1/messages',
        models: [
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Latest)' },
            { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
            { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku (Fast)' }
        ],
        placeholder: 'sk-ant-...'
    },
    'gemini': {
        name: 'Gemini API',
        requiresApiKey: true,
        helpUrl: 'https://aistudio.google.com/app/apikey',
        apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
        models: [
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Fast)' },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
            { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Experimental)' }
        ],
        placeholder: 'AIza...'
    },
    'groq': {
        name: 'Groq',
        requiresApiKey: true,
        helpUrl: 'https://console.groq.com/keys',
        apiEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
        models: [
            { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
            { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Fast)' },
            { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' }
        ],
        placeholder: 'gsk_...'
    },
    'grok': {
        name: 'Grok (xAI)',
        requiresApiKey: true,
        helpUrl: 'https://console.x.ai/',
        apiEndpoint: 'https://api.x.ai/v1/chat/completions',
        models: [
            { id: 'grok-2-latest', name: 'Grok 2 (Latest)' },
            { id: 'grok-beta', name: 'Grok Beta' }
        ],
        placeholder: 'xai-...'
    }
};

// State
// State
let currentProfileData = null;
let currentGeneratedMessage = '';
let isGenerating = false;
let currentTabId = null;
let settings = {
    provider: 'gemini-nano',
    apiKey: '',
    model: '',
    sampleMessages: ['', '', '', '', ''],
    learnedMessages: [] // Array of string messages learned from edits
};

// DOM Elements
const elements = {
    // Main action
    loadProfileBtn: document.getElementById('load-profile-btn'),

    // Tabs
    tabBtns: document.querySelectorAll('.tab-btn'),
    contextTab: document.getElementById('context-tab'),
    messageTab: document.getElementById('message-tab'),

    // Context Tab
    emptyState: document.getElementById('empty-state'),
    profileContext: document.getElementById('profile-context'),
    profileName: document.getElementById('profile-name'),
    profileHeadline: document.getElementById('profile-headline'),
    profileCompany: document.getElementById('profile-company'),
    profileActivity: document.getElementById('profile-activity'),
    profileFeatured: document.getElementById('profile-featured'),
    profileAbout: document.getElementById('profile-about'),
    companySection: document.getElementById('company-section'),
    activitySection: document.getElementById('activity-section'),
    featuredSection: document.getElementById('featured-section'),
    aboutSection: document.getElementById('about-section'),
    generateBtn: document.getElementById('generate-btn'),

    // Message Tab
    messageEmpty: document.getElementById('message-empty'),
    messageContent: document.getElementById('message-content'),
    messageLoading: document.getElementById('message-loading'),
    messageText: document.getElementById('message-text'),
    messageMeta: document.getElementById('message-meta'),
    copyBtn: document.getElementById('copy-btn'),
    insertBtn: document.getElementById('insert-btn'),
    regenerateBtn: document.getElementById('regenerate-btn'),

    // Status
    statusIndicator: document.getElementById('status-indicator'),
    rateLimitInfo: document.getElementById('rate-limit-info'),

    // Settings
    settingsBtn: document.getElementById('settings-btn'),
    settingsModal: document.getElementById('settings-modal'),
    closeSettingsBtn: document.getElementById('close-settings-btn'),
    cancelSettingsBtn: document.getElementById('cancel-settings-btn'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),

    // Read Mode
    readModeBtn: document.getElementById('read-mode-btn'),
    readModeContent: document.getElementById('read-mode-content'),
    closeReadModeBtn: document.getElementById('close-read-mode'),
    profileSummaryText: document.getElementById('profile-summary'),

    providerGrid: document.getElementById('provider-grid'),
    apiKeySection: document.getElementById('api-key-section'),
    apiKeyInput: document.getElementById('api-key-input'),
    apiKeyDescription: document.getElementById('api-key-description'),
    toggleApiKey: document.getElementById('toggle-api-key'),
    getApiKeyLink: document.getElementById('get-api-key-link'),
    modelSection: document.getElementById('model-section'),
    modelSelect: document.getElementById('model-select'),

    // Writing Style
    sampleMessages: [
        document.getElementById('sample-1'),
        document.getElementById('sample-2'),
        document.getElementById('sample-3'),
        document.getElementById('sample-4'),
        document.getElementById('sample-5')
    ],
    learnedCount: document.getElementById('learned-count'),
    clearLearnedBtn: document.getElementById('clear-learned-btn')
};

/**
 * Initialize the side panel
 */
async function initialize() {
    console.log('[SidePanel] Initializing...');

    await loadSettings();
    setupTabNavigation();
    setupEventListeners();
    setupSettingsListeners();
    setupMessageListeners();
    getCurrentTab();
}

/**
 * Load settings from storage
 */
async function loadSettings() {
    try {
        const stored = await chrome.storage.local.get(['llmProvider', 'llmApiKey', 'llmModel', 'sampleMessages', 'learnedMessages']);
        settings.provider = stored.llmProvider || 'gemini-nano';
        settings.apiKey = stored.llmApiKey || '';
        settings.model = stored.llmModel || '';
        settings.sampleMessages = stored.sampleMessages || ['', '', '', '', ''];
        settings.learnedMessages = stored.learnedMessages || [];

        console.log('[SidePanel] Settings loaded:', {
            provider: settings.provider,
            hasApiKey: !!settings.apiKey,
            samplesCount: settings.sampleMessages.filter(m => m).length,
            learnedCount: settings.learnedMessages.length
        });
    } catch (error) {
        console.log('[SidePanel] Could not load settings:', error);
    }
}

/**
 * Save settings to storage
 */
async function saveSettings() {
    try {
        await chrome.storage.local.set({
            llmProvider: settings.provider,
            llmApiKey: settings.apiKey,
            llmModel: settings.model,
            sampleMessages: settings.sampleMessages,
            learnedMessages: settings.learnedMessages
        });
        console.log('[SidePanel] Settings saved');
    } catch (error) {
        console.error('[SidePanel] Could not save settings:', error);
    }
}

/**
 * Update learned count UI
 */
function updateLearnedCountUI() {
    if (elements.learnedCount) {
        elements.learnedCount.textContent = settings.learnedMessages.length;
    }
}

/**
 * Learn from edited message
 * @param {string} originalMessage - The message generated by AI
 * @param {string} finalMessage - The message sent/copied by user
 */
async function learnFromEdit(originalMessage, finalMessage) {
    // Only learn if there was a significant change (more than just whitespace)
    if (!finalMessage || !originalMessage) return;

    const cleanOriginal = originalMessage.trim();
    const cleanFinal = finalMessage.trim();

    if (cleanOriginal === cleanFinal) return;

    // Add to learned messages
    settings.learnedMessages.push(cleanFinal);

    // Keep only last 20 learned messages
    if (settings.learnedMessages.length > 20) {
        settings.learnedMessages.shift();
    }

    await saveSettings();
    updateLearnedCountUI();
    console.log('[SidePanel] Learned new message style');
}

/**
 * Get the current active tab
 */
async function getCurrentTab() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url?.includes('linkedin.com/in/')) {
            currentTabId = tab.id;
            updateStatus('ready', 'LinkedIn profile detected');
        } else {
            updateStatus('warning', 'Not on LinkedIn profile');
        }
    } catch (error) {
        console.log('[SidePanel] Could not get current tab:', error);
    }
}

/**
 * Setup tab navigation
 */
function setupTabNavigation() {
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            switchTab(tabId);
        });
    });
}

/**
 * Switch to a specific tab
 * @param {string} tabId - Tab to switch to ('context' or 'message')
 */
function switchTab(tabId) {
    elements.tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    elements.contextTab.classList.toggle('active', tabId === 'context');
    elements.messageTab.classList.toggle('active', tabId === 'message');
}

/**
 * Setup event listeners for buttons
 */
function setupEventListeners() {
    elements.loadProfileBtn?.addEventListener('click', handleLoadProfile);
    // Generate button
    elements.generateBtn?.addEventListener('click', handleGenerateClick);

    // Read Mode
    elements.readModeBtn?.addEventListener('click', handleReadModeClick);
    elements.closeReadModeBtn?.addEventListener('click', () => {
        elements.readModeContent.classList.add('hidden');
    });

    // Copy & Insert buttons
    elements.copyBtn?.addEventListener('click', handleCopyClick);
    elements.insertBtn?.addEventListener('click', handleCopyAndOpenChat);
    elements.regenerateBtn?.addEventListener('click', handleGenerateClick);

    // Track edits to message
    elements.messageText?.addEventListener('input', () => {
        currentGeneratedMessage = elements.messageText.textContent || '';
    });
}

/**
 * Setup settings modal listeners
 */
function setupSettingsListeners() {
    // Open settings
    elements.settingsBtn?.addEventListener('click', openSettings);

    // Close settings
    elements.closeSettingsBtn?.addEventListener('click', closeSettings);
    elements.cancelSettingsBtn?.addEventListener('click', closeSettings);
    elements.settingsModal?.querySelector('.modal-backdrop')?.addEventListener('click', closeSettings);

    // Save settings
    elements.saveSettingsBtn?.addEventListener('click', handleSaveSettings);

    // Provider selection
    const providerRadios = document.querySelectorAll('input[name="llm-provider"]');
    providerRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            updateSettingsUI(e.target.value);
        });
    });

    // Toggle API key visibility
    elements.toggleApiKey?.addEventListener('click', () => {
        const input = elements.apiKeyInput;
        const btn = elements.toggleApiKey;

        if (input.type === 'password') {
            input.type = 'text';
            btn.classList.add('visible');
        } else {
            input.type = 'password';
            btn.classList.remove('visible');
        }
    });

    // Clear learned messages
    elements.clearLearnedBtn?.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear all learned writing styles?')) {
            settings.learnedMessages = [];
            await saveSettings();
            updateLearnedCountUI();
            showToast('Learned styles cleared', 'success');
        }
    });
}

/**
 * Open settings modal
 */
function openSettings() {
    // Set current provider
    const providerRadio = document.querySelector(`input[name="llm-provider"][value="${settings.provider}"]`);
    if (providerRadio) {
        providerRadio.checked = true;
    }

    // Update UI for current provider
    updateSettingsUI(settings.provider);

    // Set API key if exists
    elements.apiKeyInput.value = settings.apiKey;

    // Set model if exists
    if (settings.model && elements.modelSelect) {
        elements.modelSelect.value = settings.model;
    }

    // Set sample messages
    settings.sampleMessages.forEach((msg, index) => {
        if (elements.sampleMessages[index]) {
            elements.sampleMessages[index].value = msg;
        }
    });

    // Update learned count
    updateLearnedCountUI();

    // Show modal
    elements.settingsModal.classList.remove('hidden');
}

/**
 * Close settings modal
 */
function closeSettings() {
    elements.settingsModal.classList.add('hidden');
    elements.apiKeyInput.type = 'password';
    elements.toggleApiKey?.classList.remove('visible');
}

/**
 * Update settings UI based on selected provider
 * @param {string} providerId - Selected provider ID
 */
function updateSettingsUI(providerId) {
    const provider = LLM_PROVIDERS[providerId];
    if (!provider) return;

    // Show/hide API key section
    if (provider.requiresApiKey) {
        elements.apiKeySection.classList.remove('hidden');
        elements.apiKeyDescription.textContent = `Enter your ${provider.name} API key.`;
        elements.apiKeyInput.placeholder = provider.placeholder || 'Enter API key...';
        elements.getApiKeyLink.href = provider.helpUrl;
    } else {
        elements.apiKeySection.classList.add('hidden');
    }

    // Show/hide model selection
    if (provider.models && provider.models.length > 0) {
        elements.modelSection.classList.remove('hidden');
        elements.modelSelect.innerHTML = provider.models.map(m =>
            `<option value="${m.id}">${m.name}</option>`
        ).join('');

        // Set default model
        if (settings.provider === providerId && settings.model) {
            elements.modelSelect.value = settings.model;
        }
    } else {
        elements.modelSection.classList.add('hidden');
    }
}

/**
 * Handle save settings button click
 */
async function handleSaveSettings() {
    const selectedProvider = document.querySelector('input[name="llm-provider"]:checked')?.value;
    const provider = LLM_PROVIDERS[selectedProvider];

    if (!provider) {
        showToast('Please select a provider', 'error');
        return;
    }

    // Validate API key if required
    if (provider.requiresApiKey) {
        const apiKey = elements.apiKeyInput.value.trim();
        if (!apiKey) {
            showToast('API key is required for this provider', 'error');
            return;
        }
        settings.apiKey = apiKey;
    } else {
        settings.apiKey = '';
    }

    settings.provider = selectedProvider;
    settings.model = elements.modelSelect?.value || provider.models?.[0]?.id || '';

    // Save sample messages
    settings.sampleMessages = elements.sampleMessages.map(el => el.value.trim());

    await saveSettings();
    closeSettings();
    showToast(`Settings saved! Using ${provider.name}`, 'success');
    updateStatus('ready', `${provider.name} configured`);
}

/**
 * Setup Chrome message listeners
 */
function setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('[SidePanel] Received message:', message.type);

        if (message.type === 'PROFILE_DATA_UPDATED') {
            updateProfileContext(message.data);
        }
    });
}

/**
 * Handle Load Profile button click
 */
async function handleLoadProfile() {
    const btn = elements.loadProfileBtn;
    const originalHTML = btn.innerHTML;

    try {
        btn.disabled = true;
        btn.classList.add('loading');
        btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10"/>
      </svg>
      Loading...
    `;
        updateStatus('loading', 'Extracting profile...');

        // Get current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.url?.includes('linkedin.com/in/')) {
            throw new Error('Please navigate to a LinkedIn profile page first.');
        }

        currentTabId = tab.id;

        // Execute script to extract profile data
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: extractProfileData
        });

        if (results && results[0]?.result) {
            const profileData = results[0].result;

            if (!profileData.name) {
                throw new Error('Could not extract profile data. Please ensure the profile has loaded.');
            }

            updateProfileContext(profileData);

            btn.classList.remove('loading');
            btn.classList.add('success');
            btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Profile Loaded!
      `;

            updateStatus('ready', 'Profile loaded');
            showToast('Profile loaded successfully!', 'success');

        } else {
            throw new Error('Could not access the page. Please refresh and try again.');
        }

    } catch (error) {
        console.error('[SidePanel] Load profile error:', error);
        btn.classList.remove('loading');
        updateStatus('error', 'Load failed');
        showToast(error.message || 'Failed to load profile', 'error');
    } finally {
        // Reset button after delay
        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.classList.remove('loading', 'success');
            btn.disabled = false;
        }, 2000);
    }
}

/**
 * Extract profile data from the page (injected into LinkedIn tab)
 */
function extractProfileData() {
    try {
        console.log('[LinkedIn DM Copilot] Starting profile extraction...');

        // Helper to find text content with multiple selectors
        const getText = (selectors) => {
            for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el && el.textContent.trim()) {
                    return el.textContent.trim();
                }
            }
            return '';
        };

        // Extract profile ID from URL
        const profileId = window.location.pathname.match(/\/in\/([^/?#]+)/)?.[1] || '';

        // Extract name - Try robust selectors
        let name = getText([
            '.text-heading-xlarge', // Common new design
            '.pv-text-details__left-panel h1',
            '.artdeco-entity-lockup__title',
            'h1.text-heading-xlarge',
            'h1' // Fallback
        ]);

        // Fallback: Try obtaining from title (e.g. "Name | LinkedIn")
        if (!name) {
            const title = document.title;
            if (title.includes(' | LinkedIn')) {
                name = title.split(' | LinkedIn')[0];
            }
        }

        // Extract headline - Try robust selectors first
        let headline = getText([
            '.text-body-medium',
            '.pv-text-details__left-panel .text-body-medium',
            '[data-generated-suggestion-target="headline"]',
            '.ph5 .text-body-medium', // Mobile/narrow view
            '.pv-top-card--list-bullet > li:first-child', // Sometimes in list
            '.artdeco-entity-lockup__subtitle', // Generic lockup
            'h2.text-title-medium',
            'div.text-body-medium.break-words'
        ]);

        // Fallback: Extract from document title (format: "Name - Headline | LinkedIn")
        if (!headline) {
            try {
                const title = document.title;
                if (title.includes(' | LinkedIn')) {
                    const namePart = title.split(' | LinkedIn')[0];
                    // Split by " - " (space hyphen space) to find potential headline
                    const parts = namePart.split(' - ');
                    if (parts.length > 1) {
                        // Assume everything after the first " - " is the headline/tagline
                        headline = parts.slice(1).join(' - ').trim();
                    }
                }
            } catch (e) {
                console.log('Title fallback failed', e);
            }
        }

        // Extract "About" section
        let about = '';
        const aboutSection = document.querySelector('#about') || document.querySelector('[id="about"]');
        if (aboutSection) {
            // Navigate to the parent container to find the content
            const aboutContainer = aboutSection.closest('section');
            if (aboutContainer) {
                const aboutTextEl = aboutContainer.querySelector('.display-flex .inline-show-more-text') ||
                    aboutContainer.querySelector('.pv-shared-text-with-see-more');
                about = aboutTextEl?.textContent?.trim() || '';
            }
        }

        // Extract company/role from experience
        let company = '';
        // Method 1: Check top card current role
        const topCardCurrentParams = document.querySelectorAll('.pv-text-details__right-panel .pv-text-details__right-panel-item-link');
        if (topCardCurrentParams.length > 0) {
            company = topCardCurrentParams[0].textContent.trim();
        }

        // Method 2: If not found, look at Experience section
        if (!company) {
            const experienceHeader = Array.from(document.querySelectorAll('h2')).find(h => h.textContent.trim() === 'Experience');
            if (experienceHeader) {
                const experienceSection = experienceHeader.closest('section');
                if (experienceSection) {
                    // Try to find first role
                    const firstRole = experienceSection.querySelector('li .display-flex');
                    if (firstRole) {
                        const roleEl = firstRole.querySelector('.mr1 span[aria-hidden="true"]'); // Role title
                        const companyEl = firstRole.querySelector('.t-14.t-normal span[aria-hidden="true"]'); // Company name

                        const role = roleEl?.textContent?.trim() || '';
                        const companyName = companyEl?.textContent?.trim() || '';

                        if (role && companyName) {
                            company = `${role} at ${companyName}`;
                        } else {
                            company = role || companyName;
                        }
                    }
                }
            }
        }

        // Extract recent activity
        let recentActivitySnippet = '';
        // Look for the activity section
        const activityHeader = Array.from(document.querySelectorAll('h2')).find(h => h.textContent.trim() === 'Activity');
        if (activityHeader) {
            const activitySection = activityHeader.closest('section');
            if (activitySection) {
                // Try to find the text of the most recent post/comment
                const postContent = activitySection.querySelector('.feed-shared-update-v2__description') ||
                    activitySection.querySelector('.feed-shared-text-view') ||
                    activitySection.querySelector('.attribution-descriptions-container') ||
                    activitySection.querySelector('span[dir="ltr"]');

                if (postContent) {
                    const text = postContent.innerText?.trim() || '';
                    // InnerText preserves newlines better than textContent for structured posts
                    recentActivitySnippet = text.substring(0, 300) + (text.length > 300 ? '...' : '');
                }
            }
        }

        // Extract featured
        let featuredHighlight = '';
        const featuredHeader = Array.from(document.querySelectorAll('h2')).find(h => h.textContent.trim() === 'Featured');
        if (featuredHeader) {
            const featuredSection = featuredHeader.closest('section');
            if (featuredSection) {
                const firstFeatured = featuredSection.querySelector('li');
                if (firstFeatured) {
                    const titleEl = firstFeatured.querySelector('.mr1 span[aria-hidden="true"]') ||
                        firstFeatured.querySelector('strong') ||
                        firstFeatured.querySelector('.artdeco-entity-lockup__title');
                    featuredHighlight = titleEl?.textContent?.trim() || '';
                }
            }
        }

        const data = {
            profileId,
            name,
            headline,
            company,
            about, // Added about section
            recentActivitySnippet,
            featuredHighlight,
            extractedAt: new Date().toISOString()
        };

        console.log('[LinkedIn DM Copilot] Extracted data:', data);
        return data;

    } catch (error) {
        console.error('[LinkedIn DM Copilot] Profile extraction error:', error);
        return { error: error.message, stack: error.stack };
    }
}

/**
 * Update the UI with profile context
 * @param {Object} profileData - Profile data from content script
 */
function updateProfileContext(profileData) {
    if (!profileData) return;

    currentProfileData = profileData;
    console.log('[SidePanel] Updating profile context:', profileData);

    // Hide empty state, show profile context
    elements.emptyState.classList.add('hidden');
    elements.profileContext.classList.remove('hidden');

    // Update profile info
    elements.profileName.textContent = profileData.name || 'Unknown';
    elements.profileHeadline.textContent = profileData.headline || 'No headline';

    // Update company/role
    if (profileData.company) {
        elements.profileCompany.textContent = profileData.company;
        elements.companySection.classList.remove('hidden');
    } else {
        elements.companySection.classList.add('hidden');
    }

    // Update activity
    if (profileData.recentActivitySnippet) {
        elements.profileActivity.textContent = `"${profileData.recentActivitySnippet}"`;
        elements.activitySection.classList.remove('hidden');
    } else {
        elements.profileActivity.textContent = 'No recent activity found';
        elements.activitySection.classList.remove('hidden');
    }

    // Update featured
    if (profileData.featuredHighlight) {
        elements.profileFeatured.textContent = profileData.featuredHighlight;
        elements.featuredSection.classList.remove('hidden');
    } else {
        elements.featuredSection.classList.add('hidden');
    }

    // Update about
    if (profileData.about) {
        elements.profileAbout.textContent = profileData.about.substring(0, 150) + (profileData.about.length > 150 ? '...' : '');
        elements.aboutSection.classList.remove('hidden');
    } else {
        elements.aboutSection.classList.add('hidden');
    }
}

/**
 * Handle generate button click
 */
async function handleGenerateClick() {
    if (isGenerating || !currentProfileData) {
        if (!currentProfileData) {
            showToast('Please load a profile first', 'error');
        }
        return;
    }

    // Check if API key is needed
    const provider = LLM_PROVIDERS[settings.provider];
    if (provider?.requiresApiKey && !settings.apiKey) {
        showToast('Please configure your API key in Settings', 'error');
        openSettings();
        return;
    }

    // Check rate limit first
    try {
        const rateLimitStatus = await chrome.runtime.sendMessage({
            type: 'CHECK_RATE_LIMIT',
            profileId: currentProfileData.profileId
        });

        if (rateLimitStatus?.limited) {
            showToast('Rate limit reached. Please wait before generating more messages.', 'error');
            updateStatus('warning', 'Rate limited');
            return;
        }

        if (rateLimitStatus?.remainingGenerations) {
            elements.rateLimitInfo.textContent = `${rateLimitStatus.remainingGenerations} left`;
        }
    } catch (error) {
        console.log('[SidePanel] Could not check rate limit:', error);
    }

    // Start generation
    isGenerating = true;
    switchTab('message');
    showMessageLoading();
    updateStatus('loading', 'Generating...');

    try {
        // Generate the message
        const message = await generateMessage(currentProfileData);
        currentGeneratedMessage = message;

        // Record the generation
        await chrome.runtime.sendMessage({
            type: 'RECORD_GENERATION',
            profileId: currentProfileData.profileId
        });

        showGeneratedMessage(message);
        updateStatus('ready', 'Message ready');

    } catch (error) {
        console.error('[SidePanel] Generation error:', error);
        showToast(error.message || 'Failed to generate message. Please try again.', 'error');
        updateStatus('error', 'Generation failed');
        showMessageEmpty();
    } finally {
        isGenerating = false;
    }
}

/**
 * Handle Read Profile button click
 */
async function handleReadModeClick() {
    if (!currentProfileData) {
        showToast('Please load a profile first', 'error');
        return;
    }

    elements.readModeContent.classList.remove('hidden');
    elements.profileSummaryText.innerHTML = '<div class="loading-spinner"></div> Analyzing profile...';

    try {
        const providerId = settings.provider;
        const provider = LLM_PROVIDERS[providerId];

        // Prepare prompt for summary
        const systemPrompt = `You are a professional LinkedIn profile analyzer.
Analyze the provided profile data and output a concise summary in the following format:
**Professional Summary**: 2-3 sentences summarizing who they are.
**Key Highlights**: Bullet points of their top skills or experiences.
**Recent Activity**: A one-line summary of what they are posting about (if available).

Keep it professional, concise, and easy to read.`;

        // Use raw profile data, NOT the message generation prompt
        const userPrompt = buildProfileContextString(currentProfileData);

        // Call LLM
        let summary = '';
        if (providerId === 'gemini-nano') {
            if (!self.ai || !self.ai.languageModel) {
                throw new Error('Gemini Nano is not available in this browser.');
            }
            const session = await self.ai.languageModel.create({
                systemPrompt: systemPrompt
            });
            summary = await session.prompt(userPrompt);
            session.destroy();
        } else {
            if (!settings.apiKey) {
                throw new Error('API key required for this provider.');
            }

            switch (providerId) {
                case 'openai':
                    summary = await generateWithOpenAI(userPrompt, systemPrompt);
                    break;
                case 'claude':
                    summary = await generateWithClaude(userPrompt, systemPrompt);
                    break;
                case 'gemini':
                    summary = await generateWithGeminiAPI(`${systemPrompt}\n\n${userPrompt}`);
                    break;
                case 'groq':
                    summary = await generateWithGroq(`${systemPrompt}\n\n${userPrompt}`);
                    break;
                case 'grok':
                    summary = await generateWithGrok(`${systemPrompt}\n\n${userPrompt}`);
                    break;
                default:
                    throw new Error('Provider not supported for summarization yet.');
            }
        }

        // Format output (convert ** to bold for simple display if needed, or just display as text)
        // Simple markdown formatter
        const formattedSummary = summary
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>')
            .replace(/- /g, '• '); // Cleaner bullets

        elements.profileSummaryText.innerHTML = formattedSummary;

    } catch (error) {
        console.error('Read Mode Error:', error);
        elements.profileSummaryText.textContent = 'Failed to generate summary: ' + error.message;
    }
}

/**
 * Generate a message using the configured LLM provider
 * @param {Object} profileData - Profile data
 * @returns {Promise<string>} Generated message
 */
async function generateMessage(profileData) {
    const prompt = buildPrompt(profileData);
    const provider = settings.provider;

    console.log('[SidePanel] Generating with provider:', provider);

    switch (provider) {
        case 'gemini-nano':
            return await generateWithGeminiNano(prompt);
        case 'openai':
            return await generateWithOpenAI(prompt);
        case 'claude':
            return await generateWithClaude(prompt);
        case 'gemini':
            return await generateWithGeminiAPI(prompt);
        case 'groq':
            return await generateWithGroq(prompt);
        case 'grok':
            return await generateWithGrok(prompt);
        default:
            return buildFallbackMessage(profileData);
    }
}

/**
 * Generate with Chrome's built-in Gemini Nano
 */
async function generateWithGeminiNano(prompt) {
    try {
        if (window.ai && window.ai.languageModel) {
            console.log('[SidePanel] Using Chrome AI (Gemini Nano)');
            const session = await window.ai.languageModel.create();
            const result = await session.prompt(prompt);
            return cleanResponse(result);
        }
    } catch (error) {
        console.log('[SidePanel] Chrome AI not available:', error.message);
    }

    // Fallback to Puter.js
    try {
        if (window.puter && window.puter.ai) {
            console.log('[SidePanel] Using Puter.js');
            const response = await window.puter.ai.chat(prompt);
            return cleanResponse(response);
        }
    } catch (error) {
        console.log('[SidePanel] Puter.js not available:', error.message);
    }

    throw new Error('Gemini Nano is not available. Please try a different provider or update Chrome.');
}

/**
 * Generate with OpenAI API
 */
async function generateWithOpenAI(prompt, systemPrompt = null) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
            model: settings.model || 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt || 'You are a helpful assistant that writes personalized LinkedIn messages.' },
                { role: 'user', content: prompt }
            ],
            max_tokens: 300,
            temperature: 0.7
        })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return cleanResponse(data.choices[0]?.message?.content || '');
}

/**
 * Generate with Claude (Anthropic) API
 */
async function generateWithClaude(prompt, systemPrompt = null) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': settings.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
            model: settings.model || 'claude-3-5-sonnet-20241022',
            max_tokens: 300,
            system: systemPrompt,
            messages: [
                { role: 'user', content: prompt }
            ]
        })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `Claude API error: ${response.status}`);
    }

    const data = await response.json();
    return cleanResponse(data.content[0]?.text || '');
}

/**
 * Generate with Gemini API
 */
async function generateWithGeminiAPI(prompt) {
    const model = settings.model || 'gemini-1.5-flash';
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.apiKey}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    maxOutputTokens: 300,
                    temperature: 0.7
                }
            })
        }
    );

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return cleanResponse(data.candidates?.[0]?.content?.parts?.[0]?.text || '');
}

/**
 * Generate with Groq API
 */
async function generateWithGroq(prompt) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
            model: settings.model || 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: 'You are a helpful assistant that writes personalized LinkedIn messages.' },
                { role: 'user', content: prompt }
            ],
            max_tokens: 300,
            temperature: 0.7
        })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `Groq API error: ${response.status}`);
    }

    const data = await response.json();
    return cleanResponse(data.choices[0]?.message?.content || '');
}

/**
 * Generate with Grok (xAI) API
 */
async function generateWithGrok(prompt) {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
            model: settings.model || 'grok-2-latest',
            messages: [
                { role: 'system', content: 'You are a helpful assistant that writes personalized LinkedIn messages.' },
                { role: 'user', content: prompt }
            ],
            max_tokens: 300,
            temperature: 0.7
        })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `Grok API error: ${response.status}`);
    }

    const data = await response.json();
    return cleanResponse(data.choices[0]?.message?.content || '');
}

/**
 * Build the AI prompt
 * @param {Object} profileData - Profile data
 * @returns {string} Prompt
 */
function buildPrompt(profileData) {
    const { name, headline, company, recentActivitySnippet, featuredHighlight, about } = profileData;

    let contextSection = '';

    if (name) {
        contextSection += `Name: ${name}\n`;
    }

    if (headline) {
        contextSection += `Headline: ${headline}\n`;
    }

    if (company) {
        contextSection += `Current Role/Company: ${company}\n`;
    }

    if (about) {
        contextSection += `About/Bio: ${about.substring(0, 500)}\n`;
    }

    if (recentActivitySnippet) {
        contextSection += `Recent Activity Snippet (post/comment): ${recentActivitySnippet}\n`;
    }

    if (featuredHighlight) {
        contextSection += `Achievement or Highlight: ${featuredHighlight}\n`;
    }

    // Build examples from user settings and learned styles
    let examplesSection = '';
    const userSamples = settings.sampleMessages.filter(m => m && m.trim().length > 0);
    const learnedSamples = settings.learnedMessages || [];

    // Combine samples, prioritizing user written ones, then recent learned ones
    // Take max 3 manual samples and max 2 learned samples to keep prompt concise
    const examples = [
        ...userSamples.slice(0, 3),
        ...learnedSamples.slice(-2)
    ];

    if (examples.length > 0) {
        examplesSection = `
Here are some examples of messages written by the user. 
Analyze their tone, brevity, and style. Mimic this style exactly.

${examples.map((msg, i) => `Example ${i + 1}:\n"${msg}"`).join('\n\n')}
`;
    }

    return `You are writing a short LinkedIn message that feels 100% human.

The user is viewing this person's LinkedIn profile and wants to send a message.

Context available:

${contextSection}
${examplesSection}

Instructions:

- Write a message that sounds like a real person, not AI.
- MIMIC THE STYLE and TONE of the examples provided above (if any).
- Keep it short (2–4 lines max).
- Mention ONLY what is actually present in the context.
- Do NOT overpraise or sound fake.
- Do NOT ask random or generic questions.
- Only ask a question if it naturally fits the activity shown.
- If recentActivitySnippet is empty, do NOT invent anything.
  Just write a simple profile-based opener.
- Avoid corporate phrases like:
  "Hope you're doing well"
  "I wanted to reach out"
  "Touching base"
  "Hope this finds you well"
  "I'd love to connect"
  "Reaching out because"
- End smoothly without forcing a call-to-action (unless the examples typically do).
- Do NOT start with "Hey" followed immediately by their name (too common in cold outreach).
- Be conversational but professional.

Output ONLY the final LinkedIn message. No explanations, no quotes around the message.`;
}

/**
 * Build raw profile context string for Read Mode
 */
function buildProfileContextString(profileData) {
    const { name, headline, company, recentActivitySnippet, featuredHighlight, about } = profileData;
    let context = '';

    if (name) context += `Name: ${name}\n`;
    if (headline) context += `Headline: ${headline}\n`;
    if (company) context += `Current Role/Company: ${company}\n`;
    if (about) context += `About/Bio: ${about}\n`;
    if (recentActivitySnippet) context += `Recent Activity Snippet: ${recentActivitySnippet}\n`;
    if (featuredHighlight) context += `Achievement/Highlight: ${featuredHighlight}\n`;

    return context;
}

/**
 * Build a fallback message when AI is not available
 * @param {Object} profileData - Profile data
 * @returns {string} Template-based message
 */
function buildFallbackMessage(profileData) {
    const { name, headline, company, recentActivitySnippet, featuredHighlight } = profileData;

    const firstName = name ? name.split(' ')[0] : '';

    if (recentActivitySnippet && recentActivitySnippet.length > 20) {
        const activityPreview = recentActivitySnippet.substring(0, 50);
        return `${firstName}, saw your recent post about "${activityPreview}..." - really interesting perspective. Would be great to connect.`;
    }

    if (featuredHighlight) {
        return `${firstName}, noticed your work on "${featuredHighlight}" - impressive stuff. Would be great to exchange ideas sometime.`;
    }

    if (company && headline) {
        const isFounder = headline.toLowerCase().includes('founder') || headline.toLowerCase().includes('ceo');
        return `${firstName}, your background in ${isFounder ? 'building' : 'the'} ${company.includes(' at ') ? company.split(' at ')[1] : company} caught my attention. Would love to connect.`;
    }

    if (headline) {
        return `${firstName}, your work as ${headline.split('|')[0].trim()} looks interesting. Would be great to connect.`;
    }

    return `${firstName}, came across your profile and found your background interesting. Would be great to connect.`;
}

/**
 * Clean up AI response
 * @param {string} response - Raw AI response
 * @returns {string} Cleaned message
 */
function cleanResponse(response) {
    if (!response) return '';

    let cleaned = response.trim();

    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
        (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
        cleaned = cleaned.slice(1, -1);
    }

    const prefixesToRemove = [
        'Here is the message:',
        'Here\'s the message:',
        'Message:',
        'Draft:',
        'Here is your message:',
        'Here\'s your message:'
    ];

    for (const prefix of prefixesToRemove) {
        if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
            cleaned = cleaned.substring(prefix.length).trim();
        }
    }

    return cleaned;
}

/**
 * Show loading state in message tab
 */
function showMessageLoading() {
    elements.messageEmpty.classList.add('hidden');
    elements.messageContent.classList.add('hidden');
    elements.messageLoading.classList.remove('hidden');
}

/**
 * Show empty state in message tab
 */
function showMessageEmpty() {
    elements.messageLoading.classList.add('hidden');
    elements.messageContent.classList.add('hidden');
    elements.messageEmpty.classList.remove('hidden');
}

/**
 * Show generated message
 * @param {string} message - Generated message
 */
function showGeneratedMessage(message) {
    elements.messageLoading.classList.add('hidden');
    elements.messageEmpty.classList.add('hidden');
    elements.messageContent.classList.remove('hidden');

    elements.messageText.textContent = message;
    elements.messageMeta.textContent = 'Just now';
}

/**
 * Handle copy button click
 */
async function handleCopyClick() {
    const message = elements.messageText.textContent || currentGeneratedMessage;
    if (!message) return;

    try {
        await navigator.clipboard.writeText(message);

        // Learn from edit if changed
        if (currentGeneratedMessage && message !== currentGeneratedMessage) {
            await learnFromEdit(currentGeneratedMessage, message);
        }

        // Update button state
        const btn = elements.copyBtn;
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Copied!
    `;
        btn.classList.add('copied');

        showToast('Message copied to clipboard!', 'success');

        // Reset button
        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.classList.remove('copied');
        }, 2000);

    } catch (error) {
        console.error('[SidePanel] Copy failed:', error);
        showToast('Failed to copy. Please try again.', 'error');
    }
}

/**
 * Handle insert button click - inserts message into LinkedIn chat
 */
/**
 * Handle "Copy & Open Chat" button click
 * Safe workflow: Copies to clipboard first, then opens chat window for manual pasting
 */
async function handleCopyAndOpenChat() {
    const message = elements.messageText.textContent || currentGeneratedMessage;
    if (!message) {
        showToast('No message to copy', 'error');
        return;
    }

    if (!currentTabId) {
        showToast('LinkedIn tab not found', 'error');
        return;
    }

    // Learn from edit if changed
    if (currentGeneratedMessage && message !== currentGeneratedMessage) {
        await learnFromEdit(currentGeneratedMessage, message);
    }

    const btn = elements.insertBtn;
    const originalHTML = btn.innerHTML;

    try {
        // 1. Copy to clipboard FIRST (Success is critical here)
        await navigator.clipboard.writeText(message);

        btn.disabled = true;
        btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10"/>
      </svg>
      Opening chat...
    `;

        // 2. Try to open the chat
        const openResult = await chrome.scripting.executeScript({
            target: { tabId: currentTabId },
            func: openChatWindow
        });

        if (openResult && openResult[0]?.result?.clicked) {
            btn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                Chat Opened!
            `;
            showToast('Message copied! Paste it into the chat.', 'success');
        } else {
            btn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copied!
            `;
            showToast('Message copied! Could not auto-open chat.', 'success');
        }

    } catch (error) {
        console.error('[SidePanel] Copy/Open failed:', error);
        showToast('Failed to copy. Please copy manually.', 'error');
        btn.innerHTML = originalHTML;
    } finally {
        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }, 2500);
    }
}

/**
 * Update status indicator
 * @param {string} status - Status type: 'ready', 'loading', 'warning', 'error'
 * @param {string} text - Status text
 */
function updateStatus(status, text) {
    const dot = elements.statusIndicator.querySelector('.status-dot');
    const statusText = elements.statusIndicator.querySelector('.status-text');

    dot.className = 'status-dot';
    if (status === 'loading') dot.classList.add('loading');
    if (status === 'warning') dot.classList.add('warning');
    if (status === 'error') dot.classList.add('error');

    statusText.textContent = text;
}

/**
 * Show a toast notification
 * @param {string} message - Toast message
 * @param {string} type - Toast type: 'success' or 'error'
 */
function showToast(message, type = 'success') {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    // Create new toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Show toast
    requestAnimationFrame(() => {
        toast.classList.add('visible');
    });

    // Hide and remove toast
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add CSS for spin animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .spin {
    animation: spin 1s linear infinite;
  }
`;
document.head.appendChild(style);

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initialize);
